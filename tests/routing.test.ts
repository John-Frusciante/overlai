import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * URLのクエリを描画中に `window.location` から読んでいないこと
 *
 * Next の app-router は履歴の書き換えを `useInsertionEffect` で行う（`HistoryUpdater`）。
 * つまり URL が変わるのはコミット時であり、**描画中の `window.location` は遷移前を指す**。
 * 一覧の鉛筆から編集画面へ移ったときに `?id=` が取れず、編集のつもりが新規追加に
 * なっていたのはこれが原因だった。
 *
 * クエリは `useSearchParams()` から受け取る。ルーターが持つ正規のURLを見るので、
 * 描画のどの時点でも正しい。
 */

const APP = join(process.cwd(), 'app');

/** 注釈はコードではない。「読むな」と書いてある文まで拾ってしまうので落とす */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith('.tsx') || name.endsWith('.ts') ? [path] : [];
  });
}

describe('URLのクエリの読み方', () => {
  it('app/ 以下で window.location.search を読んでいない', () => {
    const offenders = tsxFiles(APP).filter((path) =>
      /window\.location\.search/.test(stripComments(readFileSync(path, 'utf8'))),
    );
    assert.deepEqual(
      offenders.map((p) => p.replace(process.cwd() + '/', '')),
      [],
      'クエリは useSearchParams() から受け取ること（描画中の window.location は遷移前を指す）',
    );
  });

  it('useSearchParams を使う画面は Suspense の内側に置いている', () => {
    for (const path of tsxFiles(APP)) {
      const source = stripComments(readFileSync(path, 'utf8'));
      if (!source.includes('useSearchParams')) continue;
      assert.ok(
        source.includes('<Suspense'),
        `${path.replace(process.cwd() + '/', '')} に Suspense がありません（静的に書き出せなくなります）`,
      );
    }
  });
});
