import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useAnimationEasing } from '../AnimationEasingContext';
import { computeElementEntrance } from '../easingPresets';
import type {
  AccentTone,
  UniversalArchetype,
  VideoScene,
  VisualComparisonColumn,
  VisualMetricItem,
  VisualNodeItem,
  VisualTerminalLine,
} from '../types';

function resolveToneColor(tone?: AccentTone | 'neutral'): {
  main: string;
  bg: string;
  border: string;
} {
  if (tone === 'mint') {
    return {
      main: '#1AE5A0',
      bg: 'rgba(26, 229, 160, 0.12)',
      border: 'rgba(26, 229, 160, 0.42)',
    };
  }
  if (tone === 'neutral') {
    return {
      main: '#E2E8F0',
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.14)',
    };
  }
  return {
    main: '#FF542E',
    bg: 'rgba(255, 84, 46, 0.12)',
    border: 'rgba(255, 84, 46, 0.42)',
  };
}

function renderAccentHeadline(
  headline: string,
  accentWord: string | undefined,
  accent: AccentTone,
  fontSize: number
) {
  const accentHex = accent === 'mint' ? '#1AE5A0' : '#FF542E';
  const cleanAccent = accentWord?.trim();
  const words = headline.trim().split(/\s+/);

  return (
    <div
      style={{
        fontFamily: '"Outfit", sans-serif',
        fontSize,
        fontWeight: 900,
        letterSpacing: '-0.025em',
        lineHeight: 1.06,
        color: '#F8FAFC',
        textAlign: 'center',
        maxWidth: '92%',
        wordBreak: 'break-word',
      }}
    >
      {words.map((word, idx) => {
        const isMatch =
          cleanAccent &&
          word.replace(/[^a-zA-Z0-9×+-]/g, '').toLowerCase() ===
            cleanAccent.replace(/[^a-zA-Z0-9×+-]/g, '').toLowerCase();
        return (
          <React.Fragment key={`${word}-${idx}`}>
            <span
              style={{
                color: isMatch ? accentHex : '#F8FAFC',
                textShadow: isMatch ? `0 0 28px ${accentHex}44` : undefined,
              }}
            >
              {word}
            </span>
            {idx < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const HeadlineHeader: React.FC<{
  scene: VideoScene;
  isPortrait: boolean;
  isSquare: boolean;
  introProgress: number;
}> = ({ scene, isPortrait, isSquare, introProgress }) => {
  const accentColor = scene.accent === 'mint' ? '#1AE5A0' : '#FF542E';
  const headlineSize = isPortrait ? 62 : isSquare ? 58 : 72;
  const subSize = isPortrait ? 26 : isSquare ? 24 : 28;
  const kicker = scene.visualPayload?.kicker || scene.chapterTitle;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isPortrait ? 14 : 12,
        opacity: introProgress,
        transform: `translateY(${(1 - introProgress) * 22}px)`,
        marginBottom: isPortrait ? 28 : 24,
        width: '100%',
      }}
    >
      {kicker && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 16px',
            borderRadius: 10,
            backgroundColor: 'rgba(17, 21, 30, 0.88)',
            border: `1px solid ${accentColor}55`,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: isPortrait ? 18 : 17,
            fontWeight: 700,
            letterSpacing: '0.07em',
            color: accentColor,
          }}
        >
          {kicker}
        </div>
      )}
      {renderAccentHeadline(scene.headline, scene.accentWord, scene.accent, headlineSize)}
      {scene.subheadline && (
        <div
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: subSize,
            fontWeight: 600,
            color: '#94A3B8',
            textAlign: 'center',
            maxWidth: isPortrait ? '90%' : '80%',
            lineHeight: 1.35,
          }}
        >
          {scene.subheadline}
        </div>
      )}
    </div>
  );
};

const CalloutBanner: React.FC<{
  text?: string;
  isPortrait: boolean;
  accent?: AccentTone;
}> = ({ text, isPortrait, accent = 'mint' }) => {
  if (!text?.trim()) return null;
  const color = accent === 'coral' ? '#FF542E' : '#1AE5A0';
  const border =
    accent === 'coral' ? 'rgba(255, 84, 46, 0.35)' : 'rgba(26, 229, 160, 0.32)';
  return (
    <div
      style={{
        marginTop: isPortrait ? 22 : 24,
        padding: isPortrait ? '12px 22px' : '12px 26px',
        borderRadius: 14,
        backgroundColor: 'rgba(17, 21, 30, 0.9)',
        border: `1px solid ${border}`,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: isPortrait ? 19 : 20,
        fontWeight: 700,
        color,
        textAlign: 'center',
        maxWidth: '92%',
        lineHeight: 1.35,
      }}
    >
      {text}
    </div>
  );
};

export const UniversalSceneRenderer: React.FC<{
  scene: VideoScene;
  archetype: UniversalArchetype;
}> = ({ scene, archetype }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const easing = useAnimationEasing();

  const safeFps = Math.max(1, fps);
  const timeSec = frame / safeFps;
  const isPortrait = height > width;
  const isSquare = width === height;

  const intro = computeElementEntrance(frame, safeFps, easing, -8, 20);
  const packetCycle = (timeSec * 0.55) % 1;
  const progressRatio = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const payload = scene.visualPayload || {};

  const safeTop = isPortrait ? 148 : isSquare ? 114 : 112;
  const safeBottom = isPortrait ? 210 : isSquare ? 150 : 148;
  const safeSide = isPortrait ? 56 : isSquare ? 64 : 92;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: safeTop,
    paddingBottom: safeBottom,
    paddingLeft: safeSide,
    paddingRight: safeSide,
  };

  if (archetype === 'chapter-title') {
    const lineScale = spring({
      frame: Math.max(0, frame - Math.round(0.2 * safeFps)),
      fps: safeFps,
      config: { damping: 16, stiffness: 120 },
    });
    const accentHex = scene.accent === 'mint' ? '#1AE5A0' : '#FF542E';

    return (
      <AbsoluteFill style={containerStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            opacity: intro,
            transform: `scale(${0.94 + 0.06 * intro})`,
          }}
        >
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: isPortrait ? 26 : 24,
              fontWeight: 800,
              color: accentHex,
              letterSpacing: '0.16em',
            }}
          >
            CHAPTER {String(scene.index).padStart(2, '0')}
          </div>
          {renderAccentHeadline(
            scene.headline,
            scene.accentWord,
            scene.accent,
            isPortrait ? 76 : 92
          )}
          <div
            style={{
              width: (isPortrait ? 520 : 720) * lineScale,
              height: 5,
              borderRadius: 99,
              background: 'linear-gradient(90deg, #FF542E 0%, #1AE5A0 100%)',
            }}
          />
          <div
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: isPortrait ? 30 : 32,
              fontWeight: 600,
              color: '#CBD5E1',
              textAlign: 'center',
              maxWidth: isPortrait ? 860 : 1100,
              lineHeight: 1.4,
            }}
          >
            {scene.subheadline}
          </div>
          <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent={scene.accent} />
        </div>
      </AbsoluteFill>
    );
  }

  if (archetype === 'hero-hook') {
    const pulseCycle = (timeSec % 3) / 3;
    const pulseRadius = 110 + pulseCycle * 180;
    const pulseOpacity = Math.max(0, 1 - pulseCycle) * 0.45;
    const leftText = scene.leftBadge || 'CONCEPT';
    const rightText = scene.rightBadge || 'OUTCOME';

    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: isPortrait ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isPortrait ? 28 : 42,
            width: '100%',
            maxWidth: isPortrait ? 880 : 1380,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: pulseRadius,
              height: pulseRadius,
              borderRadius: '9999px',
              border: '2px solid rgba(255, 84, 46, 0.5)',
              transform: 'translate(-50%, -50%)',
              opacity: pulseOpacity,
              pointerEvents: 'none',
            }}
          />
          {[
            { label: leftText, tone: 'coral' as const, detail: scene.bulletPoints?.[0] || 'Core Pattern' },
            { label: rightText, tone: 'mint' as const, detail: scene.bulletPoints?.[1] || 'Production Reality' },
          ].map((card, i) => {
            const cEnter = computeElementEntrance(frame, fps, easing, 8 + i * 8, 20);
            const colors = resolveToneColor(card.tone);
            return (
              <div
                key={card.label + i}
                style={{
                  flex: 1,
                  width: isPortrait ? '100%' : undefined,
                  minHeight: isPortrait ? 190 : 240,
                  borderRadius: 24,
                  background: 'linear-gradient(180deg, #151923 0%, #0C1017 100%)',
                  border: `1px solid ${colors.border}`,
                  boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
                  padding: isPortrait ? '28px 32px' : '34px 38px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 14,
                  opacity: cEnter,
                  transform: `translateY(${(1 - cEnter) * 24}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: isPortrait ? 40 : 44,
                    fontWeight: 800,
                    color: colors.main,
                    textAlign: 'center',
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: isPortrait ? 24 : 22,
                    fontWeight: 600,
                    color: '#CBD5E1',
                    textAlign: 'center',
                  }}
                >
                  {card.detail}
                </div>
              </div>
            );
          })}
        </div>
        <CalloutBanner
          text={payload.callout || scene.codeSnippet}
          isPortrait={isPortrait}
          accent="mint"
        />
      </AbsoluteFill>
    );
  }

  if (archetype === 'split-compare') {
    const defaultCols: VisualComparisonColumn[] = [
      {
        title: scene.leftBadge || 'Approach A',
        tone: 'coral',
        items: scene.bulletPoints?.slice(0, 3) || ['Manual wiring', 'Fragile scaling'],
      },
      {
        title: scene.rightBadge || 'Approach B',
        tone: 'mint',
        items: scene.bulletPoints?.slice(3, 6) || ['Standardized contract', 'Deterministic runtime'],
      },
    ];
    const cols = payload.columns?.length ? payload.columns.slice(0, 2) : defaultCols;

    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
            gap: isPortrait ? 22 : 34,
            width: '100%',
            maxWidth: isPortrait ? 880 : 1480,
          }}
        >
          {cols.map((col, idx) => {
            const colors = resolveToneColor(col.tone || (idx === 0 ? 'coral' : 'mint'));
            const enter = computeElementEntrance(frame, fps, easing, 6 + idx * 8, 20);
            return (
              <div
                key={col.title + idx}
                style={{
                  borderRadius: 24,
                  background: 'linear-gradient(180deg, #131823 0%, #0C1017 100%)',
                  border: `1px solid ${colors.border}`,
                  padding: isPortrait ? '24px 28px' : '30px 34px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 24}px)`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    paddingBottom: 14,
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: isPortrait ? 32 : 34,
                      fontWeight: 800,
                      color: colors.main,
                    }}
                  >
                    {col.title}
                  </span>
                  {col.badge && (
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 16,
                        fontWeight: 700,
                        color: colors.main,
                      }}
                    >
                      {col.badge}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {col.items.map((item, i) => {
                    const itemEnter = computeElementEntrance(
                      frame,
                      fps,
                      easing,
                      14 + idx * 6 + i * 6,
                      16
                    );
                    return (
                      <div
                        key={item + i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          opacity: itemEnter,
                          fontFamily: '"Plus Jakarta Sans", sans-serif',
                          fontSize: isPortrait ? 23 : 22,
                          fontWeight: 600,
                          color: '#E2E8F0',
                          lineHeight: 1.38,
                        }}
                      >
                        <span style={{ color: colors.main, fontWeight: 800 }}>→</span>
                        <span>{item}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent={scene.accent} />
      </AbsoluteFill>
    );
  }

  if (archetype === 'architecture-flow' || archetype === 'pipeline-steps') {
    const fallbackNodes: VisualNodeItem[] = (
      scene.bulletPoints?.length
        ? scene.bulletPoints
        : [scene.leftBadge || 'Input', 'Processor', scene.rightBadge || 'Output']
    )
      .slice(0, 5)
      .map((label, idx, arr) => ({
        id: `node-${idx}`,
        label,
        tone: idx === 0 ? 'coral' : idx === arr.length - 1 ? 'mint' : 'neutral',
      }));
    const nodes = payload.nodes?.length ? payload.nodes.slice(0, 5) : fallbackNodes;
    const connectorLabels = Array.isArray(payload.connectorLabels)
      ? payload.connectorLabels
      : [];
    const hasConnectorLabels = connectorLabels.some((lbl) => Boolean(lbl?.trim()));
    const activeIdx = Math.min(
      nodes.length - 1,
      Math.floor(progressRatio * nodes.length)
    );

    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: isPortrait ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isPortrait ? 18 : hasConnectorLabels ? 14 : 20,
            width: '100%',
            maxWidth: isPortrait ? 820 : 1620,
          }}
        >
          {nodes.map((node, idx) => {
            const enter = computeElementEntrance(frame, safeFps, easing, 6 + idx * 6, 18);
            const isActive = idx === activeIdx;
            const colors = resolveToneColor(
              node.tone || (idx === 0 ? 'coral' : idx === nodes.length - 1 ? 'mint' : 'neutral')
            );
            const edgeLabel = connectorLabels[idx]?.trim();
            return (
              <React.Fragment key={node.id + idx}>
                <div
                  style={{
                    flex: isPortrait ? undefined : 1,
                    width: isPortrait ? '100%' : undefined,
                    minHeight: isPortrait ? 132 : 220,
                    borderRadius: 22,
                    background: isActive
                      ? `linear-gradient(180deg, ${colors.bg}, #0D1119)`
                      : 'linear-gradient(180deg, #131823 0%, #0C1017 100%)',
                    border: `1.5px solid ${isActive ? colors.main : colors.border}`,
                    boxShadow: isActive ? `0 0 36px ${colors.main}33` : '0 18px 40px rgba(0,0,0,0.5)',
                    padding: isPortrait ? '20px 26px' : '26px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: isPortrait ? 'flex-start' : 'center',
                    gap: 10,
                    opacity: enter,
                    transform: `scale(${isActive ? 1.03 : 1}) translateY(${(1 - enter) * 18}px)`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 16,
                      fontWeight: 700,
                      color: colors.main,
                    }}
                  >
                    {node.badge || `STEP ${String(idx + 1).padStart(2, '0')}`}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: isPortrait ? 28 : 26,
                      fontWeight: 800,
                      color: '#F8FAFC',
                      textAlign: isPortrait ? 'left' : 'center',
                    }}
                  >
                    {node.label}
                  </div>
                  {node.sublabel && (
                    <div
                      style={{
                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                        fontSize: isPortrait ? 20 : 18,
                        color: '#94A3B8',
                        textAlign: isPortrait ? 'left' : 'center',
                      }}
                    >
                      {node.sublabel}
                    </div>
                  )}
                </div>
                {idx < nodes.length - 1 && (
                  <div
                    style={{
                      position: 'relative',
                      width: isPortrait ? 4 : hasConnectorLabels ? 112 : 56,
                      height: isPortrait ? (hasConnectorLabels ? 46 : 40) : 4,
                      borderRadius: 99,
                      background: 'rgba(255,255,255,0.16)',
                      flexShrink: 0,
                    }}
                  >
                    {edgeLabel && (
                      <div
                        style={{
                          position: 'absolute',
                          ...(isPortrait
                            ? { left: 18, top: '50%', transform: 'translateY(-50%)' }
                            : {
                                bottom: 14,
                                left: '50%',
                                transform: 'translateX(-50%)',
                              }),
                          padding: '3px 10px',
                          borderRadius: 6,
                          backgroundColor: '#0D1119',
                          border: `1px solid ${
                            idx <= activeIdx ? 'rgba(26,229,160,0.45)' : 'rgba(255,255,255,0.14)'
                          }`,
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: isPortrait ? 15 : 13,
                          fontWeight: 700,
                          color: idx <= activeIdx ? '#1AE5A0' : '#CBD5E1',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {edgeLabel}
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        borderRadius: 99,
                        background: idx <= activeIdx ? '#1AE5A0' : '#FF542E',
                        boxShadow: `0 0 12px ${idx <= activeIdx ? '#1AE5A0' : '#FF542E'}`,
                        left: isPortrait ? -4 : `${packetCycle * 80}%`,
                        top: isPortrait ? `${packetCycle * 72}%` : -4,
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent="mint" />
      </AbsoluteFill>
    );
  }

  if (archetype === 'code-walkthrough') {
    const codeLines = (
      scene.codeSnippet ||
      'export async function handler(req) {\n  const result = await verifyToken(req);\n  return Response.json({ ok: true, result });\n}'
    ).split('\n');
    const activeLine = Math.min(
      codeLines.length - 1,
      Math.floor(progressRatio * codeLines.length)
    );
    const isDense = codeLines.length > 10;
    const isMedium = codeLines.length > 7;
    const codeFontSize = isDense
      ? isPortrait
        ? 16
        : 18
      : isMedium
        ? isPortrait
          ? 18
          : 21
        : isPortrait
          ? 21
          : 24;
    const linePad = isDense ? '4px 12px' : isMedium ? '6px 12px' : '8px 14px';
    const maxCardBodyHeight = isPortrait ? 880 : 470;

    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            width: '100%',
            maxWidth: isPortrait ? 920 : 1380,
            borderRadius: 24,
            background: '#0C1018',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 28px 72px rgba(0,0,0,0.65)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 26px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: '#11151E',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 18,
              color: '#94A3B8',
            }}
          >
            <span>{payload.codeFilename || 'index.ts'}</span>
            <span style={{ color: '#1AE5A0' }}>
              {payload.codeLanguage || 'TypeScript'}
            </span>
          </div>
          <div
            style={{
              padding: isPortrait ? '18px 22px' : isDense ? '16px 26px' : '22px 30px',
              maxHeight: maxCardBodyHeight,
              overflow: 'hidden',
            }}
          >
            {codeLines.map((line, i) => {
              const lineIn = computeElementEntrance(frame, safeFps, easing, 4 + i * 4, 14);
              const highlighted = payload.highlightLines?.length
                ? payload.highlightLines.includes(i + 1)
                : i === activeLine;
              return (
                <div
                  key={`${i}-${line}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: linePad,
                    borderRadius: 8,
                    backgroundColor: highlighted ? 'rgba(26, 229, 160, 0.12)' : 'transparent',
                    borderLeft: highlighted ? '3px solid #1AE5A0' : '3px solid transparent',
                    opacity: Math.max(0.35, lineIn),
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: codeFontSize,
                    lineHeight: isDense ? 1.35 : 1.46,
                    color: highlighted ? '#F8FAFC' : '#CBD5E1',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <span style={{ color: '#64748B', minWidth: 32, textAlign: 'right' }}>
                    {i + 1}
                  </span>
                  <span>{line || ' '}</span>
                </div>
              );
            })}
          </div>
        </div>
        <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent="mint" />
      </AbsoluteFill>
    );
  }

  if (archetype === 'terminal-demo') {
    const lines: VisualTerminalLine[] = payload.terminalLines?.length
      ? payload.terminalLines
      : (scene.codeSnippet || '$ npm run build\n✓ Compiled 14 scenes\n✓ Ready on port 3000')
          .split('\n')
          .map((t) => ({
            text: t,
            kind: t.startsWith('$') ? 'cmd' : t.includes('✓') ? 'success' : 'output',
          }));
    const isDense = lines.length > 9;
    const isMedium = lines.length > 6;
    const termFontSize = isDense
      ? isPortrait
        ? 17
        : 18
      : isMedium
        ? isPortrait
          ? 19
          : 21
        : isPortrait
          ? 22
          : 24;
    const maxTermBodyHeight = isPortrait ? 880 : 470;

    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            width: '100%',
            maxWidth: isPortrait ? 920 : 1340,
            borderRadius: 24,
            background: '#090C12',
            border: '1px solid rgba(255,84,46,0.3)',
            boxShadow: '0 28px 72px rgba(0,0,0,0.65)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 26px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: '#121620',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 18,
              color: '#CBD5E1',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{payload.terminalTitle || 'studio-cli — bash'}</span>
            <span style={{ color: '#FF542E' }}>LIVE SESSION</span>
          </div>
          <div
            style={{
              padding: isDense ? '18px 28px' : '24px 30px',
              display: 'flex',
              flexDirection: 'column',
              gap: isDense ? 8 : 12,
              maxHeight: maxTermBodyHeight,
              overflow: 'hidden',
            }}
          >
            {lines.map((line, i) => {
              const showAtSec = (i / Math.max(1, lines.length)) * (durationInFrames / safeFps) * 0.72;
              const elapsedLineSec = timeSec - showAtSec;
              const visible = elapsedLineSec >= 0;
              const fade =
                i === 0
                  ? interpolate(timeSec, [0, 8 / 30], [0.82, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })
                  : interpolate(elapsedLineSec, [0, 10 / 30], [0.38, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    });
              const color =
                line.kind === 'cmd'
                  ? '#FF542E'
                  : line.kind === 'success'
                    ? '#1AE5A0'
                    : line.kind === 'warn'
                      ? '#F59E0B'
                      : '#CBD5E1';
              return (
                <div
                  key={`${i}-${line.text}`}
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: termFontSize,
                    lineHeight: isDense ? 1.35 : 1.45,
                    fontWeight: line.kind === 'cmd' ? 700 : 500,
                    color,
                    opacity: visible ? fade : 0.38,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        </div>
        <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent="coral" />
      </AbsoluteFill>
    );
  }

  if (archetype === 'metric-chart') {
    const metrics: VisualMetricItem[] = payload.metrics?.length
      ? payload.metrics
      : [
          { label: scene.leftBadge || 'Baseline', value: '42%', numericValue: 42, tone: 'coral' },
          { label: scene.rightBadge || 'Optimized', value: '96%', numericValue: 96, tone: 'mint' },
        ];
    const maxNumeric = Math.max(
      1,
      ...metrics.map((m) => (typeof m.numericValue === 'number' ? m.numericValue : 100))
    );

    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPortrait
              ? '1fr'
              : `repeat(${Math.min(4, metrics.length)}, minmax(0, 1fr))`,
            gap: 24,
            width: '100%',
            maxWidth: isPortrait ? 860 : 1480,
          }}
        >
          {metrics.slice(0, 4).map((m, idx) => {
            const enter = computeElementEntrance(frame, fps, easing, 6 + idx * 7, 22);
            const colors = resolveToneColor(m.tone || (idx % 2 === 0 ? 'coral' : 'mint'));
            const ratio = Math.max(
              0.12,
              Math.min(1, (m.numericValue ?? 75) / maxNumeric)
            );
            return (
              <div
                key={m.label + idx}
                style={{
                  borderRadius: 22,
                  background: '#11151E',
                  border: `1px solid ${colors.border}`,
                  padding: '28px 26px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 20}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#94A3B8',
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: isPortrait ? 52 : 56,
                    fontWeight: 800,
                    color: colors.main,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {m.value}
                </div>
                <div
                  style={{
                    height: 12,
                    width: '100%',
                    borderRadius: 99,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round(ratio * enter * 100)}%`,
                      borderRadius: 99,
                      backgroundColor: colors.main,
                    }}
                  />
                </div>
                {m.delta && (
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 18,
                      color: '#CBD5E1',
                    }}
                  >
                    {m.delta}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent="mint" />
      </AbsoluteFill>
    );
  }

  if (archetype === 'matrix-grid') {
    const rows = (scene.bulletPoints?.length
      ? scene.bulletPoints
      : [
          `${scene.leftBadge || 'Option A'}|Best for simple static setups`,
          `${scene.rightBadge || 'Option B'}|Best for scalable production pipelines`,
        ]
    ).map((r) => {
      const [left, right] = r.split('|');
      return { left: left?.trim() || r, right: right?.trim() || '' };
    });

    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            width: '100%',
            maxWidth: isPortrait ? 900 : 1420,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {rows.slice(0, 5).map((row, idx) => {
            const enter = computeElementEntrance(frame, fps, easing, 6 + idx * 6, 18);
            return (
              <div
                key={row.left + idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isPortrait ? '1fr' : '0.9fr 1.4fr',
                  gap: 16,
                  padding: '22px 28px',
                  borderRadius: 18,
                  background: '#11151E',
                  border: '1px solid rgba(255,255,255,0.1)',
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 16}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: '"Outfit", sans-serif',
                    fontSize: isPortrait ? 26 : 28,
                    fontWeight: 800,
                    color: idx % 2 === 0 ? '#FF542E' : '#1AE5A0',
                  }}
                >
                  {row.left}
                </div>
                <div
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: isPortrait ? 23 : 24,
                    fontWeight: 600,
                    color: '#E2E8F0',
                    lineHeight: 1.38,
                  }}
                >
                  {row.right || scene.subheadline}
                </div>
              </div>
            );
          })}
        </div>
        <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent={scene.accent} />
      </AbsoluteFill>
    );
  }

  if (archetype === 'quote-verdict') {
    const verdictStatement = payload.callout || scene.codeSnippet || scene.subheadline;
    const verdictPoints = scene.bulletPoints?.filter(Boolean).slice(0, 3) || [];
    const barWidthPct = Math.round((0.35 + 0.65 * Math.min(1, progressRatio / 0.75)) * 100);
    return (
      <AbsoluteFill style={containerStyle}>
        <HeadlineHeader
          scene={scene}
          isPortrait={isPortrait}
          isSquare={isSquare}
          introProgress={intro}
        />
        <div
          style={{
            width: '100%',
            maxWidth: isPortrait ? 900 : 1240,
            borderRadius: 26,
            background: 'linear-gradient(180deg, #131823 0%, #0B0E14 100%)',
            border: '1.5px solid rgba(26, 229, 160, 0.42)',
            boxShadow: '0 28px 72px rgba(0,0,0,0.65)',
            padding: isPortrait ? '30px 28px' : '36px 46px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
            opacity: intro,
            transform: `translateY(${(1 - intro) * 18}px)`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <span
              style={{
                padding: '8px 20px',
                borderRadius: 12,
                backgroundColor: 'rgba(255, 84, 46, 0.14)',
                border: '1px solid rgba(255, 84, 46, 0.48)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: isPortrait ? 20 : 21,
                fontWeight: 700,
                color: '#FF542E',
              }}
            >
              {scene.leftBadge || 'KEY PRINCIPLE'}
            </span>
            <span
              style={{
                padding: '8px 20px',
                borderRadius: 12,
                backgroundColor: 'rgba(26, 229, 160, 0.14)',
                border: '1px solid rgba(26, 229, 160, 0.48)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: isPortrait ? 20 : 21,
                fontWeight: 700,
                color: '#1AE5A0',
              }}
            >
              {scene.rightBadge || 'VERDICT'}
            </span>
          </div>

          {verdictStatement && (
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: isPortrait ? 24 : 28,
                fontWeight: 700,
                color: '#F8FAFC',
                textAlign: 'center',
                lineHeight: 1.38,
                maxWidth: '94%',
              }}
            >
              {verdictStatement}
            </div>
          )}

          {verdictPoints.length > 0 && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {verdictPoints.map((pt, idx) => {
                const ptIn = computeElementEntrance(frame, safeFps, easing, 8 + idx * 6, 16);
                return (
                  <div
                    key={pt + idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 16px',
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: isPortrait ? 21 : 22,
                      fontWeight: 600,
                      color: '#E2E8F0',
                      opacity: ptIn,
                    }}
                  >
                    <span style={{ color: '#1AE5A0', fontWeight: 800 }}>✓</span>
                    <span>{pt}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              width: '78%',
              height: 5,
              borderRadius: 99,
              backgroundColor: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${barWidthPct}%`,
                height: '100%',
                borderRadius: 99,
                background: 'linear-gradient(90deg, #FF542E 0%, #1AE5A0 100%)',
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // Default: 'bullet-spotlight'
  const points = scene.bulletPoints?.length
    ? scene.bulletPoints
    : [scene.subheadline, scene.codeSnippet || scene.rightBadge].filter(Boolean);
  const activePoint = Math.min(
    points.length - 1,
    Math.floor(progressRatio * points.length)
  );

  return (
    <AbsoluteFill style={containerStyle}>
      <HeadlineHeader
        scene={scene}
        isPortrait={isPortrait}
        isSquare={isSquare}
        introProgress={intro}
      />
      <div
        style={{
          width: '100%',
          maxWidth: isPortrait ? 900 : 1340,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {points.slice(0, 5).map((pt, idx) => {
          const enter = computeElementEntrance(frame, safeFps, easing, 6 + idx * 8, 18);
          const isActive = idx === activePoint;
          const accentHex = scene.accent === 'coral' ? '#FF542E' : '#1AE5A0';
          return (
            <div
              key={pt + idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: isPortrait ? '22px 26px' : '24px 32px',
                borderRadius: 20,
                background: isActive ? 'rgba(26, 229, 160, 0.08)' : '#11151E',
                border: isActive
                  ? `1.5px solid ${accentHex}`
                  : '1px solid rgba(255,255,255,0.09)',
                opacity: enter,
                transform: `translateX(${(1 - enter) * -24}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 22,
                  fontWeight: 800,
                  color: isActive ? accentHex : '#64748B',
                  minWidth: 42,
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: isPortrait ? 25 : 27,
                  fontWeight: 700,
                  color: '#F8FAFC',
                  lineHeight: 1.35,
                }}
              >
                {pt}
              </span>
            </div>
          );
        })}
      </div>
      <CalloutBanner text={payload.callout} isPortrait={isPortrait} accent={scene.accent} />
    </AbsoluteFill>
  );
};
