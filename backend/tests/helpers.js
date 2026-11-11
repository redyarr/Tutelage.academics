// Shared helpers for `node --test` suites. No test framework dependency.

/** Boots the Express app on a random port. Call `close()` in `after()`. */
async function startApp() {
  const app = require('../app');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return { status: res.status, json, headers: res.headers };
  };

  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    await require('../models').sequelize.close().catch(() => {});
  };

  return { base, request, close };
}

/** Minimal Express `res` double for middleware/controller unit tests. */
function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    cookies: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this; },
  };
}

/** Minimal Express `req` double. */
function mockReq({ headers = {}, cookies = {}, session = {}, user, body = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: lower, cookies, session, user, body, header: (name) => lower[name.toLowerCase()] };
}

module.exports = { startApp, mockRes, mockReq };
