import React, { useRef, useState } from 'react';
import { Film, Layers, Loader2, Upload } from 'lucide-react';
import {
  AMBIENT_BG_PRESETS,
  clampAmbientOpacity,
} from '../video/ambientPresets';
import type { AmbientBackgroundConfig, AmbientBgPreset } from '../video/types';

interface AmbientBgPickerProps {
  value: AmbientBackgroundConfig;
  onChange: (next: AmbientBackgroundConfig) => void;
  onApplyToAll: (config: AmbientBackgroundConfig) => void;
}

const PresetPreviewSwatch: React.FC<{ preset: AmbientBgPreset }> = ({ preset }) => {
  if (preset === 'none') {
    return (
      <div className="h-10 w-full rounded-lg border border-white/10 bg-[#07090D]" />
    );
  }
  if (preset === 'fiber-streams') {
    return (
      <svg
        viewBox="0 0 120 40"
        className="h-10 w-full rounded-lg border border-white/10 bg-[#07090D]"
      >
        <path
          d="M0 28 C 35 8, 75 34, 120 12"
          stroke="#FF542E"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M0 14 C 45 32, 80 8, 120 26"
          stroke="#1AE5A0"
          strokeWidth="2"
          fill="none"
          strokeOpacity="0.8"
        />
      </svg>
    );
  }
  if (preset === 'neural-mesh') {
    return (
      <svg
        viewBox="0 0 120 40"
        className="h-10 w-full rounded-lg border border-white/10 bg-[#07090D]"
      >
        <line x1="18" y1="12" x2="58" y2="26" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
        <line x1="58" y1="26" x2="102" y2="14" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
        <circle cx="18" cy="12" r="3" fill="#FF542E" />
        <circle cx="58" cy="26" r="3" fill="#1AE5A0" />
        <circle cx="102" cy="14" r="3" fill="#FF542E" />
      </svg>
    );
  }
  if (preset === 'circuit-pulses') {
    return (
      <svg
        viewBox="0 0 120 40"
        className="h-10 w-full rounded-lg border border-white/10 bg-[#07090D]"
      >
        <path d="M0 14 L 46 14 L 58 24 L 120 24" stroke="#1AE5A0" strokeWidth="2" fill="none" />
        <path d="M0 28 L 72 28 L 84 12 L 120 12" stroke="#FF542E" strokeWidth="1.6" fill="none" />
      </svg>
    );
  }
  if (preset === 'volumetric-wave') {
    return (
      <svg
        viewBox="0 0 120 40"
        className="h-10 w-full rounded-lg border border-white/10 bg-[#07090D]"
      >
        <path
          d="M0 22 Q 40 6, 80 24 T 120 18"
          stroke="#FF542E"
          strokeOpacity="0.6"
          strokeWidth="6"
          fill="none"
        />
        <path
          d="M0 28 Q 40 16, 80 30 T 120 22"
          stroke="#1AE5A0"
          strokeOpacity="0.5"
          strokeWidth="5"
          fill="none"
        />
      </svg>
    );
  }
  return (
    <div className="flex h-10 w-full items-center overflow-hidden rounded-lg border border-white/10 bg-[#07090D] px-2 font-mono text-[9px] text-[#1AE5A0]/70">
      {'{"method":"tools/list"} · 200 OK'}
    </div>
  );
};

export const AmbientBgPicker: React.FC<AmbientBgPickerProps> = ({
  value,
  onChange,
  onApplyToAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/backgrounds', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'video/mp4',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to save background video to workspace.');
      }
      onChange({
        preset: 'custom-video',
        opacity: clampAmbientOpacity(value.opacity || 0.34),
        customVideoUrl: data.url,
        customVideoName: data.name || data.fileName || file.name,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Background video upload failed.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-display text-sm font-bold text-[#F8FAFC]">
            <Film className="h-4 w-4 text-[#FF542E]" />
            <span>Ambient Video Background Overlay</span>
          </h4>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            Layer subtle ambient motion presets or disk-saved MP4 loops behind this scene with automatic readability scrims.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={(e) => void handleVideoUpload(e)}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#11151E] px-3 py-1.5 text-xs font-medium text-[#E2E8F0] transition-colors hover:border-white/30 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1AE5A0]" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-[#1AE5A0]" />
            )}
            <span>{isUploading ? 'Saving MP4...' : 'Upload MP4 / WebM'}</span>
          </button>
          <button
            type="button"
            onClick={() => onApplyToAll(value)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF542E]/40 bg-[#FF542E]/10 px-3 py-1.5 text-xs font-semibold text-[#FF542E] transition-colors hover:bg-[#FF542E]/20 whitespace-nowrap shrink-0"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Apply to All Scenes</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="mt-3 rounded-lg border border-[#FF542E]/40 bg-[#180E10] px-3 py-2 text-xs text-[#FCA5A5]">
          {uploadError}
        </div>
      )}

      {/* Preset Grid */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {AMBIENT_BG_PRESETS.map((preset) => {
          const active = value.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  preset: preset.id,
                  opacity:
                    preset.id === 'none'
                      ? value.opacity
                      : value.preset === 'none'
                        ? preset.recommendedOpacity
                        : value.opacity,
                })
              }
              className={`rounded-xl border p-2.5 text-left transition-colors ${
                active
                  ? 'border-[#1AE5A0]/65 bg-[#11191A]'
                  : 'border-white/[0.07] bg-[#11151E] hover:border-white/20'
              }`}
            >
              <PresetPreviewSwatch preset={preset.id} />
              <div className="mt-2 text-xs font-semibold text-[#F8FAFC]">
                {preset.label}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#94A3B8]">
                {preset.description}
              </div>
            </button>
          );
        })}
      </div>

      {value.preset === 'custom-video' && value.customVideoName && (
        <div className="mt-3 rounded-lg border border-[#1AE5A0]/30 bg-[#0D1614] px-3 py-2 text-xs text-[#1AE5A0]">
          Active custom background video: {value.customVideoName}
        </div>
      )}

      {/* Overlay Opacity Control */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <label
          htmlFor="ambient-opacity-slider"
          className="text-xs font-medium text-[#94A3B8]"
        >
          Overlay Intensity
        </label>
        <div className="flex flex-1 items-center gap-3 max-w-xs">
          <input
            id="ambient-opacity-slider"
            type="range"
            min={5}
            max={65}
            step={1}
            disabled={value.preset === 'none'}
            value={Math.round(value.opacity * 100)}
            onChange={(e) =>
              onChange({
                ...value,
                opacity: clampAmbientOpacity(Number(e.target.value) / 100),
              })
            }
            className="w-full accent-[#FF542E] disabled:opacity-40"
          />
          <span className="w-10 text-right font-mono text-xs text-[#E2E8F0] tabular-nums">
            {value.preset === 'none' ? '0%' : `${Math.round(value.opacity * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
};
