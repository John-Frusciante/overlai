import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { ReactElement } from "react";
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion";
import { BGM, FOOTAGE } from "./footage";
import { End, Feature, Hook, Logo, Mark, Pillars, Verdict } from "./scenes";
import { C, FONT, sec } from "./theme";

const T = 12; // 場面のつなぎ（フレーム）

const Legend = () => (
  <div style={{ display: "flex", gap: 28, fontFamily: FONT, fontSize: 28, fontWeight: 700, color: C.ink }}>
    {[
      [C.blue, "買っても問題なさそう"],
      [C.amber, "買わなくて大丈夫"],
      [C.red, "注意が必要"],
    ].map(([c, l]) => (
      <span key={l} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 20, height: 20, borderRadius: 99, background: c }} />
        {l}
      </span>
    ))}
  </div>
);

// 場面の並びと長さ。ここを入れ替えれば構成が変わる
const SCENES: { d: number; next: "fade" | "slide"; el: (d: number) => ReactElement }[] = [
  { d: sec(5.5), next: "fade", el: () => <Hook /> },
  { d: sec(4), next: "fade", el: () => <Logo /> },
  {
    d: sec(8),
    next: "slide",
    el: (d) => (
      <Feature
        tag="STEP 1｜家で"
        title={["家の薬・化粧品を", <>撮って<Mark color="#C7D2FE" delay={30}>登録</Mark></>]}
        sub={"AIが成分表示を読み取る。\n残りの量も管理できる。"}
        media={FOOTAGE.register}
        waiting={"R1\n家で薬を撮って登録"}
        accent={C.navy}
        duration={d}
      />
    ),
  },
  {
    d: sec(8),
    next: "slide",
    el: (d) => (
      <Feature
        tag="STEP 2｜店で"
        title={["気になる商品を", <><Mark color="#BFDBFE" delay={30}>撮るだけ</Mark></>]}
        sub={"AIが、家の薬・化粧品と照らし合わせて\n買うべきかの目安を3色で出す。"}
        media={FOOTAGE.scan}
        waiting={"R2\n店で商品を撮って\n判定が出るまで"}
        accent={C.blue}
        duration={d}
        extra={<Legend />}
      />
    ),
  },
  {
    d: sec(8),
    next: "slide",
    el: (d) => (
      <Feature
        tag="できること 1｜重複"
        title={["名前が違っても、", <>同じ<Mark color="#FDE68A" delay={30}>働きの薬</Mark>に気づける</>]}
        sub={"風邪薬と頭痛薬のように、別の薬でも\n成分がかぶっていれば知らせる。"}
        media={FOOTAGE.yellow}
        waiting="R3 🟡の判定画面"
        accent={C.amber}
        duration={d}
        extra={<Verdict color={C.amber} label="買わなくて大丈夫" delay={sec(1.2)} />}
      />
    ),
  },
  {
    d: sec(8),
    next: "slide",
    el: (d) => (
      <Feature
        tag="できること 2｜組み合わせ"
        title={["使っている薬との", <><Mark color="#FECACA" delay={30}>相性</Mark>が、買う前にわかる</>]}
        sub={"飲み薬だけでなく、塗り薬や\n化粧品との組み合わせも確かめられる。"}
        media={FOOTAGE.red}
        waiting="R4 🔴の判定画面"
        accent={C.red}
        duration={d}
        extra={<Verdict color={C.red} label="注意が必要" delay={sec(1.2)} />}
      />
    ),
  },
  {
    d: sec(8.5),
    next: "fade",
    el: (d) => (
      <Feature
        tag="できること 3｜使う順番"
        title={["薬や化粧品を", <><Mark color="#C7D2FE" delay={30}>使う順番</Mark>がわかる</>]}
        sub={"順番の理由と、使うときのコツをAIが添える。\n朝・昼・夜の服薬チェックも。"}
        media={FOOTAGE.routine}
        waiting={"R5\n今日のルーティン"}
        accent={C.navy}
        duration={d}
      />
    ),
  },
  { d: sec(6), next: "fade", el: () => <Pillars /> },
  { d: sec(7.2), next: "fade", el: () => <End /> },
];

export const TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

export const Booth = () => (
  <AbsoluteFill style={{ background: C.white }}>
    <TransitionSeries>
      {SCENES.flatMap((s, i) => {
        const seq = (
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={s.d}>
            {s.el(s.d)}
          </TransitionSeries.Sequence>
        );
        if (i === SCENES.length - 1) return [seq];
        return [
          seq,
          <TransitionSeries.Transition
            key={`t${i}`}
            presentation={s.next === "slide" ? slide({ direction: "from-right" }) : fade()}
            timing={linearTiming({ durationInFrames: T })}
          />,
        ];
      })}
    </TransitionSeries>
    {BGM && (
      <Audio
        src={staticFile(BGM)}
        volume={(f) =>
          interpolate(f, [0, 20, TOTAL - 40, TOTAL], [0, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        }
      />
    )}
  </AbsoluteFill>
);
