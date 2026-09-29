'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_STORAGE_KEY = 'aurexo_intro_seen';
const FADE_DURATION_MS = 200;

export function AurexoIntro() {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
      return !sessionStorage.getItem(SESSION_STORAGE_KEY);
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
    } catch {
      // Ignore sessionStorage exceptions (e.g. private mode restrictions)
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

  // Intercept Space key globally while intro is active
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
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

  // Attempt autoplay safely; if blocked or errored, dismiss gracefully without error
  useEffect(() => {
    if (!isVisible) return;

    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((_err) => {
          // Playback blocked by browser policy or media decoding failure
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
      aria-label="Aurexo Cinematic Introduction"
      aria-modal="true"
      className={`fixed inset-0 z-[99999] flex h-full w-full select-none items-center justify-center overflow-hidden bg-slate-950 transition-opacity duration-200 ease-out ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        src="/videos/aurexo-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => dismiss(false)}
        onError={() => dismiss(true)}
        className="h-full w-full object-cover"
      />

      {/* Skip Controls Affordance: Desktop indicator & Mobile touch skip button */}
      <div className="pointer-events-none absolute bottom-8 left-0 right-0 z-10 flex justify-center px-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss(false);
          }}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-950/70 px-4 py-2 font-mono text-xs tracking-wider text-slate-300 shadow-2xl backdrop-blur-md transition-all duration-150 hover:border-cyan-500/60 hover:bg-slate-900/90 hover:text-cyan-300 active:scale-95 sm:text-xs"
        >
          <span className="hidden sm:inline">Press</span>
          <kbd className="rounded border border-slate-600 bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400">
            SPACE
          </kbd>
          <span className="hidden sm:inline">to skip</span>
          <span className="sm:hidden">Skip Intro</span>
          <svg
            className="h-3.5 w-3.5 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
