import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VideoScene } from '../types';

export interface CustomSceneComponentProps {
  scene: VideoScene;
  customProps?: Record<string, unknown>;
}

/**
 * Reference custom TSX Remotion scene that OpenCode can duplicate/extend in src/video/customScenes/.
 */
export const SampleCustomPulseScene: React.FC<CustomSceneComponentProps> = ({
  scene,
  customProps,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isVertical = height > width;
  const ringColor =
    typeof customProps?.ringColor === 'string' && customProps.ringColor.trim()
      ? customProps.ringColor
      : 'rgba(26, 229, 160, 0.4)';
  const kickerOverride =
    typeof customProps?.kicker === 'string' && customProps.kicker.trim()
      ? customProps.kicker
      : undefined;

  const safeFps = Math.max(1, fps);
  const timeSec = frame / safeFps;

  const titleScale = spring({
    frame,
    fps: safeFps,
    config: { damping: 14, stiffness: 150 },
  });

  const ringProgress = (timeSec % 3) / 3;
  const ringScale = interpolate(ringProgress, [0, 1], [0.75, 1.5]);
  const ringOpacity = interpolate(ringProgress, [0, 0.7, 1], [0.55, 0.2, 0]);

  const nodes = scene.visualPayload?.nodes || [
    { id: '1', label: scene.leftBadge || 'INPUT', sublabel: 'Prompt & Schema', tone: 'coral' as const },
    { id: '2', label: scene.rightBadge || 'OUTPUT', sublabel: 'Remotion 60fps', tone: 'mint' as const },
  ];

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical ? '140px 64px' : '110px 120px',
        color: '#F8FAFC',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${interpolate(titleScale, [0, 1], [0.92, 1])})`,
          opacity: interpolate(timeSec, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: isVertical ? 420 : 540,
            height: isVertical ? 420 : 540,
            borderRadius: '9999px',
            border: `2px solid ${ringColor}`,
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: isVertical ? 24 : 20,
            letterSpacing: '0.16em',
            color: '#1AE5A0',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}
        >
          {kickerOverride || scene.visualPayload?.kicker || 'CUSTOM REMOTION TSX SCENE'}
        </div>
        <h1
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: isVertical ? 76 : 86,
            fontWeight: 900,
            lineHeight: 1.05,
            textAlign: 'center',
            margin: 0,
            maxWidth: isVertical ? 900 : 1360,
          }}
        >
          {scene.headline}
        </h1>
        <p
          style={{
            marginTop: 22,
            fontSize: isVertical ? 32 : 30,
            color: '#94A3B8',
            textAlign: 'center',
            maxWidth: isVertical ? 840 : 1080,
            lineHeight: 1.4,
          }}
        >
          {scene.subheadline}
        </p>

        <div
          style={{
            marginTop: 48,
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            gap: 24,
            alignItems: 'center',
          }}
        >
          {nodes.map((node, idx) => {
            const delay = Math.round(((10 + idx * 8) / 30) * safeFps);
            const enter = spring({
              frame: Math.max(0, frame - delay),
              fps: safeFps,
              config: { damping: 14, stiffness: 160 },
            });
            const accentColor =
              node.tone === 'coral' ? '#FF542E' : node.tone === 'mint' ? '#1AE5A0' : '#94A3B8';
            return (
              <div
                key={node.id}
                style={{
                  minWidth: isVertical ? 480 : 300,
                  padding: '24px 32px',
                  borderRadius: 18,
                  border: `1px solid ${accentColor}55`,
                  background: 'rgba(11, 14, 20, 0.88)',
                  transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
                  opacity: enter,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: '"Outfit", sans-serif',
                    fontWeight: 800,
                    fontSize: 30,
                    color: '#F8FAFC',
                  }}
                >
                  {node.label}
                </div>
                {node.sublabel && (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 20,
                      color: accentColor,
                    }}
                  >
                    {node.sublabel}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
