import type { Metadata } from 'next';
import { Pixelify_Sans, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { siteConfig } from '@/config/site';

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : siteConfig.url;

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: siteConfig.title,
  description: siteConfig.description,
  authors: siteConfig.authors,
};

const pixelifySans = Pixelify_Sans({
  variable: '--font-pixelify-sans',
  display: 'swap',
  subsets: ['latin'],
  weight: '500',
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  display: 'swap',
  subsets: ['latin'],
  weight: '500',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.className} ${pixelifySans.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          themes={['light', 'dark', 'classic', 'system']}
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
