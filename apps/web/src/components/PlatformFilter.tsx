'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PLATFORM_CONFIG } from '@/lib/platforms';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function PlatformFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePlatform = searchParams.get('platform');

  const updatePlatform = (platformSlug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (platformSlug) {
      params.set('platform', platformSlug);
    } else {
      params.delete('platform');
    }
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const platforms = Object.values(PLATFORM_CONFIG);

  return (
    <div
      className="sticky z-40 w-full overflow-hidden"
      style={{ top: '64px', background: 'rgba(10,10,11,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--sm-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar snap-x">
          
          {/* All Platforms (Clear) */}
          <button
            onClick={() => updatePlatform(null)}
            className={cn(
              'snap-start shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
              !activePlatform 
                ? 'bg-white text-black' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            )}
            style={!activePlatform ? {} : { border: '1px solid var(--sm-border)' }}
          >
            All Deals
            {activePlatform && <X className="w-3 h-3 ml-1" />}
          </button>

          {/* Platform Pills */}
          {platforms.map((platform) => {
            const isActive = activePlatform === platform.slug;
            return (
              <button
                key={platform.slug}
                onClick={() => updatePlatform(platform.slug)}
                className={cn(
                  'snap-start shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all'
                )}
                style={{
                  background: isActive ? platform.bg : 'var(--bg-raised)',
                  color: isActive ? platform.text : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? platform.bg : 'var(--sm-border)'}`,
                  opacity: (!activePlatform || isActive) ? 1 : 0.6
                }}
              >
                <span>{platform.emoji}</span>
                {platform.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
