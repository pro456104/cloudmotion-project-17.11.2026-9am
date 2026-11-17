import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const SceneSecurity: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const headerIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  // Sequential gate verification synced word-for-word across 21s narration:
  // 0.00-0.46: Host approval -> 0.46-0.68: Scoped OAuth 2.1 tokens -> 0.68-0.85: Backend validation -> 0.85+: All 3 Verified
  const activeGate = progress < 0.46 ? 0 : progress < 0.68 ? 1 : 2;
  const allVerified = progress >= 0.85;

  const gates = [
    {
      num: 'GATE 01',
      layer: 'MCP Host Layer',
      title: 'Explicit Human Consent',
      detail: 'Users approve sensitive tools/call actions before leaving the host.',
      color: '#FF542E',
    },
    {
      num: 'GATE 02',
      layer: 'API Gateway Layer',
      title: 'Scoped OAuth 2.1 & Tokens',
      detail: 'MCP servers authenticate downstream using least-privilege credentials.',
      color: '#F59E0B',
    },
    {
      num: 'GATE 03',
      layer: 'Backend API Layer',
      title: 'Deterministic Validation',
      detail: 'Schema checks, RBAC rules, and rate limits guard your database.',
      color: '#1AE5A0',
    },
  ];

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

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          width: '100%',
          maxWidth: 1460,
        }}
      >
        {gates.map((g, idx) => {
          const isCurrent = !allVerified && activeGate === idx;
          const isVerified = allVerified || idx < activeGate;
          const statusLabel = isCurrent ? 'CHECKING' : isVerified ? 'VERIFIED' : 'QUEUED';
          const statusColor = isVerified ? '#1AE5A0' : isCurrent ? '#F59E0B' : '#94A3B8';
          return (
            <div
              key={g.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 36,
                padding: '26px 36px',
                borderRadius: 22,
                background: isCurrent
                  ? 'linear-gradient(180deg, #181E2B 0%, #0E131B 100%)'
                  : 'linear-gradient(180deg, #12161F 0%, #0B0E14 100%)',
                border: isCurrent ? `2px solid ${g.color}` : `1px solid ${g.color}44`,
                opacity: isCurrent ? 1 : 0.88,
                transform: `translateX(${isCurrent ? 10 : 0}px)`,
              }}
            >
              <div style={{ minWidth: 270 }}>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 23,
                    fontWeight: 700,
                    color: g.color,
                  }}
                >
                  {g.num}
                </div>
                <div
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#CBD5E1',
                    marginTop: 4,
                  }}
                >
                  {g.layer}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: '"Outfit", sans-serif',
                    fontSize: 34,
                    fontWeight: 800,
                    color: '#F8FAFC',
                  }}
                >
                  {g.title}
                </div>
                <div
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 24,
                    color: isCurrent ? '#E2E8F0' : '#CBD5E1',
                    marginTop: 4,
                  }}
                >
                  {g.detail}
                </div>
              </div>

              <div
                style={{
                  minWidth: 140,
                  textAlign: 'center',
                  padding: '10px 16px',
                  borderRadius: 12,
                  backgroundColor: isVerified
                    ? 'rgba(26, 229, 160, 0.14)'
                    : isCurrent
                      ? 'rgba(245, 158, 11, 0.16)'
                      : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${
                    isVerified
                      ? 'rgba(26, 229, 160, 0.55)'
                      : isCurrent
                        ? 'rgba(245, 158, 11, 0.65)'
                        : 'rgba(255,255,255,0.14)'
                  }`,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 19,
                  fontWeight: 700,
                  color: statusColor,
                  flexShrink: 0,
                }}
              >
                {statusLabel}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
