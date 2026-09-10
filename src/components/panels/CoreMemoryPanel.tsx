import { Plate } from "../chassis/Plate";
import { Bargraph } from "../instruments/Bargraph";
import { SegmentReadout } from "../instruments/SegmentReadout";
import { percentOf, toMB } from "../../lib/format";
import type { SystemStats } from "../../types/system";

/** Per-core bargraph array, plus core store: RAM, swap and the thermal channel. */
export function CoreMemoryPanel({ stats }: { stats: SystemStats | null }) {
  const cores = stats?.coreUsage ?? [];
  const memPercent = percentOf(stats?.usedMemory ?? 0, stats?.totalMemory ?? 0);
  const swapPercent = percentOf(stats?.swapUsed ?? 0, stats?.swapTotal ?? 0);

  return (
    <Plate label="Core Array" sub={cores.length ? `${cores.length} ch` : "— ch"}>
      <div
        className="well"
        style={{ flex: 2, display: "flex", gap: 5, padding: 8, minHeight: 0 }}
      >
        {cores.length === 0 ? (
          <span className="nomen nomen--dark" style={{ margin: "auto" }}>
            No Signal
          </span>
        ) : (
          cores.map((v, i) => (
            <Bargraph key={i} value={v} label={String(i + 1).padStart(2, "0")} />
          ))
        )}
      </div>

      <div className="plate__label" style={{ margin: "11px 0 8px" }}>
        <span className="nomen">Memory</span>
        <span className="plate__rule" />
        <span className="nomen nomen--sub">Core Store</span>
      </div>

      <div
        className="well"
        style={{
          flex: 1.35,
          display: "flex",
          gap: 10,
          padding: 8,
          minHeight: 0,
        }}
      >
        <div style={{ width: 26, display: "flex" }}>
          <Bargraph value={memPercent} label="Ram" />
        </div>
        <div style={{ width: 26, display: "flex" }}>
          <Bargraph value={swapPercent} label="Swp" />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 5,
            minWidth: 0,
          }}
        >
          <span className="nomen nomen--dark">In Use</span>
          <SegmentReadout
            value={toMB(stats?.usedMemory ?? 0)}
            digits={6}
            units="MB"
            scale={0.56}
            title="Memory in use, megabytes"
          />
          <MeterLine
            label="Inst"
            value={`${toMB(stats?.totalMemory ?? 0).toFixed(0).padStart(6, "0")} MB`}
          />
          <MeterLine
            label="Swap"
            value={`${toMB(stats?.swapUsed ?? 0).toFixed(0).padStart(6, "0")} MB`}
          />
          <MeterLine
            label="Therm"
            /* A missing sensor is a missing channel, not zero degrees. */
            value={
              stats?.tempC != null
                ? `${stats.tempC.toFixed(0).padStart(3, "0")} °C`
                : "--- NO SENSOR"
            }
            title={stats?.tempLabel ?? undefined}
          />
        </div>
      </div>
    </Plate>
  );
}

function MeterLine({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "baseline", gap: 7 }}
      title={title}
    >
      <span
        className="nomen nomen--sub"
        style={{ width: 34, flex: "none", color: "rgba(228,220,198,0.55)" }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{ fontSize: 13, color: "rgba(228,220,198,0.78)" }}
      >
        {value}
      </span>
    </div>
  );
}
