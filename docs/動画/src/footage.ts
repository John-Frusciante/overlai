// 各場面のスマホ画面に何を流すか。録画が届いたら、ここを書き換えるだけで差し替わる。
// ファイルは public/ に置き、パスは public/ からの相対で書く。

export type Ring = {
  // 画面に対する割合（0〜1）
  l: number;
  t: number;
  w: number;
  h: number;
  label: string;
  // 場面の頭から何秒後に出すか
  at: number;
};

export type Cut = { from: number; to: number; rate?: number };

export type Media = {
  kind: "image" | "video";
  src: string;
  // 画面の縦横比（幅÷高さ）。iPhone の画面収録は 1179x2556
  aspect: number;
  // video のみ：使う区間（秒）を順につなぐ。rate は再生速度（待ち時間を詰めるときに上げる）。
  // 最後の区間は、場面が終わるまでそのまま流し続ける
  cuts?: Cut[];
  rings?: Ring[];
};

// null の場面は「素材待ち」の札を出す。
// 録画は raw/ の元ファイルから、使うものだけを H.264（幅720）にして public/footage/ に置いている
const IPHONE = 720 / 1566;

export const FOOTAGE: Record<"register" | "scan" | "yellow" | "red" | "routine" | "personal", Media | null> = {
  // R1 家で：ハダラボモイスト化粧水d を撮って登録する
  register: {
    kind: "video",
    src: "footage/r1-register.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 0.8, to: 10.3, rate: 3 }, // 追加 → 写真を撮る → シャッター
      { from: 10.5, to: 21.0, rate: 7 }, // 成分の読み取り待ち
      { from: 21.0, to: 22.5 }, // 商品名と成分が埋まる
      { from: 22.5, to: 31, rate: 8 }, // 追加して一覧へ
    ],
  },
  // R2 店で：カロナールA の成分表示を撮って、判定が出るまで
  scan: {
    kind: "video",
    src: "footage/r2-scan-yellow.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 0.5, to: 8.4, rate: 2.2 }, // 棚から箱を取って撮る
      { from: 8.4, to: 16.9, rate: 5 }, // 読み取り → 家の在庫と照合
      { from: 16.9, to: 19 }, // 判定カードが出る
    ],
  },
  // R3 🟡 カロナールA（アセトアミノフェン）× 家のイブA錠（イブプロフェン）。同じ解熱鎮痛の用途
  yellow: {
    kind: "video",
    src: "footage/r2-scan-yellow.mp4",
    aspect: IPHONE,
    cuts: [{ from: 17.0, to: 25.4, rate: 1.2 }],
  },
  // R4 🔴 ハダラボ薬用化粧水b × 家のベタメタゾン軟膏（処方）。顔への使用に注意
  red: {
    kind: "video",
    src: "footage/r4-red.mp4",
    aspect: IPHONE,
    cuts: [{ from: 20.9, to: 29.3, rate: 1.2 }],
  },
  // R5 今日のルーティン（服薬チェック → 洗う順番・塗る順番）
  routine: {
    kind: "video",
    src: "footage/r5-routine.mp4",
    aspect: IPHONE,
    cuts: [{ from: 0.5, to: 12, rate: 1.65 }],
  },
  // R6 肌質の設定で悩みを書く → ルーティンのAIの一言がその悩みに沿う
  personal: {
    kind: "video",
    src: "footage/r6-personal.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 0.5, to: 4.0, rate: 2 }, // 肌・頭皮の状態を選ぶ
      { from: 4.0, to: 15.0, rate: 5 }, // 悩みを打つ
      { from: 16.8, to: 21.5, rate: 3 }, // ルーティンへ。AIが一言を書く
      { from: 21.5, to: 27 }, // 一言が出る
    ],
  },
};

// BGM。public/ に置いたファイル名を書く（null なら無音）。
// 「週末京都現実逃避」written by しゃろう（OpenTracks・旧DOVA-SYNDROME）のトラック2（ループ用）
// https://opentracks.com/bgm/detail/10943 からダウンロードし、public/audio/bgm.mp3 として置く
export const BGM: string | null = "audio/bgm.mp3";
