import type { Metadata, Viewport } from 'next';
// Self-hosted Montserrat (no Google Fonts call at build or runtime)
import '@fontsource-variable/montserrat';
import './globals.css';

export const metadata: Metadata = {
  title: 'Balewa Schools',
  description: 'Mfumo wa usimamizi wa shule — Balewa Nursery & Primary School',
};
export const viewport: Viewport = { themeColor: '#0E4D90', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw">
      <body>{children}</body>
    </html>
  );
}
