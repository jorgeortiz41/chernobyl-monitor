import { Plate } from "../chassis/Plate";
import { SweepGauge } from "../instruments/SweepGauge";
import { SegmentReadout } from "../instruments/SegmentReadout";

/** Sweep gauge for total CPU, with load and process-count readouts beneath. */
export function CpuPanel({
  cpuUsage,
  processCount,
}: {
  cpuUsage: number;
  processCount: number;
}) {
  return (
    <Plate label="CPU Total" sub="M-1">
      <div className="well" style={{ flex: 1, minHeight: 0, padding: 8 }}>
        <SweepGauge value={cpuUsage} label="Total CPU load" />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 8,
          marginTop: 9,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="nomen nomen--sub">Load Pct</span>
          <SegmentReadout
            value={cpuUsage}
            digits={3}
            units="PCT"
            scale={0.72}
            title="Total CPU load percent"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="nomen nomen--sub">Proc Count</span>
          <SegmentReadout
            value={processCount}
            digits={4}
            scale={0.72}
            title="Process count"
          />
        </div>
      </div>
    </Plate>
  );
}
