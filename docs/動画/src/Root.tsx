import { Composition } from "remotion";
import { SLIDES, Slides } from "./Slides";
import { Booth, TOTAL } from "./Booth";
import { FPS } from "./theme";

export const Root = () => (
  <>
    <Composition id="Booth" component={Booth} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    {/* 1フレームが1枚のスライド */}
    <Composition id="Slides" component={Slides} durationInFrames={SLIDES.length} fps={FPS} width={1920} height={1080} />
  </>
);
