import { Plate } from "../chassis/Plate";
import { ProcessTable } from "../instruments/ProcessTable";
import { GuardedSwitch } from "../instruments/GuardedSwitch";
import type { ProcessInfo } from "../../types/system";

/** The process log, with the guarded trip switch bolted to its lower rail. */
export function ProcessPanel({
  processes,
  selectedPid,
  onSelectProcess,
  onKillProcess,
  tripState,
}: {
  processes: ProcessInfo[];
  selectedPid: number | null;
  onSelectProcess: (pid: number | null) => void;
  onKillProcess: (pid: number, force: boolean) => void;
  tripState: { pid: number | null; stillRunning: boolean; error: string | null };
}) {
  const selected = processes.find((p) => p.pid === selectedPid) ?? null;

  return (
    <Plate
      label="Process Log"
      sub="Sorted by demand · Line printer 1403"
      style={{ gridColumn: "1 / span 2" }}
    >
      <ProcessTable
        processes={processes}
        selectedPid={selectedPid}
        onSelectProcess={onSelectProcess}
      />
      <div
        style={{
          flex: "none",
          marginTop: 10,
          paddingTop: 10,
          borderTop: "2px solid var(--seam)",
          boxShadow: "0 -3px 0 rgba(255,255,255,0.10)",
        }}
      >
        <GuardedSwitch
          selectedPid={selectedPid}
          selectedName={selected?.name ?? null}
          onKillProcess={onKillProcess}
          tripState={tripState}
        />
      </div>
    </Plate>
  );
}
