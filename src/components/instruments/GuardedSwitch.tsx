import { useEffect, useState } from "react";
import { Lamp } from "../chassis/Lamp";

export type TripState = {
  /** The pid the last trip was issued against. */
  pid: number | null;
  /** That pid is still in the process table one or more samples later. */
  stillRunning: boolean;
  /** Message from the backend when the signal could not be delivered. */
  error: string | null;
};

/**
 * INSTRUMENT 7 — GUARDED SWITCH
 *
 * The cover must be raised before the switch can be thrown. Two deliberate
 * actions, and the switch stays latched until the operator lowers the cover.
 *
 * The first throw sends SIGTERM. If the process is still listed on a later
 * sample the switch re-arms for a second, explicit throw that escalates to
 * SIGKILL — the escalation is never automatic.
 */
export function GuardedSwitch({
  selectedPid,
  selectedName,
  onKillProcess,
  tripState,
}: {
  selectedPid: number | null;
  selectedName: string | null;
  onKillProcess: (pid: number, force: boolean) => void;
  tripState: TripState;
}) {
  const [coverOpen, setCoverOpen] = useState(false);
  const [thrown, setThrown] = useState(false);
  const enabled = selectedPid !== null;

  useEffect(() => {
    setCoverOpen(false);
    setThrown(false);
  }, [selectedPid]);

  const trippedThis = tripState.pid !== null && tripState.pid === selectedPid;
  const refused = trippedThis && tripState.error !== null;
  // Survived the term signal, so a force throw is now on the table.
  const canForce = trippedThis && tripState.stillRunning && !refused;
  const leverLive = enabled && coverOpen && (!thrown || canForce);

  const toggleCover = () => {
    if (!enabled) return;
    setCoverOpen((open) => {
      if (open) setThrown(false);
      return !open;
    });
  };

  const throwSwitch = () => {
    if (!leverLive || selectedPid === null) return;
    setThrown(true);
    onKillProcess(selectedPid, canForce);
  };

  const status = !enabled
    ? "No unit selected"
    : refused
      ? `Refused — ${tripState.error}`
      : canForce
        ? "No response — throw to force"
        : thrown
          ? `Trip issued — PID ${selectedPid}`
          : coverOpen
            ? "Guard raised — armed"
            : "Guard closed";

  return (
    <div
      className="guard"
      data-enabled={enabled}
      data-armed={enabled && coverOpen}
      data-thrown={thrown && !canForce}
    >
      <div className="guard__well">
        <button
          type="button"
          className="guard__lever"
          disabled={!leverLive}
          onClick={throwSwitch}
          aria-label={
            selectedPid === null
              ? "Trip switch, disabled, no process selected"
              : canForce
                ? `Force kill ${selectedName ?? ""} PID ${selectedPid}`
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
        <span className="nomen">
          Process Trip &mdash; {canForce ? "Force" : "Manual"}
        </span>
        {enabled ? (
          <span className="mono" style={{ fontSize: 13 }}>
            {selectedName ?? ""} · PID {selectedPid}
          </span>
        ) : (
          <span className="nomen nomen--sub">Select a line on the log</span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Lamp
            color={refused ? "amber" : thrown ? "red" : "amber"}
            lit={enabled && coverOpen}
          />
          <span className="nomen nomen--sub">{status}</span>
        </div>
      </div>
    </div>
  );
}
