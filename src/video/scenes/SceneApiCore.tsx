import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const SceneApiCore: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const leftIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const cardIn = computeElementEntrance(frame, fps, easing, -6, 22);

  const traits = [
    {
      label: 'Strict Endpoint Contracts',
      detail: 'Explicit verb, path, and typed payload',
    },
    {
      label: 'Auth & Rate-Limit Boundary',
      detail: 'Scoped Bearer token verified per request',
    },
    {
      label: 'Deterministic 200 OK JSON',
      detail: 'Predictable schema with zero model guesswork',
    },
  ];

  const codeLines = (scene.codeSnippet || '').split('\n');
  const timeSec = frame / Math.max(1, fps);
  const visibleLines = Math.floor(
    interpolate(timeSec, [0, 1.8], [2, codeLines.length + 0.5], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // Synchronized 3-stage spotlight matching narration word offsets:
  // 0 (0.00-0.48): HTTP verb & path -> 1 (0.48-0.68): Authorization Bearer -> 2 (0.68-1.00): 200 OK JSON
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const activeStage = progress < 0.48 ? 0 : progress < 0.68 ? 1 : 2;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '95px 100px 135px',
        gap: 64,
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          opacity: Math.max(0.92, leftIn),
          transform: `translateX(${(1 - leftIn) * -14}px)`,
        }}
      >
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 23,
            fontWeight: 700,
            color: '#1AE5A0',
            letterSpacing: '0.08em',
          }}
        >
          {scene.leftBadge}
        </div>
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: 78,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: '-0.025em',
            color: '#F8FAFC',
          }}
        >
          {scene.headline}
        </div>
        <div
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 28,
            color: '#94A3B8',
            lineHeight: 1.4,
            maxWidth: 640,
          }}
        >
          {scene.subheadline}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
          {traits.map((trait, idx) => {
            const isActive = activeStage === idx;
            return (
              <div
                key={trait.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '14px 20px',
                  borderRadius: 16,
                  backgroundColor: isActive ? 'rgba(26, 229, 160, 0.12)' : 'rgba(255,255,255,0.02)',
                  border: isActive
                    ? '1.5px solid rgba(26, 229, 160, 0.55)'
                    : '1px solid rgba(255,255,255,0.07)',
                  opacity: isActive ? 1 : 0.86,
                  transform: `translateX(${isActive ? 8 : 0}px)`,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 36,
                    borderRadius: 6,
                    backgroundColor: isActive ? '#1AE5A0' : '#475569',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: 27,
                      fontWeight: 700,
                      color: '#F8FAFC',
                    }}
                  >
                    {trait.label}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: 21,
                      color: isActive ? '#CBD5E1' : '#94A3B8',
                      marginTop: 2,
                    }}
                  >
                    {trait.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Synchronized Code Contract Panel */}
      <div
        style={{
          width: 780,
          borderRadius: 28,
          background: 'linear-gradient(180deg, #12181E 0%, #0B0F14 100%)',
          border: '1.5px solid rgba(26, 229, 160, 0.38)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          overflow: 'hidden',
          opacity: Math.max(0.92, cardIn),
          transform: `translateY(${(1 - cardIn) * 14}px)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 32px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        >
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 22,
              fontWeight: 600,
              color: '#CBD5E1',
            }}
          >
            orders-service.http
          </span>
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 22,
              fontWeight: 800,
              padding: '4px 14px',
              borderRadius: 8,
              backgroundColor: activeStage === 2 ? 'rgba(26,229,160,0.18)' : 'transparent',
              border: activeStage === 2 ? '1px solid rgba(26,229,160,0.5)' : '1px solid transparent',
              color: '#1AE5A0',
            }}
          >
            {scene.rightBadge}
          </span>
        </div>

        <pre
          style={{
            margin: 0,
            padding: '32px 32px 36px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 26,
            lineHeight: 1.62,
            color: '#E2E8F0',
            minHeight: 350,
            whiteSpace: 'pre-wrap',
          }}
        >
          {codeLines.slice(0, visibleLines).map((line, i) => {
            const isMethod = i === 0;
            const isAuth = i === 1;
            const isBody = i >= 2;
            const lineFocused =
              (activeStage === 0 && isMethod) ||
              (activeStage === 1 && isAuth) ||
              (activeStage === 2 && isBody);

            return (
              <div
                key={i}
                style={{
                  padding: '2px 12px',
                  marginLeft: -12,
                  borderRadius: 8,
                  backgroundColor: lineFocused ? 'rgba(26, 229, 160, 0.14)' : 'transparent',
                  borderLeft: lineFocused ? '4px solid #1AE5A0' : '4px solid transparent',
                  color: isMethod ? '#1AE5A0' : lineFocused ? '#F8FAFC' : '#94A3B8',
                }}
              >
                {line || ' '}
              </div>
            );
          })}
        </pre>

        <div
          style={{
            height: 6,
            background: '#1AE5A0',
            width: `${Math.round((0.25 + 0.75 * progress) * 100)}%`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
