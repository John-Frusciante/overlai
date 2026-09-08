import type { MetadataRoute } from 'next';

/**
 * PWA マニフェスト — Issue #11
 *
 * ホーム画面に追加するとアイコンが他のアプリと並び、
 * アドレスバーのない全画面で起動する。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Overlai — 買う前に、家の棚を重ねて見る。',
    short_name: 'Overlai',
    description:
      '店頭の商品に自宅の在庫を重ねて照合し、「もう持っているか」「使っている薬と重ならないか」を判定します。',
    lang: 'ja',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f7f8',
    theme_color: '#18181b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
