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
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0F]/60 backdrop-blur-sm rounded-xl z-10 p-6 text-center">
        <div className="w-12 h-12 bg-[#7C3AED]/20 rounded-full flex items-center justify-center mb-3">
          <Lock className="w-6 h-6 text-[#7C3AED]" />
        </div>
        <p className="text-white font-bold text-sm mb-1">{label}</p>
        <p className="text-gray-500 text-xs mb-4">Upgrade to access this feature</p>
        <Button asChild size="sm" className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold gap-1.5">
          <Link href="/pro">
            <Zap className="w-3.5 h-3.5" />
            Go Pro
          </Link>
        </Button>
      </div>
    </div>
  );
}
