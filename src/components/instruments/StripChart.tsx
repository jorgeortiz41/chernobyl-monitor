import { useEffect, useRef } from "react";
import { useElementSize } from "../../hooks/useElementSize";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/** INSTRUMENT 4 — STRIP CHART RECORDER */

export type ChartSample = { t: number; v: number };

/** Paper speed. One second of history occupies this many pixels. */
const PAPER_PX_PER_SEC = 36;
const CH_PAD_L = 30;
const CH_PAD_T = 8;
const CH_PAD_B = 14;

export function StripChart({
  history,
  threshold,
  label,
}: {
  history: ChartSample[];
  threshold: number;
  label: string;
}) {
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);

    const css = getComputedStyle(document.documentElement);
    const tok = (n: string) => css.getPropertyValue(n).trim();
    const bg = tok("--crt-bg") || "#0E120C";
    const phos = tok("--phosphor") || "#7FCB5C";
    const red = tok("--lamp-red") || "#C4402F";

    const w = size.w;
    const h = size.h;
    const plotL = CH_PAD_L;
    const plotT = CH_PAD_T;
    const plotB = h - CH_PAD_B;
    const yFor = (v: number) =>
      plotB - (Math.max(0, Math.min(100, v)) / 100) * (plotB - plotT);

    const draw = () => {
      const now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Sample -> x. Live, the paper moves at a constant rate. Under reduced
      // motion the paper is stepped one sample interval at a time instead.
      const newest = history.length ? history[history.length - 1].t : now;
      const xFor = (t: number) =>
        reduced
          ? w - ((newest - t) / 1000) * PAPER_PX_PER_SEC
          : w - ((now - t) / 1000) * PAPER_PX_PER_SEC;

      ctx.save();
      ctx.beginPath();
      ctx.rect(plotL, 0, w - plotL, h);
      ctx.clip();

      // printed gridlines: minor every second, major every five
      const phase = reduced
        ? 0
        : ((now / 1000) * PAPER_PX_PER_SEC) % (PAPER_PX_PER_SEC * 5);
      for (let i = 0; i * PAPER_PX_PER_SEC < w + PAPER_PX_PER_SEC * 5; i++) {
        const x = Math.round(w - phase - i * PAPER_PX_PER_SEC) + 0.5;
        if (x < plotL) continue;
        ctx.strokeStyle =
          i % 5 === 0 ? "rgba(127,203,92,0.20)" : "rgba(127,203,92,0.09)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, plotT);
        ctx.lineTo(x, plotB);
        ctx.stroke();
      }
      for (let v = 0; v <= 100; v += 10) {
        const y = Math.round(yFor(v)) + 0.5;
        ctx.strokeStyle =
          v % 20 === 0 ? "rgba(127,203,92,0.22)" : "rgba(127,203,92,0.09)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // alarm threshold pen
      const ty = Math.round(yFor(threshold)) + 0.5;
      ctx.strokeStyle = red;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotL, ty);
      ctx.lineTo(w, ty);
      ctx.stroke();

      // trace: straight segments through the actual samples, no smoothing
      if (history.length > 1) {
        const path = new Path2D();
        history.forEach((s, i) => {
          const x = xFor(s.t);
          const y = yFor(s.v);
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        ctx.strokeStyle = phos;
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 3.5;
        ctx.stroke(path);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.stroke(path);
      }

      // pen carriage at the live edge
      if (history.length) {
        const last = history[history.length - 1];
        const px = xFor(last.t);
        const py = yFor(last.v);
        ctx.strokeStyle = "rgba(127,203,92,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(w, py);
        ctx.stroke();
        ctx.fillStyle = phos;
        ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
      }
      ctx.restore();

      // percent axis in the left gutter
      ctx.fillStyle = "rgba(127,203,92,0.62)";
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let v = 0; v <= 100; v += 20) {
        ctx.fillText(String(v).padStart(3, " "), plotL - 6, yFor(v));
      }
      ctx.fillStyle = red;
      ctx.fillText(String(threshold), plotL - 6, yFor(threshold));
      ctx.strokeStyle = "rgba(127,203,92,0.22)";
      ctx.beginPath();
      ctx.moveTo(plotL + 0.5, plotT);
      ctx.lineTo(plotL + 0.5, plotB);
      ctx.stroke();

      // scanlines belong to this window only, never to the room
      ctx.fillStyle = "rgba(0,0,0,0.26)";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    };

    if (reduced) {
      draw();
      return;
    }
    let frame = 0;
    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [history, size.w, size.h, threshold, reduced]);

  const holes = Math.max(4, Math.floor(size.h / 26));

  return (
    <div className="recorder">
      <div className="recorder__feed" aria-hidden="true">
        {Array.from({ length: holes }, (_, i) => (
          <span key={i} className="recorder__hole" />
        ))}
      </div>
      <div className="recorder__paper" ref={boxRef}>
        <canvas ref={canvasRef} role="img" aria-label={label} />
      </div>
    </div>
  );
}

/* ============================================================================
 * INSTRUMENT 5 — ANNUNCIATOR PANEL
 * Dark when clear. Flashing at 1 Hz when in alarm. Steady once acknowledged.
 * A new alarm re-flashes even if its tile was previously acknowledged.
 * ========================================================================== */
