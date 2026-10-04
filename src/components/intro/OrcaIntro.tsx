'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_STORAGE_KEY = 'orca_intro_seen';
const FADE_DURATION_MS = 300;

export function OrcaIntro() {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
      return !sessionStorage.getItem(SESSION_STORAGE_KEY) && !sessionStorage.getItem('aurexo_intro_seen');
    } catch {
      return false;
    }
  });

  const [isFading, setIsFading] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isDismissedRef = useRef<boolean>(false);

  const dismiss = useCallback((immediate: boolean = false) => {
    if (isDismissedRef.current) return;
    isDismissedRef.current = true;

    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      sessionStorage.setItem('aurexo_intro_seen', 'true');
    } catch {
      // Ignore sessionStorage exceptions
    }

    if (immediate) {
      setIsVisible(false);
      return;
    }

    setIsFading(true);
    setTimeout(() => {
      setIsVisible(false);
    }, FADE_DURATION_MS);
  }, []);

  // Intercept ANY keyboard press (Space, Enter, Esc, etc.) to skip immediately
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ' || true) {
        e.preventDefault();
        e.stopPropagation();
        dismiss(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isVisible, dismiss]);

  // Attempt autoplay safely; if blocked or errored, dismiss gracefully
  useEffect(() => {
    if (!isVisible) return;

    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((_err) => {
          dismiss(true);
        });
      }
    }
  }, [isVisible, dismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="ORCA Introduction"
      aria-modal="true"
      onClick={() => dismiss(false)}
      className={`fixed inset-0 z-[99999] flex h-full w-full cursor-pointer select-none items-center justify-center overflow-hidden bg-black transition-opacity duration-300 ease-out ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Skip affordance */}
      <div className="sr-only">Skip Intro</div>

      <div className="relative h-full w-full overflow-hidden">
        <video
          ref={videoRef}
          src="/videos/orca-intro.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => dismiss(false)}
          onError={() => {
            // Fallback to aurexo-intro.mp4 if orca-intro.mp4 fails, else dismiss
            if (videoRef.current && videoRef.current.src.includes('orca-intro.mp4')) {
              videoRef.current.src = '/videos/aurexo-intro.mp4';
              videoRef.current.play().catch(() => dismiss(true));
            } else {
              dismiss(true);
            }
          }}
          className="h-full w-full scale-[1.06] transform object-cover"
        />

        {/* Corner vignette gradient to softly feather edges */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-52 bg-gradient-to-tl from-black/85 via-black/45 to-transparent" />
      </div>
    </div>
  );
}

export const AurexoIntro = OrcaIntro;
export default OrcaIntro;
