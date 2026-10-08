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

export type Media = {
  kind: "image" | "video";
  src: string;
  // 画面の縦横比（幅÷高さ）。iPhone の画面収録は 1179x2556
  aspect: number;
  // video のみ：録画の何秒目から使うか／再生速度（待ち時間を詰めるときに上げる）
  from?: number;
  rate?: number;
  rings?: Ring[];
};

// null の場面は「素材待ち」の札を出す
export const FOOTAGE: Record<"register" | "scan" | "yellow" | "red" | "routine" | "personal", Media | null> = {
  // R1 家で：薬・化粧品を撮って登録する
  register: null,
  // R2 店で：商品の成分表示を撮って、判定が出るまで
  scan: null,
  // R3 🟡 の判定画面
  yellow: {
    kind: "image",
    src: "img/yellow-real.png",
    aspect: 836 / 1686,
    rings: [
      { l: 0.05, t: 0.513, w: 0.29, h: 0.043, label: "重複する成分", at: 1.6 },
      { l: 0.035, t: 0.67, w: 0.93, h: 0.122, label: "家の薬", at: 2.6 },
    ],
  },
  // R4 🔴 の判定画面
  red: {
    kind: "image",
    src: "img/red-real.png",
    aspect: 648 / 1286,
    rings: [
      { l: 0.035, t: 0.504, w: 0.42, h: 0.044, label: "店の商品", at: 1.6 },
      { l: 0.035, t: 0.796, w: 0.93, h: 0.094, label: "家の薬", at: 2.6 },
    ],
  },
  // R5 家で：今日のルーティン（塗る順番・AIの一言・服薬チェック）
  routine: {
    kind: "image",
    src: "img/routine-crop.jpg",
    aspect: 1170 / 2420,
    rings: [{ l: 0.018, t: 0.096, w: 0.13, h: 0.734, label: "塗る順番", at: 1.8 }],
  },
  // R6 肌質の設定で悩みを書く → ルーティンに戻ると、AIの一言がその悩みに沿って変わる
  personal: null,
};

// BGM。public/ に置いたファイル名を書く（null なら無音）
export const BGM: string | null = null;
