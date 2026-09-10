import { useCallback, useEffect, useState } from "react";
import "./styles/console.css";
import { ReactorConsole } from "./components/ReactorConsole";
import type { TripState } from "./components/instruments/GuardedSwitch";
import { useSystemStats } from "./data/useSystemStats";
import { killProcess } from "./data/systemMonitor";

/**
 * Shell. The only place that knows where data comes from and what the
 * operator's intent does to the machine.
 */
export default function App() {
  const { stats, connected } = useSystemStats();
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [trip, setTrip] = useState<TripState>({
    pid: null,
    stillRunning: false,
    error: null,
  });

  // Did the target survive the signal? Answered by the next sample, not by us.
  useEffect(() => {
    if (trip.pid === null || !stats) return;
    const alive = stats.processes.some((p) => p.pid === trip.pid);
    setTrip((t) => (t.stillRunning === alive ? t : { ...t, stillRunning: alive }));
  }, [stats, trip.pid]);

  const handleSelect = useCallback((pid: number | null) => {
    setSelectedPid(pid);
    setTrip({ pid: null, stillRunning: false, error: null });
  }, []);

  const handleKill = useCallback((pid: number, force: boolean) => {
    setTrip({ pid, stillRunning: true, error: null });
    killProcess(pid, force).catch((err: unknown) => {
      setTrip({ pid, stillRunning: true, error: String(err) });
    });
  }, []);

  return (
    <ReactorConsole
      stats={stats}
      connected={connected}
      selectedPid={selectedPid}
      onSelectProcess={handleSelect}
      onKillProcess={handleKill}
      tripState={trip}
    />
  );
}
