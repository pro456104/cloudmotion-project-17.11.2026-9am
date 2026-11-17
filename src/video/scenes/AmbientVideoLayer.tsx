import React from 'react';
import { AbsoluteFill, Video, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AccentTone, AmbientBackgroundConfig } from '../types';

function resolveLocalVideoSrc(rawUrl: string): string {
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    try {
      return staticFile(rawUrl.slice(1));
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

interface AmbientVideoLayerProps {
  config: AmbientBackgroundConfig;
  accent: AccentTone;
  opacityMultiplier?: number;
  blurPx?: number;
  scale?: number;
  frameOffset?: number;
}

const TOKEN_STREAMS = [
  '{"jsonrpc":"2.0","method":"tools/list"}',
  'GET /v2/orders/8492 HTTP/1.1 200 OK',
  'capabilities: { tools: true, resources: true }',
  'Authorization: Bearer ••••••••',
  'stream: mcp-stdio://server-bridge',
  'status: "deterministic_contract_verified"',
  'SELECT id, tracking FROM shipments LIMIT 1;',
  'transport: sse | stdio | streamable-http',
];

export const AmbientVideoLayer: React.FC<AmbientVideoLayerProps> = ({
  config,
  accent,
  opacityMultiplier = 1,
  blurPx = 0,
  scale = 1,
  frameOffset = 0,
}) => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = localFrame + frameOffset;
  const timeSec = frame / Math.max(1, fps);

  if (config.preset === 'none' || opacityMultiplier <= 0.002) {
    return null;
  }

  const primaryColor = accent === 'mint' ? '#1AE5A0' : '#FF542E';
  const secondaryColor = accent === 'coral' ? '#FF542E' : '#1AE5A0';
  const alpha =
    Math.max(0.05, Math.min(0.65, config.opacity)) *
    Math.max(0, Math.min(1, opacityMultiplier));
  const transitionFilter = blurPx > 0.15 ? `blur(${blurPx.toFixed(1)}px)` : undefined;
  const transitionTransform =
    Math.abs(scale - 1) > 0.001 ? `scale(${scale.toFixed(4)})` : undefined;

  if (config.preset === 'custom-video' && config.customVideoUrl) {
    const resolvedVideoSrc = resolveLocalVideoSrc(config.customVideoUrl);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          overflow: 'hidden',
          opacity: Math.max(0, Math.min(1, opacityMultiplier)),
          filter: transitionFilter,
          transform: transitionTransform,
        }}
      >
        <Video
          src={resolvedVideoSrc}
          muted
          loop
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: Math.max(0.05, Math.min(0.65, config.opacity)),
            filter: 'saturate(0.85) contrast(1.08)',
          }}
        />
        {/* Measured obsidian readability scrim */}
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 48%, rgba(7,9,13,0.45) 0%, rgba(7,9,13,0.82) 100%)',
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: alpha,
        filter: transitionFilter,
        transform: transitionTransform,
      }}
    >
      {config.preset === 'fiber-streams' && (
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" fill="none">
          {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
            const yBase = 130 + idx * 145;
            const waveOffset = Math.sin(timeSec * 0.9 + idx) * 65;
            const dashOffset = -(timeSec * 30 * (4 + idx * 0.9)) % 900;
            const strokeColor = idx % 2 === 0 ? primaryColor : secondaryColor;
            return (
              <g key={idx}>
                <path
                  d={`M -80 ${yBase + waveOffset} C 480 ${yBase - 90}, 1220 ${yBase + 110}, 2020 ${yBase - waveOffset}`}
                  stroke={strokeColor}
                  strokeOpacity={0.22}
                  strokeWidth={2}
                />
                <path
                  d={`M -80 ${yBase + waveOffset} C 480 ${yBase - 90}, 1220 ${yBase + 110}, 2020 ${yBase - waveOffset}`}
                  stroke={strokeColor}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeDasharray="160 740"
                  strokeDashoffset={dashOffset}
                />
              </g>
            );
          })}
        </svg>
      )}

      {config.preset === 'neural-mesh' && (
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" fill="none">
          {Array.from({ length: 14 }).map((_, i) => {
            const x1 = ((i * 217) % 1760) + 80 + Math.sin(timeSec * 0.54 + i) * 38;
            const y1 = ((i * 151) % 860) + 110 + Math.cos(timeSec * 0.45 + i * 1.3) * 32;
            const nextIdx = (i + 3) % 14;
            const x2 =
              ((nextIdx * 217) % 1760) + 80 + Math.sin(timeSec * 0.54 + nextIdx) * 38;
            const y2 =
              ((nextIdx * 151) % 860) + 110 + Math.cos(timeSec * 0.45 + nextIdx * 1.3) * 32;
            const nodeColor = i % 2 === 0 ? primaryColor : secondaryColor;
            return (
              <g key={i}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(248,250,252,0.22)"
                  strokeWidth={1.5}
                />
                <circle cx={x1} cy={y1} r={5} fill={nodeColor} fillOpacity={0.85} />
                <circle cx={x1} cy={y1} r={16} stroke={nodeColor} strokeOpacity={0.25} />
              </g>
            );
          })}
        </svg>
      )}

      {config.preset === 'circuit-pulses' && (
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" fill="none">
          {[0, 1, 2, 3, 4, 5].map((lane) => {
            const y = 140 + lane * 160;
            const bendX = 480 + lane * 180;
            const path = `M -40 ${y} L ${bendX} ${y} L ${bendX + 90} ${y + 60} L 1980 ${y + 60}`;
            const dashOffset = -(timeSec * 30 * (6 + lane)) % 680;
            const color = lane % 2 === 0 ? '#1AE5A0' : '#FF542E';
            return (
              <g key={lane}>
                <path d={path} stroke="rgba(255,255,255,0.12)" strokeWidth={2} />
                <path
                  d={path}
                  stroke={color}
                  strokeWidth={3}
                  strokeDasharray="110 570"
                  strokeDashoffset={dashOffset}
                />
                <circle cx={bendX} cy={y} r={5} fill={color} />
              </g>
            );
          })}
        </svg>
      )}

      {config.preset === 'volumetric-wave' && (
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" fill="none">
          <defs>
            <linearGradient id="cloudBerryRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF542E" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#1AE5A0" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((band) => {
            const phase = timeSec * 0.72 + band * 0.85;
            const yMid = 420 + band * 85;
            const amp = 90 + band * 18;
            const d = `M -100 ${yMid + Math.sin(phase) * amp} Q 480 ${yMid - Math.cos(phase) * amp}, 960 ${yMid + Math.sin(phase + 1.2) * (amp * 0.6)} T 2020 ${yMid + Math.cos(phase) * amp}`;
            return (
              <path
                key={band}
                d={d}
                stroke="url(#cloudBerryRibbon)"
                strokeWidth={28 - band * 3}
                strokeOpacity={0.32}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      )}

      {config.preset === 'code-depth' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            padding: '60px 0',
            filter: 'blur(1px)',
          }}
        >
          {TOKEN_STREAMS.map((line, idx) => {
            const direction = idx % 2 === 0 ? -1 : 1;
            const shift = interpolate((timeSec * 30 * (1.4 + idx * 0.25)) % 900, [0, 900], [0, 420]);
            return (
              <div
                key={idx}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 28,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  color: idx % 2 === 0 ? '#1AE5A0' : '#FF542E',
                  opacity: 0.42,
                  transform: `translateX(${direction * shift - 120}px)`,
                }}
              >
                {`${line}   ·   ${line}   ·   ${line}`}
              </div>
            );
          })}
        </div>
      )}

      {/* Center focus readability scrim */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(7,9,13,0.48) 0%, rgba(7,9,13,0.18) 65%, rgba(7,9,13,0.6) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
