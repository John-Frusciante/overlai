import type { CSSProperties, ReactNode } from "react";
import {
  Easing,
  Img,
  OffthreadVideo,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Media } from "./footage";
import { C, FONT, sec } from "./theme";

const pop = (frame: number, fps: number, delay: number, damping = 16) =>
  spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });

/** 下からせり上がる文字（行ごとに使う）。delay はフレーム */
export const Reveal = ({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay, 20);
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", ...style }}>
      <div style={{ transform: `translateY(${(1 - p) * 110}%)`, opacity: Math.min(1, p * 1.5) }}>{children}</div>
    </div>
  );
};

/** 蛍光ペンのように、後ろから色が引かれる */
export const Mark = ({ children, delay, color }: { children: ReactNode; delay: number; color: string }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [delay, delay + 14], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${color}, ${color})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${w}% 32%`,
        backgroundPosition: "0 88%",
      }}
    >
      {children}
    </span>
  );
};

/** ロゴと同じ、二つの角丸の四角。gap=0 で重なった形、1 で離れた形 */
export const Squares = ({ size, gap = 0, style }: { size: number; gap?: number; style?: CSSProperties }) => {
  const s = size * 0.56;
  const r = s * 0.24;
  const d = size * 0.25 + gap * size * 0.6;
  const sq = (x: number, y: number, a: number): CSSProperties => ({
    position: "absolute",
    width: s,
    height: s,
    borderRadius: r,
    background: C.navy,
    opacity: a,
    left: size / 2 - s / 2 + x,
    top: size / 2 - s / 2 + y,
  });
  return (
    <div style={{ position: "relative", width: size, height: size, ...style }}>
      <div style={sq(-d / 2, -d / 2, 0.38)} />
      <div style={sq(d / 2, d / 2, 0.72)} />
    </div>
  );
};

export const Wordmark = ({ size }: { size: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.18 }}>
    <Squares size={size * 1.15} />
    <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: size, color: C.navy, letterSpacing: "0.01em" }}>
      Overlai
    </span>
  </div>
);

/** 判定の色の札（アプリの見出しと同じ言葉） */
export const Verdict = ({ color, label, delay }: { color: string; label: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay, 12);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 28px 12px 20px",
        borderRadius: 999,
        background: C.white,
        border: `3px solid ${color}`,
        transform: `scale(${p})`,
        transformOrigin: "left center",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 32,
        color: C.ink,
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 999, background: color }} />
      {label}
    </div>
  );
};

const SCREEN_H = 860;
const BEZEL = 14;

/** スマホの枠に画面を流す。media が null なら「素材待ち」の札 */
export const Phone = ({
  media,
  waiting,
  accent,
  duration,
}: {
  media: Media | null;
  waiting: string;
  accent: string;
  duration: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const aspect = media?.aspect ?? 1179 / 2556;
  const w = SCREEN_H * aspect;
  const enter = pop(frame, fps, 4, 18);
  const float = Math.sin(frame / 28) * 6;
  // 静止画はゆっくり寄って、止まって見えないようにする
  const zoom = media?.kind === "image" ? interpolate(frame, [0, duration], [1, 1.04]) : 1;

  return (
    <div
      style={{
        position: "relative",
        width: w + BEZEL * 2,
        height: SCREEN_H + BEZEL * 2,
        borderRadius: 64,
        background: C.ink,
        padding: BEZEL,
        boxShadow: "0 40px 80px rgba(15, 23, 42, 0.22), 0 12px 24px rgba(15, 23, 42, 0.12)",
        transform: `translateY(${(1 - enter) * 500 + float}px) rotate(${(1 - enter) * 8}deg)`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: w,
          height: SCREEN_H,
          borderRadius: 50,
          overflow: "hidden",
          background: C.white,
        }}
      >
        {media === null ? (
          <div
            style={{
              position: "absolute",
              inset: 24,
              borderRadius: 32,
              border: `4px dashed ${C.pale}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              fontFamily: FONT,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 700, color: accent }}>素材待ち</span>
            <span style={{ fontSize: 26, fontWeight: 500, color: C.muted, whiteSpace: "pre-line" }}>{waiting}</span>
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "50% 30%" }}>
            {media.kind === "video" ? (
              <Clips media={media} duration={duration} />
            ) : (
              <Img src={staticFile(media.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            {media.rings?.map((r) => (
              <Ring key={r.label} ring={r} color={accent} w={w} />
            ))}
          </div>
        )}
        {/* 画面収録には録画中の印と撮った時刻が写るので、きれいな状態バーで覆う */}
        {media?.kind === "video" && <StatusBar w={w} />}
      </div>
    </div>
  );
};

/** 状態バー（iPhone の画面収録の上端 186/2622 と同じ高さ） */
const StatusBar = ({ w }: { w: number }) => {
  const h = (SCREEN_H * 186) / 2622;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: h,
        background: C.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${w * 0.09}px`,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 19,
        color: C.ink,
      }}
    >
      <span style={{ width: w * 0.2, textAlign: "center" }}>9:41</span>
      <span style={{ width: w * 0.3, height: 26, borderRadius: 13, background: "#000" }} />
      <span style={{ width: w * 0.2, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
        {[7, 10, 13, 16].map((bh) => (
          <span key={bh} style={{ width: 4, height: bh, borderRadius: 1, background: C.ink }} />
        ))}
        <span
          style={{
            marginLeft: 6,
            width: 26,
            height: 13,
            borderRadius: 4,
            border: `2px solid ${C.ink}`,
            padding: 1.5,
            display: "flex",
          }}
        >
          <span style={{ flex: 1, borderRadius: 1.5, background: C.ink }} />
        </span>
      </span>
    </div>
  );
};

/** 録画の区間を順につなぐ。最後の区間は場面の終わりまで流す */
const Clips = ({ media, duration }: { media: Media; duration: number }) => {
  const cuts = media.cuts ?? [{ from: 0, to: Infinity }];
  let used = 0;
  return (
    <Series>
      {cuts.map((c, i) => {
        const rate = c.rate ?? 1;
        const last = i === cuts.length - 1;
        const len = last ? Math.max(1, duration - used) : Math.max(1, sec((c.to - c.from) / rate));
        used += len;
        return (
          <Series.Sequence key={i} durationInFrames={len}>
            <OffthreadVideo
              src={staticFile(media.src)}
              trimBefore={sec(c.from)}
              playbackRate={rate}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};

const Ring = ({ ring, color, w }: { ring: NonNullable<Media["rings"]>[number]; color: string; w: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, sec(ring.at), 11);
  const box: CSSProperties = {
    position: "absolute",
    left: ring.l * w - 6,
    top: ring.t * SCREEN_H - 6,
    width: ring.w * w + 12,
    height: ring.h * SCREEN_H + 12,
  };
  return (
    <div style={{ ...box, transform: `scale(${0.85 + p * 0.15})`, opacity: Math.min(1, p * 1.4) }}>
      <div style={{ position: "absolute", inset: 0, border: `5px solid ${color}`, borderRadius: 14 }} />
      <div
        style={{
          position: "absolute",
          left: -2,
          top: -40,
          padding: "4px 14px",
          borderRadius: 8,
          background: color,
          color: C.white,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 22,
          whiteSpace: "nowrap",
        }}
      >
        {ring.label}
      </div>
    </div>
  );
};
