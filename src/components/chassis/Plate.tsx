import type { ReactNode, CSSProperties } from "react";
import { Screw } from "./Screw";

export function Plate({
  label,
  sub,
  style,
  children,
}: {
  label?: string;
  sub?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section className="plate" style={style}>
      <Screw corner="tl" rot={18} />
      <Screw corner="tr" rot={-42} />
      <Screw corner="bl" rot={65} />
      <Screw corner="br" rot={-9} />
      {label && (
        <div className="plate__label">
          <span className="nomen">{label}</span>
          <span className="plate__rule" />
          {sub && <span className="nomen nomen--sub">{sub}</span>}
        </div>
      )}
      <div className="plate__body">{children}</div>
    </section>
  );
}
