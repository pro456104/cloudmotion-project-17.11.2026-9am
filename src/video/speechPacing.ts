import type { MaleVoiceId } from './types';

export interface SpokenPhrase {
  text: string;
  pauseAfterMs: number;
  breakKind: 'sentence' | 'clause' | 'end';
}

export interface BrowserVoiceCandidate {
  name: string;
  lang: string;
  localService?: boolean;
}

export interface LocalNeuralVoiceOption {
  id: MaleVoiceId;
  name: string;
  edgeVoiceName: string;
  profile: string;
}

export const LOCAL_NEURAL_VOICES: LocalNeuralVoiceOption[] = [
  {
    id: 'Andrew',
    name: 'US Andrew · Natural Neural',
    edgeVoiceName: 'en-US-AndrewMultilingualNeural',
    profile: 'Warm conversational American male host (default)',
  },
  {
    id: 'Brian',
    name: 'US Brian · Clean Explainer',
    edgeVoiceName: 'en-US-BrianMultilingualNeural',
    profile: 'Crisp, upbeat American male developer educator',
  },
  {
    id: 'Christopher',
    name: 'US Christopher · Studio Baritone',
    edgeVoiceName: 'en-US-ChristopherNeural',
    profile: 'Grounded, deep documentary narration voice',
  },
  {
    id: 'Guy',
    name: 'US Guy · Broadcast Host',
    edgeVoiceName: 'en-US-GuyNeural',
    profile: 'Clear steady editorial tone for technical deep dives',
  },
];

export function normalizeLocalVoiceId(raw?: string): MaleVoiceId {
  switch (raw) {
    case 'Brian':
    case 'Puck':
      return 'Brian';
    case 'Christopher':
    case 'Fenrir':
      return 'Christopher';
    case 'Guy':
      return 'Guy';
    case 'Andrew':
    case 'Charon':
    default:
      return 'Andrew';
  }
}

export function getEdgeVoiceNameForPersona(voiceId?: string): string {
  const normalized = normalizeLocalVoiceId(voiceId);
  return (
    LOCAL_NEURAL_VOICES.find((v) => v.id === normalized)?.edgeVoiceName ||
    'en-US-AndrewMultilingualNeural'
  );
}

export function clampVoiceSpeedPct(pct?: number): number {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 0;
  return Math.max(-20, Math.min(20, Math.round(pct)));
}

const PROTECTED_ABBR_PATTERNS: Array<[RegExp, string]> = [
  [/\be\.g\./gi, 'e__DOT__g__DOT__'],
  [/\bi\.e\./gi, 'i__DOT__e__DOT__'],
  [/\betc\./gi, 'etc__DOT__'],
  [/\bvs\./gi, 'vs__DOT__'],
  [/\bDr\./g, 'Dr__DOT__'],
  [/\bMr\./g, 'Mr__DOT__'],
];

const FEMALE_VOICE_HINTS =
  /\b(zira|hazel|susan|aria|jenny|samantha|victoria|karen|moira|fiona|tessa|serena|sara|sarah|emma|olivia|michelle|sonia|libby|ava|allison|kate|veena|lekha|female|woman|girl)\b/i;

const NATURAL_US_MALE_HINTS =
  /\b(andrew|brian|christopher|guy|davis|steffan|eric|roger|tony|jason|brandon|matthew|alex|daniel|mark|david|aaron|nathan|reed|ryan|thomas|oliver|william|james|benjamin|caleb|liam|noah|male)\b/i;

/**
 * Normalizes technical tokens strictly for spoken TTS output (never mutating on-screen captions)
 * so both local Edge TTS and browser SpeechSynthesis pronounce abbreviations naturally.
 */
export function normalizeSpokenTechnicalTerms(text: string): string {
  return text
    .replace(/\bI\/O\b/g, 'I O')
    .replace(/\bgRPC\b/g, 'g R P C')
    .replace(/\bJSON-RPC\b/gi, 'JSON R P C')
    .replace(/\bURIs\b/g, 'U R Is')
    .replace(/\bURI\b/g, 'U R I')
    .replace(/\bIDEs\b/g, 'I D Es')
    .replace(/\bIDE\b/g, 'I D E')
    .replace(/\bCLIs\b/g, 'C L Is')
    .replace(/\bCLI\b/g, 'C L I')
    .replace(/\bAPIs\b/g, 'A P Is')
    .replace(/\bAPI\b/g, 'A P I')
    .replace(/\bN×M\b/g, 'N times M')
    .replace(/\bN\+M\b/g, 'N plus M')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a narration script into conversational phrases with explicit inter-phrase breath durations,
 * preventing TTS or browser speech synthesis from dumping an entire paragraph in one rushed breath.
 * Decimals (e.g. "2.0", "1.1") and abbreviations are kept intact.
 */
export function splitNarrationIntoPhrases(rawText: string): SpokenPhrase[] {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  let masked = cleaned;
  for (const [pattern, replacement] of PROTECTED_ABBR_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  masked = masked.replace(/(\d)\.(\d)/g, '$1__DEC__$2');

  const unmask = (value: string): string =>
    value
      .replace(/__DEC__/g, '.')
      .replace(/e__DOT__g__DOT__/gi, 'e.g.')
      .replace(/i__DOT__e__DOT__/gi, 'i.e.')
      .replace(/etc__DOT__/gi, 'etc.')
      .replace(/vs__DOT__/gi, 'vs.')
      .replace(/Dr__DOT__/g, 'Dr.')
      .replace(/Mr__DOT__/g, 'Mr.')
      .trim();

  const sentenceParts = masked
    .split(/(?<=[.!?]["”']?)\s+(?=[A-Z0-9"“'(])/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const phrases: SpokenPhrase[] = [];

  for (let sIdx = 0; sIdx < sentenceParts.length; sIdx++) {
    const sentence = sentenceParts[sIdx];
    const isLastSentence = sIdx === sentenceParts.length - 1;

    const clauses = sentence
      .split(/\s*(?:—|–|;)\s+/g)
      .map((c) => c.trim())
      .filter(Boolean);

    for (let cIdx = 0; cIdx < clauses.length; cIdx++) {
      const clauseText = unmask(clauses[cIdx]);
      if (!clauseText) continue;

      const isLastClauseInSentence = cIdx === clauses.length - 1;
      const isFinalPhrase = isLastSentence && isLastClauseInSentence;

      phrases.push({
        text: clauseText,
        breakKind: isFinalPhrase
          ? 'end'
          : isLastClauseInSentence
            ? 'sentence'
            : 'clause',
        pauseAfterMs: isFinalPhrase ? 0 : isLastClauseInSentence ? 340 : 210,
      });
    }
  }

  return phrases;
}

export function formatTextForGeminiTts(
  narration: string,
  useBreathTags: boolean
): string {
  const spoken = normalizeSpokenTechnicalTerms(narration);
  const phrases = splitNarrationIntoPhrases(spoken);
  if (phrases.length === 0) return narration.trim();

  return phrases
    .map((phrase, idx) => {
      if (idx === phrases.length - 1) return phrase.text;
      if (phrase.breakKind === 'clause') {
        return `${phrase.text},`;
      }
      return useBreathTags ? `${phrase.text} <breath>` : phrase.text;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Picks the closest browser voice matching the selected US English male persona.
 */
export function pickNaturalUsMaleVoice<T extends BrowserVoiceCandidate>(
  voices: T[],
  preferredPersona: MaleVoiceId = 'Andrew'
): T | undefined {
  if (!voices || voices.length === 0) return undefined;

  const personaRegex = new RegExp(`\\b${preferredPersona.toLowerCase()}\\b`, 'i');
  let bestVoice: T | undefined;
  let bestScore = -Infinity;

  for (const voice of voices) {
    const name = voice.name || '';
    const lang = (voice.lang || '').toLowerCase();
    const isUs = lang === 'en-us' || lang.startsWith('en-us-');
    const isEn = isUs || lang.startsWith('en');
    const isNaturalOrOnline = /\b(natural|online|neural|multilingual)\b/i.test(name);
    const isFemale = FEMALE_VOICE_HINTS.test(name);

    let score = 0;

    if (isUs) score += 60;
    else if (isEn) score += 20;
    else score -= 120;

    if (personaRegex.test(name)) {
      score += 160;
    } else if (/\bandrew\b/i.test(name)) {
      score += 120;
    } else if (NATURAL_US_MALE_HINTS.test(name)) {
      score += 85;
    }

    if (isNaturalOrOnline) score += 30;
    if (voice.localService === false && isEn) score += 10;

    if (isFemale) score -= 110;
    if (/^google us english$/i.test(name.trim())) score -= 25;

    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return bestVoice;
}
