import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import {
  DEFAULT_AMBIENT_BG,
  DEFAULT_BG_TRANSITION,
  computeBackgroundTransitionState,
} from '../ambientPresets';
import { buildCaptionCues } from '../timeline';
import type {
  AccentTone,
  AmbientBackgroundConfig,
  BackgroundTransitionConfig,
} from '../types';
import { AmbientVideoLayer } from './AmbientVideoLayer';

interface BackdropGridProps {
  chapterTitle: string;
  sceneIndex: number;
  totalScenes: number;
  accent: AccentTone;
  narration: string;
  audioDurationSec?: number;
  showCaptions: boolean;
  ambientBg?: AmbientBackgroundConfig;
  prevAmbientBg?: AmbientBackgroundConfig;
  prevAccent?: AccentTone;
  prevDurationFrames?: number;
  bgTransition?: BackgroundTransitionConfig;
  layerMode?: 'full' | 'backdrop' | 'hud';
}

export const BackdropGrid: React.FC<BackdropGridProps> = ({
  chapterTitle,
  sceneIndex,
  totalScenes,
  accent,
  narration,
  audioDurationSec,
  showCaptions,
  ambientBg = DEFAULT_AMBIENT_BG,
  prevAmbientBg,
  prevAccent,
  prevDurationFrames = 0,
  bgTransition = DEFAULT_BG_TRANSITION,
  layerMode = 'full',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const isPortrait = height > width;
  const isSquare = width === height;

  const gridShift = interpolate(frame, [0, durationInFrames], [0, -64]);
  const headerIn = computeElementEntrance(frame, fps, easing, -4, 20);

  const spokenDurationFrames =
    audioDurationSec && audioDurationSec > 0
      ? Math.round(audioDurationSec * fps)
      : undefined;

  const cues = React.useMemo(
    () => buildCaptionCues(narration, durationInFrames, isPortrait ? 6 : 8, spokenDurationFrames),
    [narration, durationInFrames, isPortrait, spokenDurationFrames]
  );
  const activeCue = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);

  const transitionState = computeBackgroundTransitionState(
    frame,
    durationInFrames,
    fps,
    bgTransition,
    Boolean(prevAmbientBg)
  );

  const leftGlowOpacity = accent === 'mint' ? 0.08 : 0.17;
  const rightGlowOpacity = accent === 'coral' ? 0.08 : 0.17;

  const showBackdrop = layerMode === 'full' || layerMode === 'backdrop';
  const showHud = layerMode === 'full' || layerMode === 'hud';

  const hudTop = isPortrait ? 68 : 48;
  const hudSide = isPortrait ? 48 : isSquare ? 52 : 84;
  const captionBottom = isPortrait ? 92 : 42;
  const captionFontSize = isPortrait ? 34 : isSquare ? 28 : 33;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: showBackdrop ? '#07090D' : 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {showBackdrop && (
        <>
          {prevAmbientBg && transitionState.outgoingOpacity > 0.005 && (
            <AmbientVideoLayer
              config={prevAmbientBg}
              accent={prevAccent || accent}
              opacityMultiplier={transitionState.outgoingOpacity}
              blurPx={transitionState.outgoingBlurPx}
              scale={transitionState.outgoingScale}
              frameOffset={prevDurationFrames}
            />
          )}

          <AmbientVideoLayer
            config={ambientBg}
            accent={accent}
            opacityMultiplier={transitionState.incomingOpacity}
            blurPx={transitionState.incomingBlurPx}
            scale={transitionState.incomingScale}
          />

          <div
            style={{
              position: 'absolute',
              inset: -64,
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.032) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.032) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              transform: `translate3d(${gridShift}px, ${gridShift * 0.4}px, 0)`,
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: '-10%',
              bottom: '-22%',
              width: '58%',
              height: '72%',
              borderRadius: '9999px',
              background: `radial-gradient(circle, rgba(255,84,46,${leftGlowOpacity}) 0%, rgba(255,84,46,0) 68%)`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '-10%',
              bottom: '-22%',
              width: '58%',
              height: '72%',
              borderRadius: '9999px',
              background: `radial-gradient(circle, rgba(26,229,160,${rightGlowOpacity}) 0%, rgba(26,229,160,0) 68%)`,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {showHud && (
        <>
          <div
            style={{
              position: 'absolute',
              top: hudTop,
              left: hudSide,
              right: hudSide,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: headerIn,
              transform: `translateY(${(1 - headerIn) * -12}px)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: isPortrait ? 22 : 24,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#CBD5E1',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 5,
                  borderRadius: 99,
                  background:
                    accent === 'mint'
                      ? '#1AE5A0'
                      : accent === 'coral'
                        ? '#FF542E'
                        : 'linear-gradient(90deg, #FF542E 0%, #1AE5A0 100%)',
                }}
              />
              <span>{chapterTitle}</span>
            </div>
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: isPortrait ? 20 : 22,
                fontWeight: 600,
                color: '#94A3B8',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(sceneIndex).padStart(2, '0')} / {String(totalScenes).padStart(2, '0')}
            </div>
          </div>

          {showCaptions && activeCue && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: captionBottom,
                display: 'flex',
                justifyContent: 'center',
                paddingLeft: isPortrait ? 44 : 100,
                paddingRight: isPortrait ? 44 : 100,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(9, 12, 18, 0.92)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: 16,
                  padding: isPortrait ? '16px 26px' : '15px 32px',
                  maxWidth: isPortrait ? 960 : 1380,
                  textAlign: 'center',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: captionFontSize,
                  fontWeight: 700,
                  lineHeight: 1.32,
                  color: '#F8FAFC',
                  boxShadow: '0 22px 54px rgba(0,0,0,0.65)',
                }}
              >
                {activeCue.text}
              </div>
            </div>
          )}
        </>
      )}
    </AbsoluteFill>
  );
};
