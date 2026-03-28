"use client";

import { ReactNode } from 'react';
import Link from 'next/link';
import { Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProGateProps {
  children: ReactNode;
  isPro: boolean;
  label?: string;
}

export function ProGate({ children, isPro, label = 'Pro members only' }: ProGateProps) {
  if (isPro) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl z-10 p-6 text-center"
        style={{ background: 'rgba(10,10,10,0.65)' }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
          style={{
            background: 'linear-gradient(135deg, var(--gold), var(--gold-bright))',
            boxShadow: '0 0 20px rgba(201,168,76,0.35)',
          }}
        >
          <Lock className="w-6 h-6" style={{ color: '#0A0A0A' }} />
        </div>
        <p className="text-white font-bold text-sm mb-1">{label}</p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Upgrade to access this feature
        </p>
        <Button
          asChild
          size="sm"
          className="font-bold gap-1.5"
          style={{ background: 'var(--gold)', color: '#0A0A0A' }}
        >
          <Link href="/pro">
            <Zap className="w-3.5 h-3.5" />
            Go Pro
          </Link>
        </Button>
      </div>
    </div>
  );
}
