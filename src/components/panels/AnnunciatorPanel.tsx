import { Plate } from "../chassis/Plate";
import { Annunciator } from "../instruments/Annunciator";
import type { AlarmState } from "../../lib/alarms";

export function AnnunciatorPanel({
  alarms,
  lampTest,
  onLampTest,
}: {
  alarms: AlarmState;
  lampTest: boolean;
  onLampTest: (held: boolean) => void;
}) {
  return (
    <Plate label="Annunciator" sub="Panel A">
      <Annunciator
        alarms={alarms}
        lampTest={lampTest}
        onLampTest={onLampTest}
      />
    </Plate>
  );
}
