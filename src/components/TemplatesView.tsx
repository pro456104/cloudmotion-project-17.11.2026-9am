import React, { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { PROJECT_TEMPLATES } from '../video/projectTemplates';

interface TemplatesViewProps {
  onUseTemplate: (templateId: string) => Promise<void>;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onUseTemplate }) => {
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const handleSelect = async (templateId: string) => {
    setCreatingId(templateId);
    try {
      await onUseTemplate(templateId);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-[1220px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-8 max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FAFC] sm:text-3xl">
          Starter Templates &amp; Examples
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          Start from a blank OpenCode canvas or clone an example project into your workspace.
          Every template adapts cleanly across 16:9, 9:16, and 1:1 formats.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {PROJECT_TEMPLATES.map((tpl) => {
          const isLoading = creatingId === tpl.id;
          return (
            <article
              key={tpl.id}
              className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-6"
            >
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-[#94A3B8] tabular-nums">
                  <span className="text-[#1AE5A0]">{tpl.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{tpl.aspectRatio}</span>
                  <span aria-hidden="true">·</span>
                  <span>{tpl.sceneCount} scenes</span>
                  <span aria-hidden="true">·</span>
                  <span>{tpl.estimatedDurationLabel}</span>
                </div>
                <h2 className="mt-2.5 font-display text-lg font-bold text-[#F8FAFC]">
                  {tpl.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                  {tpl.description}
                </p>
              </div>

              <div className="mt-6 border-t border-white/[0.06] pt-4">
                <button
                  type="button"
                  disabled={Boolean(creatingId)}
                  onClick={() => void handleSelect(tpl.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#11151E] px-4 py-2 text-xs font-semibold text-[#F8FAFC] transition-colors hover:border-[#FF542E] hover:bg-[#FF542E] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating project...</span>
                    </>
                  ) : (
                    <>
                      <span>Use Template</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
};
