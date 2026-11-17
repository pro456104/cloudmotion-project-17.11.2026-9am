import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GoogleGenAI } from '@google/genai';
import { UniversalEdgeTTS } from 'edge-tts-universal';
import { tightenNaturalSilencesWav } from '../src/video/audioCleaner';
import {
  clampVoiceSpeedPct,
  formatTextForGeminiTts,
  getEdgeVoiceNameForPersona,
  normalizeLocalVoiceId,
  normalizeSpokenTechnicalTerms,
} from '../src/video/speechPacing';
import { getWavDurationSeconds } from '../src/video/timeline';
import type { MaleVoiceId } from '../src/video/types';

const execFileAsync = promisify(execFile);

let cachedFfmpegAvailable: boolean | null = null;

export async function checkFfmpegAvailability(forceRefresh = false): Promise<boolean> {
  if (cachedFfmpegAvailable !== null && !forceRefresh) {
    return cachedFfmpegAvailable;
  }
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 3000 });
    cachedFfmpegAvailable = true;
    return true;
  } catch {
    cachedFfmpegAvailable = false;
    return false;
  }
}

export function getGenAIClient(apiVersion: string = 'v1beta'): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion,
      headers: {
        'User-Agent': 'cloudmotion-studio-local',
      },
    },
  });
}

function measureWavSec(wavBytes: Uint8Array): number {
  return Number(getWavDurationSeconds(wavBytes).toFixed(2));
}

async function convertMp3BufferTo24kWav(mp3Bytes: Buffer): Promise<Uint8Array> {
  const hasFfmpeg = await checkFfmpegAvailability();
  if (!hasFfmpeg) {
    throw new Error(
      'FFmpeg was not found on your system PATH. Install FFmpeg locally (macOS: brew install ffmpeg, Windows: winget install Gyan.FFmpeg, Linux: sudo apt install ffmpeg) to synthesize neural WAV tracks.'
    );
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-tts-'));
  const inMp3 = path.join(tmpDir, 'in.mp3');
  const outWav = path.join(tmpDir, 'out.wav');
  try {
    fs.writeFileSync(inMp3, mp3Bytes);
    await execFileAsync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      inMp3,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      outWav,
    ]);
    return new Uint8Array(fs.readFileSync(outWav));
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function synthesizeEdgeNeuralWav(
  text: string,
  voiceId: MaleVoiceId,
  speedPct: number
): Promise<{ wavBytes: Uint8Array; edgeVoiceName: string }> {
  const spoken = normalizeSpokenTechnicalTerms(text);
  const edgeVoiceName = getEdgeVoiceNameForPersona(voiceId);
  const rateStr = `${speedPct >= 0 ? '+' : ''}${speedPct}%`;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const tts = new UniversalEdgeTTS(spoken, edgeVoiceName, {
        rate: rateStr,
        pitch: '+0Hz',
      });

      const result = await Promise.race([
        tts.synthesize(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Edge Neural TTS timed out (12s)')), 12000)
        ),
      ]);

      const ab = await result.audio.arrayBuffer();
      const mp3Buf = Buffer.from(ab);
      if (mp3Buf.length < 256) {
        throw new Error('Edge Neural TTS returned empty audio stream.');
      }
      const rawWav = await convertMp3BufferTo24kWav(mp3Buf);
      const { wavBytes } = tightenNaturalSilencesWav(rawWav);
      return { wavBytes, edgeVoiceName };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      // Do not retry if FFmpeg is missing locally
      if (msg.includes('FFmpeg was not found')) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Edge Neural TTS synthesis failed.');
}

async function synthesizeOptionalGeminiFallback(
  text: string,
  voiceId: MaleVoiceId,
  style?: string
): Promise<{ wavBytes: Uint8Array; model: string }> {
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('GEMINI_NOT_CONFIGURED');
  }

  const geminiVoice =
    voiceId === 'Christopher' ? 'Fenrir' : voiceId === 'Brian' ? 'Puck' : 'Charon';
  const primaryModel =
    geminiVoice === 'Charon' ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts';
  const speechStyle =
    style?.trim() ||
    'Warm, conversational American English male tech narrator with natural breathing pauses.';

  const runModel = async (targetModel: string) => {
    const useBreathTags = targetModel === 'gemini-3.8-flash-tts';
    const formattedText = formatTextForGeminiTts(text.trim(), useBreathTags);
    return ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: formattedText,
              speechMetadata: {
                style: speechStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: geminiVoice,
            },
          },
        },
      },
    });
  };

  let activeModel = primaryModel;
  let response;
  try {
    response = await runModel(activeModel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      activeModel =
        activeModel === 'gemini-3.8-flash-tts'
          ? 'gemini-3.8-flash-lite-tts'
          : 'gemini-3.8-flash-tts';
      response = await runModel(activeModel);
    } else {
      throw err;
    }
  }

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const base64Audio = part?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('No audio payload returned by Gemini fallback TTS.');
  }

  const rawWav = new Uint8Array(Buffer.from(base64Audio, 'base64'));
  const { wavBytes } = tightenNaturalSilencesWav(rawWav);
  return { wavBytes, model: `${activeModel} (${geminiVoice})` };
}

export interface VoiceSynthesisOutput {
  wavBytes: Uint8Array;
  durationSec: number;
  voiceName: MaleVoiceId;
  providerUsed: string;
}

export async function synthesizeStudioVoice(options: {
  text: string;
  voiceId?: MaleVoiceId | string;
  speedPct?: number;
  style?: string;
}): Promise<VoiceSynthesisOutput> {
  const cleanText = options.text.trim();
  if (!cleanText) {
    throw new Error('Narration text is required.');
  }

  const selectedVoice = normalizeLocalVoiceId(options.voiceId);
  const speedPct = clampVoiceSpeedPct(options.speedPct);

  try {
    const { wavBytes, edgeVoiceName } = await synthesizeEdgeNeuralWav(
      cleanText,
      selectedVoice,
      speedPct
    );
    return {
      wavBytes,
      durationSec: measureWavSec(wavBytes),
      voiceName: selectedVoice,
      providerUsed: edgeVoiceName,
    };
  } catch (edgeErr) {
    const edgeMsg = edgeErr instanceof Error ? edgeErr.message : 'Edge Neural TTS failed.';
    if (edgeMsg.includes('FFmpeg was not found')) {
      throw edgeErr;
    }
    try {
      const { wavBytes, model } = await synthesizeOptionalGeminiFallback(
        cleanText,
        selectedVoice,
        options.style
      );
      return {
        wavBytes,
        durationSec: measureWavSec(wavBytes),
        voiceName: selectedVoice,
        providerUsed: model,
      };
    } catch (fallbackErr) {
      if (
        fallbackErr instanceof Error &&
        fallbackErr.message === 'GEMINI_NOT_CONFIGURED'
      ) {
        throw new Error(
          `Local neural voice synthesis failed (${edgeMsg}). Ensure internet access for Edge TTS or optionally set GEMINI_API_KEY in .env as backup.`
        );
      }
      throw fallbackErr;
    }
  }
}
