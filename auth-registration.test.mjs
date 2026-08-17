import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('./admin/vite.config.js', import.meta.url), 'utf8');
const databaseRules = JSON.parse(readFileSync(new URL('./database.rules.json', import.meta.url), 'utf8'));

test('registration has a confirmation-password field', () => {
  assert.match(html, /id="auth-inp-pass-confirm"/);
});

test('registration uses a technical @wiem.click address instead of asking for an email', () => {
  assert.match(html, /const fakeEmail = username \+ '@wiem\.click';/);
  assert.match(html, /id="auth-inp-email" type="text"/);
});

test('registration always starts with a standard user role', () => {
  assert.match(html, /const role = 'user';/);
  assert.doesNotMatch(html, /username === ADMIN_USERNAME/);
});

test('only an existing admin role can read or write all admin data', () => {
  const adminRule = "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'";
  assert.equal(databaseRules.rules['.read'], adminRule);
  assert.equal(databaseRules.rules['.write'], adminRule);
});

test('player reports can be created by players but read and moderated only by an admin', () => {
  assert.ok(databaseRules.rules.playerReports)
  assert.equal(databaseRules.rules.playerReports['.read'], "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'")
});

test('question library is readable by the game but writable only by an admin', () => {
  const adminRule = "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'";
  assert.equal(databaseRules.rules.questions['.read'], true);
  assert.equal(databaseRules.rules.questions['.write'], adminRule);
});

test('the game refreshes its question library from Firebase', () => {
  assert.match(html, /async function loadQuestionLibrary\(\)/);
  assert.match(html, /\$\{DB_URL\}\/questions\.json/);
  assert.match(html, /QS\.splice\(0, QS\.length, \.\.\.approvedQuestions\)/);
});

test('game lets a player report another player with an optional moderation reason', () => {
  assert.match(html, /function openPlayerReport\(\)/);
  assert.match(html, /function submitPlayerReport\(\)/);
  assert.match(html, /playerReports\.json/);
  for (const reason of ['obraźliwa nazwa', 'oszustwo', 'trolling']) assert.match(html, new RegExp(reason));
});

test('admin buttons open the separately deployed React panel', () => {
  assert.match(html, /id="dh-admin-btn"[^>]*onclick="location\.href='\.\/admin\/'"/);
  assert.match(html, /id="auth-admin-btn"[^>]*onclick="location\.href='\.\/admin\/'"/);
  assert.match(viteConfig, /base:\s*'\/alphaWiemGame2\.0\/admin\/'/);
});

test('desktop header has signed-in account controls', () => {
  assert.match(html, /id="dh-auth-logged-out"/);
  assert.match(html, /id="dh-auth-logged-in"/);
  assert.match(html, /id="dh-admin-btn"/);
  assert.match(html, /const desktopOut\s*=\s*\$\('dh-auth-logged-out'\)/);
});

test('successful authentication immediately refreshes the signed-in interface', () => {
  assert.match(html, /let authenticatedUser;/);
  assert.match(html, /window\._onAuthStateChanged\(authenticatedUser\)/);
});

test('registration rejects unequal passwords before creating an account', () => {
  assert.match(html, /Hasła nie są takie same/);
  assert.match(html, /pass !== passConfirm/);
});
