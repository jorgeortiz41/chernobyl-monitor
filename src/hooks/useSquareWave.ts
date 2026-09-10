import { useEffect, useState } from "react";

/** Single shared square wave so every alarm tile flashes in unison. */
export function useSquareWave(hz: number, enabled: boolean): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!enabled) {
      setOn(true);
      return;
    }
    let frame = 0;
    const halfPeriod = 500 / hz;
    const tick = () => {
      setOn(Math.floor(performance.now() / halfPeriod) % 2 === 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hz, enabled]);
  return on;
}
