import { useEffect, useState } from "react";
import type { SystemStats } from "../types/system";
import { fetchSystemStats, subscribeSystemStats } from "./systemMonitor";

export type SystemStatsFeed = {
  /** Latest snapshot, or `null` before the first one lands. */
  stats: SystemStats | null;
  /** True once a snapshot has arrived and nothing has failed since. */
  connected: boolean;
  /** Last transport error, surfaced on the LINK LOSS tile. */
  error: string | null;
};

/**
 * Subscribes to the backend sampler.
 *
 * The backend pushes; this hook does not poll. It takes one immediate reading
 * on mount so the console isn't blank for a full sample interval.
 */
export function useSystemStats(): SystemStatsFeed {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let unlisten: (() => void) | undefined;

    subscribeSystemStats((next) => {
      if (!live) return;
      setStats(next);
      setError(null);
    })
      .then((off) => {
        // Unmounted while the subscription was still being set up.
        if (!live) off();
        else unlisten = off;
      })
      .catch((err: unknown) => {
        if (live) setError(String(err));
      });

    fetchSystemStats()
      .then((first) => {
        if (!live) return;
        // A pushed sample that arrived first is newer; don't overwrite it.
        setStats((current) => current ?? first);
        setError(null);
      })
      .catch((err: unknown) => {
        if (live) setError(String(err));
      });

    return () => {
      live = false;
      unlisten?.();
    };
  }, []);

  return { stats, connected: stats !== null && error === null, error };
}
