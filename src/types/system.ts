/**
 * The contract with the Rust backend.
 *
 * Field names and casing are produced by `#[serde(rename_all = "camelCase")]`
 * on the structs in `src-tauri/src/monitor.rs`. Change one side, change both.
 */

export type ProcessInfo = {
  pid: number;
  name: string;
  /**
   * Percent of a single core, the `top` / Activity Monitor convention. A busy
   * multi-threaded process can legitimately exceed 100.
   */
  cpuUsage: number;
  /** Resident set size, bytes. */
  memory: number;
};

export type SystemStats = {
  /** 0-100, averaged across all logical cores. */
  cpuUsage: number;
  /** 0-100 per logical core; length is the machine's core count. */
  coreUsage: number[];
  totalMemory: number;
  usedMemory: number;
  swapTotal: number;
  swapUsed: number;
  /**
   * Hottest readable sensor in Celsius. `null` where the platform exposes no
   * sensors — Apple silicon reports none without elevated rights. Null means
   * "no channel", never "zero degrees".
   */
  tempC: number | null;
  tempLabel: string | null;
  /** Sorted by `cpuUsage` descending by the backend. */
  processes: ProcessInfo[];
};
