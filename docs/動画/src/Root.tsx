import { Composition } from "remotion";
import { CLIPS, Clip, SLIDES, Slides } from "./Slides";
import { Booth, TOTAL } from "./Booth";
import { FPS } from "./theme";

export const Root = () => (
  <>
    <Composition id="Booth" component={Booth} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    {/* 1フレームが1枚のスライド */}
    <Composition id="Slides" component={Slides} durationInFrames={SLIDES.length} fps={FPS} width={1920} height={1080} />
    {/* スライド1枚に貼る動画（scripts/clips.mjs が書き出す） */}
    {CLIPS.map((c) => (
      <Composition
        key={c.name}
        id={c.name}
        component={Clip}
        defaultProps={{ id: c.id }}
        durationInFrames={c.d}
        fps={FPS}
        width={1920}
        height={1080}
      />
    ))}
  </>
);
