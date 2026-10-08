// 文の切れ目に入る「ザザッ」という息のノイズを消す（ノイズゲート）。
// Gemini TTS は文の間に -55dB 前後の高い音域のノイズ（息継ぎ）を入れてくる。
// 10ミリ秒ごとに音量を測り、THRESHOLD より小さい区間が MIN_RUN 以上続いたら無音にする。
// 境目はプツッと鳴らないよう FADE だけかけて落とす。
//   node scripts/gate.mjs public/narration/*.wav   … 既存の wav をその場で処理する
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const THRESHOLD = -45; // dB（話し声はおおむね -35dB より大きい）
const MIN_RUN = 0.08; // 秒。これより短い小さな区間は、語尾の減衰とみなして残す
const FADE = 0.008; // 秒

/** 16bit モノラル PCM を受け取り、ゲートをかけた PCM を返す */
export function gate(pcm, rate) {
  const n = pcm.length / 2;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = pcm.readInt16LE(i * 2) / 32768;

  const win = Math.round(rate * 0.01);
  const quiet = [];
  for (let w = 0; w * win < n; w++) {
    let sum = 0;
    const end = Math.min(n, (w + 1) * win);
    for (let i = w * win; i < end; i++) sum += s[i] * s[i];
    quiet.push(10 * Math.log10(sum / (end - w * win) + 1e-12) < THRESHOLD);
  }

  const gain = new Float32Array(n).fill(1);
  const fade = Math.round(rate * FADE);
  for (let w = 0; w < quiet.length; ) {
    if (!quiet[w]) { w++; continue; }
    let e = w;
    while (e < quiet.length && quiet[e]) e++;
    if ((e - w) * win >= MIN_RUN * rate) {
      const a = w * win, b = Math.min(n, e * win);
      for (let i = a; i < b; i++) {
        // 区間の端だけなめらかに落とし、真ん中は無音にする
        const edge = Math.min(i - a, b - 1 - i);
        gain[i] = edge < fade ? 1 - edge / fade : 0;
      }
    }
    w = e;
  }

  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(s[i] * gain[i] * 32767), i * 2);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of process.argv.slice(2)) {
    const b = readFileSync(file);
    const rate = b.readUInt32LE(24);
    writeFileSync(file, Buffer.concat([b.subarray(0, 44), gate(b.subarray(44), rate)]));
    console.log(`ゲート済み: ${file}`);
  }
}
