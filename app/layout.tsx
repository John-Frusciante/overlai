import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Overlai — 買う前に、家の棚を重ねて見る。',
  description:
    '店頭の商品に自宅の在庫を重ねて照合し、「もう持っているか」「使っている薬と重ならないか」を判定します。',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Overlai',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#18181b',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
