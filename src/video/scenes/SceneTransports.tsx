import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const SceneTransports: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const headerIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  // First 60%: stdio local subprocess -> Second 40%: Streamable HTTP cloud service
  const activeSide: 'stdio' | 'http' = progress < 0.60 ? 'stdio' : 'http';
  const pulse = ((frame / Math.max(1, fps)) % 1.8) / 1.8;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '88px 96px 135px',
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 44,
          width: '100%',
          maxWidth: 1580,
        }}
      >
        {/* Left: stdio Transport */}
        <div
          style={{
            position: 'relative',
            borderRadius: 28,
            background: 'linear-gradient(180deg, #1B1316 0%, #0D0E13 100%)',
            border:
              activeSide === 'stdio'
                ? '2px solid rgba(255,84,46,0.8)'
                : '1px solid rgba(255,84,46,0.28)',
            padding: '34px 36px 44px',
            overflow: 'hidden',
            opacity: activeSide === 'stdio' ? 1 : 0.88,
            transform: `translateY(${activeSide === 'stdio' ? -6 : 0}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 23,
                fontWeight: 700,
                color: '#FF542E',
              }}
            >
              LOCAL SUBPROCESS
            </span>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 21,
                fontWeight: 600,
                color: '#CBD5E1',
              }}
            >
              Newline-Delimited JSON
            </span>
          </div>

          <div
            style={{
              fontFamily: '"Outfit", sans-serif',
              fontSize: 46,
              fontWeight: 900,
              color: '#F8FAFC',
              marginTop: 12,
            }}
          >
            stdio Transport
          </div>

          <div
            style={{
              marginTop: 24,
              borderRadius: 16,
              backgroundColor: '#07090D',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 23,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F8FAFC' }}>
                <span>stdin →</span>
                <span style={{ color: '#FF542E', fontWeight: 700 }}>JSON-RPC Requests</span>
              </div>
              <div style={{ position: 'relative', height: 4, marginTop: 8, background: 'rgba(255,84,46,0.2)', borderRadius: 99 }}>
                {activeSide === 'stdio' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      left: `${pulse * 94}%`,
                      width: 18,
                      height: 12,
                      borderRadius: 99,
                      background: '#FF542E',
                      boxShadow: '0 0 12px #FF542E',
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F8FAFC' }}>
                <span>stdout ←</span>
                <span style={{ color: '#1AE5A0', fontWeight: 700 }}>Server Responses</span>
              </div>
              <div style={{ position: 'relative', height: 4, marginTop: 8, background: 'rgba(26,229,160,0.2)', borderRadius: 99 }}>
                {activeSide === 'stdio' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: `${((pulse + 0.5) % 1) * 94}%`,
                      width: 18,
                      height: 12,
                      borderRadius: 99,
                      background: '#1AE5A0',
                      boxShadow: '0 0 12px #1AE5A0',
                    }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>stderr ·</span>
              <span>Isolated Diagnostic Logs</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 24,
              color: '#E2E8F0',
              lineHeight: 1.4,
            }}
          >
            Ideal for local CLI tools, filesystems, and desktop IDE extensions.
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 28,
              right: 28,
              height: activeSide === 'stdio' ? 8 : 5,
              borderRadius: '7px 7px 0 0',
              backgroundColor: '#FF542E',
            }}
          />
        </div>

        {/* Right: Streamable HTTP Transport */}
        <div
          style={{
            position: 'relative',
            borderRadius: 28,
            background: 'linear-gradient(180deg, #121A1B 0%, #0C1013 100%)',
            border:
              activeSide === 'http'
                ? '2px solid rgba(26,229,160,0.8)'
                : '1px solid rgba(26,229,160,0.28)',
            padding: '34px 36px 44px',
            overflow: 'hidden',
            opacity: activeSide === 'http' ? 1 : 0.88,
            transform: `translateY(${activeSide === 'http' ? -6 : 0}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 23,
                fontWeight: 700,
                color: '#1AE5A0',
              }}
            >
              REMOTE CLOUD SERVICE
            </span>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 21,
                fontWeight: 600,
                color: '#CBD5E1',
              }}
            >
              Multi-Tenant
            </span>
          </div>

          <div
            style={{
              fontFamily: '"Outfit", sans-serif',
              fontSize: 46,
              fontWeight: 900,
              color: '#F8FAFC',
              marginTop: 12,
            }}
          >
            Streamable HTTP
          </div>

          <div
            style={{
              marginTop: 24,
              borderRadius: 16,
              backgroundColor: '#07090D',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 23,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F8FAFC' }}>
                <span>POST /mcp →</span>
                <span style={{ color: '#1AE5A0', fontWeight: 700 }}>Unified RPC Endpoint</span>
              </div>
              <div style={{ position: 'relative', height: 4, marginTop: 8, background: 'rgba(26,229,160,0.2)', borderRadius: 99 }}>
                {activeSide === 'http' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      left: `${pulse * 94}%`,
                      width: 18,
                      height: 12,
                      borderRadius: 99,
                      background: '#1AE5A0',
                      boxShadow: '0 0 12px #1AE5A0',
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F8FAFC' }}>
                <span>GET /mcp ←</span>
                <span style={{ color: '#FF542E', fontWeight: 700 }}>Optional SSE Stream</span>
              </div>
              <div style={{ position: 'relative', height: 4, marginTop: 8, background: 'rgba(255,84,46,0.2)', borderRadius: 99 }}>
                {activeSide === 'http' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: `${((pulse + 0.5) % 1) * 94}%`,
                      width: 18,
                      height: 12,
                      borderRadius: 99,
                      background: '#FF542E',
                      boxShadow: '0 0 12px #FF542E',
                    }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Auth ·</span>
              <span>OAuth 2.1 / API Gateway</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 24,
              color: '#E2E8F0',
              lineHeight: 1.4,
            }}
          >
            Built for shared cloud servers behind gateways, auth, and rate limits.
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 28,
              right: 28,
              height: activeSide === 'http' ? 8 : 5,
              borderRadius: '7px 7px 0 0',
              backgroundColor: '#1AE5A0',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
