// apps/web/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import SandboxBanner from '../components/SandboxBanner';
import './globals.css';

export const metadata: Metadata = {
  title:       'ResolveX — Smart Civic CRM',
  description: 'File and track civic complaints in real time',
  manifest:    '/manifest.json',
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#4F46E5',
};

// FIX: children must be explicitly typed as React.ReactNode in strict mode
// Original error: "Binding element 'children' implicitly has an 'any' type. ts(7031)"
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demoMode = process.env.NEXT_PUBLIC_MODE === 'demo';

  return (
    <html lang="en">
      <body className="bg-[var(--main-dark-bg)] text-white antialiased">
        <SandboxBanner demoMode={demoMode} />
        <nav className="bg-[var(--secondary-dark)]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="ResolveX Logo" className="w-6 h-6 object-contain drop-shadow-sm" />
            <span className="font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-wide text-lg">
              ResolveX
            </span>
          </Link>
          <Link href="/file" className="text-sm text-[var(--blue)] font-medium hover:text-white hover:underline transition-colors">
            Report issue
          </Link>
        </nav>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}