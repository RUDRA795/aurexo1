import type { Metadata } from 'next';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navbar } from '@/components/layout/Navbar';
import { SiteBackground } from '@/components/layout/SiteBackground';
import { OrcaIntro } from '@/components/intro/OrcaIntro';

export const metadata: Metadata = {
  title: 'ORCA // Marine Ecosystem Reasoning Platform',
  description:
    'ORCA: Marine Ecosystem Reasoning with Collaborative Agents. AI-driven marine intelligence with deterministic spatial safety and satellite observation layers. SIH 2026 PS 176 (ISRO).',
  icons: {
    icon: '/images/orca-logo-circle.png',
    apple: '/images/orca-logo-circle.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <body className="min-h-screen w-full bg-slate-950/60 font-sans antialiased text-slate-100">
        <OrcaIntro />
        <SiteBackground />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
