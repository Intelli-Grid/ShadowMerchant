import { cn } from '@/lib/utils';

interface DealCardSkeletonProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DealCardSkeleton({ size = 'sm', className }: DealCardSkeletonProps) {
  // Skeleton styles matching the DealCard design
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-[24px] overflow-hidden border p-4 sm:p-5 w-full',
        'animate-pulse opacity-80',
        size === 'lg' ? 'md:flex-row md:p-8' : '',
        className
      )}
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--sm-border)',
        minHeight: size === 'sm' ? '320px' : size === 'md' ? '380px' : '400px'
      }}
    >
      {/* Top row: Badge and Wishlist */}
      <div className="flex items-center justify-between mb-4 z-10 w-full">
        {/* Badge skeleton */}
        <div className="h-6 w-20 rounded bg-[#2A2A35]" />
        {/* Heart skeleton */}
        <div className="h-8 w-8 rounded-full bg-[#2A2A35]" />
      </div>

      {/* Main Image Area Skeleton */}
      <div
        className={cn(
          'relative w-full rounded-xl bg-gradient-to-br from-[#1A1A24] to-[#13131A] mb-4 overflow-hidden',
          size === 'lg' ? 'md:w-[45%] md:mb-0 md:mr-8 md:h-[280px]' : 'aspect-square md:aspect-[4/3]'
        )}
      >
        <div className="absolute inset-0 bg-white/5" />
      </div>

      {/* Content Area Skeleton */}
      <div className={cn('flex flex-col flex-1', size === 'lg' ? 'justify-center' : '')}>
        {/* Title skeleton */}
        <div className="space-y-2 mb-4">
          <div className="h-5 w-[85%] rounded bg-[#2A2A35]" />
          <div className="h-5 w-[60%] rounded bg-[#2A2A35]" />
        </div>

        {/* Price Row Skeleton */}
        <div className="mt-auto pt-4 border-t border-[#2A2A35]/50 flex items-center justify-between">
          <div>
            {/* Old price */}
            <div className="h-3 w-12 rounded bg-[#2A2A35] mb-1.5" />
            {/* New price */}
            <div className="h-6 w-24 rounded bg-[#2A2A35]" />
          </div>

          {/* Discount badge */}
          <div className="h-6 w-14 rounded bg-[#2A2A35]" />
        </div>
        
        {/* Score Bar Skeleton */}
        <div className="w-full h-1.5 bg-[#2A2A35] rounded-full mt-4 overflow-hidden" />
      </div>
    </div>
  );
}
