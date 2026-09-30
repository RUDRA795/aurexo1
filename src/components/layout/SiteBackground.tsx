'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export function SiteBackground() {
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';

  // The dashboard renders an interactive full-screen WebGL map
  if (isDashboard) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none">
      {/* High-visibility background looping video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover scale-105 opacity-85 transition-opacity duration-700"
      >
        <source src="/videos/aurexo-intro.mp4" type="video/mp4" />
      </video>

      {/* Light frosted glass tint & gentle vignette for high readability without masking the video */}
      <div className="absolute inset-0 bg-slate-950/30 bg-gradient-to-b from-slate-950/45 via-slate-950/20 to-slate-950/50 backdrop-blur-[0.5px]" />

      {/* Soft ambient light sheen at the top */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30" />
    </div>
  );
}
