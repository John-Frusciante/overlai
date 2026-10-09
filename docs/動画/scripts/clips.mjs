// スライド1枚ごとの動画と、その最初のコマ（PowerPoint の表紙画像）を out/clips/ に書き出す。
// 一度だけまとめて（bundle）、Clip-01-hook のような名前の場面を順に書き出す。
//   npm run slides:pptx … ここから PowerPoint づくりまで一度にやる
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import { mkdirSync, rmSync } from "node:fs";

const OUT = "out/clips";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const serveUrl = await bundle({ entryPoint: "src/index.ts" });
const clips = (await getCompositions(serveUrl)).filter((c) => c.id.startsWith("Clip-"));
for (const composition of clips) {
  const name = composition.id.replace(/^Clip-/, "");
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    // Windows・Mac どちらの PowerPoint でも再生できる形にする
    pixelFormat: "yuv420p",
    imageFormat: "jpeg",
    jpegQuality: 95,
    muted: true,
    outputLocation: `${OUT}/${name}.mp4`,
  });
  await renderStill({ composition, serveUrl, frame: 0, output: `${OUT}/${name}.png` });
  console.log(`${name}（${(composition.durationInFrames / composition.fps).toFixed(1)}秒）`);
}
