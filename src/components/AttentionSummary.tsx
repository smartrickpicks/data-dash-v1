import { MessageSquare, AlertTriangle, Layers, AlertCircle } from 'lucide-react';
import { FieldViewMode } from '../types';

interface AttentionSummaryProps {
  rfiCount: number;
  attentionCount: number;
  anomalyCount: number;
  viewMode: FieldViewMode;
  onViewModeChange: (mode: FieldViewMode) => void;
}

export function AttentionSummary({
  rfiCount,
  attentionCount,
  anomalyCount,
  viewMode,
  onViewModeChange,
}: AttentionSummaryProps) {
  const totalIssues = rfiCount + attentionCount + anomalyCount;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Row Summary</span>
          {rfiCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
              <MessageSquare className="w-3 h-3" />
              {rfiCount} RFI{rfiCount !== 1 ? 's' : ''}
            </div>
          )}
          {anomalyCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {anomalyCount} Anomal{anomalyCount !== 1 ? 'ies' : 'y'}
            </div>
          )}
          {totalIssues === 0 && (
            <span className="text-xs text-green-600 font-medium">All clear</span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Data
          </button>
          <button
            onClick={() => onViewModeChange('attention')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'attention'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Needs Attention
            {attentionCount > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                viewMode === 'attention' ? 'bg-white/20' : 'bg-rose-100 text-rose-700'
              }`}>
                {attentionCount}
              </span>
            )}
          </button>
          {rfiCount > 0 && (
            <button
              onClick={() => onViewModeChange('rfi')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'rfi'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              RFIs
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                viewMode === 'rfi' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
              }`}>
                {rfiCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
