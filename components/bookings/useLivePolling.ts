"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseLivePollingOptions<T> = {
  initialData: T;
  load: (signal: AbortSignal) => Promise<T>;
  intervalMs?: number;
  hiddenIntervalMs?: number;
  maxBackoffMs?: number;
  enabled?: boolean;
};

type UseLivePollingResult<T> = {
  data: T;
  setData: React.Dispatch<React.SetStateAction<T>>;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
};

export function useLivePolling<T>({
  initialData,
  load,
  intervalMs = 15000,
  hiddenIntervalMs = 30000,
  maxBackoffMs = 60000,
  enabled = true,
}: UseLivePollingOptions<T>): UseLivePollingResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const failureCountRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      abortRef.current?.abort();
      inFlightRef.current = false;
      return;
    }

    let cancelled = false;

    const getBaseDelay = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return hiddenIntervalMs;
      }

      return intervalMs;
    };

    const getNextDelay = () => {
      const baseDelay = getBaseDelay();
      if (failureCountRef.current === 0) {
        return baseDelay;
      }

      return Math.min(baseDelay * 2 ** (failureCountRef.current - 1), maxBackoffMs);
    };

    const scheduleNext = (delay = getNextDelay()) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        void run();
      }, delay);
    };

    const run = async () => {
      if (cancelled || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      const initialRun = !loadedOnceRef.current;

      if (initialRun) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const nextData = await load(controller.signal);
        if (cancelled || controller.signal.aborted) {
          return;
        }

        loadedOnceRef.current = true;
        failureCountRef.current = 0;
        setData(nextData);
        setError(null);
        setLastUpdated(new Date());
      } catch (loadError) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        failureCountRef.current += 1;
        setError(loadError instanceof Error ? loadError.message : "Live update failed");
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
          scheduleNext();
        }

        inFlightRef.current = false;
      }
    };

    const onVisibilityChange = () => {
      if (cancelled || inFlightRef.current) {
        return;
      }

      scheduleNext(document.visibilityState === "visible" ? 250 : hiddenIntervalMs);
    };

    void run();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearTimer();
      abortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clearTimer, enabled, hiddenIntervalMs, intervalMs, load, maxBackoffMs]);

  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    lastUpdated,
  };
}