import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { isSameSite, maxRequests } from '../lib/guard';

/**
 * APIの入口 — 自分のサイトからの呼び出しだけを通す
 *
 * 本番の判定なので、`NODE_ENV` を production に見せかけて確かめる。
 * 開発中は素通りさせる作りなので、そのままだと何も検査していないことになる。
 */

function request(headers: Record<string, string>): Request {
  return new Request('https://overlai-delta.vercel.app/api/analyze', {
    method: 'POST',
    headers,
  });
}

function asProduction<T>(run: () => T): T {
  const before = process.env.NODE_ENV;
  // 型の上では読み取り専用だが、実体はただの環境変数
  (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
  try {
    return run();
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = before;
  }
}

const HOST = 'overlai-delta.vercel.app';

describe('呼び出し元の検査', () => {
  it('自分のサイトからの呼び出しは通す', () => {
    const ok = asProduction(() =>
      isSameSite(request({ host: HOST, origin: `https://${HOST}` })),
    );
    assert.equal(ok, true);
  });

  it('Origin が無くても Referer が自分なら通す', () => {
    const ok = asProduction(() =>
      isSameSite(request({ host: HOST, referer: `https://${HOST}/scan` })),
    );
    assert.equal(ok, true);
  });

  it('別のサイトからの呼び出しは断る', () => {
    const ok = asProduction(() =>
      isSameSite(request({ host: HOST, origin: 'https://evil.example.com' })),
    );
    assert.equal(ok, false);
  });

  it('Origin も Referer も無い呼び出し（curl など）は断る', () => {
    assert.equal(asProduction(() => isSameSite(request({ host: HOST }))), false);
  });

  it('壊れた Origin は断る', () => {
    const ok = asProduction(() => isSameSite(request({ host: HOST, origin: 'not a url' })));
    assert.equal(ok, false);
  });

  it('開発中は素通りさせる', () => {
    assert.equal(isSameSite(request({ host: HOST })), true);
  });
});

describe('回数の上限', () => {
  function withEnv<T>(value: string | undefined, run: () => T): T {
    const before = process.env.GUARD_MAX_REQUESTS;
    if (value === undefined) delete process.env.GUARD_MAX_REQUESTS;
    else process.env.GUARD_MAX_REQUESTS = value;
    try {
      return run();
    } finally {
      if (before === undefined) delete process.env.GUARD_MAX_REQUESTS;
      else process.env.GUARD_MAX_REQUESTS = before;
    }
  }

  it('既定は 30回/10分', () => {
    assert.equal(withEnv(undefined, maxRequests), 30);
  });

  it('展示のあいだは環境変数で広げられる', () => {
    assert.equal(withEnv('120', maxRequests), 120);
  });

  it('壊れた値は既定に戻す（0・負数・文字列）', () => {
    assert.equal(withEnv('0', maxRequests), 30);
    assert.equal(withEnv('-5', maxRequests), 30);
    assert.equal(withEnv('many', maxRequests), 30);
  });
});
