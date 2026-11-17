import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const SceneVerdict: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const titleIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const subIn = computeElementEntrance(frame, fps, easing, -4, 22);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const ruleWidth = 28 + 72 * Math.min(1, progress / 0.7);
  const pulse = ((frame / Math.max(1, fps)) % 2) / 2;

  const accentWord = scene.accentWord || 'ENGINE';
  const parts = scene.headline.split(accentWord);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '88px 120px 135px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: '"Outfit", sans-serif',
          fontSize: 94,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: '#F8FAFC',
          opacity: Math.max(0.92, titleIn),
          transform: `scale(${0.96 + titleIn * 0.04})`,
        }}
      >
        {parts.length > 1 ? (
          <>
            {parts[0]}
            <span style={{ color: '#1AE5A0' }}>{accentWord}</span>
            {parts.slice(1).join(accentWord)}
          </>
        ) : (
          scene.headline
        )}
      </div>

      <div
        style={{
          fontFamily: '"Outfit", sans-serif',
          fontSize: 42,
          fontWeight: 700,
          color: '#FF542E',
          marginTop: 20,
          opacity: Math.max(0.9, subIn),
          transform: `translateY(${(1 - subIn) * 14}px)`,
        }}
      >
        {scene.subheadline}
      </div>

      {/* Dual Summary Anchor Badges + Pulsing Bridge synced to narration */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          marginTop: 42,
        }}
      >
        <div
          style={{
            padding: '18px 34px',
            borderRadius: 18,
            backgroundColor: progress < 0.48 ? '#11221F' : '#0F1817',
            border:
              progress < 0.48
                ? '2px solid rgba(26, 229, 160, 0.9)'
                : '1.5px solid rgba(26, 229, 160, 0.48)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 25,
            fontWeight: 700,
            color: '#1AE5A0',
            transform: `scale(${progress < 0.48 ? 1.04 : 1})`,
          }}
        >
          API · {scene.leftBadge}
        </div>
        <div
          style={{
            width: 84,
            height: 4,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.16)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -5,
              left: `${pulse * 86}%`,
              width: 14,
              height: 14,
              borderRadius: 99,
              backgroundColor: pulse < 0.5 ? '#1AE5A0' : '#FF542E',
            }}
          />
        </div>
        <div
          style={{
            padding: '18px 34px',
            borderRadius: 18,
            backgroundColor: progress >= 0.48 ? '#231418' : '#1A1316',
            border:
              progress >= 0.48
                ? '2px solid rgba(255, 84, 46, 0.9)'
                : '1.5px solid rgba(255, 84, 46, 0.48)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 25,
            fontWeight: 700,
            color: '#FF542E',
            transform: `scale(${progress >= 0.48 ? 1.04 : 1})`,
          }}
        >
          MCP · {scene.rightBadge}
        </div>
      </div>

      <div
        style={{
          width: 960,
          height: 6,
          borderRadius: 99,
          backgroundColor: 'rgba(255,255,255,0.07)',
          marginTop: 42,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${ruleWidth}%`,
            height: '100%',
            borderRadius: 99,
            background: 'linear-gradient(90deg, #FF542E 0%, #1AE5A0 100%)',
          }}
        />
      </div>

      {scene.codeSnippet && (
        <div
          style={{
            marginTop: 34,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 28,
            fontWeight: 700,
            color: '#E2E8F0',
            letterSpacing: '0.03em',
          }}
        >
          {scene.codeSnippet}
        </div>
      )}
    </AbsoluteFill>
  );
};
