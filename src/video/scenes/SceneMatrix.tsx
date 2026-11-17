import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const SceneMatrix: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const headerIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  // First 55%: Direct API ("Choose direct APIs...") -> Second 45%: MCP Server ("Add an MCP server...")
  const focusSide: 'api' | 'mcp' = progress < 0.55 ? 'api' : 'mcp';
  const activeRow =
    progress < 0.55
      ? Math.min(2, Math.floor((progress / 0.55) * 3))
      : Math.min(2, Math.floor(((progress - 0.55) / 0.45) * 3));

  const pairs = (
    scene.bulletPoints && scene.bulletPoints.length > 0
      ? scene.bulletPoints
      : [
          'Deterministic app logic & strict workflows|Natural-language agent orchestration',
          'High-throughput service-to-service calls|Runtime tool & resource discovery',
          'Fixed webhooks, billing & SQL pipelines|Cross-host reuse (IDE, Desktop, CLI)',
        ]
  ).map((row) => {
    const [left, right] = row.split('|');
    return {
      apiRule: (left || '').trim(),
      mcpRule: (right || left || '').trim(),
    };
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '88px 100px 135px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 42,
          opacity: Math.max(0.92, headerIn),
          transform: `translateY(${(1 - headerIn) * 14}px)`,
        }}
      >
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: 72,
            fontWeight: 900,
            color: '#F8FAFC',
            letterSpacing: '-0.025em',
          }}
        >
          {scene.headline}
        </div>
        <div
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 28,
            color: '#94A3B8',
            marginTop: 8,
          }}
        >
          {scene.subheadline}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 44,
          width: '100%',
          maxWidth: 1560,
        }}
      >
        {/* Left: Direct API */}
        <div
          style={{
            position: 'relative',
            borderRadius: 28,
            background: 'linear-gradient(180deg, #121A1B 0%, #0C1013 100%)',
            border:
              focusSide === 'api'
                ? '2px solid rgba(26,229,160,0.78)'
                : '1px solid rgba(26,229,160,0.28)',
            padding: '38px 40px 46px',
            overflow: 'hidden',
            opacity: focusSide === 'api' ? 1 : 0.88,
            transform: `translateY(${focusSide === 'api' ? -6 : 0}px)`,
          }}
        >
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 28,
              fontWeight: 800,
              color: '#1AE5A0',
              marginBottom: 26,
              letterSpacing: '0.06em',
            }}
          >
            {scene.leftBadge}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {pairs.map((pair, idx) => {
              const isRowHot = focusSide === 'api' && activeRow === idx;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    padding: '18px 22px',
                    borderRadius: 16,
                    backgroundColor: isRowHot ? 'rgba(26,229,160,0.14)' : 'rgba(255,255,255,0.03)',
                    border: isRowHot
                      ? '1.5px solid rgba(26,229,160,0.6)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 99,
                      backgroundColor: '#1AE5A0',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: 27,
                      fontWeight: 600,
                      color: '#F8FAFC',
                    }}
                  >
                    {pair.apiRule}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 28,
              right: 28,
              height: focusSide === 'api' ? 8 : 5,
              borderRadius: '7px 7px 0 0',
              backgroundColor: '#1AE5A0',
            }}
          />
        </div>

        {/* Right: MCP Server */}
        <div
          style={{
            position: 'relative',
            borderRadius: 28,
            background: 'linear-gradient(180deg, #1B1316 0%, #0E0E13 100%)',
            border:
              focusSide === 'mcp'
                ? '2px solid rgba(255,84,46,0.78)'
                : '1px solid rgba(255,84,46,0.28)',
            padding: '38px 40px 46px',
            overflow: 'hidden',
            opacity: focusSide === 'mcp' ? 1 : 0.88,
            transform: `translateY(${focusSide === 'mcp' ? -6 : 0}px)`,
          }}
        >
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 28,
              fontWeight: 800,
              color: '#FF542E',
              marginBottom: 26,
              letterSpacing: '0.06em',
            }}
          >
            {scene.rightBadge}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {pairs.map((pair, idx) => {
              const isRowHot = focusSide === 'mcp' && activeRow === idx;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    padding: '18px 22px',
                    borderRadius: 16,
                    backgroundColor: isRowHot ? 'rgba(255,84,46,0.14)' : 'rgba(255,255,255,0.03)',
                    border: isRowHot
                      ? '1.5px solid rgba(255,84,46,0.6)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 99,
                      backgroundColor: '#FF542E',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: 27,
                      fontWeight: 600,
                      color: '#F8FAFC',
                    }}
                  >
                    {pair.mcpRule}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 28,
              right: 28,
              height: focusSide === 'mcp' ? 8 : 5,
              borderRadius: '7px 7px 0 0',
              backgroundColor: '#FF542E',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
