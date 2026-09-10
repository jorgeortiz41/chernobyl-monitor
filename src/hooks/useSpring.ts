import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Damped mass-spring integrator. Meter movements have inertia and a return
 * spring; they overshoot and settle. k=900 / c=36 gives zeta ~= 0.6, which is
 * about 9% overshoot settling in ~250ms.
 */
export function useSpring(target: number, stiffness = 900, damping = 36): number {
  const [value, setValue] = useState(target);
  const motion = useRef({ x: target, v: 0 });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      motion.current = { x: target, v: 0 };
      setValue(target);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const m = motion.current;
      const accel = -stiffness * (m.x - target) - damping * m.v;
      m.v += accel * dt;
      m.x += m.v * dt;
      if (Math.abs(m.x - target) < 0.004 && Math.abs(m.v) < 0.02) {
        m.x = target;
        m.v = 0;
        setValue(target);
        return;
      }
      setValue(m.x);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, stiffness, damping, reduced]);

  return value;
}
