'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/patient/ui';

/**
 * Infinite scroll without flicker: one IntersectionObserver for the life of the list (callbacks are read
 * from refs, so re-renders don't re-create it), and it fires again only after the previous page has
 * finished loading.
 */
export function useInfiniteScroll(loadMore: () => Promise<void> | void, hasMore: boolean) {
  const sentinel = useRef<HTMLDivElement>(null);
  const load = useRef(loadMore);
  const busy = useRef(false);
  load.current = loadMore;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || busy.current) return;
        busy.current = true;
        try {
          await load.current();
        } finally {
          busy.current = false;
        }
      },
      { rootMargin: '800px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  return sentinel;
}

/** The quiet footer under an infinite list: a fixed-height spinner while the next page loads, no text swapping. */
export function InfiniteFooter({ sentinel, hasMore, loading }: { sentinel: React.RefObject<HTMLDivElement>; hasMore: boolean; loading: boolean }) {
  if (!hasMore) return null;
  return (
    <div ref={sentinel} className="h-12 flex items-center justify-center" aria-live="polite" aria-busy={loading}>
      <Icon name="progress_activity" className={`text-[24px] text-primary ${loading ? 'animate-spin opacity-100' : 'opacity-0'}`} />
      <span className="sr-only">{loading ? 'Loading more' : ''}</span>
    </div>
  );
}
