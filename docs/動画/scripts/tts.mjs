// ナレーションを Gemini TTS で読み上げ、public/narration/<scene>.wav に書き出す。
//   node scripts/tts.mjs            … 全部作り直す
//   node scripts/tts.mjs red end    … 指定した場面だけ作り直す
// キーはリポジトリ直下の .env.local の GEMINI_API_KEY を読む（アプリと同じキー。外には出さない）
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gate } from "./gate.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "gemini-3.8-flash-tts";
const RATE = 24000; // 生の PCM で返ってきたときの標本化周波数（24kHz・16bit・モノラル）

const env = readFileSync(join(HERE, "../../.env.local"), "utf8");
const key = env.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error(".env.local に GEMINI_API_KEY が無い");

const { voice, lines } = JSON.parse(readFileSync(join(HERE, "narration.json"), "utf8"));
const only = process.argv.slice(2);
mkdirSync(join(HERE, "public/narration"), { recursive: true });

/**
 * 返ってきた音声から PCM だけを取り出す。
 * モデルによって、生の PCM を返すものと WAV ファイルごと返すものがある。gemini-3.8-flash-tts は後者で、
 * 末尾に生成元を示すメタデータ（IPTC の digitalSourceType など）の塊が付いている。
 * これを PCM として扱うと、頭のヘッダーと末尾のメタデータが「ザッ」という雑音になる（実際になった）。
 */
function pcmFrom(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF") return { pcm: buf, rate: RATE };
  let off = 12, rate = RATE, pcm = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      const channels = buf.readUInt16LE(off + 10);
      const bits = buf.readUInt16LE(off + 22);
      if (channels !== 1 || bits !== 16) throw new Error(`想定外の形式: ${channels}ch ${bits}bit`);
      rate = buf.readUInt32LE(off + 12);
    }
    if (id === "data") pcm = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  if (!pcm) throw new Error("WAV に data が無い");
  return { pcm, rate };
}

function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // モノラル
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 無料枠は1分に3回まで。429 が返ったら、言われた秒数だけ待ってやり直す
async function speak(text) {
  for (;;) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      // 本文だけを渡す。読み方の指示を混ぜると指示まで読み上げ、systemInstruction はこのモデルでは使えない。
      // 声の調子は voice（話者）で選ぶ
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
    });
    if (res.status === 429) {
      const wait = Number((await res.text()).match(/retry in ([\d.]+)s/)?.[1] ?? 30);
      console.log(`  …1分あたりの上限。${Math.ceil(wait)}秒待つ`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }
}

for (const { scene, text } of lines) {
  if (only.length && !only.includes(scene)) continue;
  const data = await speak(text);
  const b64 = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error(`${scene}: 音声が返ってこない ${JSON.stringify(data).slice(0, 300)}`);
  const { pcm: raw, rate } = pcmFrom(Buffer.from(b64, "base64"));
  // 文の切れ目の息のノイズを消してから書き出す
  const pcm = gate(raw, rate);
  writeFileSync(join(HERE, `public/narration/${scene}.wav`), wav(pcm, rate));
  console.log(`${scene}\t${(pcm.length / 2 / rate).toFixed(2)}秒\t${text}`);
}
