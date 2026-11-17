import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

const PHASE_SNIPPETS: Record<number, { filename: string; code: string; responseHint?: string }> = {
  0: {
    filename: '01-initialize.json',
    code: `{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "initialize",\n  "params": {\n    "protocolVersion": "2025-03-26",\n    "capabilities": { "roots": {} },\n    "clientInfo": { "name": "ai-host" }\n  }\n}`,
  },
  1: {
    filename: '02-tools-list.json',
    code: `{\n  "jsonrpc": "2.0",\n  "id": 2,\n  "method": "tools/list"\n}`,
    responseHint: `Server Returns Tool Schemas:\n["lookup_shipment", "list_orders"]`,
  },
};

export const SceneMcpBridge: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const headerIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  // Aligned to exact word positions in Scene 05 narration (21s):
  // 0.00-0.62: UTF-8 JSON-RPC 2.0 + initialize handshake
  // 0.62-0.84: queries tools/list at runtime
  // 0.84-1.00: invokes actions via tools/call
  const activePhase = progress < 0.62 ? 0 : progress < 0.84 ? 1 : 2;

  const steps = [
    { step: '01', label: 'initialize', detail: 'Negotiate protocol & capabilities' },
    { step: '02', label: 'tools/list', detail: 'Discover schemas dynamically at runtime' },
    { step: '03', label: 'tools/call', detail: 'Invoke action via structured JSON-RPC' },
  ];

  const activeSnippet =
    activePhase < 2
      ? PHASE_SNIPPETS[activePhase]
      : {
          filename: '03-tools-call.json',
          code: scene.codeSnippet || '',
        };

  const codeLines = activeSnippet.code.split('\n');

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
      {/* Left: Dynamic JSON-RPC Wire Payload synced to lifecycle stage */}
      <div
        style={{
          width: 780,
          borderRadius: 28,
          background: 'linear-gradient(180deg, #191418 0%, #0D0E13 100%)',
          border: '1.5px solid rgba(255, 84, 46, 0.42)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          overflow: 'hidden',
          opacity: Math.max(0.92, headerIn),
          transform: `translateY(${(1 - headerIn) * 14}px)`,
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
            {activeSnippet.filename}
          </span>
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 22,
              fontWeight: 700,
              color: '#FF542E',
            }}
          >
            {scene.leftBadge}
          </span>
        </div>

        <div
          style={{
            padding: '30px 32px 34px',
            minHeight: 360,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          <pre
            style={{
              margin: 0,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 23,
              lineHeight: 1.56,
              color: '#F8FAFC',
              whiteSpace: 'pre-wrap',
            }}
          >
            {codeLines.map((line, idx) => {
              const isMethod = line.includes('"method"');
              return (
                <div
                  key={idx}
                  style={{
                    color: isMethod ? '#FF542E' : '#E2E8F0',
                    fontWeight: isMethod ? 700 : 500,
                  }}
                >
                  {line || ' '}
                </div>
              );
            })}
          </pre>

          {activePhase === 0 && progress >= 0.42 && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                backgroundColor: 'rgba(255, 84, 46, 0.1)',
                border: '1px solid rgba(255, 84, 46, 0.42)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 19,
                lineHeight: 1.45,
                color: '#FF542E',
                fontWeight: 600,
              }}
            >
              → Client confirms: notifications/initialized
            </div>
          )}

          {activePhase === 1 && PHASE_SNIPPETS[1].responseHint && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 14,
                backgroundColor: 'rgba(26, 229, 160, 0.1)',
                border: '1px solid rgba(26, 229, 160, 0.42)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 20,
                lineHeight: 1.45,
                color: '#1AE5A0',
                fontWeight: 600,
                whiteSpace: 'pre-wrap',
              }}
            >
              {PHASE_SNIPPETS[1].responseHint}
            </div>
          )}
        </div>

        <div
          style={{
            height: 6,
            background: '#FF542E',
            width: `${Math.round((0.25 + 0.75 * progress) * 100)}%`,
          }}
        />
      </div>

      {/* Right: 3-Step Sequential Lifecycle Spotlight */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          opacity: Math.max(0.92, headerIn),
        }}
      >
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 23,
            fontWeight: 700,
            color: '#FF542E',
            letterSpacing: '0.08em',
          }}
        >
          {scene.rightBadge}
        </div>
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: 72,
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
            fontSize: 27,
            color: '#94A3B8',
            lineHeight: 1.4,
          }}
        >
          {scene.subheadline}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
          {steps.map((item, idx) => {
            const isActive = activePhase === idx;
            return (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '18px 24px',
                  borderRadius: 16,
                  backgroundColor: isActive ? 'rgba(255, 84, 46, 0.14)' : '#11151E',
                  border: isActive
                    ? '1.5px solid rgba(255, 84, 46, 0.6)'
                    : '1px solid rgba(255,255,255,0.08)',
                  opacity: isActive ? 1 : 0.86,
                  transform: `translateX(${isActive ? -8 : 0}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 24,
                    fontWeight: 800,
                    color: isActive ? '#FF542E' : '#64748B',
                  }}
                >
                  {item.step}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 26,
                      fontWeight: 700,
                      color: '#F8FAFC',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: 22,
                      color: isActive ? '#E2E8F0' : '#94A3B8',
                    }}
                  >
                    {item.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
