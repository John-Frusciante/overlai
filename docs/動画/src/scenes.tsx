import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Media } from "./footage";
import { Mark, Phone, Reveal, Squares, Verdict, Wordmark } from "./parts";
import { C, FONT, sec } from "./theme";

const base = { fontFamily: FONT, color: C.ink } as const;

/** 背景に大きく薄い四角を漂わせる（ロゴの形） */
const Backdrop = ({ tint, side = "right" }: { tint: string; side?: "left" | "right" }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 14;
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <div
        style={{
          position: "absolute",
          [side]: -160,
          top: 60 + drift,
          width: 760,
          height: 760,
          borderRadius: 180,
          background: tint,
          opacity: 0.1,
        }}
      />
      <div
        style={{
          position: "absolute",
          [side]: 160,
          top: 380 - drift,
          width: 760,
          height: 760,
          borderRadius: 180,
          background: tint,
          opacity: 0.07,
        }}
      />
    </AbsoluteFill>
  );
};

/** 左上の小さなロゴ（ブースで途中から見た人にも名前が見えるように） */
const Corner = () => (
  <div style={{ position: "absolute", left: 96, top: 72 }}>
    <Wordmark size={34} />
  </div>
);

// ---------------------------------------------------------------- 1. 迷い

/** 吹き出し。tail は、しっぽを付ける位置（吹き出しの幅に対する割合） */
const Bubble = ({ text, delay, x, y, tail }: { text: string; delay: number; x: number; y: number; tail: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 11, mass: 0.6 } });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${p})`,
        transformOrigin: `${tail * 100}% 120%`,
        padding: "34px 56px",
        borderRadius: 60,
        background: C.white,
        border: `4px solid ${C.navy}`,
        boxShadow: "0 18px 40px rgba(27, 42, 74, 0.12)",
        ...base,
        fontSize: 54,
        fontWeight: 800,
        color: C.navy,
        whiteSpace: "nowrap",
      }}
    >
      {text}
      <div
        style={{
          position: "absolute",
          left: `${tail * 100}%`,
          bottom: -22,
          width: 40,
          height: 40,
          marginLeft: -20,
          background: C.white,
          borderRight: `4px solid ${C.navy}`,
          borderBottom: `4px solid ${C.navy}`,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
};

export const Hook = () => {
  const frame = useCurrentFrame();
  const people = (src: string, x: number, w: number, delay: number) => (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: x,
        bottom: 0,
        width: w,
        transform: `translateY(${interpolate(frame, [delay, delay + 12], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%)`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: C.white }}>
      {people("img/people-1.png", 160, 360, 0)}
      {people("img/people-2.png", 1330, 500, sec(2.3))}
      <Bubble text="家に、同じような薬あったっけ？" x={700} y={300} tail={0.12} delay={sec(1.0)} />
      <Bubble text="薬を塗った肌に、使っていい？" x={1200} y={560} tail={0.82} delay={sec(2.6)} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center" }}>
        <Reveal delay={sec(0.2)}>
          <span style={{ ...base, fontSize: 40, fontWeight: 700, color: C.muted }}>
            薬や化粧品を買うとき、こんな迷いはありませんか？
          </span>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 2. ロゴ

export const Logo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const join = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  const text = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.white, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <Squares size={230} gap={1 - join} />
        <span
          style={{
            ...base,
            fontSize: 190,
            fontWeight: 500,
            color: C.navy,
            opacity: text,
            transform: `translateX(${(1 - text) * -30}px)`,
          }}
        >
          Overlai
        </span>
      </div>
      <div style={{ marginTop: 50 }}>
        <Reveal delay={42}>
          <span style={{ ...base, fontSize: 60, fontWeight: 800, color: C.navy }}>重ねる前に、重ねて見る。</span>
        </Reveal>
      </div>
      <div style={{ marginTop: 22 }}>
        <Reveal delay={52}>
          <span style={{ ...base, fontSize: 32, fontWeight: 500, color: C.muted }}>
            店で撮るだけで、家の薬・化粧品と重ねて判定するアプリ
          </span>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3〜7. 画面を見せる場面

export const Feature = ({
  tag,
  title,
  sub,
  media,
  waiting,
  accent,
  duration,
  extra,
}: {
  tag: string;
  title: ReactNode[];
  sub: string;
  media: Media | null;
  waiting: string;
  accent: string;
  duration: number;
  extra?: ReactNode;
}) => (
  <AbsoluteFill>
    <Backdrop tint={accent} />
    <Corner />
    <div style={{ position: "absolute", left: 140, top: 0, bottom: 0, width: 1000, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Reveal delay={4}>
        <span
          style={{
            ...base,
            display: "inline-block",
            fontSize: 30,
            fontWeight: 700,
            color: C.white,
            background: accent,
            padding: "6px 22px",
            borderRadius: 10,
          }}
        >
          {tag}
        </span>
      </Reveal>
      <div style={{ height: 30 }} />
      {title.map((line, i) => (
        <Reveal key={i} delay={10 + i * 5}>
          <span style={{ ...base, fontSize: 80, fontWeight: 900, lineHeight: 1.32, letterSpacing: "0.01em" }}>{line}</span>
        </Reveal>
      ))}
      <div style={{ height: 28 }} />
      <Reveal delay={10 + title.length * 5 + 6}>
        <span style={{ ...base, fontSize: 36, fontWeight: 500, color: C.muted, lineHeight: 1.6, whiteSpace: "pre-line" }}>{sub}</span>
      </Reveal>
      {extra && <div style={{ marginTop: 44 }}>{extra}</div>}
    </div>
    <div style={{ position: "absolute", right: 200, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
      <Phone media={media} waiting={waiting} accent={accent} duration={duration} />
    </div>
  </AbsoluteFill>
);

export { Mark, Verdict };

/** 自分の言葉で書いた悩み（肌質の設定の「気になっていること」）を、入力欄の形で見せる */
export const NoteCard = ({ text, delay }: { text: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  // 一文字ずつ打ち込まれるように見せる
  const shown = Math.floor(interpolate(frame, [delay + 8, delay + 8 + text.length * 2], [0, text.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
  return (
    <div
      style={{
        width: 820,
        padding: "22px 30px",
        borderRadius: 24,
        background: C.white,
        border: `2px solid ${C.line}`,
        boxShadow: "0 12px 30px rgba(27, 42, 74, 0.08)",
        transform: `translateY(${(1 - p) * 40}px)`,
        opacity: p,
        ...base,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: C.faint }}>気になっていること</div>
      <div style={{ marginTop: 8, fontSize: 30, fontWeight: 500, color: C.ink, lineHeight: 1.6, minHeight: 48 }}>
        {text.slice(0, shown)}
        <span style={{ opacity: Math.floor(frame / 15) % 2 ? 0 : 1, color: C.blue }}>｜</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 8. 目指すこと
// カードはナレーションの「買い重ねる前に／塗り重ねる前に／一緒に飲む前に」に合わせて出す

const Pillar = ({ head, body, delay }: { head: string; body: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  return (
    <div
      style={{
        width: 470,
        padding: "44px 48px",
        borderRadius: 32,
        background: C.white,
        boxShadow: "0 16px 40px rgba(27, 42, 74, 0.08)",
        transform: `translateY(${(1 - p) * 60}px)`,
        opacity: p,
      }}
    >
      <div style={{ ...base, fontSize: 44, fontWeight: 800, color: C.navy }}>{head}</div>
      <div style={{ ...base, marginTop: 18, fontSize: 30, fontWeight: 500, color: C.muted, lineHeight: 1.6, whiteSpace: "pre-line" }}>
        {body}
      </div>
    </div>
  );
};

export const Pillars = () => (
  <AbsoluteFill style={{ background: C.canvas, alignItems: "center", justifyContent: "center" }}>
    <Reveal delay={4}>
      <span style={{ ...base, fontSize: 92, fontWeight: 900, color: C.navy }}>重ねる前に、重ねて見る。</span>
    </Reveal>
    <div style={{ display: "flex", gap: 44, marginTop: 80 }}>
      <Pillar head="買い重ねる前に" body={"もう家にある？\n名前違いの同じ薬は？"} delay={sec(0.4)} />
      <Pillar head="塗り重ねる前に" body={"一緒に使っていい？\nどれを先に塗る？"} delay={sec(2.2)} />
      <Pillar head="一緒に飲む前に" body={"今飲んでいる薬と\n一緒で大丈夫？"} delay={sec(4.0)} />
    </div>
  </AbsoluteFill>
);

// ---------------------------------------------------------------- 9. 締め

/** 締めの最後に白へ抜けるフレーム数。スライドに貼る動画では、ここを切り落とす */
export const END_FADE = 14;

export const End = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  // 最後は白へ抜けて、頭の白い場面へつなげる（ループ再生のため）。
  // 長さは場面の長さで測る（動画全体の長さで測ると、スライドに切り出したときに白く抜けてしまう）
  const out = interpolate(frame, [duration - END_FADE, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: C.white, alignItems: "center", justifyContent: "center" }}>
      <Reveal delay={4}>
        <span style={{ ...base, fontSize: 40, fontWeight: 500, color: C.muted }}>
          店で撮るだけで、家の薬・化粧品と重ねて判定する。
        </span>
      </Reveal>
      <div style={{ marginTop: 50 }}>
        <Reveal delay={12}>
          <Wordmark size={170} />
        </Reveal>
      </div>
      <div style={{ marginTop: 40 }}>
        <Reveal delay={20}>
          <span style={{ ...base, fontSize: 56, fontWeight: 800, color: C.navy }}>重ねる前に、重ねて見る。</span>
        </Reveal>
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 80, ...base, fontSize: 26, color: C.muted, lineHeight: 1.7 }}>
        <div>判定は買い物の目安です。気になるときは薬剤師・医師に相談してください。</div>
        <div style={{ fontWeight: 700 }}>鈴鹿工業高等専門学校　井上 高志・濱田 圭太郎・杉本 隼都</div>
      </div>
      <div style={{ position: "absolute", right: 120, bottom: 70, textAlign: "center" }}>
        <Img src={staticFile("img/qr.png")} style={{ width: 190, height: 190 }} />
        <div style={{ ...base, fontSize: 24, color: C.muted, marginTop: 8 }}>ぜひお試しください</div>
      </div>
      <AbsoluteFill style={{ background: C.white, opacity: out }} />
    </AbsoluteFill>
  );
};
