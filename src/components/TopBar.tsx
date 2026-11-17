import React from 'react';
import { AlertCircle, Check, Download, Loader2 } from 'lucide-react';

export type StudioTab = 'stage' | 'script' | 'templates' | 'bridge';
export type SaveSyncState = 'saved' | 'saving' | 'error';

interface TopBarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onExportVideo: () => void;
  isExporting: boolean;
  canExport?: boolean;
  saveState?: SaveSyncState;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onExportVideo,
  isExporting,
  canExport = true,
  saveState = 'saved',
}) => {
  const tabs: Array<{ id: StudioTab; label: string }> = [
    { id: 'stage', label: 'Studio Stage' },
    { id: 'script', label: 'Script & Voice' },
    { id: 'templates', label: 'Templates' },
    { id: 'bridge', label: 'OpenCode Setup' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#07090D]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-8 gap-y-2.5 px-4 py-3 sm:px-6 md:flex-nowrap md:py-3.5">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#stage"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('stage');
          }}
          className="font-display text-base font-extrabold tracking-tight text-[#F8FAFC] whitespace-nowrap shrink-0 sm:text-lg"
        >
          CloudMotion Studio
        </a>

        {/* Zone 3 (mobile order-2, desktop order-3): Subtle Save State + Primary Action */}
        <div className="flex items-center gap-3 shrink-0 md:order-3">
          <span
            role="status"
            aria-live="polite"
            data-testid="save-status-indicator"
            title={
              saveState === 'saving'
                ? 'Syncing changes to workspace...'
                : saveState === 'error'
                  ? 'Failed to sync changes to workspace'
                  : 'All changes saved to workspace'
            }
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
              saveState === 'saving'
                ? 'text-[#E2E8F0]'
                : saveState === 'error'
                  ? 'text-[#FCA5A5]'
                  : 'text-[#64748B]'
            }`}
          >
            {saveState === 'saving' ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-[#1AE5A0]" />
                <span>Saving...</span>
              </>
            ) : saveState === 'error' ? (
              <>
                <AlertCircle className="h-3 w-3 text-[#FF542E]" />
                <span>Sync failed</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-[#1AE5A0]/80" />
                <span>Saved</span>
              </>
            )}
          </span>

          <button
            type="button"
            onClick={onExportVideo}
            disabled={isExporting || !canExport}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF542E] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#EA4722] disabled:opacity-45 whitespace-nowrap shrink-0 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF542E]"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Rendering MP4...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Export MP4</span>
              </>
            )}
          </button>
        </div>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Workspace sections"
          className="order-3 flex w-full items-center gap-6 overflow-x-auto border-t border-white/[0.06] pt-2 md:order-2 md:w-auto md:border-t-0 md:pt-0"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF542E] ${
                  active
                    ? 'text-[#F8FAFC]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {tab.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute right-0 bottom-0 left-0 h-[2px] bg-[#FF542E] md:-bottom-[15px]"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
