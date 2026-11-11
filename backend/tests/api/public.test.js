// Read-only API tests against the configured database: GET requests and rejected writes only.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('../helpers');

let api;
before(async () => { api = await startApp(); });
after(async () => { await api.close(); });

test('GET /api/status reports healthy', async () => {
  const { status, json } = await api.request('/api/status');
  assert.equal(status, 200);
  assert.equal(json.status, 'healthy');
});

// Two response shapes exist: { data: { <key>: [], pagination } } and { data: [], pagination }.
const nested = (key) => (json) => ({ items: json.data[key], pagination: json.data.pagination });
const flat = (json) => ({ items: json.data, pagination: json.pagination });

const LISTS = [
  ['/api/blogs/paginated', nested('blogs')],
  ['/api/readings/paginated', nested('readings')],
  ['/api/writings/paginated', nested('writings')],
  ['/api/speakings/paginated', nested('speakings')],
  ['/api/audios/paginated', nested('audios')],
  ['/api/videos/paginated', nested('videos')],
  ['/api/stories', nested('stories')],
  ['/api/esl-audios', flat],
  ['/api/esl-videos', flat],
];

describe('page-based pagination', () => {
  for (const [path, listOf] of LISTS) {
    test(`${path}?page=1&limit=3 returns a page and its metadata`, async () => {
      const { status, json } = await api.request(`${path}?page=1&limit=3`);
      assert.equal(status, 200);
      assert.equal(json.success, true);
      const { items, pagination } = listOf(json);
      assert.ok(Array.isArray(items), 'items array');
      assert.ok(items.length <= 3, 'respects limit');
      assert.equal(Number(pagination.currentPage), 1);
      assert.equal(typeof pagination.totalPages, 'number');
      assert.equal(typeof pagination.hasNextPage, 'boolean');
      assert.equal(pagination.hasPrevPage, false);
    });

    test(`${path} page 2 does not repeat page 1`, async (t) => {
      const first = listOf((await api.request(`${path}?page=1&limit=2`)).json);
      if (!first.pagination.hasNextPage) return t.skip('only one page of data');
      const second = listOf((await api.request(`${path}?page=2&limit=2`)).json);
      const ids = new Set(first.items.map((i) => i.id));
      assert.ok(second.items.every((i) => !ids.has(i.id)));
      assert.equal(second.pagination.hasPrevPage, true);
    });

    test(`${path} search with no matches returns an empty page`, async () => {
      const { json } = await api.request(`${path}?page=1&limit=3&search=zzqqxx-no-such-thing`);
      const { items, pagination } = listOf(json);
      assert.deepEqual(items, []);
      assert.equal(pagination.hasNextPage, false);
    });
  }
});

describe('detail endpoints', () => {
  for (const path of ['/api/blogs', '/api/readings', '/api/writings', '/api/speakings', '/api/audios', '/api/stories']) {
    test(`${path}/:id returns 404 for a missing id`, async () => {
      const { status, json } = await api.request(`${path}/999999999`);
      assert.equal(status, 404);
      assert.equal(json.success, false);
    });
  }
});

describe('auth', () => {
  test('GET /api/auth/me without a token is 401', async () => {
    assert.equal((await api.request('/api/auth/me')).status, 401);
  });

  test('POST /api/auth/login validates input', async () => {
    assert.equal((await api.request('/api/auth/login', { method: 'POST', body: {} })).status, 400);
    const badEmail = await api.request('/api/auth/login', { method: 'POST', body: { email: 'x', password: 'y' } });
    assert.equal(badEmail.status, 400);
  });

  test('POST /api/auth/login with unknown credentials is 401 and sets no auth cookie', async () => {
    const res = await api.request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody-e2e@example.com', password: 'wrong-password-123' },
    });
    assert.equal(res.status, 401);
    assert.doesNotMatch(res.headers.get('set-cookie') || '', /\btoken=/);
  });
});

describe('protected endpoints reject anonymous requests', () => {
  // Non-existent ids: even a broken guard could not touch real rows.
  const calls = [
    ['POST', '/api/blogs'],
    ['PUT', '/api/blogs/999999999'],
    ['DELETE', '/api/blogs/999999999'],
    ['POST', '/api/readings'],
    ['DELETE', '/api/stories/999999999'],
    ['GET', '/api/users'], // was public: leaked every user's name, email and role
    ['POST', '/api/auth/register'], // was public and defaulted role to ADMIN
  ];
  for (const [method, path] of calls) {
    test(`${method} ${path} -> 401`, async () => {
      assert.equal((await api.request(path, { method })).status, 401);
    });
  }
});

describe('CORS', () => {
  const originHeader = async (origin) =>
    (await api.request('/api/status', { headers: { Origin: origin } })).headers.get('access-control-allow-origin');

  test('the configured frontend and local dev ports are allowed with credentials', async () => {
    for (const origin of ['http://localhost:3000', 'http://localhost:3100']) {
      assert.equal(await originHeader(origin), origin);
    }
  });

  test('unknown origins get no CORS header', async () => {
    assert.equal(await originHeader('https://evil.example.com'), null);
  });
});

test('compact search returns titled results', async () => {
  const { status, json } = await api.request('/api/search?format=compact&query=english&limit=5&page=1');
  assert.equal(status, 200);
  for (const item of json.results || []) {
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.description, 'string');
  }
});
