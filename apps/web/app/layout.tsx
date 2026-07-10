import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Cormorant_Garamond, Newsreader } from 'next/font/google';
import { headers } from 'next/headers';
import { CartProvider } from '@/lib/cart-context';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

// Storefront-only display/body faces (Ch.5.16-style brand identity for the
// customer-facing redesign) — exposed as CSS vars only, scoped to
// `.storefront-theme` in styles/storefront-theme.css, so admin (which never
// references these vars) is unaffected by adding them here.
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fresh & Petals',
  description: 'Premium flower delivery, powered by Prana Commerce OS.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // proxy.ts mints this per-request so next-themes' anti-flash script
  // (the one raw inline <script> this app injects itself) can carry the
  // same nonce as the CSP header's `script-src`, instead of tripping it.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${cormorantGaramond.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Ch.5.27: dark mode architecture must exist but stays dormant in
            v1 — defaultTheme "light" with system detection off means this
            never activates `.dark` on its own; it only makes next-themes'
            useTheme() (which the shadcn Toaster depends on) resolve to a
            real value instead of undefined. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          {...(nonce !== undefined ? { nonce } : {})}
        >
          <CartProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </CartProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
