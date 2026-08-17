import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('registration has a confirmation-password field', () => {
  assert.match(html, /id="auth-inp-pass-confirm"/);
});

test('registration uses a technical @wiem.click address instead of asking for an email', () => {
  assert.match(html, /const fakeEmail = username \+ '@wiem\.click';/);
  assert.match(html, /id="auth-inp-email" type="text"/);
});

test('registration rejects unequal passwords before creating an account', () => {
  assert.match(html, /Hasła nie są takie same/);
  assert.match(html, /pass !== passConfirm/);
});
