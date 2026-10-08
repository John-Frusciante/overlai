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
const RATE = 24000; // Gemini TTS は 24kHz・16bit・モノラルの PCM を返す

const env = readFileSync(join(HERE, "../../.env.local"), "utf8");
const key = env.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error(".env.local に GEMINI_API_KEY が無い");

const { voice, lines } = JSON.parse(readFileSync(join(HERE, "narration.json"), "utf8"));
const only = process.argv.slice(2);
mkdirSync(join(HERE, "public/narration"), { recursive: true });

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // モノラル
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
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
  // 文の切れ目の息のノイズを消してから書き出す
  const pcm = gate(Buffer.from(b64, "base64"), RATE);
  writeFileSync(join(HERE, `public/narration/${scene}.wav`), wav(pcm));
  console.log(`${scene}\t${(pcm.length / 2 / RATE).toFixed(2)}秒\t${text}`);
}
