export async function checkConnection(apiKey, { fetcher = fetch, signal } = {}) {
  if (!apiKey?.trim()) throw new Error('Add your OpenRouter API key first.');
  const controller = new AbortController(), cancel = () => controller.abort();
  if (signal?.aborted) throw new Error('Connection check cancelled.');
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 10000);
  try {
    const response = await fetcher('https://openrouter.ai/api/v1/key', {
      method: 'GET', headers: { Authorization: `Bearer ${apiKey.trim()}` }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'Your API key was not accepted.' : 'Connection could not be verified. Try again later.');
    const data = await response.json();
    if (!data?.data || typeof data.data !== 'object' || data.error) throw new Error('The provider returned an invalid response.');
    return true;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Connection check cancelled or timed out.');
    if (error instanceof TypeError) throw new Error('Could not reach OpenRouter. Check your connection.');
    if (error instanceof SyntaxError) throw new Error('The provider returned an invalid response.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
