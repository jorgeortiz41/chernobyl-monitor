import { useEffect, useMemo, useState } from "react";
import type { SystemStats } from "../types/system";
import { deriveAlarms, CPU_ALARM_THRESHOLD } from "../lib/alarms";
import { useElapsedSeconds } from "../hooks/useElapsedSeconds";
import type { ChartSample } from "./instruments/StripChart";
import type { TripState } from "./instruments/GuardedSwitch";
import { HeaderPanel } from "./panels/HeaderPanel";
import { CpuPanel } from "./panels/CpuPanel";
import { RecorderPanel } from "./panels/RecorderPanel";
import { CoreMemoryPanel } from "./panels/CoreMemoryPanel";
import { ProcessPanel } from "./panels/ProcessPanel";
import { AnnunciatorPanel } from "./panels/AnnunciatorPanel";

/** How many samples of chart paper to keep behind the pen. */
const HISTORY_DEPTH = 180;

/**
 * The assembled console. Pure presentation: everything it knows arrives in
 * props, and every operator action leaves through a callback.
 */
export function ReactorConsole({
  stats,
  connected,
  selectedPid,
  onSelectProcess,
  onKillProcess,
  tripState,
}: {
  stats: SystemStats | null;
  connected: boolean;
  selectedPid: number | null;
  onSelectProcess: (pid: number | null) => void;
  onKillProcess: (pid: number, force: boolean) => void;
  tripState: TripState;
}) {
  const [lampTest, setLampTest] = useState(false);
  const [history, setHistory] = useState<ChartSample[]>([]);
  const elapsed = useElapsedSeconds();

  // The recorder keeps its own paper trail of what it has been shown. This is
  // ink on a chart, not a data subscription.
  useEffect(() => {
    if (!stats) return;
    setHistory((h) =>
      [...h, { t: performance.now(), v: stats.cpuUsage }].slice(-HISTORY_DEPTH),
    );
  }, [stats]);

  const alarms = useMemo(() => deriveAlarms(stats), [stats]);

  return (
    <>
      <div className="console">
        <HeaderPanel
          connected={connected}
          alarms={alarms}
          lampTest={lampTest}
          elapsedSeconds={elapsed}
        />
        <CpuPanel
          cpuUsage={stats?.cpuUsage ?? 0}
          processCount={stats?.processes.length ?? 0}
        />
        <RecorderPanel history={history} threshold={CPU_ALARM_THRESHOLD} />
        <CoreMemoryPanel stats={stats} />
        <ProcessPanel
          processes={stats?.processes ?? []}
          selectedPid={selectedPid}
          onSelectProcess={onSelectProcess}
          onKillProcess={onKillProcess}
          tripState={tripState}
        />
        <AnnunciatorPanel
          alarms={alarms}
          lampTest={lampTest}
          onLampTest={setLampTest}
        />
      </div>
      <div className="grain" aria-hidden="true" />
    </>
  );
}
