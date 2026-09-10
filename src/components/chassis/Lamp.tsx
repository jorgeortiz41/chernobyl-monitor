import type { CSSProperties } from "react";

export type LampColor = "amber" | "red" | "green" | "white";

export const LAMP_ON: Record<LampColor, string> = {
  amber: "var(--lamp-amber)",
  red: "var(--lamp-red)",
  green: "var(--lamp-green)",
  white: "var(--lamp-white)",
};
export const LAMP_OFF: Record<LampColor, string> = {
  amber: "var(--lamp-amber-off)",
  red: "var(--lamp-red-off)",
  green: "var(--lamp-green-off)",
  white: "var(--lamp-white-off)",
};
export const LAMP_HALO: Record<LampColor, string> = {
  amber: "rgba(232,163,61,0.42)",
  red: "rgba(196,64,47,0.42)",
  green: "rgba(110,155,76,0.40)",
  white: "rgba(240,230,200,0.40)",
};

export function Lamp({ color, lit }: { color: LampColor; lit: boolean }) {
  return (
    <span
      className="lamp"
      data-lit={lit}
      style={
        {
          "--on": LAMP_ON[color],
          "--off": LAMP_OFF[color],
          "--halo": LAMP_HALO[color],
        } as CSSProperties
      }
    />
  );
}

export function LampCell({
  color,
  lit,
  label,
}: {
  color: LampColor;
  lit: boolean;
  label: string;
}) {
  return (
    <div className="lampcell">
      <Lamp color={color} lit={lit} />
      <span
        className="nomen nomen--sub"
        style={{ textAlign: "center", lineHeight: 1.1 }}
      >
        {label}
      </span>
    </div>
  );
}
