/**
 * INSTRUMENT 3 — SEVEN SEGMENT READOUT
 *
 * Segments are drawn as polygons. Unlit segments are always painted,
 * because a real display shows its dark bars.
 */

const SEG_W = 22;
const SEG_H = 40;
const SEG_T = 5;

function hbar(x0: number, x1: number, y: number): string {
  const h = SEG_T / 2;
  return `${x0 + h},${y} ${x0 + SEG_T},${y - h} ${x1 - SEG_T},${y - h} ${x1 - h},${y} ${x1 - SEG_T},${y + h} ${x0 + SEG_T},${y + h}`;
}
function vbar(x: number, y0: number, y1: number): string {
  const h = SEG_T / 2;
  return `${x},${y0 + h} ${x + h},${y0 + SEG_T} ${x + h},${y1 - SEG_T} ${x},${y1 - h} ${x - h},${y1 - SEG_T} ${x - h},${y0 + SEG_T}`;
}

const SEG_GEOM: Record<string, string> = {
  a: hbar(3, 19, 4),
  g: hbar(3, 19, 20),
  d: hbar(3, 19, 36),
  f: vbar(3, 4, 20),
  b: vbar(19, 4, 20),
  e: vbar(3, 20, 36),
  c: vbar(19, 20, 36),
};

const SEG_MAP: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

function SevenSegDigit({ char, scale }: { char: string; scale: number }) {
  const on = SEG_MAP[char] ?? "";
  return (
    <svg
      width={SEG_W * scale}
      height={SEG_H * scale}
      viewBox={`0 0 ${SEG_W} ${SEG_H}`}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {Object.keys(SEG_GEOM).map((k) => (
        <polygon
          key={k}
          points={SEG_GEOM[k]}
          fill={on.includes(k) ? "var(--segment-lit)" : "var(--segment-unlit)"}
        />
      ))}
    </svg>
  );
}

function SegColon({ scale }: { scale: number }) {
  return (
    <svg
      width={7 * scale}
      height={SEG_H * scale}
      viewBox={`0 0 7 ${SEG_H}`}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect x="1" y="12" width="5" height="5" fill="var(--segment-lit)" />
      <rect x="1" y="25" width="5" height="5" fill="var(--segment-lit)" />
    </svg>
  );
}

/**
 * Fixed-width numeric window. `digits` never changes with the value, so the
 * readout cannot reflow when the number does.
 */
export function SegmentReadout({
  value,
  digits,
  units,
  scale = 0.85,
  colonAfter,
  title,
  readAs,
}: {
  value: number;
  digits: number;
  units?: string;
  scale?: number;
  colonAfter?: number;
  title: string;
  /** Spoken form, when the packed numeric value is not what a reader means. */
  readAs?: string;
}) {
  const clamped = Math.max(
    0,
    Math.min(Math.pow(10, digits) - 1, Math.round(value)),
  );
  const text = String(clamped).padStart(digits, "0");
  const spoken = readAs ?? `${clamped}${units ? ` ${units}` : ""}`;
  return (
    <div className="segwin" role="img" aria-label={`${title}: ${spoken}`}>
      {text.split("").map((ch, i) => (
        <span key={i} style={{ display: "flex" }}>
          <SevenSegDigit char={ch} scale={scale} />
          {colonAfter === i + 1 && <SegColon scale={scale} />}
        </span>
      ))}
      {units && <span className="segwin__units">{units}</span>}
    </div>
  );
}
