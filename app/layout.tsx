import './globals.css';

export const metadata = {
  title: 'Products Index Generator — Maison Aria',
  description: 'Upload a Shopify product CSV export, get back products-index.json.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
