import type { CSSProperties } from "react";

/**
 * INSTRUMENT 2 — BARGRAPH COLUMN
 *
 * Twenty discrete segments, lit bottom up. A segment is on or off; there is
 * no such thing as a partly lit lamp.
 */

const BAR_SEGMENTS = 20;

export function Bargraph({
  value,
  label,
  sub,
}: {
  value: number;
  label: string;
  sub?: string;
}) {
  const lit = Math.round(
    (Math.max(0, Math.min(100, value)) / 100) * BAR_SEGMENTS,
  );
  const alarm = value >= 85;
  return (
    <div className="bargraph" style={{ flex: 1 }}>
      <div
        className="bargraph__stack"
        role="img"
        aria-label={`${label}: ${value.toFixed(0)} percent`}
      >
        {Array.from({ length: BAR_SEGMENTS }, (_, i) => {
          const segTop = ((i + 1) / BAR_SEGMENTS) * 100;
          // Red lens zone at the top of the column; the whole stack goes red
          // once the reading itself is in alarm.
          const red = alarm || segTop > 85;
          return (
            <span
              key={i}
              className="bargraph__seg"
              data-lit={i < lit}
              style={
                {
                  "--segon": red ? "var(--lamp-red)" : "var(--lamp-amber)",
                  "--segoff": red
                    ? "var(--lamp-red-off)"
                    : "var(--lamp-amber-off)",
                } as CSSProperties
              }
            />
          );
        })}
      </div>
      <span className="nomen nomen--sub">{label}</span>
      {sub && <span className="nomen nomen--sub">{sub}</span>}
    </div>
  );
}
