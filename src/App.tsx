/* ============================================================================
 * NEXUS STATION — UNIT 1 PROCESS COMPUTER CONSOLE
 * Presentation layer only. Every instrument below is a pure function of props.
 * No IPC, no data retrieval, no polling. Data arrives from above; intent leaves via
 * callbacks.
 * ========================================================================== */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ============================================================================
 * DATA CONTRACT — mirrors the Rust backend. Do not extend.
 * ========================================================================== */

export type ProcessInfo = {
  pid: number;
  name: string;
  cpuUsage: number; // 0-100
  memory: number; // bytes
};

export type SystemStats = {
  cpuUsage: number; // 0-100, global
  coreUsage: number[]; // 0-100 per logical core
  totalMemory: number; // bytes
  usedMemory: number; // bytes
  processes: ProcessInfo[]; // already sorted by the backend
};

/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MOCK DATA SOURCE — DELETE THIS ENTIRE BLOCK TO GO LIVE.                  ║
 * ║                                                                          ║
 * ║  Nothing below this block imports from it except the single call site     ║
 * ║  marked "DATA SEAM" inside <ReactorConsole/>. Swap that one line for your ║
 * ║  real subscription and delete everything between these rules.             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */

const MOCK_CORE_COUNT = 8;
const MOCK_TOTAL_MEMORY = 32 * 1024 ** 3;

const MOCK_PROC_NAMES = [
  "kernel_task", "launchd", "WindowServer", "loginwindow", "mds_stores",
  "coreaudiod", "bluetoothd", "hidd", "cfprefsd", "distnoted", "syslogd",
  "notifyd", "diskarbitrationd", "powerd", "opendirectoryd", "securityd",
  "trustd", "nsurlsessiond", "apsd", "rapportd", "sharingd", "spindump",
  "fseventsd", "revisiond", "backupd", "mDNSResponder", "netbiosd",
  "configd", "airportd", "usbmuxd", "cloudd", "bird", "gamed", "akd",
  "identityservicesd", "imagent", "callservicesd", "avconferenced",
  "tccd", "sandboxd", "amfid", "taskgated", "kextd", "watchdogd",
  "thermald", "smcd", "iostat", "vmstat", "top", "zsh", "bash", "tmux",
  "sshd", "cupsd", "ntpd", "nginx", "postgres", "redis-server", "dockerd",
  "containerd", "node", "bun", "esbuild", "vite", "tsserver", "rust-analyzer",
  "cargo", "rustc", "clang", "ld", "git", "gh", "ripgrep", "fd", "ffmpeg",
];

function mockRand(seedRef: { s: number }): number {
  // Deterministic LCG so a reload looks like the same plant, not a new one.
  seedRef.s = (seedRef.s * 1664525 + 1013904223) >>> 0;
  return seedRef.s / 4294967296;
}

type MockProcState = {
  pid: number;
  name: string;
  cpu: number;
  cpuTarget: number;
  mem: number;
  memTarget: number;
};

function useMockSystemStats(): SystemStats | null {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const seed = { s: 0x9e3779b9 };
    const rnd = () => mockRand(seed);

    const cores = Array.from({ length: MOCK_CORE_COUNT }, () => ({
      v: 8 + rnd() * 22,
      target: 8 + rnd() * 22,
    }));
    let memUsed = MOCK_TOTAL_MEMORY * 0.44;
    let memTarget = memUsed;

    const procs: MockProcState[] = Array.from({ length: 260 }, (_, i) => {
      const base = MOCK_PROC_NAMES[i % MOCK_PROC_NAMES.length];
      const cpu = rnd() < 0.12 ? rnd() * 34 : rnd() * 2.4;
      const mem = (12 + rnd() * 900) * 1024 ** 2;
      return {
        pid: 100 + Math.floor(rnd() * 89000),
        name: i < MOCK_PROC_NAMES.length ? base : `${base}.${i}`,
        cpu,
        cpuTarget: cpu,
        mem,
        memTarget: mem,
      };
    });

    // Excursions: deliberate, sustained upsets. Without them the drift never
    // parks anywhere long enough to trip a tile, and the annunciator can't be
    // exercised while developing.
    let coreExcursion = { core: -1, ticks: 0 };
    let memExcursion = 0;
    let procCount = 168;
    let procTarget = 168;
    let tick = 0;

    const step = () => {
      tick += 1;

      if (coreExcursion.ticks > 0) coreExcursion.ticks -= 1;
      else if (tick % 11 === 0) {
        coreExcursion = { core: Math.floor(rnd() * MOCK_CORE_COUNT), ticks: 6 };
      }

      // Cores drift toward a target; targets are re-rolled occasionally so the
      // motion reads as load moving around rather than white noise.
      cores.forEach((c, i) => {
        if (coreExcursion.ticks > 0 && coreExcursion.core === i) {
          c.target = 93 + rnd() * 6;
        } else if (tick % 4 === 0 && rnd() < 0.45) {
          c.target = 6 + rnd() * 46;
        }
        c.v += (c.target - c.v) * 0.28 + (rnd() - 0.5) * 3.2;
        c.v = Math.max(0, Math.min(100, c.v));
      });

      if (memExcursion > 0) memExcursion -= 1;
      else if (tick % 19 === 0) memExcursion = 8;
      if (tick % 6 === 0 || memExcursion === 8) {
        memTarget =
          MOCK_TOTAL_MEMORY *
          (memExcursion > 0 ? 0.91 + rnd() * 0.07 : 0.34 + rnd() * 0.42);
      }
      memUsed += (memTarget - memUsed) * 0.16;

      // Processes come and go; occasionally enough of them to trip the count.
      if (tick % 13 === 0) {
        procTarget = rnd() < 0.3 ? 226 + rnd() * 26 : 150 + rnd() * 34;
      }
      procCount += (procTarget - procCount) * 0.3;

      procs.forEach((p) => {
        if (tick % 3 === 0 && rnd() < 0.3) {
          p.cpuTarget = rnd() < 0.1 ? rnd() * 46 : rnd() * 3;
        }
        p.cpu += (p.cpuTarget - p.cpu) * 0.34 + (rnd() - 0.5) * 0.5;
        p.cpu = Math.max(0, Math.min(100, p.cpu));
        if (tick % 7 === 0 && rnd() < 0.2) {
          p.memTarget = (12 + rnd() * 1400) * 1024 ** 2;
        }
        p.mem += (p.memTarget - p.mem) * 0.12;
      });

      const processes: ProcessInfo[] = procs
        .slice(0, Math.round(procCount))
        .map((p) => ({
          pid: p.pid,
          name: p.name,
          cpuUsage: p.cpu,
          memory: Math.round(p.mem),
        }))
        .sort((a, b) => b.cpuUsage - a.cpuUsage); // backend sorts; mock matches

      setStats({
        cpuUsage: cores.reduce((a, c) => a + c.v, 0) / cores.length,
        coreUsage: cores.map((c) => c.v),
        totalMemory: MOCK_TOTAL_MEMORY,
        usedMemory: Math.round(memUsed),
        processes,
      });
    };

    step();
    const id = window.setInterval(step, 1000);
    return () => window.clearInterval(id);
  }, []);

  return stats;
}

/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  END MOCK DATA SOURCE                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */

/* ============================================================================
 * DISPLAY HOOKS — clocks and physics for instrument movement. None of these
 * touch data; they only animate what has already been handed down.
 * ========================================================================== */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * Damped mass-spring integrator. Meter movements have inertia and a return
 * spring; they overshoot and settle. k=900 / c=36 gives zeta ~= 0.6, which is
 * about 9% overshoot settling in ~250ms.
 */
function useSpring(target: number, stiffness = 900, damping = 36): number {
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

/** Single shared square wave so every alarm tile flashes in unison. */
function useSquareWave(hz: number, enabled: boolean): boolean {
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

/** Whole seconds since the console was energised. */
function useElapsedSeconds(): number {
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

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/* ============================================================================
 * SHEET METAL — tokens and material rules for the whole console.
 * ========================================================================== */

const CONSOLE_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@600;700&family=IBM+Plex+Mono:wght@400;500&display=swap");

:root {
  --console-shell: #43423A;
  --panel-face:    #9A9280;
  --panel-inset:   #6B6558;
  --bezel:         #2B2924;
  --dial-face:     #E4DCC6;
  --engrave:       #1A1813;
  --seam:          #35342E;

  --lamp-amber:      #E8A33D;  --lamp-amber-off: #3D3020;
  --lamp-red:        #C4402F;  --lamp-red-off:   #3A211C;
  --lamp-green:      #6E9B4C;  --lamp-green-off: #26301F;
  --lamp-white:      #F0E6C8;  --lamp-white-off: #3A382F;

  --crt-bg:        #0E120C;
  --phosphor:      #7FCB5C;
  --segment-lit:   #D8342A;
  --segment-unlit: #2A1512;

  --nomen: "Archivo Narrow", "Arial Narrow", "Helvetica Neue Condensed", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

html, body, #root { height: 100%; margin: 0; padding: 0; }
body {
  background: var(--console-shell);
  color: var(--engrave);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
*, *::before, *::after { box-sizing: border-box; }

/* --- nomenclature: engraved plastic labelling ---------------------------- */
.nomen {
  font-family: var(--nomen);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--engrave);
  text-shadow: 0 1px 0 rgba(255,255,255,0.16);
}
.nomen--sub { font-size: 9px; letter-spacing: 0.14em; opacity: 0.72; }
.nomen--plate { font-size: 13px; letter-spacing: 0.16em; }
.nomen--dark { color: rgba(228,220,198,0.62); text-shadow: 0 1px 0 rgba(0,0,0,0.6); }

.mono {
  font-family: var(--mono);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

/* --- console carcass ----------------------------------------------------- */
.console {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr) 306px;
  grid-template-rows: 68px minmax(0, 1fr) minmax(0, 1.08fr);
  gap: 3px;
  padding: 3px;
  background: var(--seam);
  overflow: hidden;
}

.grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  opacity: 0.038;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='170'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='170' height='170' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* --- panel plates -------------------------------------------------------- */
.plate {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 11px 13px 12px;
  background: var(--panel-face);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.10),
    inset 0 -1px 0 rgba(0,0,0,0.22),
    2px 2px 0 var(--seam);
}
.plate__body { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.plate__label { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.plate__rule { flex: 1; height: 2px; background: var(--seam); box-shadow: 0 1px 0 rgba(255,255,255,0.14); }

.screw { position: absolute; width: 9px; height: 9px; }
.screw--tl { left: 4px;  top: 4px; }
.screw--tr { right: 4px; top: 4px; }
.screw--bl { left: 4px;  bottom: 4px; }
.screw--br { right: 4px; bottom: 4px; }

/* --- recessed wells ------------------------------------------------------ */
.well {
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--panel-inset);
  box-shadow:
    inset 2px 2px 0 var(--seam),
    inset -1px -1px 0 rgba(255,255,255,0.10);
}
.well--dark { background: var(--bezel); }

/* --- indicator lamps ----------------------------------------------------- */
.lampcell { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 62px; }
.lamp {
  position: relative;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--off);
  box-shadow:
    inset 0 0 0 2px var(--bezel),
    inset 1px 1px 0 rgba(0,0,0,0.55),
    0 1px 0 rgba(255,255,255,0.10);
}
.lamp[data-lit="true"] {
  background:
    radial-gradient(circle at 36% 32%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 42%),
    var(--on);
}
/* Bloom is a painted halo, not a blurred shadow: zero blur anywhere. */
.lamp[data-lit="true"]::after {
  content: "";
  position: absolute;
  inset: -9px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--halo) 0%, rgba(0,0,0,0) 62%);
  pointer-events: none;
}

/* --- seven segment window ------------------------------------------------ */
.segwin {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: var(--crt-bg);
  box-shadow:
    inset 2px 2px 0 #000,
    inset -1px -1px 0 rgba(255,255,255,0.07),
    0 0 0 2px var(--bezel);
}
.segwin__units { font-family: var(--nomen); font-weight: 600; font-size: 9px; letter-spacing: 0.14em; color: rgba(216,52,42,0.75); }

/* --- bargraph ------------------------------------------------------------ */
.bargraph { display: flex; flex-direction: column; align-items: center; gap: 5px; min-height: 0; }
.bargraph__stack {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column-reverse;
  gap: 1px;
  padding: 3px;
  background: var(--bezel);
  box-shadow: inset 2px 2px 0 #000;
}
.bargraph__seg { flex: 1; min-height: 2px; background: var(--segoff); }
.bargraph__seg[data-lit="true"] { background: var(--segon); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16); }

/* --- strip chart --------------------------------------------------------- */
.recorder { flex: 1; min-height: 0; display: flex; box-shadow: 0 0 0 2px var(--bezel), inset 0 0 0 1px #000; }
.recorder__feed {
  width: 20px;
  flex: none;
  background: var(--dial-face);
  box-shadow: inset -2px 0 0 rgba(26,24,19,0.45);
  display: flex; flex-direction: column; align-items: center;
  justify-content: space-around;
  padding: 6px 0;
}
.recorder__hole {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--crt-bg);
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.5);
}
.recorder__paper { flex: 1; min-width: 0; position: relative; background: var(--crt-bg); }
.recorder__paper canvas { display: block; width: 100%; height: 100%; }

/* --- annunciator --------------------------------------------------------- */
.annun { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; flex: 1; min-height: 0; }
.tile {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  padding: 4px 3px;
  text-align: center;
  background: var(--off);
  box-shadow:
    inset 0 0 0 2px var(--bezel),
    inset 2px 2px 0 rgba(0,0,0,0.45),
    0 1px 0 rgba(255,255,255,0.08);
  font-family: var(--nomen);
  font-weight: 700;
  font-size: 9px;
  letter-spacing: 0.12em;
  line-height: 1.25;
  text-transform: uppercase;
  color: rgba(228,220,198,0.30);
}
.tile[data-lit="true"] {
  background: var(--on);
  color: var(--engrave);
  text-shadow: 0 1px 0 rgba(255,255,255,0.28);
}
.tile[data-lit="true"]::after {
  content: "";
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 36%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 68%);
  pointer-events: none;
}

/* --- switches ------------------------------------------------------------ */
.switchbtn {
  font-family: var(--nomen);
  font-weight: 600; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--engrave);
  background: var(--panel-face);
  border: 0;
  padding: 7px 6px 6px;
  cursor: pointer;
  text-shadow: 0 1px 0 rgba(255,255,255,0.18);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.30),
    inset 0 -2px 0 rgba(0,0,0,0.30),
    2px 2px 0 var(--seam);
}
.switchbtn:active, .switchbtn[data-held="true"] {
  box-shadow: inset 0 2px 0 rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.10);
  transform: translate(1px, 1px);
}
.switchbtn:focus-visible { outline: 2px solid var(--lamp-amber); outline-offset: 1px; }

/* --- process table ------------------------------------------------------- */
.printer { flex: 1 1 0; min-height: 0; display: flex; box-shadow: 0 0 0 2px var(--bezel); }
.printer__tractor {
  width: 15px; flex: none;
  background: #D9D0B7;
  display: flex; flex-direction: column; align-items: center; gap: 9px;
  padding-top: 7px;
  overflow: hidden;
}
.printer__tractor--r { box-shadow: inset 2px 0 0 rgba(26,24,19,0.22); }
.printer__tractor--l { box-shadow: inset -2px 0 0 rgba(26,24,19,0.22); }
.printer__punch {
  width: 6px; height: 6px; flex: none; border-radius: 50%;
  background: var(--panel-inset);
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.55);
}
.printer__sheet { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--dial-face); }
.printer__scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }

.prow {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr) 64px 88px;
  font-family: var(--mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 19px;
  color: var(--engrave);
}
.prow > * {
  padding: 0 7px;
  border-right: 1px solid rgba(26,24,19,0.30);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prow > *:last-child { border-right: 0; }
.prow--head {
  font-family: var(--nomen);
  font-weight: 600; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  background: var(--panel-inset);
  color: var(--dial-face);
  line-height: 22px;
  box-shadow: inset 0 -2px 0 var(--seam);
}
.prow--head > * { border-right: 1px solid rgba(0,0,0,0.35); }
.prow--data { cursor: pointer; }
.prow--data:nth-child(even) { background: rgba(110,155,76,0.20); }
.prow--data[data-selected="true"] { background: var(--engrave); color: var(--dial-face); }
.prow--data[data-selected="true"] > * { border-right-color: rgba(228,220,198,0.30); }
.prow--data:focus-visible { outline: 2px solid var(--lamp-amber); outline-offset: -2px; }
.pnum { text-align: right; }
.phot { color: #8E2118; }
.prow--data[data-selected="true"] .phot { color: var(--lamp-amber); }

/* --- guarded switch ------------------------------------------------------ */
.guard { display: flex; align-items: stretch; gap: 10px; }
.guard__well {
  position: relative;
  width: 78px; flex: none;
  perspective: 260px;
  background: var(--bezel);
  box-shadow: inset 2px 2px 0 #000, inset -1px -1px 0 rgba(255,255,255,0.08);
  padding: 6px;
}
.guard__lever {
  position: relative;
  display: block;
  width: 100%; height: 100%;
  border: 0; padding: 0;
  background: #241f1c;
  box-shadow: inset 0 0 0 2px #17130f;
  cursor: pointer;
}
.guard__lever[disabled] { cursor: default; }
.guard__bat {
  position: absolute;
  left: 50%; bottom: 9px;
  width: 15px; height: 30px;
  margin-left: -7.5px;
  border-radius: 3px 3px 7px 7px;
  background: var(--lamp-red-off);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 3px 0 rgba(255,255,255,0.10);
  transform-origin: 50% 100%;
  transform: rotate(0deg) translateY(0);
  transition: transform 90ms linear;
}
.guard[data-armed="true"] .guard__bat { background: var(--lamp-red); }
.guard[data-thrown="true"] .guard__bat { transform: rotate(0deg) translateY(-11px); }
.guard__cover {
  position: absolute;
  inset: 0;
  transform-origin: 50% 0%;
  transform: rotateX(0deg);
  transition: transform 120ms linear;
  border: 2px solid rgba(232,226,206,0.42);
  background: rgba(240,230,200,0.06);
  cursor: pointer;
  padding: 0;
  overflow: hidden;
}
.guard__cover[data-open="true"] { transform: rotateX(-104deg); }
.guard__cover[disabled] { cursor: default; border-color: rgba(232,226,206,0.20); }
.guard__spec {
  position: absolute;
  top: -20%; left: 26%;
  width: 2px; height: 140%;
  background: rgba(255,255,255,0.20);
  transform: rotate(24deg);
}
.guard__spec--b { left: 44%; width: 1px; background: rgba(255,255,255,0.13); }
.guard__legend { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px; }
.guard[data-enabled="false"] .guard__legend { opacity: 0.42; }

/* --- motion policy ------------------------------------------------------- */
@keyframes annunFlash { 0%, 49.999% { opacity: 1; } 50%, 100% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .guard__bat, .guard__cover { transition: none; }
}
`;

/* ============================================================================
 * FASTENERS AND PLATES
 * ========================================================================== */

function Screw({ corner, rot }: { corner: "tl" | "tr" | "bl" | "br"; rot: number }) {
  return (
    <svg className={`screw screw--${corner}`} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5.6" r="4.3" fill="rgba(0,0,0,0.32)" />
      <circle cx="5" cy="5" r="4.3" fill="#8B846F" />
      <circle cx="5" cy="5" r="4.3" fill="none" stroke="#3A382F" strokeWidth="0.8" />
      <g transform={`rotate(${rot} 5 5)`}>
        <path d="M5 1.3 V8.7 M1.3 5 H8.7" stroke="#CFC7AE" strokeWidth="1.6" />
        <path d="M5 1.3 V8.7 M1.3 5 H8.7" stroke="#3A382F" strokeWidth="1.1" />
      </g>
    </svg>
  );
}

function Plate({
  label,
  sub,
  style,
  children,
}: {
  label?: string;
  sub?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
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

/* ============================================================================
 * INSTRUMENT 8 — NAMEPLATE
 * ========================================================================== */

function Nameplate() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 3,
        padding: "6px 12px",
        background: "#8E876F",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(0,0,0,0.30), 2px 2px 0 var(--seam)",
      }}
    >
      <span className="nomen nomen--plate">Nexus Station &middot; Unit 1</span>
      <span className="nomen nomen--sub">
        Process Computer Console &middot; Panel 4C&#8209;117 &middot; Rev D 03&#8209;74
      </span>
    </div>
  );
}

/* ============================================================================
 * LAMPS
 * ========================================================================== */

type LampColor = "amber" | "red" | "green" | "white";

const LAMP_ON: Record<LampColor, string> = {
  amber: "var(--lamp-amber)",
  red: "var(--lamp-red)",
  green: "var(--lamp-green)",
  white: "var(--lamp-white)",
};
const LAMP_OFF: Record<LampColor, string> = {
  amber: "var(--lamp-amber-off)",
  red: "var(--lamp-red-off)",
  green: "var(--lamp-green-off)",
  white: "var(--lamp-white-off)",
};
const LAMP_HALO: Record<LampColor, string> = {
  amber: "rgba(232,163,61,0.42)",
  red: "rgba(196,64,47,0.42)",
  green: "rgba(110,155,76,0.40)",
  white: "rgba(240,230,200,0.40)",
};

function Lamp({ color, lit }: { color: LampColor; lit: boolean }) {
  return (
    <span
      className="lamp"
      data-lit={lit}
      style={
        {
          "--on": LAMP_ON[color],
          "--off": LAMP_OFF[color],
          "--halo": LAMP_HALO[color],
        } as React.CSSProperties
      }
    />
  );
}

function LampCell({ color, lit, label }: { color: LampColor; lit: boolean; label: string }) {
  return (
    <div className="lampcell">
      <Lamp color={color} lit={lit} />
      <span className="nomen nomen--sub" style={{ textAlign: "center", lineHeight: 1.1 }}>
        {label}
      </span>
    </div>
  );
}

/* ============================================================================
 * INSTRUMENT 3 — SEVEN SEGMENT READOUT
 * Segments are drawn as polygons. Unlit segments are always painted, because a
 * real display shows its dark bars.
 * ========================================================================== */

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
  "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
  "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  "-": "g", " ": "",
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
function SegmentReadout({
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
  const clamped = Math.max(0, Math.min(Math.pow(10, digits) - 1, Math.round(value)));
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

/* ============================================================================
 * INSTRUMENT 2 — BARGRAPH COLUMN
 * Twenty discrete segments, lit bottom up. A segment is on or off; there is no
 * such thing as a partly lit lamp.
 * ========================================================================== */

const BAR_SEGMENTS = 20;

function Bargraph({
  value,
  label,
  sub,
}: {
  value: number;
  label: string;
  sub?: string;
}) {
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * BAR_SEGMENTS);
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
                  "--segoff": red ? "var(--lamp-red-off)" : "var(--lamp-amber-off)",
                } as React.CSSProperties
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

/* ============================================================================
 * INSTRUMENT 1 — SWEEP GAUGE
 * 240 degrees of painted arc on a cream face, black needle with a counterweight
 * tail, red hatched danger band from 85 to 100.
 * ========================================================================== */

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

function SweepGauge({ value, label }: { value: number; label: string }) {
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
      <circle cx={G_CX} cy={G_CY} r="94" fill="none" stroke="#545044" strokeWidth="1.4" />
      <circle cx={G_CX} cy={G_CY} r="90" fill="var(--dial-face)" />

      {/* danger band 85-100 */}
      <path d={gAnnulus(85, 100, 74, 86)} fill="url(#dangerHatch)" />
      <path d={gAnnulus(85, 100, 74, 86)} fill="none" stroke="#8E2118" strokeWidth="1.2" />

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
        return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--engrave)" strokeWidth="1.1" />;
      })}

      {majors.map((v) => {
        const a = gAngle(v);
        const [x1, y1] = gPolar(86, a);
        const [x2, y2] = gPolar(69, a);
        const [tx, ty] = gPolar(56, a);
        return (
          <g key={v}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--engrave)" strokeWidth="2.6" />
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
      <circle cx={G_CX} cy={G_CY} r="5.5" fill="none" stroke="#3A382F" strokeWidth="0.8" />

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

/* ============================================================================
 * INSTRUMENT 4 — STRIP CHART RECORDER
 * ========================================================================== */

export type ChartSample = { t: number; v: number };

/** Paper speed. One second of history occupies this many pixels. */
const PAPER_PX_PER_SEC = 36;
const CH_PAD_L = 30;
const CH_PAD_T = 8;
const CH_PAD_B = 14;

function StripChart({
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
    const yFor = (v: number) => plotB - (Math.max(0, Math.min(100, v)) / 100) * (plotB - plotT);

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
      const phase = reduced ? 0 : ((now / 1000) * PAPER_PX_PER_SEC) % (PAPER_PX_PER_SEC * 5);
      for (let i = 0; i * PAPER_PX_PER_SEC < w + PAPER_PX_PER_SEC * 5; i++) {
        const x = Math.round(w - phase - i * PAPER_PX_PER_SEC) + 0.5;
        if (x < plotL) continue;
        ctx.strokeStyle = i % 5 === 0 ? "rgba(127,203,92,0.20)" : "rgba(127,203,92,0.09)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, plotT);
        ctx.lineTo(x, plotB);
        ctx.stroke();
      }
      for (let v = 0; v <= 100; v += 10) {
        const y = Math.round(yFor(v)) + 0.5;
        ctx.strokeStyle = v % 20 === 0 ? "rgba(127,203,92,0.22)" : "rgba(127,203,92,0.09)";
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

type TileSpec = { id: string; legend: string; color: LampColor };

const ANNUN_TILES: TileSpec[] = [
  { id: "CPU_HIGH", legend: "CPU High", color: "amber" },
  { id: "CORE_IMBALANCE", legend: "Core Imbalance", color: "amber" },
  { id: "THERMAL", legend: "Thermal", color: "amber" },
  { id: "MEM_HIGH", legend: "Mem High", color: "amber" },
  { id: "MEM_CRITICAL", legend: "Mem Critical", color: "red" },
  { id: "SWAP_ACTIVE", legend: "Swap Active", color: "amber" },
  { id: "PROC_COUNT_HIGH", legend: "Proc Count High", color: "amber" },
  { id: "LINK_LOSS", legend: "Link Loss", color: "red" },
  { id: "SPARE_1", legend: "Spare", color: "white" },
  { id: "SPARE_2", legend: "Spare", color: "white" },
  { id: "SPARE_3", legend: "Spare", color: "white" },
  { id: "SPARE_4", legend: "Spare", color: "white" },
];

function Annunciator({
  alarms,
  lampTest,
  onLampTest,
}: {
  alarms: Record<string, boolean>;
  lampTest: boolean;
  onLampTest: (held: boolean) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const flashOn = useSquareWave(1, !reduced);
  const [acked, setAcked] = useState<string[]>([]);
  const previous = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const before = previous.current;
    setAcked((current) =>
      current.filter(
        // drop the ack if the alarm cleared, or if it just re-annunciated
        (id) => alarms[id] && before[id],
      ),
    );
    previous.current = { ...alarms };
  }, [alarms]);

  const acknowledge = useCallback(() => {
    setAcked(ANNUN_TILES.filter((t) => alarms[t.id]).map((t) => t.id));
  }, [alarms]);

  const unacked = ANNUN_TILES.some((t) => alarms[t.id] && !acked.includes(t.id));

  return (
    <>
      <div className="annun" role="group" aria-label="Annunciator panel">
        {ANNUN_TILES.map((t) => {
          const active = !!alarms[t.id];
          const isAcked = acked.includes(t.id);
          const lit = lampTest || (active && (isAcked || flashOn));
          return (
            <div
              key={t.id}
              className="tile"
              data-lit={lit}
              role="status"
              aria-label={`${t.legend}: ${active ? (isAcked ? "alarm acknowledged" : "alarm") : "clear"}`}
              style={
                {
                  "--on": LAMP_ON[t.color],
                  "--off": LAMP_OFF[t.color],
                } as React.CSSProperties
              }
            >
              {t.legend}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "stretch" }}>
        <button
          type="button"
          className="switchbtn"
          style={{ flex: 1 }}
          onClick={acknowledge}
          disabled={!unacked}
        >
          Acknowledge
        </button>
        <button
          type="button"
          className="switchbtn"
          style={{ flex: 1 }}
          data-held={lampTest}
          onPointerDown={() => onLampTest(true)}
          onPointerUp={() => onLampTest(false)}
          onPointerLeave={() => onLampTest(false)}
          onPointerCancel={() => onLampTest(false)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") onLampTest(true);
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") onLampTest(false);
          }}
          onBlur={() => onLampTest(false)}
        >
          Lamp Test
        </button>
      </div>
    </>
  );
}

/* ============================================================================
 * INSTRUMENT 6 — PROCESS TABLE
 * Continuous-feed line printer output on greenbar stock.
 * ========================================================================== */

const MB = 1024 * 1024;

function ProcessTable({
  processes,
  selectedPid,
  onSelectProcess,
}: {
  processes: ProcessInfo[];
  selectedPid: number | null;
  onSelectProcess: (pid: number | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const moveFocus = useCallback(
    (from: number, delta: number) => {
      const next = Math.max(0, Math.min(processes.length - 1, from + delta));
      const target = processes[next];
      if (!target) return;
      onSelectProcess(target.pid);
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-pid="${target.pid}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    },
    [processes, onSelectProcess],
  );

  const punches = 40;

  return (
    <div className="printer">
      <div className="printer__tractor printer__tractor--l" aria-hidden="true">
        {Array.from({ length: punches }, (_, i) => (
          <span key={i} className="printer__punch" />
        ))}
      </div>

      <div className="printer__sheet">
        <div className="prow prow--head" role="row" aria-hidden="true">
          <span className="pnum">PID</span>
          <span>Process</span>
          <span className="pnum">CPU</span>
          <span className="pnum">Mem MB</span>
        </div>
        <div
          className="printer__scroll"
          ref={scrollRef}
          role="grid"
          aria-label="Running processes"
          aria-rowcount={processes.length}
        >
          {processes.map((p, i) => {
            const selected = p.pid === selectedPid;
            const tabbable = selected || (selectedPid === null && i === 0);
            return (
              <div
                key={p.pid}
                className="prow prow--data"
                role="row"
                aria-rowindex={i + 1}
                aria-selected={selected}
                data-pid={p.pid}
                data-selected={selected}
                tabIndex={tabbable ? 0 : -1}
                onClick={() => onSelectProcess(selected ? null : p.pid)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectProcess(selected ? null : p.pid);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    moveFocus(i, 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    moveFocus(i, -1);
                  }
                }}
              >
                <span className="pnum" role="gridcell">
                  {p.pid}
                </span>
                <span role="gridcell">{p.name}</span>
                <span
                  className={`pnum${p.cpuUsage >= 50 ? " phot" : ""}`}
                  role="gridcell"
                >
                  {p.cpuUsage.toFixed(1)}
                </span>
                <span className="pnum" role="gridcell">
                  {(p.memory / MB).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="printer__tractor printer__tractor--r" aria-hidden="true">
        {Array.from({ length: punches }, (_, i) => (
          <span key={i} className="printer__punch" />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * INSTRUMENT 7 — GUARDED SWITCH
 * The cover must be raised before the switch can be thrown. Two deliberate
 * actions, and the switch stays thrown until the operator closes the cover.
 * ========================================================================== */

function GuardedSwitch({
  selectedPid,
  selectedName,
  onKillProcess,
}: {
  selectedPid: number | null;
  selectedName: string | null;
  onKillProcess: (pid: number) => void;
}) {
  const [coverOpen, setCoverOpen] = useState(false);
  const [thrown, setThrown] = useState(false);
  const enabled = selectedPid !== null;

  useEffect(() => {
    setCoverOpen(false);
    setThrown(false);
  }, [selectedPid]);

  const toggleCover = () => {
    if (!enabled) return;
    setCoverOpen((open) => {
      if (open) setThrown(false);
      return !open;
    });
  };

  const throwSwitch = () => {
    if (!enabled || !coverOpen || thrown || selectedPid === null) return;
    setThrown(true);
    onKillProcess(selectedPid);
  };

  const status = !enabled
    ? "No unit selected"
    : thrown
      ? `Trip issued — PID ${selectedPid}`
      : coverOpen
        ? "Guard raised — armed"
        : "Guard closed";

  return (
    <div className="guard" data-enabled={enabled} data-armed={enabled && coverOpen} data-thrown={thrown}>
      <div className="guard__well">
        <button
          type="button"
          className="guard__lever"
          disabled={!enabled || !coverOpen || thrown}
          onClick={throwSwitch}
          aria-label={
            selectedPid === null
              ? "Trip switch, disabled, no process selected"
              : `Trip process ${selectedName ?? ""} PID ${selectedPid}`
          }
        >
          <span className="guard__bat" />
        </button>
        <button
          type="button"
          className="guard__cover"
          data-open={coverOpen}
          disabled={!enabled}
          onClick={toggleCover}
          aria-label={coverOpen ? "Lower safety guard" : "Raise safety guard"}
        >
          <i className="guard__spec" />
          <i className="guard__spec guard__spec--b" />
        </button>
      </div>

      <div className="guard__legend">
        <span className="nomen">Process Trip &mdash; Manual</span>
        {enabled ? (
          <span className="mono" style={{ fontSize: 13 }}>
            {selectedName ?? ""} · PID {selectedPid}
          </span>
        ) : (
          <span className="nomen nomen--sub">Select a line on the log</span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Lamp color={thrown ? "red" : "amber"} lit={enabled && coverOpen} />
          <span className="nomen nomen--sub">{status}</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * THE CONSOLE
 * Pure presentation. Everything it knows arrives in props.
 * ========================================================================== */

const CPU_ALARM_THRESHOLD = 85;
const CORE_IMBALANCE_SPREAD = 60;
const PROC_COUNT_ALARM = 220;
const HISTORY_DEPTH = 180;

export function ReactorConsole({
  stats,
  selectedPid,
  onSelectProcess,
  onKillProcess,
}: {
  stats: SystemStats | null;
  selectedPid: number | null;
  onSelectProcess: (pid: number | null) => void;
  onKillProcess: (pid: number) => void;
}) {
  const [lampTest, setLampTest] = useState(false);
  const [history, setHistory] = useState<ChartSample[]>([]);
  const elapsed = useElapsedSeconds();

  // The recorder keeps its own paper trail of what it has been shown. This is
  // ink on a chart, not a data subscription.
  useEffect(() => {
    if (!stats) return;
    setHistory((h) =>
      [...h, { t: performance.now(), v: stats.cpuUsage }].slice(-HISTORY_DEPTH),
    );
  }, [stats]);

  const cores = stats?.coreUsage ?? [];
  const memPercent = stats && stats.totalMemory > 0 ? (stats.usedMemory / stats.totalMemory) * 100 : 0;
  const coreSpread = cores.length ? Math.max(...cores) - Math.min(...cores) : 0;

  const alarms = useMemo<Record<string, boolean>>(
    () => ({
      CPU_HIGH: !!stats && stats.cpuUsage >= CPU_ALARM_THRESHOLD,
      CORE_IMBALANCE: coreSpread >= CORE_IMBALANCE_SPREAD,
      THERMAL: false, // no channel for this in the data contract
      MEM_HIGH: memPercent >= 75,
      MEM_CRITICAL: memPercent >= 90,
      SWAP_ACTIVE: false, // no channel for this in the data contract
      PROC_COUNT_HIGH: (stats?.processes.length ?? 0) >= PROC_COUNT_ALARM,
      LINK_LOSS: stats === null,
      SPARE_1: false,
      SPARE_2: false,
      SPARE_3: false,
      SPARE_4: false,
    }),
    [stats, coreSpread, memPercent],
  );

  const anyAlarm = Object.values(alarms).some(Boolean);
  const selected = stats?.processes.find((p) => p.pid === selectedPid) ?? null;

  const mm = Math.min(99, Math.floor(elapsed / 60));
  const ss = elapsed % 60;

  return (
    <>
      <style>{CONSOLE_CSS}</style>
      <div className="console">
        {/* ---- header: nameplate / master lamps / elapsed ------------------ */}
        <Plate style={{ gridColumn: "1 / -1", padding: "6px 16px" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <Nameplate />

            <div className="well" style={{ display: "flex", gap: 2, padding: "6px 10px" }}>
              <LampCell color="green" lit={lampTest || !!stats} label="Power" />
              <LampCell color="green" lit={lampTest || !!stats} label="Data Link" />
              <LampCell color="red" lit={lampTest || alarms.CPU_HIGH} label="CPU Alarm" />
              <LampCell color="red" lit={lampTest || alarms.MEM_CRITICAL} label="Mem Trip" />
              <LampCell color="amber" lit={lampTest || anyAlarm} label="Annun" />
              <LampCell color="white" lit={lampTest} label="Test" />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="nomen nomen--sub">Elapsed</span>
              <SegmentReadout
                value={mm * 100 + ss}
                digits={4}
                colonAfter={2}
                scale={0.85}
                title="Elapsed run time"
                readAs={`${mm} minutes ${ss} seconds`}
              />
            </div>
          </div>
        </Plate>

        {/* ---- sweep gauge ------------------------------------------------- */}
        <Plate label="CPU Total" sub="M-1">
          <div className="well" style={{ flex: 1, minHeight: 0, padding: 8 }}>
            <SweepGauge value={stats?.cpuUsage ?? 0} label="Total CPU load" />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 8,
              marginTop: 9,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="nomen nomen--sub">Load Pct</span>
              <SegmentReadout
                value={stats?.cpuUsage ?? 0}
                digits={3}
                units="PCT"
                scale={0.72}
                title="Total CPU load percent"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="nomen nomen--sub">Proc Count</span>
              <SegmentReadout
                value={stats?.processes.length ?? 0}
                digits={4}
                scale={0.72}
                title="Process count"
              />
            </div>
          </div>
        </Plate>

        {/* ---- strip chart recorder ---------------------------------------- */}
        <Plate label="CPU Load Recorder" sub="Chan 1 · 0-100 pct · Chart 36 mm/min">
          <StripChart
            history={history}
            threshold={CPU_ALARM_THRESHOLD}
            label="CPU load history recorder trace"
          />
        </Plate>

        {/* ---- core array and memory --------------------------------------- */}
        <Plate label="Core Array" sub={`${cores.length} ch`}>
          <div className="well" style={{ flex: 2, display: "flex", gap: 5, padding: 8, minHeight: 0 }}>
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

          <div className="well" style={{ flex: 1.35, display: "flex", gap: 11, padding: 8, minHeight: 0 }}>
            <div style={{ width: 30, display: "flex" }}>
              <Bargraph value={memPercent} label="Pct" />
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 6,
                minWidth: 0,
              }}
            >
              <span className="nomen nomen--dark">In Use</span>
              <SegmentReadout
                value={(stats?.usedMemory ?? 0) / MB}
                digits={6}
                units="MB"
                scale={0.68}
                title="Memory in use, megabytes"
              />
              <span className="mono" style={{ fontSize: 13, color: "rgba(228,220,198,0.72)" }}>
                {((stats?.totalMemory ?? 0) / MB).toFixed(0).padStart(6, "0")} MB INST
              </span>
            </div>
          </div>
        </Plate>

        {/* ---- process table + guarded kill --------------------------------- */}
        <Plate
          label="Process Log"
          sub="Sorted by demand · Line printer 1403"
          style={{ gridColumn: "1 / span 2" }}
        >
          <ProcessTable
            processes={stats?.processes ?? []}
            selectedPid={selectedPid}
            onSelectProcess={onSelectProcess}
          />
          <div
            style={{
              flex: "none",
              marginTop: 10,
              paddingTop: 10,
              borderTop: "2px solid var(--seam)",
              boxShadow: "0 -3px 0 rgba(255,255,255,0.10)",
            }}
          >
            <GuardedSwitch
              selectedPid={selectedPid}
              selectedName={selected?.name ?? null}
              onKillProcess={onKillProcess}
            />
          </div>
        </Plate>

        {/* ---- annunciator --------------------------------------------------- */}
        <Plate label="Annunciator" sub="Panel A">
          <Annunciator alarms={alarms} lampTest={lampTest} onLampTest={setLampTest} />
        </Plate>
      </div>
      <div className="grain" aria-hidden="true" />
    </>
  );
}

/* ============================================================================
 * SHELL — the only place that knows where data comes from.
 * ========================================================================== */

export default function App() {
  /* ── DATA SEAM ───────────────────────────────────────────────────────────
   * Replace this single line with your real subscription. It must produce
   * `SystemStats | null`. Then delete the MOCK DATA SOURCE block above.
   * ------------------------------------------------------------------------ */
  const stats = useMockSystemStats();
  /* ── END DATA SEAM ────────────────────────────────────────────────────── */

  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const handleKill = useCallback((pid: number) => {
    // Wire this to the backend's kill command. The console only reports intent.
    // The selection is deliberately left in place: the guarded switch stays
    // latched, showing what was tripped, until the operator lowers the cover.
    console.info(`[console] trip requested for pid ${pid}`);
  }, []);

  return (
    <ReactorConsole
      stats={stats}
      selectedPid={selectedPid}
      onSelectProcess={setSelectedPid}
      onKillProcess={handleKill}
    />
  );
}
