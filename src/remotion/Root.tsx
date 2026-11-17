import React from 'react';
import { Composition } from 'remotion';
import { RemotionComposition, type RemotionCompositionProps } from '../video/RemotionComposition';
import { DEFAULT_PROJECT } from '../video/defaultProject';
import { resolveAspectRatio } from '../video/aspectRatios';
import { getTotalFrames } from '../video/timeline';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CloudMotionVideo"
      component={RemotionComposition as unknown as React.ComponentType<Record<string, unknown>>}
      durationInFrames={getTotalFrames(DEFAULT_PROJECT.scenes, 60)}
      fps={60}
      width={1920}
      height={1080}
      defaultProps={{
        project: DEFAULT_PROJECT,
        muted: true,
      }}
      calculateMetadata={({ props }) => {
        const p = (props as unknown as RemotionCompositionProps)?.project || DEFAULT_PROJECT;
        const dims = resolveAspectRatio(p.aspectRatio, p.width, p.height);
        const renderFps = 60;
        const durationInFrames = Math.max(60, getTotalFrames(p.scenes, renderFps));
        return {
          durationInFrames,
          fps: renderFps,
          width: dims.width,
          height: dims.height,
        };
      }}
    />
  );
};
