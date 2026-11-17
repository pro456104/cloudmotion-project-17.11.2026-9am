import {
  clampVoiceSpeedPct,
  normalizeSpokenTechnicalTerms,
  pickNaturalUsMaleVoice,
  splitNarrationIntoPhrases,
} from '../video/speechPacing';
import type { MaleVoiceId } from '../video/types';

export interface LiveSpeechController {
  stop: () => void;
}

export interface LiveSpeechOptions {
  narration: string;
  voiceId?: MaleVoiceId;
  voiceSpeedPct?: number;
  startFraction?: number;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Speaks narration phrase-by-phrase using the closest available US English male voice,
 * inserting natural conversational pauses (210-340ms) between clauses and sentences.
 */
export function startNaturalPhraseSpeech(
  options: LiveSpeechOptions
): LiveSpeechController {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { stop: () => {} };
  }

  const synth = window.speechSynthesis;
  const spokenText = normalizeSpokenTechnicalTerms(options.narration);
  const phrases = splitNarrationIntoPhrases(spokenText);

  if (phrases.length === 0) {
    return { stop: () => {} };
  }

  const clampedFraction = Math.max(0, Math.min(0.95, options.startFraction ?? 0));
  const startPhraseIdx =
    clampedFraction > 0.08
      ? Math.min(phrases.length - 1, Math.floor(clampedFraction * phrases.length))
      : 0;

  const speedPct = clampVoiceSpeedPct(options.voiceSpeedPct);
  const computedRate = Math.max(
    0.75,
    Math.min(1.25, (options.rate ?? 0.96) * (1 + speedPct / 100))
  );

  let cancelled = false;
  let timerId: number | null = null;
  let currentUtterance: SpeechSynthesisUtterance | null = null;

  const clearTimer = () => {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  };

  const stop = () => {
    cancelled = true;
    clearTimer();
    currentUtterance = null;
    synth.cancel();
  };

  const speakPhraseAt = (idx: number) => {
    if (cancelled) return;
    if (idx >= phrases.length) {
      currentUtterance = null;
      options.onEnd?.();
      return;
    }

    const phrase = phrases[idx];
    const utterance = new SpeechSynthesisUtterance(phrase.text);
    currentUtterance = utterance;

    const preferredVoice = pickNaturalUsMaleVoice(
      synth.getVoices(),
      options.voiceId || 'Andrew'
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.lang = 'en-US';
    utterance.rate = computedRate;
    utterance.pitch = options.pitch ?? 1.0;

    utterance.onend = () => {
      if (cancelled || currentUtterance !== utterance) return;
      if (idx + 1 >= phrases.length) {
        currentUtterance = null;
        options.onEnd?.();
        return;
      }
      clearTimer();
      timerId = window.setTimeout(() => {
        if (!cancelled) {
          speakPhraseAt(idx + 1);
        }
      }, phrase.pauseAfterMs);
    };

    utterance.onerror = () => {
      if (cancelled || currentUtterance !== utterance) return;
      currentUtterance = null;
      options.onEnd?.();
    };

    synth.speak(utterance);
  };

  synth.cancel();
  options.onStart?.();

  const initialVoices = synth.getVoices();
  if (initialVoices.length === 0) {
    let started = false;
    const kickOff = () => {
      if (started || cancelled) return;
      started = true;
      synth.removeEventListener?.('voiceschanged', kickOff);
      clearTimer();
      speakPhraseAt(startPhraseIdx);
    };
    synth.addEventListener?.('voiceschanged', kickOff);
    timerId = window.setTimeout(kickOff, 120);
  } else {
    speakPhraseAt(startPhraseIdx);
  }

  return { stop };
}
