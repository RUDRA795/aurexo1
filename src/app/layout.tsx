import type { Metadata } from 'next';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';

export const metadata: Metadata = {
  title: 'AUREXO // Marine Intelligence Platform',
  description: 'AI-driven conversational marine intelligence platform with deterministic spatial reasoning and satellite-derived observation layers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <body className="h-full w-full select-none overflow-hidden bg-slate-950 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
