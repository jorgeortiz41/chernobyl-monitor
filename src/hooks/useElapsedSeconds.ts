import { useEffect, useState } from "react";

/** Whole seconds since the console was energised. */
export function useElapsedSeconds(): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      setSecs(Math.floor((performance.now() - start) / 1000));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return secs;
}

