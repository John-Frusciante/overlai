import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import narration from "../narration.json";
import { BGM, FOOTAGE } from "./footage";
import { End, Feature, Hook, Logo, Mark, NoteCard, Pillars, Verdict } from "./scenes";
import { C, FONT, sec } from "./theme";

const T = 12; // 場面のつなぎ（フレーム）
const VOICE_IN = 6; // 場面が始まってからナレーションが入るまで（フレーム）

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
const SCENES: { id: string; d: number; next: "fade" | "slide"; el: (d: number) => ReactElement }[] = [
  { id: "hook", d: sec(5.5), next: "fade", el: () => <Hook /> },
  { id: "logo", d: sec(5.0), next: "fade", el: () => <Logo /> },
  {
    id: "register", d: sec(8.5),
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
    id: "stock", d: sec(8.5),
    next: "slide",
    el: (d) => (
      <Feature
        tag="STEP 1｜家で"
        title={["家にあるものが、", <><Mark color="#C7D2FE" delay={30}>ひと目で</Mark>わかる</>]}
        sub={"開封後の目安や、残りが少ないものも\n知らせてくれる。"}
        media={FOOTAGE.stock}
        waiting="マイストック"
        accent={C.navy}
        duration={d}
      />
    ),
  },
  {
    id: "dose", d: sec(6.0),
    next: "slide",
    el: (d) => (
      <Feature
        tag="STEP 1｜家で"
        title={["飲む薬やサプリは、", <>飲む<Mark color="#C7D2FE" delay={30}>時間と量</Mark>も</>]}
        sub={"朝・昼・夜のどこで飲むかと、1回の量を登録。\n毎日のチェックに使われる。"}
        media={FOOTAGE.dose}
        waiting="飲む時間の登録"
        accent={C.navy}
        duration={d}
      />
    ),
  },
  {
    id: "scan", d: sec(7.5),
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
    id: "blue", d: sec(5.2),
    next: "slide",
    el: (d) => (
      <Feature
        tag="判定は3色"
        title={["問題がなさそうなら、", <><Mark color="#BFDBFE" delay={30}>青</Mark>で知らせる</>]}
        sub={"家にあるものと重ならず、\n組み合わせの心配も見つからないとき。"}
        media={FOOTAGE.blue}
        waiting="🔵の判定画面"
        accent={C.blue}
        duration={d}
        extra={<Verdict color={C.blue} label="買っても問題なさそう" delay={sec(1.2)} />}
      />
    ),
  },
  {
    id: "yellow", d: sec(7.2),
    next: "slide",
    el: (d) => (
      <Feature
        tag="できること 1｜重複"
        title={["名前が違っても、", <>同じ<Mark color="#FDE68A" delay={30}>働きの薬</Mark>に気づける</>]}
        sub={"解熱鎮痛薬どうしのように、成分が違っても\n同じ用途の薬が家にあれば知らせる。"}
        media={FOOTAGE.yellow}
        waiting="R3 🟡の判定画面"
        accent={C.amber}
        duration={d}
        extra={<Verdict color={C.amber} label="買わなくて大丈夫" delay={sec(1.2)} />}
      />
    ),
  },
  {
    id: "red", d: sec(6.4),
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
    id: "evidence", d: sec(9.0),
    next: "slide",
    el: (d) => (
      <Feature
        tag="安全のために"
        title={["理由には、", <><Mark color="#C7D2FE" delay={30}>成分名と出典</Mark>を添える</>]}
        sub={"家のどの薬と、どの成分が関係するかを示す。\n成分をたどれない理由は表示しない。"}
        media={FOOTAGE.evidence}
        waiting="根拠の画面"
        accent={C.navy}
        duration={d}
      />
    ),
  },
  {
    id: "routine", d: sec(7.0),
    next: "slide",
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
  {
    id: "personal", d: sec(7.2),
    next: "fade",
    el: (d) => (
      <Feature
        tag="できること 4｜パーソナライズ"
        title={["悩みまで伝えると、", <>その人に<Mark color="#BFDBFE" delay={30}>合った使い方</Mark>に</>]}
        sub={"肌質や年代に加えて、自分の言葉で書いた悩みも\nAIの一言に反映される。"}
        media={FOOTAGE.personal}
        waiting={"R6\n悩みを書く →\nAIの一言が変わる"}
        accent={C.blue}
        duration={d}
        extra={<NoteCard text="朝は時間がないため手早く済ませたいです。" delay={sec(1.4)} />}
      />
    ),
  },
  { id: "pillars", d: sec(6.0), next: "fade", el: () => <Pillars /> },
  { id: "end", d: sec(5.2), next: "fade", el: () => <End /> },
];

export const TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

/** 各場面の頭のフレーム（つなぎで重なる分を引く） */
const START: Record<string, number> = {};
SCENES.reduce((at, s) => {
  START[s.id] = at;
  return at + s.d - T;
}, 0);

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
    {/* ナレーション（Gemini TTS。scripts/tts.mjs で public/narration/ に作る） */}
    {narration.lines.map(({ scene }) => (
      <Sequence key={scene} from={START[scene] + VOICE_IN}>
        <Audio src={staticFile(`narration/${scene}.wav`)} />
      </Sequence>
    ))}
    {BGM && (
      <Audio
        src={staticFile(BGM)}
        volume={(f) =>
          // 頭は短く入り、最後は締めの場面に合わせてゆっくり消す（ループ再生でつなぎ目を目立たせない）
          interpolate(f, [0, 10, TOTAL - 60, TOTAL - 6], [0, 0.5, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        }
      />
    )}
  </AbsoluteFill>
);
