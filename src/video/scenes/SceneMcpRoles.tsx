import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const SceneMcpRoles: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const headerIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const isHostPhase = progress < 0.58;

  // After Host permissions phase (0.58+), showcase Pair A then Pair B in 1:1 isolation
  const pairProgress = Math.max(0, (progress - 0.58) / 0.42);
  const activePair = isHostPhase ? 0 : pairProgress < 0.5 ? 0 : 1;
  const timeSec = frame / Math.max(1, fps);
  const subProgress = isHostPhase ? (timeSec % 3) / 3 : (pairProgress * 2) % 1;
  const isOut = subProgress < 0.5;
  const packetT = isOut ? subProgress * 2 : 1 - (subProgress - 0.5) * 2;
  const packetX = interpolate(packetT, [0, 1], [854, 1086]);

  const pairs = [
    {
      client: 'MCP Client A',
      server: 'Orders MCP Server',
      capability: 'Tools: lookup_shipment · track_eta',
      detail: '1:1 Stateful Session',
      wireLabel: isOut ? 'tools/call →' : '← JSON Result',
      color: '#FF542E',
      rowCenterY: 162,
    },
    {
      client: 'MCP Client B',
      server: 'Docs MCP Server',
      capability: 'Resources: docs://api · schema',
      detail: 'Isolated Context',
      wireLabel: isOut ? 'resources/read →' : '← Schema URI',
      color: '#1AE5A0',
      rowCenterY: 316,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '88px 96px 132px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 40,
          opacity: Math.max(0.92, headerIn),
          transform: `translateY(${(1 - headerIn) * 14}px)`,
        }}
      >
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: 68,
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

      {/* Exact Row-Aligned Host -> 1:1 Client <-> Server Topology */}
      <div
        style={{
          position: 'relative',
          width: 1560,
          height: 416,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
        }}
      >
        {/* SVG 1:1 Beams cleanly aligned to row centers (162px & 316px) */}
        <svg
          width="1560"
          height="416"
          viewBox="0 0 1560 416"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
        >
          {pairs.map((p, idx) => {
            const isActive = idx === activePair;
            return (
              <g key={p.client}>
                <line
                  x1="846"
                  y1={p.rowCenterY}
                  x2="1094"
                  y2={p.rowCenterY}
                  stroke={p.color}
                  strokeOpacity={isActive ? 0.9 : 0.3}
                  strokeWidth={isActive ? '4' : '2.5'}
                  strokeDasharray="8 8"
                />
                {isActive && (
                  <>
                    <circle cx={packetX} cy={p.rowCenterY} r="14" fill={`${p.color}33`} />
                    <circle cx={packetX} cy={p.rowCenterY} r="7" fill={p.color} />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Active Wire Pill cleanly framed above the 248px gap */}
        {pairs.map((p, idx) => {
          if (idx !== activePair) return null;
          return (
            <div
              key={`lbl-${p.client}`}
              style={{
                position: 'absolute',
                left: 862,
                width: 216,
                top: p.rowCenterY - 52,
                padding: '4px 10px',
                borderRadius: 8,
                backgroundColor: '#0D1119',
                border: `1px solid ${p.color}55`,
                textAlign: 'center',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 18,
                fontWeight: 700,
                color: p.color,
                zIndex: 3,
              }}
            >
              {p.wireLabel}
            </div>
          );
        })}

        {/* Left: MCP HOST enclosing 1:1 Clients */}
        <div
          style={{
            width: 874,
            height: 416,
            borderRadius: 28,
            background: 'linear-gradient(180deg, #131822 0%, #0C0F16 100%)',
            border: isHostPhase
              ? '2px solid rgba(255, 84, 46, 0.72)'
              : '1.5px solid rgba(255,255,255,0.16)',
            padding: '26px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 28px 70px rgba(0,0,0,0.6)',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
            <div>
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#FF542E',
                  letterSpacing: '0.08em',
                }}
              >
                MCP HOST PROCESS
              </div>
              <div
                style={{
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: 32,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  marginTop: 2,
                }}
              >
                AI Application (IDE / Desktop)
              </div>
            </div>
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 19,
                fontWeight: 700,
                color: isHostPhase ? '#FF542E' : '#CBD5E1',
                padding: '8px 16px',
                borderRadius: 10,
                border: isHostPhase
                  ? '1px solid rgba(255, 84, 46, 0.65)'
                  : '1px solid rgba(255,255,255,0.12)',
                background: isHostPhase
                  ? 'rgba(255, 84, 46, 0.14)'
                  : 'rgba(255,255,255,0.04)',
              }}
            >
              Enforces Permissions
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {pairs.map((p, idx) => {
              const isActive = idx === activePair;
              return (
                <div
                  key={p.client}
                  style={{
                    height: 128,
                    borderRadius: 18,
                    background: isActive ? '#101520' : '#0A0D14',
                    border: `1.5px solid ${isActive ? p.color : `${p.color}44`}`,
                    padding: '0 28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: isActive ? 1 : 0.86,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: '"Outfit", sans-serif',
                        fontSize: 30,
                        fontWeight: 800,
                        color: '#F8FAFC',
                      }}
                    >
                      {p.client}
                    </div>
                    <div
                      style={{
                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                        fontSize: 21,
                        color: '#94A3B8',
                        marginTop: 3,
                      }}
                    >
                      Capability &amp; Message Routing
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 20,
                      fontWeight: 700,
                      color: p.color,
                    }}
                  >
                    {p.detail}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Independent MCP Servers aligned directly with the 2 client rows */}
        <div
          style={{
            width: 466,
            height: 416,
            paddingTop: 98,
            paddingBottom: 26,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            zIndex: 2,
          }}
        >
          {pairs.map((p, idx) => {
            const isActive = idx === activePair;
            return (
              <div
                key={p.server}
                style={{
                  position: 'relative',
                  height: 128,
                  borderRadius: 18,
                  background: isActive
                    ? 'linear-gradient(180deg, #171D28 0%, #0E121B 100%)'
                    : 'linear-gradient(180deg, #131720 0%, #0C0F16 100%)',
                  border: `1.5px solid ${isActive ? p.color : `${p.color}44`}`,
                  padding: '0 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  opacity: isActive ? 1 : 0.86,
                }}
              >
                <div
                  style={{
                    fontFamily: '"Outfit", sans-serif',
                    fontSize: 30,
                    fontWeight: 800,
                    color: '#F8FAFC',
                  }}
                >
                  {p.server}
                </div>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 18,
                    fontWeight: 600,
                    color: p.color,
                    marginTop: 5,
                  }}
                >
                  {p.capability}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 20,
                    right: 20,
                    height: 5,
                    borderRadius: '5px 5px 0 0',
                    backgroundColor: p.color,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
