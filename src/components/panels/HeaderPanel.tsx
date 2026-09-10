import { Plate } from "../chassis/Plate";
import { Nameplate } from "../chassis/Nameplate";
import { LampCell } from "../chassis/Lamp";
import { SegmentReadout } from "../instruments/SegmentReadout";
import type { AlarmState } from "../../lib/alarms";

/** Nameplate, master lamp row, and the elapsed-run readout. */
export function HeaderPanel({
  connected,
  alarms,
  lampTest,
  elapsedSeconds,
}: {
  connected: boolean;
  alarms: AlarmState;
  lampTest: boolean;
  elapsedSeconds: number;
}) {
  const anyAlarm = Object.values(alarms).some(Boolean);
  const mm = Math.min(99, Math.floor(elapsedSeconds / 60));
  const ss = elapsedSeconds % 60;

  return (
    <Plate style={{ gridColumn: "1 / -1", padding: "6px 16px" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <Nameplate />

        <div
          className="well"
          style={{ display: "flex", gap: 2, padding: "6px 10px" }}
        >
          {/* The console has power whenever it is running. */}
          <LampCell color="green" lit label="Power" />
          {/* Always lit; the colour is the message. */}
          <LampCell
            color={connected ? "green" : "red"}
            lit
            label="Data Link"
          />
          <LampCell
            color="red"
            lit={lampTest || alarms.CPU_HIGH}
            label="CPU Alarm"
          />
          <LampCell
            color="red"
            lit={lampTest || alarms.MEM_CRITICAL}
            label="Mem Trip"
          />
          <LampCell color="amber" lit={lampTest || anyAlarm} label="Annun" />
          <LampCell color="white" lit={lampTest} label="Test" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="nomen nomen--sub">Elapsed</span>
          <SegmentReadout
            value={mm * 100 + ss}
            digits={4}
            colonAfter={2}
            scale={0.85}
            title="Elapsed run time"
            readAs={`${mm} minutes ${ss} seconds`}
          />
        </div>
      </div>
    </Plate>
  );
}
