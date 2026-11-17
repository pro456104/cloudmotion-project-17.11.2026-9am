import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAlignedMasterWav,
  buildCaptionCues,
  computeSceneWindows,
  concatenateWavBuffers,
  formatTimecode,
  getSceneAtFrame,
  getTotalFrames,
  getWavDurationSeconds,
} from './timeline';
import { DEFAULT_PROJECT } from './defaultProject';
import { computeHookMotionState } from './hookMotion';

function makeMockWav(pcmByteCount: number, byteRate: number = 48000): Uint8Array {
  const buf = new Uint8Array(44 + pcmByteCount);
  const view = new DataView(buf.buffer);
  // "RIFF"
  buf.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + pcmByteCount, true);
  // "WAVE"
  buf.set([0x57, 0x41, 0x56, 0x45], 8);
  // "fmt "
  buf.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 24000, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // "data"
  buf.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, pcmByteCount, true);
  return buf;
}

test('computeSceneWindows produces contiguous frame boundaries', () => {
  const windows = computeSceneWindows(DEFAULT_PROJECT.scenes, 30);
  assert.equal(windows.length, 11);
  assert.equal(windows[0].startFrame, 0);
  for (let i = 1; i < windows.length; i++) {
    assert.equal(windows[i].startFrame, windows[i - 1].endFrame);
  }
  const total = getTotalFrames(DEFAULT_PROJECT.scenes, 30);
  const expectedFrames = DEFAULT_PROJECT.scenes.reduce(
    (sum, sc) => sum + Math.max(1, Math.round(sc.durationSec * 30)),
    0
  );
  assert.equal(total, windows[windows.length - 1].endFrame);
  assert.equal(total, expectedFrames);
  assert.equal(total, 6231);
  assert.equal(formatTimecode(total, 30), '03:27');
});

test('getSceneAtFrame resolves exact scene for boundary and mid frames', () => {
  const windows = computeSceneWindows(DEFAULT_PROJECT.scenes, 30);
  const first = getSceneAtFrame(windows, 0);
  assert.equal(first?.scene.id, windows[0].scene.id);

  const secondStart = windows[1].startFrame;
  const second = getSceneAtFrame(windows, secondStart);
  assert.equal(second?.scene.id, windows[1].scene.id);

  const overflow = getSceneAtFrame(windows, 999999);
  assert.equal(overflow?.scene.id, windows[windows.length - 1].scene.id);
});

test('buildCaptionCues spans full duration without gaps', () => {
  const cues = buildCaptionCues(
    'APIs remain the deterministic execution engine while MCP acts as the universal conversational bridge.',
    300,
    6
  );
  assert.ok(cues.length >= 2);
  assert.equal(cues[0].startFrame, 0);
  assert.equal(cues[cues.length - 1].endFrame, 300);
});

test('formatTimecode formats mm:ss accurately', () => {
  assert.equal(formatTimecode(0, 30), '00:00');
  assert.equal(formatTimecode(90, 30), '00:03');
  assert.equal(formatTimecode(2340, 30), '01:18');
});

import {
  applyAmbientBgToScenes,
  clampAmbientOpacity,
  clampTransitionBlur,
  clampTransitionDuration,
  computeBackgroundTransitionState,
  resolveProjectBgTransition,
  resolveSceneAmbientBg,
} from './ambientPresets';

test('WAV duration and concatenation preserve RIFF header sizes', () => {
  const clipA = makeMockWav(48000); // 1.0s at 48KB/s
  const clipB = makeMockWav(24000); // 0.5s at 48KB/s
  assert.equal(getWavDurationSeconds(clipA), 1.0);

  const merged = concatenateWavBuffers([clipA, clipB], 0.5, 24000);
  // Expected PCM = 48000 + 24000 (0.5s gap) + 24000 = 96000 bytes
  assert.equal(merged.length, 44 + 96000);
  const view = new DataView(merged.buffer);
  assert.equal(view.getUint32(4, true), 36 + 96000);
  assert.equal(view.getUint32(40, true), 96000);
});

test('ambient background helpers clamp opacity and apply across all scenes', () => {
  assert.equal(clampAmbientOpacity(-0.4), 0.05);
  assert.equal(clampAmbientOpacity(0.95), 0.65);
  assert.equal(clampAmbientOpacity(0.34), 0.34);

  const fallback = resolveSceneAmbientBg(DEFAULT_PROJECT.scenes[0]);
  assert.equal(fallback.preset, 'fiber-streams');

  const updated = applyAmbientBgToScenes(DEFAULT_PROJECT.scenes, {
    preset: 'neural-mesh',
    opacity: 0.42,
  });
  assert.equal(updated.length, 11);
  for (const sc of updated) {
    assert.equal(sc.ambientBg?.preset, 'neural-mesh');
    assert.equal(sc.ambientBg?.opacity, 0.42);
  }
});

test('buildCaptionCues aligns intermediate cues to spokenDurationFrames when shorter than scene', () => {
  const cues = buildCaptionCues(
    'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen',
    600, // 20s scene
    4,
    300  // 10s spoken audio
  );
  assert.equal(cues.length, 4);
  assert.equal(cues[0].startFrame, 0);
  // Second-to-last cue ends inside the spoken window (leadIn 4 + 300 = 304), not spread across 600 frames
  assert.ok(cues[cues.length - 2].endFrame <= 304);
  assert.equal(cues[cues.length - 1].endFrame, 600);
});

test('buildAlignedMasterWav preserves exact scene timeline duration including silent slots', () => {
  const clip1 = makeMockWav(48000); // 1.0s
  const clip3 = makeMockWav(48000); // 1.0s
  // 3 slots: 3s + 2s (silent) + 3s = 8s total = 384000 PCM bytes at 48000 B/s
  const aligned = buildAlignedMasterWav([
    { wavBytes: clip1, targetDurationSec: 3, leadInSec: 0.1 },
    { targetDurationSec: 2 },
    { wavBytes: clip3, targetDurationSec: 3, leadInSec: 0.1 },
  ]);
  assert.equal(aligned.length, 44 + 384000);
  const view = new DataView(aligned.buffer);
  assert.equal(view.getUint32(4, true), 36 + 384000);
  assert.equal(view.getUint32(40, true), 384000);
});

test('background transition helpers clamp values and compute crossfade and motion-blur curves', () => {
  assert.equal(clampTransitionDuration(0.05), 0.2);
  assert.equal(clampTransitionDuration(5.5), 2.0);
  assert.equal(clampTransitionDuration(1.24), 1.2);

  assert.equal(clampTransitionBlur(1), 4);
  assert.equal(clampTransitionBlur(99), 28);
  assert.equal(clampTransitionBlur(16), 16);

  const fallback = resolveProjectBgTransition();
  assert.equal(fallback.mode, 'crossfade');
  assert.equal(fallback.durationSec, 0.8);

  // Instant cut or first scene returns full incoming with 0 outgoing
  const noTrans = computeBackgroundTransitionState(
    5,
    300,
    30,
    { mode: 'none', durationSec: 1.0, blurPx: 14 },
    true
  );
  assert.equal(noTrans.isTransitioning, false);
  assert.equal(noTrans.incomingOpacity, 1);
  assert.equal(noTrans.outgoingOpacity, 0);

  // Midpoint of 1.0s (30 frames @ 30fps) crossfade -> frame 15 gives 50/50 dissolve with 0 blur
  const midFade = computeBackgroundTransitionState(
    15,
    300,
    30,
    { mode: 'crossfade', durationSec: 1.0, blurPx: 16 },
    true
  );
  assert.equal(midFade.isTransitioning, true);
  assert.equal(midFade.incomingOpacity, 0.5);
  assert.equal(midFade.outgoingOpacity, 0.5);
  assert.equal(midFade.incomingBlurPx, 0);

  // Midpoint of 1.0s motion-blur -> symmetrical blur & optical scale > 1
  const midBlur = computeBackgroundTransitionState(
    15,
    300,
    30,
    { mode: 'motion-blur', durationSec: 1.0, blurPx: 16 },
    true
  );
  assert.equal(midBlur.isTransitioning, true);
  assert.equal(midBlur.incomingBlurPx, 8);
  assert.equal(midBlur.outgoingBlurPx, 8);
  assert.ok(midBlur.incomingScale > 1);
  assert.ok(midBlur.outgoingScale > 1);

  // After transition finishes -> clean settled state
  const settled = computeBackgroundTransitionState(
    30,
    300,
    30,
    { mode: 'motion-blur', durationSec: 1.0, blurPx: 16 },
    true
  );
  assert.equal(settled.isTransitioning, false);
  assert.equal(settled.incomingOpacity, 1);
  assert.equal(settled.outgoingOpacity, 0);
  assert.equal(settled.incomingBlurPx, 0);
});

test('Scene 1 hook motion progresses smoothly through myth, bridge, and 2-layer stack beats', () => {
  const fps = 30;
  const total = 22 * fps; // 660 frames matching opening narration

  const f0 = computeHookMotionState(0, total, fps);
  assert.equal(f0.beat2Weight, 0);
  assert.equal(f0.beat3Weight, 0);
  assert.equal(f0.mythStrike, 0);
  assert.ok(f0.mcpStrokeDraw >= 0.5 && f0.ruleProgress > 0.2);

  // Beat 1 end (~36%): myth strikethrough complete right as narrator finishes Beat 1
  const beat1End = computeHookMotionState(Math.round(total * 0.36), total, fps);
  assert.ok(beat1End.mythStrike > 0.9);
  assert.equal(beat1End.beat3Weight, 0);

  // Beat 2 peak (~50%): live bidirectional bridge active
  const beat2Peak = computeHookMotionState(Math.round(total * 0.50), total, fps);
  assert.ok(beat2Peak.beat2Weight > 0.9);
  assert.equal(beat2Peak.beat3Weight, 0);

  // Beat 3 peak (~85%): 2-layer stack synthesis active
  const beat3Peak = computeHookMotionState(Math.round(total * 0.85), total, fps);
  assert.ok(beat3Peak.beat3Weight > 0.9);
  assert.ok(beat3Peak.beat2Weight < 0.1);
  assert.ok(beat3Peak.ruleProgress > 0.9);
});

import {
  clampSceneTransitionDuration,
  computeSceneTransitionFrames,
  computeSceneTransitionStyles,
  resolveProjectSceneTransition,
} from './sceneTransitions';

test('scene transition helpers clamp durations and compute symmetric outgoing/incoming shot transforms', () => {
  assert.equal(clampSceneTransitionDuration(0.05), 0.2);
  assert.equal(clampSceneTransitionDuration(3.2), 1.5);
  assert.equal(clampSceneTransitionDuration(0.64), 0.6);

  const fallback = resolveProjectSceneTransition();
  assert.equal(fallback.mode, 'fade-blur');
  assert.equal(fallback.durationSec, 0.6);

  assert.equal(computeSceneTransitionFrames({ mode: 'none', durationSec: 0.6 }, 30, 300), 0);
  assert.equal(computeSceneTransitionFrames({ mode: 'fade-blur', durationSec: 0.6 }, 30, 300), 18);

  // Midpoint of Optical Dissolve (frame 9 / 18) -> 50% opacity blend with optical depth scale
  const midFade = computeSceneTransitionStyles(9, 18, 'fade-blur', true);
  assert.equal(midFade.isTransitioning, true);
  assert.equal(midFade.incoming.opacity, 0.5);
  assert.equal(midFade.outgoing.opacity, 0.5);
  assert.ok(midFade.incoming.blurPx > 0 && midFade.outgoing.blurPx > 0);

  // Midpoint of Editorial Slide -> outgoing at -0.5x, incoming at +0.5x, glowing seam at +0.5x
  const midSlide = computeSceneTransitionStyles(9, 18, 'slide-left', true);
  assert.equal(midSlide.isTransitioning, true);
  assert.equal(midSlide.incoming.translateXFraction, 0.5);
  assert.equal(midSlide.outgoing.translateXFraction, -0.5);
  assert.equal(midSlide.seam.xFraction, 0.5);
  assert.ok(midSlide.seam.opacity > 0.9);

  // Midpoint of Studio Wipe -> incoming reveals left 50%
  const midWipe = computeSceneTransitionStyles(9, 18, 'wipe-reveal', true);
  assert.equal(midWipe.isTransitioning, true);
  assert.equal(midWipe.incoming.wipeRevealFraction, 0.5);
  assert.ok(midWipe.seam.opacity > 0.9);

  // Settled past transition boundary
  const settled = computeSceneTransitionStyles(18, 18, 'slide-left', true);
  assert.equal(settled.isTransitioning, false);
  assert.equal(settled.incoming.opacity, 1);
  assert.equal(settled.incoming.translateXFraction, 0);
  assert.equal(settled.outgoing.opacity, 0);
});

test('DEFAULT_PROJECT narration pacing prevents mid-sentence cutoffs and uses local Andrew default', () => {
  for (const sc of DEFAULT_PROJECT.scenes) {
    const words = sc.narration.trim().split(/\s+/).length;
    const wordsPerSec = words / sc.durationSec;
    assert.ok(
      wordsPerSec <= 2.9,
      `Scene ${sc.index} (${sc.chapterTitle}) has ${words} words in ${sc.durationSec}s (${wordsPerSec.toFixed(2)} w/s)`
    );
  }
  const scene1 = DEFAULT_PROJECT.scenes[0];
  assert.ok(scene1.narration.length > 40);

  const scene2 = DEFAULT_PROJECT.scenes[1];
  assert.ok(scene2.codeSnippet?.includes('N + M = 6'));
  assert.equal(DEFAULT_PROJECT.voiceId, 'Andrew');
});

import {
  clampVoiceSpeedPct,
  formatTextForGeminiTts,
  getEdgeVoiceNameForPersona,
  normalizeLocalVoiceId,
  normalizeSpokenTechnicalTerms,
  pickNaturalUsMaleVoice,
  splitNarrationIntoPhrases,
} from './speechPacing';

test('speechPacing splits paragraphs into paused phrases without breaking decimal versions', () => {
  const sample =
    'Under the hood, every message uses JSON-RPC 2.0. When a session opens, it negotiates capabilities — and runs via Standard I/O.';
  const normalized = normalizeSpokenTechnicalTerms(sample);
  assert.ok(normalized.includes('JSON R P C 2.0'));
  assert.ok(normalized.includes('Standard I O'));

  const phrases = splitNarrationIntoPhrases(normalized);
  assert.equal(phrases.length, 3);
  assert.ok(phrases[0].text.endsWith('2.0.'));
  assert.equal(phrases[0].breakKind, 'sentence');
  assert.equal(phrases[0].pauseAfterMs, 340);

  assert.equal(phrases[1].breakKind, 'clause');
  assert.equal(phrases[1].pauseAfterMs, 210);

  assert.equal(phrases[2].breakKind, 'end');
  assert.equal(phrases[2].pauseAfterMs, 0);
});

test('formatTextForGeminiTts inserts <breath> only on expressive model', () => {
  const input = 'First sentence here. Second sentence follows.';
  const expressive = formatTextForGeminiTts(input, true);
  const lite = formatTextForGeminiTts(input, false);

  assert.ok(expressive.includes('<breath>'));
  assert.ok(!lite.includes('<breath>'));
});

test('voice persona normalization and speed clamping map legacy IDs and enforce -20..20 range', () => {
  assert.equal(normalizeLocalVoiceId('Charon'), 'Andrew');
  assert.equal(normalizeLocalVoiceId('Fenrir'), 'Christopher');
  assert.equal(normalizeLocalVoiceId('Puck'), 'Brian');
  assert.equal(normalizeLocalVoiceId('Guy'), 'Guy');

  assert.equal(getEdgeVoiceNameForPersona('Brian'), 'en-US-BrianMultilingualNeural');
  assert.equal(getEdgeVoiceNameForPersona('Christopher'), 'en-US-ChristopherNeural');
  assert.equal(getEdgeVoiceNameForPersona('Guy'), 'en-US-GuyNeural');
  assert.equal(getEdgeVoiceNameForPersona('unknown'), 'en-US-AndrewMultilingualNeural');

  assert.equal(clampVoiceSpeedPct(-45), -20);
  assert.equal(clampVoiceSpeedPct(38), 20);
  assert.equal(clampVoiceSpeedPct(6.4), 6);
  assert.equal(clampVoiceSpeedPct(undefined), 0);
});

test('pickNaturalUsMaleVoice prioritizes selected US English persona over generic and female voices', () => {
  const catalog = [
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
    { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
    { name: 'Microsoft Brian Online (Natural) - English (United States)', lang: 'en-US' },
    { name: 'Microsoft Christopher Online (Natural) - English (United States)', lang: 'en-US' },
    { name: 'Microsoft Andrew Online (Natural) - English (United States)', lang: 'en-US' },
  ];

  assert.equal(
    pickNaturalUsMaleVoice(catalog, 'Andrew')?.name,
    'Microsoft Andrew Online (Natural) - English (United States)'
  );
  assert.equal(
    pickNaturalUsMaleVoice(catalog, 'Brian')?.name,
    'Microsoft Brian Online (Natural) - English (United States)'
  );
  assert.equal(
    pickNaturalUsMaleVoice(catalog, 'Christopher')?.name,
    'Microsoft Christopher Online (Natural) - English (United States)'
  );
  assert.equal(
    pickNaturalUsMaleVoice(catalog, 'Guy')?.name,
    'Microsoft Guy Online (Natural) - English (United States)'
  );
});

import { tightenNaturalSilencesWav } from './audioCleaner';

test('tightenNaturalSilencesWav compresses long leading/internal/trailing dead air naturally', () => {
  const sr = 24000;
  // Build 2.4s mono 16-bit WAV: 0.4s silence + 0.5s tone + 0.8s silence + 0.4s tone + 0.3s silence
  const totalSamples = Math.round(sr * 2.4);
  const wav = makeMockWav(totalSamples * 2);
  const view = new DataView(wav.buffer);

  const writeTone = (startSec: number, durSec: number) => {
    const startIdx = Math.round(startSec * sr);
    const endIdx = Math.round((startSec + durSec) * sr);
    for (let i = startIdx; i < endIdx; i++) {
      const sample = Math.round(Math.sin((i / sr) * Math.PI * 2 * 440) * 8000);
      view.setInt16(44 + i * 2, sample, true);
    }
  };
  writeTone(0.4, 0.5);
  writeTone(1.7, 0.4);

  const { wavBytes, stats } = tightenNaturalSilencesWav(wav);
  assert.equal(stats.compressedPauses, 1);
  assert.ok(stats.removedSec >= 0.8, `Expected >= 0.8s removed, got ${stats.removedSec}`);
  // Should preserve 0.9s active tone + ~0.25s internal pause + ~0.12s lead/tail (~1.27s total)
  const cleanedDur = getWavDurationSeconds(wavBytes);
  assert.ok(cleanedDur >= 1.1 && cleanedDur <= 1.5, `Cleaned duration ${cleanedDur}s out of expected natural range`);
});

import { DEFAULT_ANIMATION_EASING, computeElementEntrance } from './easingPresets';

test('computeElementEntrance produces identical time-based progress across 30fps and 60fps', () => {
  const presets = ['spring', 'cubic-bezier', 'ease-in-out', 'ease-out'] as const;
  for (const preset of presets) {
    const cfg = { ...DEFAULT_ANIMATION_EASING, preset };
    for (const f30 of [0, 6, 12, 24, 36]) {
      const f60 = f30 * 2;
      const p30 = computeElementEntrance(f30, 30, cfg, 6, 18);
      const p60 = computeElementEntrance(f60, 60, cfg, 6, 18);
      assert.ok(
        Math.abs(p30 - p60) < 1e-6,
        `${preset} frame ${f30}@30 vs ${f60}@60 mismatch: ${p30} vs ${p60}`
      );
    }
  }
});

import {
  clampSceneDurationSec,
  clearSceneAudio,
  computeVoiceFittedDurationSec,
  createSilentWavBuffer,
  MAX_SCENE_DURATION_SEC,
  MIN_SCENE_DURATION_SEC,
} from './timeline';
import { generateWhooshPcmSamples } from '../utils/sfxEngine';

test('timeline helpers clamp durations, fit voiceover duration, clear audio fields, and create silent WAVs', () => {
  assert.equal(clampSceneDurationSec(0.5), MIN_SCENE_DURATION_SEC);
  assert.equal(clampSceneDurationSec(120), MAX_SCENE_DURATION_SEC);
  assert.equal(clampSceneDurationSec(Number.NaN, 12), 12);

  assert.equal(computeVoiceFittedDurationSec(1.2), 4);
  assert.equal(computeVoiceFittedDurationSec(9.5), 9.75);
  assert.equal(computeVoiceFittedDurationSec(90), MAX_SCENE_DURATION_SEC);

  const cleared = clearSceneAudio({
    ...DEFAULT_PROJECT.scenes[0],
    audioDataUrl: '/audio/test/sc-1.wav',
    audioDurationSec: 12.4,
    audioProvider: 'edge-neural',
  });
  assert.equal(cleared.audioDataUrl, undefined);
  assert.equal(cleared.audioDurationSec, undefined);
  assert.equal(cleared.audioProvider, undefined);

  const silent = createSilentWavBuffer(0.5, 24000);
  assert.equal(silent.length, 44 + 24000);
  assert.ok(Math.abs(getWavDurationSeconds(silent) - 0.5) < 1e-6);
});

test('generateWhooshPcmSamples produces bounded, deterministic mono PCM samples', () => {
  const a = generateWhooshPcmSamples(24000, 0.28, 0.09);
  const b = generateWhooshPcmSamples(24000, 0.28, 0.09);
  assert.equal(a.length, Math.floor(24000 * 0.28));
  assert.deepEqual(Array.from(a), Array.from(b));
  let peak = 0;
  for (let i = 0; i < a.length; i++) {
    peak = Math.max(peak, Math.abs(a[i]));
  }
  assert.ok(peak > 0.005 && peak <= 0.09);
});
