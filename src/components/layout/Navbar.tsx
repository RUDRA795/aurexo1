'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Anchor,
  Map,
  Ship,
  Globe2,
  BarChart3,
  Info,
  MessageSquare,
  Menu,
  X,
  Radio,
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard', icon: Map },
  { label: 'Fleet', href: '/fleet', icon: Ship },
  { label: 'Regions', href: '/regions', icon: Globe2 },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'About PS 176', href: '/about', icon: Info },
];

export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/15 bg-slate-950/60 shadow-lg shadow-black/20 backdrop-blur-2xl'
          : 'bg-slate-950/30 border-b border-white/10 backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 md:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-cyan-400/40 bg-slate-900/80 shadow-md shadow-cyan-500/20 transition-all group-hover:scale-105 group-hover:border-cyan-300">
            <img
              src="/images/orca-logo-circle.png"
              alt="ORCA Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="font-mono text-xl font-extrabold tracking-wider text-white">
            ORCA
            <span className="ml-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-cyan-300">
              MARINE AI
            </span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1.5 md:flex">
          {NAV_LINKS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white shadow-sm ring-1 ring-white/30 backdrop-blur'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 opacity-80" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Ask ORCA CTA + hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden items-center gap-2 rounded-lg bg-white/95 px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-md transition-all hover:bg-white hover:shadow-lg active:scale-95 md:flex"
          >
            <MessageSquare className="h-4 w-4 text-slate-900" />
            Ask ORCA
          </Link>

          {/* Live indicator */}
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 md:flex">
            <Radio className="h-3 w-3 animate-pulse text-emerald-300" />
            <span className="font-mono text-[10px] font-semibold text-emerald-300">LIVE</span>
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 hover:text-white md:hidden"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="border-t border-slate-800/60 bg-slate-950/95 px-4 pb-4 pt-2 md:hidden">
          {NAV_LINKS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/dashboard"
            onClick={() => setIsMenuOpen(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300"
          >
            <MessageSquare className="h-4 w-4" />
            Ask ORCA
          </Link>
        </div>
      )}
    </nav>
  );
}
