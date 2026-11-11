const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'unit-test-secret'; // unit tests never read the real .env secret

const AuthController = require('../../controllers/authController');

describe('validateLoginInput', () => {
  const cases = [
    [{}, 'Email is required'],
    [{ email: 'a@b.co' }, 'Password is required'],
    [{ email: 'not-an-email', password: 'x' }, 'Please provide a valid email address'],
  ];
  for (const [input, message] of cases) {
    test(`${JSON.stringify(input)} -> "${message}"`, () => {
      assert.equal(AuthController.validateLoginInput(input), message);
    });
  }

  test('accepts a well-formed email and password', () => {
    assert.ok(!AuthController.validateLoginInput({ email: 'a@b.co', password: 'longenough' }));
  });
});

describe('tokens', () => {
  const user = { id: 7, name: 'T', email: 't@example.com', role: 'ADMIN' };

  test('access token carries the role the frontend middleware reads', () => {
    const token = AuthController.generateAccessToken(AuthController.createUserDataObject(user));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(payload.id, 7);
    assert.equal(payload.role, 'ADMIN');
    assert.ok(payload.exp > payload.iat);
  });

  test('refresh token carries only the user id', () => {
    const payload = jwt.verify(AuthController.generateRefreshToken(7), process.env.JWT_SECRET);
    assert.equal(payload.id, 7);
    assert.equal(payload.role, undefined);
  });

  test('createUserDataObject never leaks the password hash', () => {
    const data = AuthController.createUserDataObject({ ...user, passwordHash: 'secret' });
    assert.deepEqual(Object.keys(data).sort(), ['email', 'id', 'name', 'role']);
  });
});

describe('getCookieOptions', () => {
  let saved;
  beforeEach(() => { saved = process.env.MAIN_DOMAIN; });
  afterEach(() => {
    if (saved === undefined) delete process.env.MAIN_DOMAIN;
    else process.env.MAIN_DOMAIN = saved;
  });

  test('auth cookies are httpOnly and cross-site capable', () => {
    const opts = AuthController.getCookieOptions(1000);
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.secure, true);
    assert.equal(opts.sameSite, 'none');
    assert.equal(opts.maxAge, 1000);
    assert.equal(opts.path, '/');
  });

  test('cookie domain follows MAIN_DOMAIN, defaulting to localhost', () => {
    delete process.env.MAIN_DOMAIN;
    assert.equal(AuthController.getCookieOptions(1).domain, 'localhost');
    process.env.MAIN_DOMAIN = '.tutelage.krd';
    assert.equal(AuthController.getCookieOptions(1).domain, '.tutelage.krd');
  });
});
