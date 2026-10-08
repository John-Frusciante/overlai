import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// 色はピッチ（docs/ピッチ/build.py）とそろえる
export const C = {
  navy: "#1B2A4A",
  ink: "#0F172A",
  muted: "#475569",
  faint: "#94A3B8",
  pale: "#C9D0DB",
  line: "#D9DFE7",
  mist: "#F2F4F7",
  canvas: "#F5F7FA",
  white: "#FFFFFF",
  blue: "#2563EB",
  amber: "#D97706",
  red: "#DC2626",
};

export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);

export const FONT = "Noto Sans JP";

// フォントが読み終わるまで書き出しを止める（豆腐やフォールバックのまま描かないため）
const waiting = delayRender("Noto Sans JP");
const face = new FontFace(FONT, `url(${staticFile("fonts/NotoSansJP.ttf")}) format("truetype")`, {
  weight: "100 900",
});
face
  .load()
  .then(() => {
    document.fonts.add(face);
    continueRender(waiting);
  })
  .catch((e) => cancelRender(new Error(`フォントが読めない（./fonts.sh を実行）: ${e}`)));
