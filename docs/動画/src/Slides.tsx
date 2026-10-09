import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Booth, SCENES, START } from "./Booth";
import { END_FADE } from "./scenes";
import { C, sec } from "./theme";

// 1分ピッチ用のスライド（お試し）。動画（Booth）の場面を、テロップと画面がそろった瞬間で止めて1枚ずつ切り出す。
// at は場面の頭から何秒後で止めるか。スマホ画面に何が映るかは src/footage.ts の cuts で決まる
export const SLIDES: { id: string; at: number }[] = [
  { id: "hook", at: 5.0 }, // 迷い
  { id: "logo", at: 3.5 }, // Overlai／重ねる前に、重ねて見る。
  { id: "register", at: 4.5 }, // 撮って登録（商品名と成分が埋まったところ）
  { id: "scan", at: 2.5 }, // 店では撮るだけ（成分表示を構えたところ）
  { id: "yellow", at: 1.6 }, // 🟡 カロナールA と家のイブA錠
  { id: "red", at: 4.3 }, // 🔴 顔への使用に注意（家のステロイド外用薬）
  { id: "evidence", at: 3.0 }, // 根拠と出典
  { id: "routine", at: 2.0 }, // 使う順番
  { id: "personal", at: 6.4 }, // 悩みを踏まえたAIのアドバイス
  { id: "pillars", at: 5.5 }, // 目指すこと
  { id: "end", at: 4.0 }, // 締め（QR）
];

// 動画をずらして置き、このフレームでちょうど目当ての瞬間が映るようにする
// （Freeze だと、中の場面の切り替え〈TransitionSeries〉が止まらなかった）
export const Slides = () => {
  const frame = useCurrentFrame();
  const s = SLIDES[frame];
  return (
    <Sequence from={frame - (START[s.id] + sec(s.at))}>
      <Booth />
    </Sequence>
  );
};

// スライドに貼る動画（PowerPoint 版）。場面を1つずつ、前後のつなぎを含めずに書き出す。
// つなぎはスライドの切り替えが受け持つ。締めは最後に白へ抜ける部分を落とし、QR が映ったまま止める
export const CLIPS = SLIDES.map(({ id }, i) => {
  const s = SCENES.find((x) => x.id === id)!;
  return { name: `Clip-${String(i + 1).padStart(2, "0")}-${id}`, id, d: id === "end" ? s.d - END_FADE : s.d };
});

export const Clip = ({ id }: { id: string }) => {
  const s = SCENES.find((x) => x.id === id)!;
  return <AbsoluteFill style={{ background: C.white }}>{s.el(s.d)}</AbsoluteFill>;
};
