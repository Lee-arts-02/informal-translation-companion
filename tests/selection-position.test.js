import test from 'node:test';
import assert from 'node:assert/strict';
import { placeToolbar } from '../selection-position.js';

test('toolbar sits immediately above selected words, not the editor boundary', () => {
  const result = placeToolbar({ left: 200, right: 300, top: 400, bottom: 425 }, { width: 300, height: 70 }, { left: 0, top: 0, width: 1000, height: 800 });
  assert.equal(result.top, 320); assert.equal(result.left, 100); assert.equal(result.side, 'above');
});
test('viewport edges clamp horizontally and flip below when above cannot fit', () => {
  const viewport = { left: 0, top: 0, width: 320, height: 640 };
  const result = placeToolbar({ left: 3, right: 40, top: 20, bottom: 42 }, { width: 300, height: 100 }, viewport);
  assert.equal(result.left, 10); assert.equal(result.top, 52); assert.equal(result.side, 'below');
  const right = placeToolbar({ left: 300, right: 318, top: 400, bottom: 420 }, { width: 300, height: 70 }, viewport);
  assert.equal(right.left, 10); assert(right.top + 70 < 400);
});
test('visual viewport offsets and tight vertical space stay within the visible screen', () => {
  const result = placeToolbar({ left: 150, right: 200, top: 250, bottom: 280 }, { width: 250, height: 100 }, { left: 50, top: 200, width: 300, height: 160 });
  assert(result.left >= 60); assert(result.left + 250 <= 340);
  assert(result.top >= 210); assert(result.top + 100 <= 350);
});
