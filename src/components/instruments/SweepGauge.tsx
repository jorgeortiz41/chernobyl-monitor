import { useSpring } from "../../hooks/useSpring";

/**
 * INSTRUMENT 1 — SWEEP GAUGE
 *
 * 240 degrees of painted arc on a cream face, black needle with a
 * counterweight tail, red hatched danger band from 85 to 100.
 */

const G_CX = 110;
const G_CY = 104;
const G_SWEEP = 240;

function gAngle(v: number): number {
  return -G_SWEEP / 2 + (Math.max(0, Math.min(100, v)) / 100) * G_SWEEP;
}
function gPolar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [G_CX + r * Math.sin(rad), G_CY - r * Math.cos(rad)];
}
function gAnnulus(v0: number, v1: number, rIn: number, rOut: number): string {
  const a0 = gAngle(v0);
  const a1 = gAngle(v1);
  const large = a1 - a0 > 180 ? 1 : 0;
  const [ox0, oy0] = gPolar(rOut, a0);
  const [ox1, oy1] = gPolar(rOut, a1);
  const [ix1, iy1] = gPolar(rIn, a1);
  const [ix0, iy0] = gPolar(rIn, a0);
  return [
    `M ${ox0} ${oy0}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${ox1} ${oy1}`,
    `L ${ix1} ${iy1}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${ix0} ${iy0}`,
    "Z",
  ].join(" ");
}

export function SweepGauge({ value, label }: { value: number; label: string }) {
  const needle = useSpring(Math.max(0, Math.min(100, value)));
  const majors = [0, 20, 40, 60, 80, 100];
  const minors: number[] = [];
  for (let v = 0; v <= 100; v += 5) if (v % 20 !== 0) minors.push(v);

  return (
    <svg
      viewBox="0 0 220 208"
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label={`${label}: ${value.toFixed(0)} percent`}
    >
      <defs>
        <pattern
          id="dangerHatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" fill="#E4DCC6" />
          <rect width="3.4" height="7" fill="#B0332A" />
        </pattern>
        <clipPath id="dialClip">
          <circle cx={G_CX} cy={G_CY} r="90" />
        </clipPath>
      </defs>

      {/* machined bezel */}
      <circle cx={G_CX} cy={G_CY} r="101" fill="var(--seam)" />
      <circle cx={G_CX} cy={G_CY} r="99" fill="var(--bezel)" />
      <circle
        cx={G_CX}
        cy={G_CY}
        r="94"
        fill="none"
        stroke="#545044"
        strokeWidth="1.4"
      />
      <circle cx={G_CX} cy={G_CY} r="90" fill="var(--dial-face)" />

      {/* danger band 85-100 */}
      <path d={gAnnulus(85, 100, 74, 86)} fill="url(#dangerHatch)" />
      <path
        d={gAnnulus(85, 100, 74, 86)}
        fill="none"
        stroke="#8E2118"
        strokeWidth="1.2"
      />

      {/* painted scale arc */}
      <path
        d={`M ${gPolar(86, gAngle(0)).join(" ")} A 86 86 0 1 1 ${gPolar(86, gAngle(100)).join(" ")}`}
        fill="none"
        stroke="var(--engrave)"
        strokeWidth="1.3"
      />

      {minors.map((v) => {
        const a = gAngle(v);
        const [x1, y1] = gPolar(86, a);
        const [x2, y2] = gPolar(78, a);
        return (
          <line
            key={v}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--engrave)"
            strokeWidth="1.1"
          />
        );
      })}

      {majors.map((v) => {
        const a = gAngle(v);
        const [x1, y1] = gPolar(86, a);
        const [x2, y2] = gPolar(69, a);
        const [tx, ty] = gPolar(56, a);
        return (
          <g key={v}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--engrave)"
              strokeWidth="2.6"
            />
            <text
              x={tx}
              y={ty + 5}
              textAnchor="middle"
              fill="var(--engrave)"
              fontFamily="var(--nomen)"
              fontWeight="600"
              fontSize="13"
              letterSpacing="0.06em"
            >
              {v}
            </text>
          </g>
        );
      })}

      <text
        x={G_CX}
        y={G_CY + 44}
        textAnchor="middle"
        fill="var(--engrave)"
        fontFamily="var(--nomen)"
        fontWeight="600"
        fontSize="11"
        letterSpacing="0.14em"
      >
        PERCENT LOAD
      </text>
      <text
        x={G_CX}
        y={G_CY + 58}
        textAnchor="middle"
        fill="rgba(26,24,19,0.55)"
        fontFamily="var(--nomen)"
        fontWeight="600"
        fontSize="9"
        letterSpacing="0.14em"
      >
        TYPE 411&#8209;B
      </text>

      {/* needle with counterweight tail past the pivot */}
      <g transform={`rotate(${gAngle(needle)} ${G_CX} ${G_CY})`}>
        <circle cx={G_CX} cy={G_CY + 24} r="6.5" fill="#141210" />
        <polygon
          points={`${G_CX},${G_CY - 68} ${G_CX + 3},${G_CY - 8} ${G_CX + 5},${G_CY + 22} ${G_CX - 5},${G_CY + 22} ${G_CX - 3},${G_CY - 8}`}
          fill="#141210"
        />
      </g>
      <circle cx={G_CX} cy={G_CY} r="9" fill="#3A382F" />
      <circle cx={G_CX} cy={G_CY} r="5.5" fill="#8B846F" />
      <circle
        cx={G_CX}
        cy={G_CY}
        r="5.5"
        fill="none"
        stroke="#3A382F"
        strokeWidth="0.8"
      />

      {/* glass specular across the upper left */}
      <g clipPath="url(#dialClip)">
        <ellipse
          cx={G_CX - 42}
          cy={G_CY - 52}
          rx="78"
          ry="34"
          fill="rgba(255,255,255,0.16)"
          transform={`rotate(-34 ${G_CX - 42} ${G_CY - 52})`}
        />
      </g>
    </svg>
  );
}
