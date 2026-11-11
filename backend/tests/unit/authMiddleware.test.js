const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { isAuthenticated, isAdmin, isMainManager } = require('../../middlewares/auth');
const { mockReq, mockRes } = require('../helpers');

const run = async (middleware, req) => {
  const res = mockRes();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

describe('isAuthenticated (paths that never reach the database)', () => {
  test('rejects a request with no token', async () => {
    const { res, nextCalled } = await run(isAuthenticated, mockReq());
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  test('rejects a malformed bearer token', async () => {
    const { res, nextCalled } = await run(isAuthenticated, mockReq({ headers: { Authorization: 'Bearer not.a.jwt' } }));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  test('rejects a malformed cookie token', async () => {
    const { res } = await run(isAuthenticated, mockReq({ cookies: { token: 'garbage' } }));
    assert.equal(res.statusCode, 401);
  });
});

describe('role guards', () => {
  const cases = [
    [isAdmin, 'ADMIN', 'next'],
    [isAdmin, 'MAIN_MANAGER', 'next'],
    [isAdmin, 'USER', 403],
    [isMainManager, 'MAIN_MANAGER', 'next'],
    [isMainManager, 'ADMIN', 403],
  ];

  for (const [mw, role, expected] of cases) {
    test(`${mw.name} with role ${role} -> ${expected}`, async () => {
      const { res, nextCalled } = await run(mw, mockReq({ user: { role } }));
      if (expected === 'next') return assert.equal(nextCalled, true);
      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, expected);
    });
  }

  test('role guards reject an unauthenticated request with 401', async () => {
    for (const mw of [isAdmin, isMainManager]) {
      assert.equal((await run(mw, mockReq())).res.statusCode, 401);
    }
  });
});
