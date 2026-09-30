import type { Metadata } from 'next';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navbar } from '@/components/layout/Navbar';
import { SiteBackground } from '@/components/layout/SiteBackground';

export const metadata: Metadata = {
  title: 'AUREXO // Marine Intelligence Platform',
  description:
    'AI-driven conversational marine intelligence platform with deterministic spatial reasoning and satellite-derived observation layers. SIH 2026 PS-176.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <body className="min-h-screen w-full bg-slate-950/60 font-sans antialiased text-slate-100">
        <SiteBackground />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
