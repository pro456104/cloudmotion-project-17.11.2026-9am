import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type { VideoScene } from '../types';

export const ScenePrimitives: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const headerIn = computeElementEntrance(frame, fps, easing, -8, 22);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  // Aligned word-for-word to 22s narration: Tools (0.00-0.43) -> Resources (0.43-0.71) -> Prompts (0.71-1.00)
  const activeIdx = progress < 0.43 ? 0 : progress < 0.71 ? 1 : 2;

  const primitives = [
    {
      index: '01',
      name: 'TOOLS',
      control: 'Model-Controlled',
      color: '#FF542E',
      methods: 'tools/list · tools/call',
      desc: 'Executable actions that query APIs, run workflows, or trigger side effects.',
      example: 'lookup_shipment("ORD-8492")',
    },
    {
      index: '02',
      name: 'RESOURCES',
      control: 'App-Controlled',
      color: '#1AE5A0',
      methods: 'resources/list · resources/read',
      desc: 'Read-only structured data URIs attached safely into context by the Host.',
      example: 'postgres://orders/schema',
    },
    {
      index: '03',
      name: 'PROMPTS',
      control: 'User-Controlled',
      color: '#F8FAFC',
      methods: 'prompts/list · prompts/get',
      desc: 'Reusable workflow templates triggered explicitly by the human user.',
      example: '/audit_failed_deliveries',
    },
  ];

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '88px 90px 135px',
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
            fontSize: 70,
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
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 32,
          width: '100%',
          maxWidth: 1640,
        }}
      >
        {primitives.map((item, idx) => {
          const isActive = activeIdx === idx;
          return (
            <div
              key={item.name}
              style={{
                position: 'relative',
                borderRadius: 26,
                background: isActive
                  ? 'linear-gradient(180deg, #181E2B 0%, #0D1119 100%)'
                  : 'linear-gradient(180deg, #12161F 0%, #0B0E14 100%)',
                border: isActive ? `2px solid ${item.color}` : `1px solid ${item.color}33`,
                boxShadow: isActive ? '0 28px 70px rgba(0,0,0,0.72)' : '0 14px 36px rgba(0,0,0,0.45)',
                padding: '32px 30px 40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 430,
                overflow: 'hidden',
                opacity: isActive ? 1 : 0.88,
                transform: `translateY(${isActive ? -10 : 0}px) scale(${isActive ? 1.02 : 0.99})`,
              }}
            >
              <div>
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
                      color: item.color,
                    }}
                  >
                    {item.index}
                  </span>
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 20,
                      fontWeight: 700,
                      color: item.color,
                    }}
                  >
                    {item.control}
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: '"Outfit", sans-serif',
                    fontSize: 46,
                    fontWeight: 900,
                    color: '#F8FAFC',
                    marginTop: 20,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 22,
                    fontWeight: 600,
                    color: item.color,
                    marginTop: 8,
                  }}
                >
                  {item.methods}
                </div>
                <p
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 25,
                    lineHeight: 1.46,
                    color: '#E2E8F0',
                    marginTop: 20,
                  }}
                >
                  {item.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: 22,
                  padding: '14px 18px',
                  borderRadius: 12,
                  backgroundColor: 'rgba(7,9,13,0.82)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 21,
                  fontWeight: 600,
                  color: item.color,
                }}
              >
                {item.example}
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 24,
                  right: 24,
                  height: isActive ? 8 : 5,
                  borderRadius: '7px 7px 0 0',
                  backgroundColor: item.color,
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
