import type { Metadata } from 'next';
import { Pixelify_Sans, Space_Grotesk  } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Next.js and Supabase Starter Kit',
  description: 'The fastest way to build apps with Next.js and Supabase',
};

const pixelifySans = Pixelify_Sans({
  variable: '--font-pixelify-sans',
  display: 'swap',
  subsets: ['latin'],
  weight: "400",
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  display: 'swap',
  subsets: ['latin'],
  weight: "400",
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
