import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const ScenePipeline: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const headerIn = computeElementEntrance(frame, fps, easing, -8, 22);

  const stages = [
    {
      index: '01',
      title: 'AI Host',
      subtitle: 'Intent · MCP Client',
      color: '#F8FAFC',
      border: 'rgba(255,255,255,0.28)',
      glow: 'rgba(255,255,255,0.1)',
    },
    {
      index: '02',
      title: 'MCP Server',
      subtitle: 'Tool Translator',
      color: '#FF542E',
      border: 'rgba(255,84,46,0.52)',
      glow: 'rgba(255,84,46,0.25)',
    },
    {
      index: '03',
      title: 'Orders API',
      subtitle: 'Authenticated Engine',
      color: '#1AE5A0',
      border: 'rgba(26,229,160,0.52)',
      glow: 'rgba(26,229,160,0.25)',
    },
    {
      index: '04',
      title: 'PostgreSQL DB',
      subtitle: 'Source of Truth',
      color: '#94A3B8',
      border: 'rgba(148,163,184,0.4)',
      glow: 'rgba(148,163,184,0.14)',
    },
  ];

  // Exact padded inter-card whitespace gaps inside 1680px container (4 x 340px cards):
  const GAPS = [
    [356, 430],
    [803, 877],
    [1250, 1324],
  ] as const;

  // Synchronized directly to 20s Scene 08 narration:
  // 0.00-0.22: AI Host ("latest tracking number")
  // 0.22-0.44: MCP Server ("selects the shipment tool on your MCP Server")
  // 0.44-0.76: Orders API ("authenticated REST or gRPC API call")
  // 0.76-0.88: PostgreSQL DB ("fetches the record")
  // 0.88-1.00: Return JSON ("and returns clean JSON")
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const isForward = progress < 0.88;
  const activeStage =
    progress < 0.22 ? 0 : progress < 0.44 ? 1 : progress < 0.76 ? 2 : progress < 0.88 ? 3 : 0;
  const activeGap =
    progress < 0.44 ? 0 : progress < 0.76 ? 1 : progress < 0.88 ? 2 : progress < 0.92 ? 2 : progress < 0.96 ? 1 : 0;
  const timeSec = frame / Math.max(1, fps);
  const pulse = (timeSec % 1.6) / 1.6;
  const gapTravel = isForward ? pulse : 1 - pulse;
  const [gStart, gEnd] = GAPS[activeGap];
  const packetX = interpolate(gapTravel, [0, 1], [gStart, gEnd]);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '88px 90px 132px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 60,
          opacity: Math.max(0.92, headerIn),
          transform: `translateY(${(1 - headerIn) * 14}px)`,
        }}
      >
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: 74,
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
            marginTop: 10,
          }}
        >
          {scene.subheadline}
        </div>
      </div>

      {/* Stage Flow + Inter-Card Packet Bridges */}
      <div
        style={{
          position: 'relative',
          width: 1680,
          height: 310,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <svg
          width="1680"
          height="310"
          viewBox="0 0 1680 310"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
        >
          {GAPS.map(([x1, x2], gi) => {
            const hotGap = gi === activeGap;
            const laneColor = isForward ? '#FF542E' : '#1AE5A0';
            return (
              <line
                key={gi}
                x1={x1}
                y1="155"
                x2={x2}
                y2="155"
                stroke={hotGap ? laneColor : 'rgba(255,255,255,0.22)'}
                strokeOpacity={hotGap ? 0.9 : 0.45}
                strokeWidth={hotGap ? '4.5' : '3.5'}
                strokeDasharray="8 7"
              />
            );
          })}
          <circle
            cx={packetX}
            cy={155}
            r="22"
            fill={isForward ? 'rgba(255,84,46,0.28)' : 'rgba(26,229,160,0.28)'}
          />
          <circle cx={packetX} cy={155} r="9" fill={isForward ? '#FF542E' : '#1AE5A0'} />
        </svg>

        {stages.map((st, idx) => {
          const isCurrent = activeStage === idx;
          return (
            <div
              key={st.index}
              style={{
                position: 'relative',
                width: 340,
                height: 248,
                borderRadius: 26,
                background: isCurrent
                  ? 'linear-gradient(180deg, #19202D 0%, #0E131B 100%)'
                  : 'linear-gradient(180deg, #12161F 0%, #0B0E14 100%)',
                border: isCurrent ? `2px solid ${st.color}` : `1px solid ${st.border}`,
                boxShadow: isCurrent ? '0 28px 70px rgba(0,0,0,0.72)' : '0 18px 44px rgba(0,0,0,0.48)',
                padding: '28px 30px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                overflow: 'hidden',
                zIndex: 2,
                transform: `translateY(${isCurrent ? -10 : 0}px)`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 22,
                    fontWeight: 700,
                    color: st.color,
                  }}
                >
                  {st.index}
                </span>
                {isCurrent && (
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 17,
                      fontWeight: 700,
                      color: isForward ? '#FF542E' : '#1AE5A0',
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: '"Outfit", sans-serif',
                    fontSize: 36,
                    fontWeight: 800,
                    color: '#F8FAFC',
                  }}
                >
                  {st.title}
                </div>
                <div
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 24,
                    color: isCurrent ? '#E2E8F0' : '#94A3B8',
                    marginTop: 6,
                  }}
                >
                  {st.subtitle}
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(circle at 50% 110%, ${st.glow} 0%, transparent 62%)`,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 24,
                  right: 24,
                  height: isCurrent ? 8 : 5,
                  borderRadius: '6px 6px 0 0',
                  backgroundColor: st.color,
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 34,
          padding: '10px 26px',
          borderRadius: 12,
          backgroundColor: 'rgba(17, 21, 30, 0.9)',
          border: isForward
            ? '1px solid rgba(255,84,46,0.45)'
            : '1px solid rgba(26,229,160,0.45)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 24,
          fontWeight: 700,
          color: isForward ? '#FF542E' : '#1AE5A0',
          letterSpacing: '0.04em',
        }}
      >
        {isForward
          ? 'REQUEST →  MCP Translates Intent into Authenticated API Call'
          : '← RESPONSE   Deterministic JSON Returned via API'}
      </div>
    </AbsoluteFill>
  );
};
