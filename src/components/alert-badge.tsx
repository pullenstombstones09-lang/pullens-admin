'use client';

import { useEffect, useState, useCallback } from 'react';

export function AlertBadge() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      // Silently fail — badge just shows stale count
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  if (count === 0) return null;

  return (
    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function useAlertCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function fetch_() {
      try {
        const res = await fetch('/api/alerts');
        if (res.ok && mounted) {
          const data = await res.json();
          setCount(Array.isArray(data) ? data.length : 0);
        }
      } catch {
        // ignore
      }
    }

    fetch_();
    const interval = setInterval(fetch_, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return count;
}
