import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'interactive';
  className?: string;
}

export function GlassCard({
  children,
  variant = 'default',
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl transition-all duration-200',
          variant === 'default' && 'glass-pearl',
          variant === 'subtle' && 'glass-pearl-subtle',
          variant === 'interactive' &&
            'glass-pearl hover:bg-white/95 hover:shadow-pearl-md cursor-pointer active:scale-[0.99]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}
