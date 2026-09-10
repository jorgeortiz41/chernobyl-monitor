import { Plate } from "../chassis/Plate";
import { StripChart, type ChartSample } from "../instruments/StripChart";

/** The strip chart recorder: CPU history on gridded chart paper. */
export function RecorderPanel({
  history,
  threshold,
}: {
  history: ChartSample[];
  threshold: number;
}) {
  return (
    <Plate label="CPU Load Recorder" sub="Chan 1 · 0-100 pct · Chart 36 mm/min">
      <StripChart
        history={history}
        threshold={threshold}
        label="CPU load history recorder trace"
      />
    </Plate>
  );
}
