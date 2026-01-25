import { AlertCircle, MessageSquare, Zap, Pencil, X, AlertTriangle, Shield } from 'lucide-react';
import { SheetAnalytics } from '../utils/analytics';

export type FilterType = 'needsAttention' | 'rfi' | 'anomaly' | 'blacklistHit' | 'manualEdit' | 'systemChange' | null;

interface GridSummaryBarProps {
  analytics: SheetAnalytics;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

const FILTER_LABELS: Record<Exclude<FilterType, null>, string> = {
  needsAttention: 'Needs Attention',
  rfi: 'RFIs',
  anomaly: 'Anomalies',
  blacklistHit: 'Blacklist Hits',
  manualEdit: 'Manual Edits',
  systemChange: 'System Changes',
};

export function GridSummaryBar({
  analytics,
  activeFilter,
  onFilterChange,
}: GridSummaryBarProps) {
  const handleChipClick = (filter: FilterType) => {
    if (activeFilter === filter) {
      onFilterChange(null);
    } else {
      onFilterChange(filter);
    }
  };

  const needsAttentionCount = analytics.rowsNeedingAttention.size;
  const rfiCount = analytics.rfiRowCount;
  const anomalyCount = analytics.anomalyRowCount;
  const blacklistHitCount = analytics.blacklistHitRowCount;
  const manualEditCount = analytics.manualEditRowCount;
  const systemChangeCount = analytics.systemChangeRowCount;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {needsAttentionCount > 0 && (
        <button
          onClick={() => handleChipClick('needsAttention')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeFilter === 'needsAttention'
              ? 'bg-rose-600 text-white ring-2 ring-rose-300'
              : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Needs Attention</span>
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold">
            {needsAttentionCount}
          </span>
        </button>
      )}

      {rfiCount > 0 && (
        <button
          onClick={() => handleChipClick('rfi')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            activeFilter === 'rfi'
              ? 'bg-amber-500 text-white ring-2 ring-amber-300'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>RFIs</span>
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
            activeFilter === 'rfi' ? 'bg-white/20' : 'bg-amber-200/60'
          }`}>
            {rfiCount}
          </span>
        </button>
      )}

      {anomalyCount > 0 && (
        <button
          onClick={() => handleChipClick('anomaly')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            activeFilter === 'anomaly'
              ? 'bg-orange-500 text-white ring-2 ring-orange-300'
              : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Anomalies</span>
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
            activeFilter === 'anomaly' ? 'bg-white/20' : 'bg-orange-200/60'
          }`}>
            {anomalyCount}
          </span>
        </button>
      )}

      {blacklistHitCount > 0 && (
        <button
          onClick={() => handleChipClick('blacklistHit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            activeFilter === 'blacklistHit'
              ? 'bg-red-600 text-white ring-2 ring-red-300'
              : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Blacklist Hits</span>
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
            activeFilter === 'blacklistHit' ? 'bg-white/20' : 'bg-red-200/60'
          }`}>
            {blacklistHitCount}
          </span>
        </button>
      )}

      {manualEditCount > 0 && (
        <button
          onClick={() => handleChipClick('manualEdit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            activeFilter === 'manualEdit'
              ? 'bg-blue-500 text-white ring-2 ring-blue-300'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Manual Edits</span>
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
            activeFilter === 'manualEdit' ? 'bg-white/20' : 'bg-blue-200/60'
          }`}>
            {manualEditCount}
          </span>
        </button>
      )}

      {systemChangeCount > 0 && (
        <button
          onClick={() => handleChipClick('systemChange')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            activeFilter === 'systemChange'
              ? 'bg-slate-600 text-white ring-2 ring-slate-400'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>System Changes</span>
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
            activeFilter === 'systemChange' ? 'bg-white/20' : 'bg-slate-200/60'
          }`}>
            {systemChangeCount}
          </span>
        </button>
      )}

      {activeFilter && (
        <button
          onClick={() => onFilterChange(null)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );
}

export function getFilterLabel(filter: FilterType): string {
  if (!filter) return '';
  return FILTER_LABELS[filter];
}
