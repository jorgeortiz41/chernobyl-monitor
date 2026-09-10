import { useCallback, useRef } from "react";
import type { ProcessInfo } from "../../types/system";
import { MB } from "../../lib/format";

/**
 * INSTRUMENT 6 — PROCESS TABLE
 *
 * Continuous-feed line printer output on greenbar stock.
 */

export function ProcessTable({
  processes,
  selectedPid,
  onSelectProcess,
}: {
  processes: ProcessInfo[];
  selectedPid: number | null;
  onSelectProcess: (pid: number | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const moveFocus = useCallback(
    (from: number, delta: number) => {
      const next = Math.max(0, Math.min(processes.length - 1, from + delta));
      const target = processes[next];
      if (!target) return;
      onSelectProcess(target.pid);
      const el = scrollRef.current?.querySelector<HTMLElement>(
        `[data-pid="${target.pid}"]`,
      );
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    },
    [processes, onSelectProcess],
  );

  const punches = 40;

  return (
    <div className="printer">
      <div className="printer__tractor printer__tractor--l" aria-hidden="true">
        {Array.from({ length: punches }, (_, i) => (
          <span key={i} className="printer__punch" />
        ))}
      </div>

      <div className="printer__sheet">
        <div className="prow prow--head" role="row" aria-hidden="true">
          <span className="pnum">PID</span>
          <span>Process</span>
          <span className="pnum">CPU</span>
          <span className="pnum">Mem MB</span>
        </div>
        <div
          className="printer__scroll"
          ref={scrollRef}
          role="grid"
          aria-label="Running processes"
          aria-rowcount={processes.length}
        >
          {processes.map((p, i) => {
            const selected = p.pid === selectedPid;
            const tabbable = selected || (selectedPid === null && i === 0);
            return (
              <div
                key={p.pid}
                className="prow prow--data"
                role="row"
                aria-rowindex={i + 1}
                aria-selected={selected}
                data-pid={p.pid}
                data-selected={selected}
                tabIndex={tabbable ? 0 : -1}
                onClick={() => onSelectProcess(selected ? null : p.pid)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectProcess(selected ? null : p.pid);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    moveFocus(i, 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    moveFocus(i, -1);
                  }
                }}
              >
                <span className="pnum" role="gridcell">
                  {p.pid}
                </span>
                <span role="gridcell">{p.name}</span>
                <span
                  className={`pnum${p.cpuUsage >= 50 ? " phot" : ""}`}
                  role="gridcell"
                >
                  {p.cpuUsage.toFixed(1)}
                </span>
                <span className="pnum" role="gridcell">
                  {(p.memory / MB).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="printer__tractor printer__tractor--r" aria-hidden="true">
        {Array.from({ length: punches }, (_, i) => (
          <span key={i} className="printer__punch" />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * INSTRUMENT 7 — GUARDED SWITCH
 * The cover must be raised before the switch can be thrown. Two deliberate
 * actions, and the switch stays thrown until the operator closes the cover.
 * ========================================================================== */
