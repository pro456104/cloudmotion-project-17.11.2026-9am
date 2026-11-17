import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

function evalCubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export const SceneTrap: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const safeFps = Math.max(1, fps);
  const timeSec = frame / safeFps;

  const titleIn = computeElementEntrance(frame, safeFps, easing, -8, 18);
  const splitFrame = Math.floor(durationInFrames * 0.74);
  const hubMorph = spring({
    frame: frame - splitFrame,
    fps: safeFps,
    config: { damping: 16, stiffness: 115 },
  });

  const leftNodes = ['AI Agent 1', 'IDE Copilot', 'Chat Host'];
  const rightNodes = ['Orders DB', 'Slack API', 'Billing API'];

  const meshReveal = interpolate(timeSec, [0, 38 / 30], [0.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Sequential highlight of which service change breaks multiple adapters during Beat 1
  const hotRow = Math.floor((timeSec / 1.2) % 3);
  const afterSplitSec = Math.max(0, frame - splitFrame) / safeFps;
  const packet = (afterSplitSec % 2.2) / 2.2;
  const activeLane = Math.floor(afterSplitSec / 2.2) % 3;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '84px 100px 132px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 34,
          opacity: Math.max(0.92, titleIn),
          transform: `translateY(${(1 - titleIn) * 14}px)`,
        }}
      >
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: 70,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: '#F8FAFC',
          }}
        >
          {scene.headline}
        </div>
        <div
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 28,
            fontWeight: 500,
            color: '#94A3B8',
            marginTop: 8,
          }}
        >
          {scene.subheadline}
        </div>
      </div>

      {/* Main N*M -> N+M Topology Stage */}
      <div
        style={{
          position: 'relative',
          width: 1480,
          height: 430,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <svg
          width="1480"
          height="430"
          viewBox="0 0 1480 430"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {/* Beat 1: N x M Sprawl Wires */}
          {leftNodes.map((_, li) =>
            rightNodes.map((__, ri) => {
              const y1 = 68 + li * 147;
              const y2 = 68 + ri * 147;
              const pathLen = 1040;
              const dashOffset = pathLen * (1 - meshReveal);
              const isHot = ri === hotRow;
              return (
                <path
                  key={`${li}-${ri}`}
                  d={`M 310 ${y1} C 590 ${y1}, 890 ${y2}, 1170 ${y2}`}
                  fill="none"
                  stroke="#FF542E"
                  strokeWidth={isHot ? '3.5' : '2.2'}
                  strokeOpacity={(isHot ? 0.85 : 0.35) * (1 - hubMorph)}
                  strokeDasharray={pathLen}
                  strokeDashoffset={dashOffset}
                />
              );
            })
          )}

          {/* Beat 2: Clean N + M Hub Connections */}
          {leftNodes.map((_, li) => {
            const y1 = 68 + li * 147;
            const isActive = li === activeLane;
            return (
              <path
                key={`in-${li}`}
                d={`M 310 ${y1} C 460 ${y1}, 500 215, 600 215`}
                fill="none"
                stroke="#FF542E"
                strokeWidth={isActive ? '4.5' : '3'}
                strokeOpacity={hubMorph * (isActive ? 0.95 : 0.45)}
              />
            );
          })}
          {rightNodes.map((_, ri) => {
            const y2 = 68 + ri * 147;
            const isActive = ri === activeLane;
            return (
              <path
                key={`out-${ri}`}
                d={`M 880 215 C 980 215, 1020 ${y2}, 1170 ${y2}`}
                fill="none"
                stroke="#1AE5A0"
                strokeWidth={isActive ? '4.5' : '3'}
                strokeOpacity={hubMorph * (isActive ? 0.95 : 0.45)}
              />
            );
          })}

          {/* Smooth curve-following packets along ALL 3 lanes */}
          {hubMorph > 0.45 &&
            [0, 1, 2].map((laneIdx) => {
              const yNode = 68 + laneIdx * 147;
              const tIn = (packet + laneIdx * 0.33) % 1;
              const pxIn = evalCubicBezier(tIn, 310, 460, 500, 600);
              const pyIn = evalCubicBezier(tIn, yNode, yNode, 215, 215);

              const tOut = (packet + 0.25 + laneIdx * 0.33) % 1;
              const pxOut = evalCubicBezier(tOut, 880, 980, 1020, 1170);
              const pyOut = evalCubicBezier(tOut, 215, 215, yNode, yNode);

              return (
                <g key={`pkt-${laneIdx}`} opacity={hubMorph}>
                  <circle cx={pxIn} cy={pyIn} r="7" fill="#FF542E" />
                  <circle cx={pxOut} cy={pyOut} r="7" fill="#1AE5A0" />
                </g>
              );
            })}
        </svg>

        {/* Left Nodes: AI Hosts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 52, zIndex: 2 }}>
          {leftNodes.map((label, idx) => {
            const nodeIn = computeElementEntrance(frame, safeFps, easing, -6 + idx * 2, 18);
            return (
              <div
                key={label}
                style={{
                  width: 310,
                  height: 95,
                  borderRadius: 18,
                  background: '#11151E',
                  border: '1.5px solid rgba(255,84,46,0.48)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: 30,
                  fontWeight: 700,
                  color: '#F8FAFC',
                  opacity: Math.max(0.92, nodeIn),
                  transform: `translateX(${(1 - nodeIn) * -14}px)`,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* Center: Clean Hub only in Beat 2 (no wire collision in Beat 1!) */}
        <div
          style={{
            zIndex: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hubMorph >= 0.35 && (
            <div
              style={{
                width: 280,
                height: 164,
                borderRadius: 24,
                background: 'linear-gradient(180deg, #161B26 0%, #0E1219 100%)',
                border: '1.5px solid rgba(26,229,160,0.42)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.75)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: hubMorph,
                transform: `scale(${0.9 + hubMorph * 0.1})`,
              }}
            >
              <span
                style={{
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: 33,
                  fontWeight: 900,
                  color: '#F8FAFC',
                  textAlign: 'center',
                }}
              >
                MCP STANDARD
              </span>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 21,
                  fontWeight: 700,
                  color: '#1AE5A0',
                }}
              >
                1 Shared Contract
              </span>
            </div>
          )}
        </div>

        {/* Right Nodes: Services */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 52, zIndex: 2 }}>
          {rightNodes.map((label, idx) => {
            const nodeIn = computeElementEntrance(frame, safeFps, easing, -6 + idx * 2, 18);
            const isHighlighted = hubMorph < 0.35 && idx === hotRow;
            return (
              <div
                key={label}
                style={{
                  width: 310,
                  height: 95,
                  borderRadius: 18,
                  background: isHighlighted ? '#1A1317' : '#11151E',
                  border: isHighlighted
                    ? '1.5px solid rgba(255,84,46,0.78)'
                    : '1.5px solid rgba(26,229,160,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: 30,
                  fontWeight: 700,
                  color: isHighlighted ? '#FF542E' : '#1AE5A0',
                  opacity: Math.max(0.92, nodeIn),
                  transform: `translateX(${(1 - nodeIn) * 14}px)`,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dedicated Non-Overlapping Formula Callout Pill Below Diagram */}
      <div
        style={{
          marginTop: 26,
          padding: '12px 28px',
          borderRadius: 14,
          backgroundColor: hubMorph < 0.45 ? 'rgba(255, 84, 46, 0.14)' : 'rgba(26, 229, 160, 0.14)',
          border:
            hubMorph < 0.45
              ? '1px solid rgba(255, 84, 46, 0.5)'
              : '1px solid rgba(26, 229, 160, 0.5)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 25,
          fontWeight: 700,
          color: hubMorph < 0.45 ? '#FF542E' : '#1AE5A0',
        }}
      >
        {hubMorph < 0.45
          ? `N × M = 3 Hosts × 3 Services = 9 Custom Adapters`
          : `N + M = 3 Clients + 3 MCP Servers = 6 Shared Connectors`}
      </div>
    </AbsoluteFill>
  );
};
