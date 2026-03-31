"use client";

import { useEffect, useState } from "react";

export function usePolling<T>(fetcher: () => Promise<T>, interval = 15000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetcher();
        if (mounted) {
          setData(next);
          setError(null);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError instanceof Error ? fetchError.message : "Unknown error");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, interval);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [fetcher, interval]);

  return { data, loading, error };
}
