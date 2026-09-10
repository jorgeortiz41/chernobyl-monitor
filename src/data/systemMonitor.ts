/**
 * The only module that talks to Tauri. Everything above this line receives
 * plain data and hands back plain intent.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SystemStats } from "../types/system";

/** Event name emitted by the sampler thread in `src-tauri/src/lib.rs`. */
const STATS_EVENT = "system-stats";

/** One-shot reading, so the panel has something to show before the first tick. */
export function fetchSystemStats(): Promise<SystemStats> {
  return invoke<SystemStats>("get_system_stats");
}

/** Subscribe to the sampler. Returns the unlisten handle. */
export function subscribeSystemStats(
  onStats: (stats: SystemStats) => void,
): Promise<UnlistenFn> {
  return listen<SystemStats>(STATS_EVENT, (event) => onStats(event.payload));
}

/**
 * Signal a process. `force` escalates SIGTERM to SIGKILL.
 * Rejects with the backend's message when the process is gone or protected.
 */
export function killProcess(pid: number, force = false): Promise<void> {
  return invoke<void>("kill_process", { pid, force });
}
