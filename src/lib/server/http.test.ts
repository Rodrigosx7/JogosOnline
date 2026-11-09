import test from 'node:test';
import assert from 'node:assert/strict';
import { sameOrigin } from './http';

test('production origin guard uses the browser-facing Host instead of Next bind address', () => {
  for (const host of ['localhost:3000', '127.0.0.1:3000']) {
    const request = new Request('http://0.0.0.0:3000/api/rooms', {
      method: 'POST', headers: { host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' },
    });
    assert.doesNotThrow(() => sameOrigin(request));
  }
  assert.doesNotThrow(() => sameOrigin(new Request('http://0.0.0.0:3000/api/rooms', {
    headers: { host: 'mesa.example', origin: 'https://mesa.example' },
  })));
});

test('origin guard rejects foreign, malformed and cross-site origins', () => {
  for (const origin of ['https://evil.com', 'null', 'ftp://localhost:3000', 'http://localhost:3000.evil.com', 'http://localhost:3000/path']) {
    assert.throws(() => sameOrigin(new Request('http://0.0.0.0:3000/api/rooms', {
      headers: { host: 'localhost:3000', origin },
    })), { status: 403 });
  }
  assert.throws(() => sameOrigin(new Request('http://0.0.0.0:3000/api/rooms', {
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' },
  })), { status: 403 });
  assert.throws(() => sameOrigin(new Request('http://0.0.0.0:3000/api/rooms', {
    headers: { host: 'localhost:3000@evil.com', origin: 'http://evil.com' },
  })), { status: 403 });
});
