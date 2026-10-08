import { Composition } from "remotion";
import { Booth, TOTAL } from "./Booth";
import { FPS } from "./theme";

export const Root = () => (
  <Composition id="Booth" component={Booth} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
