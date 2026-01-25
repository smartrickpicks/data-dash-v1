import { memo, useState, useEffect, ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen, FileText, Plus, Maximize2, Minimize2 } from 'lucide-react';

type WidthPreset = '30/70' | '40/60' | '50/50';

interface SplitViewProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  hasContract: boolean;
  onOpenContractModal: () => void;
}

const STORAGE_KEY = 'contract-panel-settings';

interface PanelSettings {
  widthPreset: WidthPreset;
  isCollapsed: boolean;
}

const defaultSettings: PanelSettings = {
  widthPreset: '30/70',
  isCollapsed: false,
};

function loadSettings(): PanelSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.widthPreset === '60/40' || parsed.widthPreset === '70/30') {
        parsed.widthPreset = '30/70';
      }
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultSettings;
}

function saveSettings(settings: PanelSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

const widthMap: Record<WidthPreset | 'focus', { left: string; right: string }> = {
  '30/70': { left: '30%', right: '70%' },
  '40/60': { left: '40%', right: '60%' },
  '50/50': { left: '50%', right: '50%' },
  'focus': { left: '20%', right: '80%' },
};

const presetLabels: Record<WidthPreset, string> = {
  '30/70': 'Fields 30%',
  '40/60': 'Fields 40%',
  '50/50': 'Equal',
};

export const SplitView = memo(function SplitView({
  leftPanel,
  rightPanel,
  hasContract,
  onOpenContractModal,
}: SplitViewProps) {
  const [settings, setSettings] = useState<PanelSettings>(loadSettings);
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const handlePresetChange = (preset: WidthPreset) => {
    setSettings((prev) => ({ ...prev, widthPreset: preset }));
    setIsFocusMode(false);
  };

  const toggleCollapse = () => {
    setSettings((prev) => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  };

  const toggleFocusMode = () => {
    setIsFocusMode((prev) => !prev);
  };

  const showRightPanel = hasContract && !settings.isCollapsed;
  const activeWidthKey = isFocusMode ? 'focus' : settings.widthPreset;
  const widths = widthMap[activeWidthKey];

  return (
    <div className="flex-1 flex overflow-hidden">
      <div
        className="flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: showRightPanel ? widths.left : '100%' }}
      >
        {leftPanel}
      </div>

      {showRightPanel ? (
        <div
          className="flex flex-col border-l border-slate-200 bg-white overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: widths.right }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-1">
              {(['30/70', '40/60', '50/50'] as WidthPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    settings.widthPreset === preset && !isFocusMode
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title={presetLabels[preset]}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleFocusMode}
                className={`p-1.5 rounded transition-colors ${
                  isFocusMode
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-slate-100 text-slate-500'
                }`}
                title={isFocusMode ? 'Exit focus mode' : 'Focus Contract (20/80)'}
              >
                {isFocusMode ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onOpenContractModal}
                className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                title="Open in modal"
              >
                <FileText className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                title="Collapse panel"
              >
                <PanelRightClose className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {rightPanel}
          </div>
        </div>
      ) : (
        <div className="flex items-center border-l border-slate-200 bg-slate-50 shrink-0">
          {hasContract ? (
            <button
              onClick={toggleCollapse}
              className="p-2 hover:bg-slate-100 transition-colors h-full"
              title="Expand contract panel"
            >
              <PanelRightOpen className="w-5 h-5 text-slate-500" />
            </button>
          ) : (
            <button
              onClick={onOpenContractModal}
              className="flex flex-col items-center justify-center gap-2 px-4 py-6 hover:bg-slate-100 transition-colors h-full"
              title="Add contract"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap [writing-mode:vertical-lr] rotate-180">
                Add Contract
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});
