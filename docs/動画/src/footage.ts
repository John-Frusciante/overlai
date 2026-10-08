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

export const FOOTAGE: Record<
  "register" | "stock" | "dose" | "scan" | "blue" | "yellow" | "red" | "evidence" | "routine" | "personal",
  Media | null
> = {
  // R1 家で：ハダラボモイスト化粧水d を撮って登録する
  register: {
    kind: "video",
    src: "footage/r1-register.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 0.8, to: 10.3, rate: 3 }, // 追加 → 写真を撮る → シャッター
      { from: 10.5, to: 21.0, rate: 7 }, // 成分の読み取り待ち
      { from: 21.0, to: 22.5 }, // 商品名と成分が埋まる
      // 録画はこのあと編集画面を開いて閉じるので、一覧が出たところ（31秒目）で止まる速さにする
      { from: 22.5, to: 31, rate: 3.6 }, // 追加して一覧へ
    ],
  },
  // マイストックの一覧（開封後の目安・残りわずかの知らせ → 種類ごとの一覧）
  stock: {
    kind: "video",
    src: "footage/r0-stock.mp4",
    aspect: IPHONE,
    // 録画の 15.9 秒目からコントロールセンター（画面収録を止める操作）が映る。最後の区間は場面の終わり（8.5秒）まで流れるので、
    // 0.3 + 8.5 × rate が 15.8 を超えないよう速度を 1.75 にしている（読み進める範囲は 15.2 秒目まで）
    cuts: [{ from: 0.3, to: 15.2, rate: 1.75 }],
  },
  // 登録：ディアナチュラ ビタミンC。飲む時間（朝・夜）と1回の量まで設定して一覧へ
  dose: {
    kind: "video",
    src: "footage/r1b-dose.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 23.6, to: 26.0, rate: 3 }, // 読み取り結果
      { from: 26.0, to: 34.8, rate: 2.4 }, // 飲むタイミングと1回の量
      { from: 34.8, to: 40 }, // 一覧へ
    ],
  },
  // R2 店で：カロナールA の成分表示を撮って、判定が出るまで
  scan: {
    kind: "video",
    src: "footage/r2-scan-yellow.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 0.5, to: 8.4, rate: 2.5 }, // 棚から箱を取って撮る
      { from: 8.4, to: 16.9, rate: 6 }, // 読み取り → 家の在庫と照合
      { from: 16.9, to: 19 }, // 判定カードが出る
    ],
  },
  // 🔵 化粧水（保湿中心）。家の処方薬とも化粧水とも重ならない
  blue: {
    kind: "video",
    src: "footage/r3b-blue.mp4",
    aspect: IPHONE,
    cuts: [{ from: 15.8, to: 21.7 }],
  },
  // R3 🟡 カロナールA（アセトアミノフェン）× 家のイブA錠（イブプロフェン）。同じ解熱鎮痛の用途
  yellow: {
    kind: "video",
    src: "footage/r2-scan-yellow.mp4",
    aspect: IPHONE,
    // 録画は 25.2 秒で終わる。場面の終わりまでに尽きない速さにする
    cuts: [{ from: 17.0, to: 25.0, rate: 1.1 }],
  },
  // R4 🔴 ハダラボ薬用化粧水b × 家のベタメタゾン軟膏（処方）。顔への使用に注意
  red: {
    kind: "video",
    src: "footage/r4-red.mp4",
    aspect: IPHONE,
    cuts: [{ from: 20.9, to: 24.4, rate: 0.55 }],
  },
  // 🔴の続き：「根拠を見る」を開き、エタノール・メントール・カンフルの理由と PMDA への入り口を見せる
  evidence: {
    kind: "video",
    src: "footage/r4-red.mp4",
    aspect: IPHONE,
    cuts: [{ from: 24.4, to: 28.4, rate: 0.45 }],
  },
  // R5 今日のルーティン（服薬チェック → 洗う順番・塗る順番）
  routine: {
    kind: "video",
    src: "footage/r5-routine.mp4",
    aspect: IPHONE,
    cuts: [{ from: 0.5, to: 11.9, rate: 1.6 }],
  },
  // R6 肌質の設定で悩みを書く → ルーティンのAIの一言がその悩みに沿う
  personal: {
    kind: "video",
    src: "footage/r6-personal.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 0.5, to: 4.0, rate: 3 }, // 肌・頭皮の状態を選ぶ
      { from: 4.0, to: 15.0, rate: 6 }, // 悩みを打つ
      { from: 16.8, to: 21.5, rate: 4 }, // ルーティンへ。AIが一言を書く
      { from: 21.5, to: 27 }, // 一言が出る
    ],
  },
};

// BGM。public/ に置いたファイル名を書く（null なら無音）。
// 10/8 に「週末京都現実逃避」（しゃろう）を試したが、ユーザー判断で無音にした
export const BGM: string | null = null;
