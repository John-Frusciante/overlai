import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { coverCrop } from '../lib/image';

/**
 * ガイド枠の切り抜き — 画面の座標を映像の座標へ移す計算
 *
 * ここを間違えると、枠と違う場所を送ることになる。実機では気づきにくいので、
 * 数字で押さえておく。
 */

/** 縦長の画面に、横長の映像を object-cover で表示した状態 */
const video = { width: 1920, height: 1080 };
const display = { x: 0, y: 0, width: 390, height: 844 };

describe('ガイド枠の切り抜き', () => {
  it('画面いっぱいの枠は、映像の高さいっぱいになる', () => {
    // object-cover なので、縦は映像がぴったり収まり、横は左右が切れている
    const crop = coverCrop(video, display, display, 0);
    assert.ok(crop);
    assert.equal(crop!.height, video.height);
    assert.ok(crop!.width < video.width);
  });

  it('中央の枠は、映像の中央を指す', () => {
    const guide = { x: 95, y: 322, width: 200, height: 200 };
    const crop = coverCrop(video, display, guide, 0)!;
    const centerX = crop.x + crop.width / 2;
    const centerY = crop.y + crop.height / 2;
    assert.ok(Math.abs(centerX - video.width / 2) <= 1, `横の中心がずれています: ${centerX}`);
    assert.ok(Math.abs(centerY - video.height / 2) <= 1, `縦の中心がずれています: ${centerY}`);
  });

  it('余白の指定だけ広く取る', () => {
    const guide = { x: 95, y: 322, width: 200, height: 200 };
    const tight = coverCrop(video, display, guide, 0)!;
    const loose = coverCrop(video, display, guide, 0.1)!;
    assert.ok(loose.width > tight.width);
    assert.ok(loose.height > tight.height);
  });

  it('映像からはみ出す枠は、映像の中に収める', () => {
    const guide = { x: -200, y: -200, width: 900, height: 1400 };
    const crop = coverCrop(video, display, guide, 0)!;
    assert.ok(crop.x >= 0 && crop.y >= 0);
    assert.ok(crop.x + crop.width <= video.width);
    assert.ok(crop.y + crop.height <= video.height);
  });

  it('計算が成り立たないときは null を返す（全画面に戻す合図）', () => {
    assert.equal(coverCrop({ width: 0, height: 0 }, display, display), null);
    // 極端に小さい枠は、計算が壊れている合図として扱う
    assert.equal(coverCrop(video, display, { x: 0, y: 0, width: 2, height: 2 }, 0), null);
  });
});
