import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeHookMotionState } from '../hookMotion';
import type { VideoScene } from '../types';

const MCP_STEPS = ['Intent', 'Discover', 'Invoke'];
const API_STEPS = ['Auth', 'Validate', 'Execute'];

export const SceneHook: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const m = computeHookMotionState(frame, durationInFrames, fps, easing);

  const words = scene.headline.split(' ');
  const leftWord = words[0] || scene.leftBadge;
  const midWord = words[1] || 'VS';
  const rightWord = words.slice(2).join(' ') || scene.rightBadge;

  const dualStageOpacity = 1 - m.beat3Weight;
  const topStatusPrefix =
    m.beat3Weight >= 0.45
      ? 'STACK REALITY · '
      : m.beat2Weight >= 0.35
        ? 'ARCHITECTURAL ROLES · '
        : 'MYTH · ';

  const topStatusClaim =
    m.beat3Weight >= 0.45
      ? 'MCP SITS ON TOP OF YOUR APIS'
      : m.beat2Weight >= 0.35
        ? 'BRIDGE VS EXECUTION'
        : 'MCP REPLACES TRADITIONAL APIS';

  const dualSpreadPx = m.beat2Weight * 105;

  const bottomCallout =
    m.beat3Weight >= 0.55
      ? 'MCP Orchestrates AI Intent · APIs Execute Deterministically'
      : m.beat2Weight >= 0.35
        ? 'MCP Translates Model Calls · Backend APIs Run Business Logic'
        : scene.subheadline;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 48,
        paddingBottom: 92,
      }}
    >
      {/* Kinetic 3-part Hero Title */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 36,
          fontFamily: '"Outfit", sans-serif',
          fontSize: 112,
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          marginBottom: 18,
        }}
      >
        {/* Expanding subtle energy pulse ring centered on VS */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 110 + m.shockwave * 170,
            height: 110 + m.shockwave * 170,
            transform: 'translate(-50%, -50%)',
            borderRadius: '9999px',
            border: '2px solid rgba(255, 84, 46, 0.45)',
            opacity: Math.max(0, (1 - m.shockwave) * 0.65),
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            color: '#F8FAFC',
            opacity: 0.88 + 0.12 * m.introEase,
            transform: `translateX(${(1 - m.introEase) * -42}px)`,
          }}
        >
          {leftWord}
        </span>
        <span
          style={{
            color: '#FF542E',
            opacity: 0.9 + 0.1 * m.introEase,
            transform: `scale(${0.92 + m.introEase * 0.08})`,
            textShadow: '0 0 36px rgba(255, 84, 46, 0.35)',
          }}
        >
          {midWord}
        </span>
        <span
          style={{
            color: '#1AE5A0',
            opacity: 0.88 + 0.12 * m.introEase,
            transform: `translateX(${(1 - m.introEase) * 42}px)`,
          }}
        >
          {rightWord}
        </span>
      </div>

      {/* Live Narrative Beat Indicator + Myth Strikethrough Strip */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '8px 22px',
          borderRadius: 12,
          backgroundColor: 'rgba(17, 21, 30, 0.88)',
          border:
            m.beat3Weight >= 0.45
              ? '1px solid rgba(26, 229, 160, 0.4)'
              : '1px solid rgba(255, 84, 46, 0.35)',
          marginBottom: 24,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: m.beat3Weight >= 0.45 ? '#1AE5A0' : '#F8FAFC',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '9999px',
            backgroundColor: m.beat3Weight >= 0.45 ? '#1AE5A0' : '#FF542E',
            boxShadow:
              m.beat3Weight >= 0.45
                ? '0 0 12px rgba(26,229,160,0.85)'
                : '0 0 12px rgba(255,84,46,0.85)',
          }}
        />
        <span style={{ color: m.beat3Weight >= 0.45 ? '#1AE5A0' : '#94A3B8' }}>
          {topStatusPrefix}
        </span>
        <span style={{ position: 'relative' }}>
          {topStatusClaim}
          {m.beat2Weight < 0.2 && m.beat3Weight < 0.2 && m.mythStrike > 0.02 && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '52%',
                height: 4,
                width: `${m.mythStrike * 100}%`,
                backgroundColor: '#FF542E',
                borderRadius: 99,
                boxShadow: '0 0 10px rgba(255,84,46,0.9)',
              }}
            />
          )}
        </span>
        {m.beat2Weight < 0.2 && m.beat3Weight < 0.2 && m.mythStrike > 0.55 && (
          <span
            style={{
              marginLeft: 6,
              padding: '2px 10px',
              borderRadius: 6,
              backgroundColor: 'rgba(255, 84, 46, 0.2)',
              border: '1px solid rgba(255, 84, 46, 0.6)',
              color: '#FF542E',
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            FALSE
          </span>
        )}
      </div>

      {/* Main Kinetic Stage (Dual Cards -> Live Handshake -> 2-Layer Stack) */}
      <div
        style={{
          position: 'relative',
          width: 1480,
          height: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* BEATS 1 & 2: Dual Glass Cards + Animated Bidirectional Bridge */}
        {dualStageOpacity > 0.01 && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: dualStageOpacity,
              transform: `scale(${1 - m.beat3Weight * 0.08})`,
            }}
          >
            {/* Beat 1 Simple Dashed Beam */}
            <svg
              width="220"
              height="44"
              viewBox="0 0 220 44"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 1 - m.beat2Weight,
              }}
            >
              <line
                x1="12"
                y1="22"
                x2="208"
                y2="22"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="3"
                strokeDasharray="8 8"
              />
              <circle
                cx={12 + m.packetCycle * 196}
                cy="22"
                r="7"
                fill={m.packetCycle < 0.5 ? '#FF542E' : '#1AE5A0'}
              />
            </svg>

            {/* Beat 2 Live Bidirectional Protocol Bridge */}
            {m.beat2Weight > 0.02 && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 390,
                  height: 180,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 28,
                  opacity: m.beat2Weight,
                }}
              >
                {/* Request Lane: MCP -> API */}
                <div style={{ position: 'relative', height: 54 }}>
                  <div
                    style={{
                      textAlign: 'center',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#FF542E',
                      marginBottom: 8,
                    }}
                  >
                    tools/call →
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      height: 4,
                      borderRadius: 99,
                      background: 'rgba(255, 84, 46, 0.25)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -6,
                        left: `${m.packetCycle * 92}%`,
                        width: 24,
                        height: 16,
                        borderRadius: 99,
                        background: '#FF542E',
                        boxShadow: '0 0 18px rgba(255, 84, 46, 0.95)',
                      }}
                    />
                  </div>
                </div>

                {/* Response Lane: API -> MCP */}
                <div style={{ position: 'relative', height: 54 }}>
                  <div
                    style={{
                      position: 'relative',
                      height: 4,
                      borderRadius: 99,
                      background: 'rgba(26, 229, 160, 0.25)',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: `${((m.packetCycle + 0.45) % 1) * 92}%`,
                        width: 24,
                        height: 16,
                        borderRadius: 99,
                        background: '#1AE5A0',
                        boxShadow: '0 0 18px rgba(26, 229, 160, 0.95)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      textAlign: 'center',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#1AE5A0',
                    }}
                  >
                    ← 200 OK · JSON
                  </div>
                </div>
              </div>
            )}

            {/* Left Card: MCP (Coral Accent) */}
            <div
              style={{
                position: 'relative',
                width: 376,
                height: 332,
                borderRadius: 30,
                background: 'linear-gradient(180deg, #151923 0%, #0D1017 100%)',
                border: '1px solid rgba(255,84,46,0.34)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px 20px 20px',
                overflow: 'hidden',
                marginRight: 88 + dualSpreadPx,
                transform: `translateY(${m.floatY + (1 - m.introEase) * 18}px)`,
              }}
            >
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 6,
                    borderRadius: 99,
                    backgroundColor: '#FF542E',
                  }}
                />
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#FF542E',
                    letterSpacing: '0.08em',
                  }}
                >
                  AI INTERFACE
                </span>
              </div>

              {/* Rotating Orbital Telemetry Ring + Animated MCP Path */}
              <div
                style={{
                  position: 'relative',
                  width: 176,
                  height: 176,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="176"
                  height="176"
                  viewBox="0 0 176 176"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: `rotate(${m.orbitDeg}deg)`,
                  }}
                >
                  <circle
                    cx="88"
                    cy="88"
                    r="82"
                    fill="none"
                    stroke="rgba(255, 84, 46, 0.35)"
                    strokeWidth="2"
                    strokeDasharray="16 12"
                  />
                </svg>
                <svg width="108" height="108" viewBox="0 0 120 120" fill="none">
                  <path
                    d="M28 78L60 28C65 20 76 24 72 34L48 74C44 82 54 88 60 78L84 38C90 29 101 34 95 44L68 88C64 95 72 102 80 96"
                    stroke="#F8FAFC"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="320"
                    strokeDashoffset={320 * (1 - m.mcpStrokeDraw)}
                  />
                </svg>
              </div>

              {/* Animated Role Steps */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                {MCP_STEPS.map((step, idx) => {
                  const active = m.activeStepIndex === idx;
                  return (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        padding: '7px 6px',
                        borderRadius: 8,
                        backgroundColor: active
                          ? 'rgba(255, 84, 46, 0.24)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: active
                          ? '1px solid rgba(255, 84, 46, 0.65)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 17,
                        fontWeight: 700,
                        color: active ? '#F8FAFC' : '#94A3B8',
                      }}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 50% 108%, rgba(255,84,46,0.28) 0%, rgba(255,84,46,0) 60%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Right Card: API (Cyber Mint Accent) */}
            <div
              style={{
                position: 'relative',
                width: 376,
                height: 332,
                borderRadius: 30,
                background: 'linear-gradient(180deg, #131B1A 0%, #0C1111 100%)',
                border: '1px solid rgba(26,229,160,0.34)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px 20px 20px',
                overflow: 'hidden',
                marginLeft: 88 + dualSpreadPx,
                transform: `translateY(${-m.floatY + (1 - m.introEase) * 18}px)`,
              }}
            >
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 6,
                    borderRadius: 99,
                    backgroundColor: '#1AE5A0',
                  }}
                />
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1AE5A0',
                    letterSpacing: '0.08em',
                  }}
                >
                  DATA ENGINE
                </span>
              </div>

              {/* Counter-Rotating Telemetry Ring + API Emblem */}
              <div
                style={{
                  position: 'relative',
                  width: 176,
                  height: 176,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="176"
                  height="176"
                  viewBox="0 0 176 176"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: `rotate(${-m.orbitDeg * 1.15}deg)`,
                  }}
                >
                  <circle
                    cx="88"
                    cy="88"
                    r="82"
                    fill="none"
                    stroke="rgba(26, 229, 160, 0.35)"
                    strokeWidth="2"
                    strokeDasharray="20 10"
                  />
                </svg>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 66,
                    fontWeight: 700,
                    color: '#1AE5A0',
                    letterSpacing: '0.02em',
                    lineHeight: 1,
                  }}
                >
                  {scene.rightBadge}
                </span>
                <span
                  style={{
                    marginTop: 8,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 17,
                    fontWeight: 600,
                    color: '#CBD5E1',
                  }}
                >
                  REST · gRPC · DB
                </span>
              </div>

              {/* Animated Execution Steps */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                {API_STEPS.map((step, idx) => {
                  const active = m.activeStepIndex === idx;
                  return (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        padding: '7px 6px',
                        borderRadius: 8,
                        backgroundColor: active
                          ? 'rgba(26, 229, 160, 0.24)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: active
                          ? '1px solid rgba(26, 229, 160, 0.65)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 17,
                        fontWeight: 700,
                        color: active ? '#F8FAFC' : '#94A3B8',
                      }}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 50% 108%, rgba(26,229,160,0.26) 0%, rgba(26,229,160,0) 60%)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* BEAT 3: Architectural Stack Synthesis Reveal (MCP Sits Above APIs) */}
        {m.beat3Weight > 0.01 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: m.beat3Weight,
              transform: `translateY(${(1 - m.beat3Weight) * 26}px)`,
            }}
          >
            {/* Top Stack Layer: MCP */}
            <div
              style={{
                width: 980,
                height: 122,
                borderRadius: 22,
                background: 'linear-gradient(90deg, #1A1416 0%, #11151E 100%)',
                border: '1px solid rgba(255, 84, 46, 0.58)',
                boxShadow: '0 22px 54px rgba(0, 0, 0, 0.55)',
                padding: '0 34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 16,
                    background: 'rgba(255, 84, 46, 0.16)',
                    border: '1px solid rgba(255, 84, 46, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"Outfit", sans-serif',
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#FF542E',
                  }}
                >
                  MCP
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 19,
                      fontWeight: 700,
                      color: '#FF542E',
                      letterSpacing: '0.08em',
                    }}
                  >
                    LAYER 2 · AI PROTOCOL INTERFACE
                  </div>
                  <div
                    style={{
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: 32,
                      fontWeight: 800,
                      color: '#F8FAFC',
                    }}
                  >
                    Model Context &amp; Tool Discovery
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 21,
                  fontWeight: 700,
                  color: '#E2E8F0',
                }}
              >
                tools/list · tools/call
              </div>
            </div>

            {/* Vertical Bidirectional Data Connector */}
            <div
              style={{
                position: 'relative',
                width: 480,
                height: 76,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 32px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#FF542E',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 4,
                    height: 64,
                    background: 'rgba(255, 84, 46, 0.3)',
                    borderRadius: 99,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: -4,
                      top: m.packetCycle * 52,
                      width: 12,
                      height: 12,
                      borderRadius: 99,
                      background: '#FF542E',
                      boxShadow: '0 0 12px #FF542E',
                    }}
                  />
                </div>
                <span>Calls API ↓</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#1AE5A0',
                }}
              >
                <span>↑ Verified Data</span>
                <div
                  style={{
                    position: 'relative',
                    width: 4,
                    height: 64,
                    background: 'rgba(26, 229, 160, 0.3)',
                    borderRadius: 99,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: -4,
                      bottom: ((m.packetCycle + 0.5) % 1) * 52,
                      width: 12,
                      height: 12,
                      borderRadius: 99,
                      background: '#1AE5A0',
                      boxShadow: '0 0 12px #1AE5A0',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Stack Layer: Traditional APIs */}
            <div
              style={{
                width: 980,
                height: 122,
                borderRadius: 22,
                background: 'linear-gradient(90deg, #0F1A18 0%, #11151E 100%)',
                border: '1px solid rgba(26,229,160,0.58)',
                boxShadow: '0 22px 54px rgba(0, 0, 0, 0.55)',
                padding: '0 34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 16,
                    background: 'rgba(26, 229, 160, 0.14)',
                    border: '1px solid rgba(26, 229, 160, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#1AE5A0',
                  }}
                >
                  API
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 19,
                      fontWeight: 700,
                      color: '#1AE5A0',
                      letterSpacing: '0.08em',
                    }}
                  >
                    LAYER 1 · DETERMINISTIC EXECUTION
                  </div>
                  <div
                    style={{
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: 32,
                      fontWeight: 800,
                      color: '#F8FAFC',
                    }}
                  >
                    REST · GraphQL · gRPC · Databases
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 21,
                  fontWeight: 700,
                  color: '#1AE5A0',
                }}
              >
                Auth &amp; 200 OK
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subheadline + Coral-to-Mint Gradient Rule */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          marginTop: 22,
        }}
      >
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '0.03em',
            color: m.beat3Weight >= 0.55 ? '#1AE5A0' : '#FF542E',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {bottomCallout}
        </div>
        <div
          style={{
            width: 1080,
            height: 6,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(m.ruleProgress * 100)}%`,
              height: '100%',
              borderRadius: 99,
              background: 'linear-gradient(90deg, #FF542E 0%, #F59E0B 45%, #1AE5A0 100%)',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
