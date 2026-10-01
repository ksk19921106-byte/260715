const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { NextRequest } = require('next/server');
function load(file, mocks = {}, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name), process: { env }, URL, console });
  return module.exports;
}
const policy = load('app/services/accountPolicy.ts');
const flow = load('app/services/invoiceWorkflow.ts');
assert.equal(policy.loginEmail(' Sally '), 'sally@icbanq.com');
assert.equal(policy.loginEmail('Tommy_G'), 'tommy_g@icbanq.com');
for (const invalid of ['sally@icbanq.com', '../admin', '', '한글', 'a b']) assert.equal(policy.loginEmail(invalid), null);
assert.equal(policy.mustChangePassword({}), true);
assert.equal(policy.mustChangePassword({ portal_password_initialized: true }), false);
assert.equal(policy.mustChangePassword({ portal_password_initialized: true, portal_password_reset_required: true }), true);
assert.equal(policy.passwordProblem('Initial999999', 'NewPassword9999'), null);
for (const value of ['short1', 'onlyletterslong', 'Initial999999']) assert.ok(policy.passwordProblem('Initial999999', value));
for (const value of ['//evil.invalid', '/\\evil.invalid', '/\n/evil.invalid']) assert.equal(policy.safeAccountNext(value), '/');
assert.equal(policy.safeAccountNext('/month-end?x=1'), '/month-end?x=1');
const order = { id: '1', companyId: 'a', label: 'part', supply: 100, vat: 10, linked: 0 };
const draft = { mode: 'orders', companyId: 'a', orderIds: ['1'], title: 'parts', date: '2026-09-22', supply: 0, vat: 0, note: '' };
assert.equal(flow.draftProblem(draft, [order]), null);
assert.ok(flow.draftProblem({ ...draft, orderIds: [] }, [order]));
assert.ok(flow.draftProblem({ ...draft, orderIds: ['1', '1'] }, [order]));
assert.ok(flow.draftProblem(draft, [{ ...order, linked: 10 }]));
assert.ok(flow.draftProblem({ ...draft, companyId: 'b' }, [order]));
assert.equal(flow.draftProblem({ ...draft, mode: 'advance', orderIds: [], supply: 100, vat: 10 }, []), null);
assert.ok(flow.draftProblem({ ...draft, mode: 'advance', orderIds: [], supply: Infinity }, []));
const invoice = { id: 'i1', companyId: 'a', total: 110, title: 'parts', allocations: [] };
assert.equal(flow.allocationProblem(invoice, order, 30), null);
assert.ok(flow.allocationProblem(invoice, order, 111));
assert.ok(flow.allocationProblem(invoice, { ...order, companyId: 'b' }, 30));
assert.ok(flow.allocationProblem(invoice, { ...order, linked: 100 }, 30));
assert.ok(flow.allocationProblem(invoice, order, NaN));
assert.ok(flow.allocationProblem(invoice, order, 0.5));
assert.equal(flow.invoiceAvailable({ ...invoice, allocations: [{ orderId: '1', amount: 30 }] }), 80);

const env = { NEXT_PUBLIC_OPS_AUTH_MODE: 'supabase', NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public', SUPABASE_SERVICE_ROLE_KEY: 'test-private' };
const activeUser = { id: 'employee-1', email: 'sally@icbanq.com', app_metadata: {} };
const chain = value => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return value; } });
async function testProxy() {
  let user = activeUser;
  let profile = { data: { active: true } };
  const mocks = { './app/services/accountPolicy': policy, '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) }, from: () => chain(profile) }) } };
  const proxy = load('proxy.ts', mocks, env).proxy;
  const run = path => proxy(new NextRequest(`https://portal.example.invalid${path}`));
  assert.equal((await run('/api/requests')).status, 403);
  const redirect = await run('/month-end');
  assert.equal(redirect.status, 307);
  assert.match(redirect.headers.get('location'), /account\/password/);
  assert.equal((await run('/account/password')).status, 200);
  assert.equal((await run('/api/auth/password')).status, 200);
  user = { ...activeUser, app_metadata: { portal_password_initialized: true } };
  assert.equal((await run('/api/requests')).status, 200);
  profile = { data: null };
  assert.equal((await run('/api/requests')).status, 403);
  assert.equal((await run('/api/auth/logout')).status, 200);
  user = null;
  assert.equal((await run('/api/requests')).status, 401);
  const misconfigured = load('proxy.ts', mocks, { NEXT_PUBLIC_OPS_AUTH_MODE: 'supabase' }).proxy;
  assert.equal((await misconfigured(new NextRequest('https://portal.example.invalid/'))).status, 503);
}
async function testPasswordRoute() {
  let verified = true, active = true, hasUser = true, updated = null, updateError = false;
  const server = { auth: { getUser: async () => ({ data: { user: hasUser ? activeUser : null } }), signOut: async () => ({ error: null }) }, from: () => chain({ data: active ? { active: true } : null }) };
  const mocks = {
    '../../../lib/supabase/server': { createClient: async () => server },
    '../../../services/authMode': { isLiveAuthEnabled: () => true },
    '../../../services/accountPolicy': policy,
    '@supabase/supabase-js': { createClient: (_url, key) => key === 'test-private' ? { auth: { admin: { updateUserById: async (id, values) => { updated = { id, values }; return { error: updateError ? new Error('failed') : null }; } } } } : { auth: { signInWithPassword: async () => ({ error: verified ? null : new Error('wrong'), data: { user: verified ? activeUser : null } }), signOut: async () => ({ error: null }) } } }
  };
  const post = load('app/api/auth/password/route.ts', mocks, env).POST;
  const request = (origin = 'https://portal.example.invalid', body = { currentPassword: 'Initial999999', newPassword: 'NewPassword9999' }) => new NextRequest('https://portal.example.invalid/api/auth/password', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post(request('https://evil.invalid'))).status, 403);
  assert.equal(updated, null);
  hasUser = false; assert.equal((await post(request())).status, 401); hasUser = true;
  active = false; assert.equal((await post(request())).status, 403); active = true;
  verified = false; assert.equal((await post(request())).status, 400); assert.equal(updated, null); verified = true;
  assert.equal((await post(request(undefined, { currentPassword: 'x', newPassword: 'short' }))).status, 400);
  assert.equal((await post(request())).status, 200);
  assert.equal(updated.id, activeUser.id);
  assert.equal(updated.values.password, 'NewPassword9999');
  assert.equal(updated.values.app_metadata.portal_password_initialized, true);
  assert.equal(updated.values.app_metadata.portal_password_reset_required, false);
  updateError = true; assert.equal((await post(request())).status, 400);
  const unavailable = load('app/api/auth/password/route.ts', mocks, {}).POST;
  assert.equal((await unavailable(request())).status, 503);
}
(async () => { await testProxy(); await testPasswordRoute(); console.log('PASS: invoice selection/allocation, name login, password validation, initial-password access gate, account status, CSRF, current-password verification and server-only metadata update'); })().catch(error => { console.error(error); process.exitCode = 1; });
