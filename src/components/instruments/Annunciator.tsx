import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { LAMP_ON, LAMP_OFF, type LampColor } from "../chassis/Lamp";
import type { AlarmId, AlarmState } from "../../lib/alarms";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useSquareWave } from "../../hooks/useSquareWave";

/**
 * INSTRUMENT 5 — ANNUNCIATOR PANEL
 *
 * Dark when clear. Flashing at 1 Hz when in alarm. Steady once acknowledged.
 * A new alarm re-flashes even if its tile was previously acknowledged.
 */

type TileSpec = { id: AlarmId; legend: string; color: LampColor };

const ANNUN_TILES: TileSpec[] = [
  { id: "CPU_HIGH", legend: "CPU High", color: "amber" },
  { id: "CORE_IMBALANCE", legend: "Core Imbalance", color: "amber" },
  { id: "THERMAL", legend: "Thermal", color: "amber" },
  { id: "MEM_HIGH", legend: "Mem High", color: "amber" },
  { id: "MEM_CRITICAL", legend: "Mem Critical", color: "red" },
  { id: "SWAP_ACTIVE", legend: "Swap Active", color: "amber" },
  { id: "PROC_COUNT_HIGH", legend: "Proc Count High", color: "amber" },
  { id: "LINK_LOSS", legend: "Link Loss", color: "red" },
  { id: "SPARE_1", legend: "Spare", color: "white" },
  { id: "SPARE_2", legend: "Spare", color: "white" },
  { id: "SPARE_3", legend: "Spare", color: "white" },
  { id: "SPARE_4", legend: "Spare", color: "white" },
];

export function Annunciator({
  alarms,
  lampTest,
  onLampTest,
}: {
  alarms: AlarmState;
  lampTest: boolean;
  onLampTest: (held: boolean) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const flashOn = useSquareWave(1, !reduced);
  const [acked, setAcked] = useState<AlarmId[]>([]);
  const previous = useRef<Partial<AlarmState>>({});

  useEffect(() => {
    const before = previous.current;
    setAcked((current) =>
      current.filter(
        // drop the ack if the alarm cleared, or if it just re-annunciated
        (id) => alarms[id] && before[id],
      ),
    );
    previous.current = { ...alarms };
  }, [alarms]);

  const acknowledge = useCallback(() => {
    setAcked(ANNUN_TILES.filter((t) => alarms[t.id]).map((t) => t.id));
  }, [alarms]);

  const unacked = ANNUN_TILES.some(
    (t) => alarms[t.id] && !acked.includes(t.id),
  );

  return (
    <>
      <div className="annun" role="group" aria-label="Annunciator panel">
        {ANNUN_TILES.map((t) => {
          const active = !!alarms[t.id];
          const isAcked = acked.includes(t.id);
          const lit = lampTest || (active && (isAcked || flashOn));
          return (
            <div
              key={t.id}
              className="tile"
              data-lit={lit}
              role="status"
              aria-label={`${t.legend}: ${active ? (isAcked ? "alarm acknowledged" : "alarm") : "clear"}`}
              style={
                {
                  "--on": LAMP_ON[t.color],
                  "--off": LAMP_OFF[t.color],
                } as CSSProperties
              }
            >
              {t.legend}
            </div>
          );
        })}
      </div>

      <div
        style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "stretch" }}
      >
        <button
          type="button"
          className="switchbtn"
          style={{ flex: 1 }}
          onClick={acknowledge}
          disabled={!unacked}
        >
          Acknowledge
        </button>
        <button
          type="button"
          className="switchbtn"
          style={{ flex: 1 }}
          data-held={lampTest}
          onPointerDown={() => onLampTest(true)}
          onPointerUp={() => onLampTest(false)}
          onPointerLeave={() => onLampTest(false)}
          onPointerCancel={() => onLampTest(false)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") onLampTest(true);
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") onLampTest(false);
          }}
          onBlur={() => onLampTest(false)}
        >
          Lamp Test
        </button>
      </div>
    </>
  );
}

/* ============================================================================
 * INSTRUMENT 6 — PROCESS TABLE
 * Continuous-feed line printer output on greenbar stock.
 * ========================================================================== */
