import type { SystemStats } from "../types/system";
import { percentOf } from "./format";

/** Every tile the annunciator can light, in panel reading order. */
export const ALARM_IDS = [
  "CPU_HIGH",
  "CORE_IMBALANCE",
  "THERMAL",
  "MEM_HIGH",
  "MEM_CRITICAL",
  "SWAP_ACTIVE",
  "PROC_COUNT_HIGH",
  "LINK_LOSS",
  "SPARE_1",
  "SPARE_2",
  "SPARE_3",
  "SPARE_4",
] as const;

export type AlarmId = (typeof ALARM_IDS)[number];
export type AlarmState = Record<AlarmId, boolean>;

export const CPU_ALARM_THRESHOLD = 85;
export const CORE_IMBALANCE_SPREAD = 60;
export const MEM_HIGH_PERCENT = 75;
export const MEM_CRITICAL_PERCENT = 90;
/**
 * macOS idles around 450-550 processes, so a threshold under that would leave
 * this tile permanently lit — the same failure mode SWAP_ACTIVE avoids below.
 */
export const PROC_COUNT_ALARM = 700;
/**
 * Swap in use at all is normal on macOS, so a bare `> 0` would leave this tile
 * permanently lit — an alarm that is always on is an alarm nobody reads.
 */
export const SWAP_ACTIVE_PERCENT = 10;
/** Below typical throttle points (90-100C), high enough to mean something. */
export const THERMAL_ALARM_C = 85;

export function deriveAlarms(stats: SystemStats | null): AlarmState {
  if (!stats) {
    return {
      ...(Object.fromEntries(ALARM_IDS.map((id) => [id, false])) as AlarmState),
      LINK_LOSS: true,
    };
  }

  const memPercent = percentOf(stats.usedMemory, stats.totalMemory);
  const swapPercent = percentOf(stats.swapUsed, stats.swapTotal);
  const cores = stats.coreUsage;
  const spread = cores.length
    ? Math.max(...cores) - Math.min(...cores)
    : 0;

  return {
    CPU_HIGH: stats.cpuUsage >= CPU_ALARM_THRESHOLD,
    CORE_IMBALANCE: spread >= CORE_IMBALANCE_SPREAD,
    THERMAL: stats.tempC !== null && stats.tempC >= THERMAL_ALARM_C,
    MEM_HIGH: memPercent >= MEM_HIGH_PERCENT,
    MEM_CRITICAL: memPercent >= MEM_CRITICAL_PERCENT,
    SWAP_ACTIVE: swapPercent >= SWAP_ACTIVE_PERCENT,
    PROC_COUNT_HIGH: stats.processes.length >= PROC_COUNT_ALARM,
    LINK_LOSS: false,
    SPARE_1: false,
    SPARE_2: false,
    SPARE_3: false,
    SPARE_4: false,
  };
}
