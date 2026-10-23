"""Browser smoke check. Start a local HTTP server on port 8000 first."""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def run():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1100})
        page = context.new_page()
        errors = []
        requests = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        page.goto(os.environ.get("TEST_URL", "http://127.0.0.1:8000"))
        page.wait_for_load_state("networkidle")
        expect(page.locator("#result-badge")).to_have_text("CURATED DEMO")
        expect(page.locator("#translation")).to_contain_text("something special")
        assert not any("openrouter.ai" in url for url in requests)
        page.locator('[data-register="formal"]').click()
        expect(page.locator("#translation")).to_contain_text("considerably enhanced")
        page.locator('[data-demo="spanish"]').click()
        expect(page.locator("#translation")).to_contain_text("resolve this very quickly")
        expect(page.locator("#source-text")).to_have_attribute("readonly", "")

        page.locator("#open-profile").click()
        page.locator("#new-trait").fill('<img src=x onerror="window.injected=true">')
        page.locator('#trait-form button[type="submit"]').click()
        assert page.locator("#traits img").count() == 0
        assert page.evaluate("window.injected === undefined")
        page.locator('[data-close="profile"]').click()
        page.reload()
        page.locator("#open-profile").click()
        expect(page.locator("#traits")).to_contain_text("window.injected")
        page.keyboard.press("Escape")

        page.locator("#live-mode").click()
        expect(page.locator("#copy")).to_be_disabled()
        page.locator("#translate").click()
        expect(page.locator("#settings")).to_be_visible()
        page.locator("#api-key").fill("browser-test-key")
        page.locator('#settings-form button[type="submit"]').click()
        expect(page.locator("#settings")).not_to_be_visible()
        stored = page.evaluate("JSON.stringify({...localStorage})")
        assert "browser-test-key" not in stored
        assert page.locator("#api-key").input_value() == ""
        page.locator("#source-text").fill("  ")
        page.locator("#translate").click()
        expect(page.locator("#error")).to_contain_text("Enter something")

        payload = {"translation": "Thank you for helping me.", "nuance": "Keeps the gratitude.",
                   "alternatives": {"casual": "Thanks for the help!", "direct": "Thank you.",
                                    "formal": "Thank you for your assistance."}}
        sent = []

        def respond(route):
            sent.append(route.request.post_data_json)
            assert route.request.headers["authorization"] == "Bearer browser-test-key"
            route.fulfill(json={"choices": [{"message": {"content": json.dumps(payload)}}]})

        page.route("https://openrouter.ai/**", respond)
        page.locator("#source-text").fill("Merci de m’aider.")
        page.locator("#source").select_option("French")
        page.locator("#translate").click()
        expect(page.locator("#translation")).to_have_text("Thank you for helping me.")
        expect(page.locator("#result-badge")).to_have_text("LIVE AI")
        page.locator('[data-register="casual"]').click()
        expect(page.locator("#translation")).to_have_text("Thanks for the help!")
        data = json.loads(sent[0]["messages"][1]["content"])
        assert data["source"] == "French" and data["target"] == "English"
        page.locator("#tone").select_option("Natural")
        expect(page.locator("#copy")).to_be_disabled()

        page.unroute("https://openrouter.ai/**")
        page.route("https://openrouter.ai/**", lambda route: route.fulfill(status=401, json={"error": "bad key"}))
        page.locator("#translate").click()
        expect(page.locator("#error")).to_contain_text("key was not accepted")
        expect(page.locator("#translate")).to_be_enabled()
        page.reload()
        page.locator("#live-mode").click()
        page.locator("#translate").click()
        expect(page.locator("#settings")).to_be_visible()
        assert page.locator("#api-key").input_value() == ""
        page.keyboard.press("Escape")
        page.locator("#demo-mode").click()
        screenshot_dir = Path("temp")
        screenshot_dir.mkdir(exist_ok=True)
        page.screenshot(path=str(screenshot_dir / "desktop.png"), full_page=True)
        for width in (390, 320):
            page.set_viewport_size({"width": width, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"Overflow at {width}px"
        page.screenshot(path=str(screenshot_dir / "mobile.png"), full_page=True)
        assert not errors, errors
        browser.close()
        print("Browser smoke checks passed: demo, live request, errors, persistence, XSS, key lifecycle, mobile.")


if __name__ == "__main__":
    run()
