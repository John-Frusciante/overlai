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

/** 録画の区間をつないだ長さ（秒）。場面の長さはこれに合わせる */
export const clipSeconds = (m: Media | null) =>
  (m?.cuts ?? []).reduce((a, c) => a + (c.to - c.from) / (c.rate ?? 1), 0);

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
      { from: 6.2, to: 8.3 }, // 成分表示に向けてシャッター
      { from: 9.3, to: 9.9 }, // 写真を使用
      { from: 10.4, to: 11.4 }, // 読み取りが始まる（待ち時間は飛ばす）
      { from: 21.0, to: 23.0 }, // 商品名と成分が埋まる
      { from: 27.6, to: 29.6 }, // 追加して一覧へ（このあと編集画面を開くので、ここまで）
    ],
  },
  // マイストックの一覧（開封後の目安・残りわずかの知らせ → 種類ごとの一覧）
  stock: {
    kind: "video",
    src: "footage/r0-stock.mp4",
    aspect: IPHONE,
    cuts: [
      // ナレーションの順（一覧 → 開封後の目安・残りわずか）に合わせ、一覧を先に見せてから上に戻る。
      // 15.9 秒目からはコントロールセンターが映るので使わない
      { from: 3.0, to: 8.0 }, // 種類ごとの一覧
      { from: 0.3, to: 3.8 }, // 開封後の目安・残りわずかの知らせ
    ],
  },
  // 登録：ディアナチュラ ビタミンC。飲む時間（朝・夜）と1回の量まで設定して一覧へ
  dose: {
    kind: "video",
    src: "footage/r1b-dose.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 23.7, to: 24.9 }, // 読み取った商品名と成分
      { from: 28.0, to: 32.0 }, // 飲むタイミング（朝・夜）を選ぶ
      { from: 32.3, to: 33.0 }, // 1回の量
    ],
  },
  // R2 店で：カロナールA の成分表示を撮って、判定が出るまで
  scan: {
    kind: "video",
    src: "footage/r2-scan-yellow.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 4.6, to: 8.5 }, // 箱を手に取って撮る
      { from: 8.5, to: 9.0 }, // 読み取りが始まる
      { from: 14.6, to: 15.4 }, // （待ち時間は飛ばす）家の在庫と照合
      { from: 16.9, to: 18.3 }, // 判定カード
    ],
  },
  // 🔵 化粧水（保湿中心）。家の処方薬とも化粧水とも重ならない
  blue: {
    kind: "video",
    src: "footage/r3b-blue.mp4",
    aspect: IPHONE,
    cuts: [{ from: 16.5, to: 21.7 }],
  },
  // R3 🟡 カロナールA（アセトアミノフェン）× 家のイブA錠（イブプロフェン）。同じ解熱鎮痛の用途
  yellow: {
    kind: "video",
    src: "footage/r2-scan-yellow.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 17.0, to: 19.0 }, // カロナールA と家のイブA錠
      { from: 20.4, to: 25.1 }, // 根拠：アセトアミノフェンとイブプロフェンは同じ解熱鎮痛の用途
    ],
  },
  // R4 🔴 ハダラボ薬用化粧水b × 家のベタメタゾン軟膏（処方）。顔への使用に注意
  red: {
    kind: "video",
    src: "footage/r4-red.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 3.3, to: 5.9 }, // 化粧水を手に取って撮る
      { from: 20.9, to: 24.1 }, // （待ち時間は飛ばす）判定カード
    ],
  },
  // 🔴の続き：「根拠を見る」を開き、エタノール・メントール・カンフルの理由と PMDA への入り口を見せる
  evidence: {
    kind: "video",
    src: "footage/r4-red.mp4",
    aspect: IPHONE,
    cuts: [{ from: 24.0, to: 28.4, rate: 0.5 }],
  },
  // R5 今日のルーティン（服薬チェック → 洗う順番・塗る順番）
  routine: {
    kind: "video",
    src: "footage/r5-routine.mp4",
    aspect: IPHONE,
    cuts: [
      // ナレーションの順（使う順番 → 飲んだかのチェック）に合わせて入れ替える
      { from: 6.0, to: 9.6 }, // 洗う順番・塗る順番
      { from: 1.2, to: 3.8 }, // 服薬チェック
    ],
  },
  // R6 肌質の設定で悩みを書く → ルーティンのAIの一言がその悩みに沿う
  personal: {
    kind: "video",
    src: "footage/r6-personal.mp4",
    aspect: IPHONE,
    cuts: [
      { from: 12.8, to: 14.3 }, // 悩みを打ち終える
      { from: 15.2, to: 16.0 }, // 肌質の設定に悩みが入った
      { from: 17.0, to: 17.6 }, // ルーティンへ。AIが一言を書く
      { from: 20.8, to: 24.3 }, // 一言が出る
    ],
  },
};

// BGM。public/ に置いたファイル名を書く（null なら無音）。
// 10/8 に「週末京都現実逃避」（しゃろう）を試したが、ユーザー判断で無音にした
export const BGM: string | null = null;
