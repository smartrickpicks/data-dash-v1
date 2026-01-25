import { AlertCircle, MessageSquare, Zap, Pencil, X, AlertTriangle, Shield, FileWarning, CheckCircle, Circle, ListTodo, Archive, List, ClipboardCheck } from 'lucide-react';
import { SheetAnalytics } from '../utils/analytics';
import { QueueView } from '../types';

export type FilterType = 'needsAttention' | 'rfi' | 'anomaly' | 'blacklistHit' | 'manualEdit' | 'systemChange' | 'pendingReview' | 'manualPdfReview' | 'manualReviewRequired' | 'readyToFinalize' | null;

interface GridSummaryBarProps {
  analytics: SheetAnalytics;
  queueView: QueueView;
  onQueueViewChange: (view: QueueView) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  todoCount: number;
  finalizedCount: number;
  totalCount: number;
}

const FILTER_LABELS: Record<Exclude<FilterType, null>, string> = {
  needsAttention: 'Needs Attention',
  rfi: 'RFIs',
  anomaly: 'Anomalies',
  blacklistHit: 'Blacklist Hits',
  manualEdit: 'Manual Edits',
  systemChange: 'System Changes',
  pendingReview: 'Pending Review',
  manualPdfReview: 'Manual PDF Review',
  manualReviewRequired: 'Manual Review Required',
  readyToFinalize: 'Ready to Finalize',
};

export function GridSummaryBar({
  analytics,
  queueView,
  onQueueViewChange,
  activeFilter,
  onFilterChange,
  todoCount,
  finalizedCount,
  totalCount,
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
  const pendingReviewCount = analytics.pendingReviewCount || 0;
  const manualPdfReviewCount = analytics.manualPdfReviewCount || 0;
  const manualReviewRequiredCount = analytics.manualReviewRequiredCount || 0;
  const readyToFinalizeCount = analytics.readyToFinalizeCount || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1">Queue:</span>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => onQueueViewChange('todo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              queueView === 'todo'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            To-Do
            <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              queueView === 'todo' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {todoCount}
            </span>
          </button>
          <button
            onClick={() => onQueueViewChange('finalized')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              queueView === 'finalized'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-4 h-4" />
            Finalized
            <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              queueView === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {finalizedCount}
            </span>
          </button>
          <button
            onClick={() => onQueueViewChange('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              queueView === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-4 h-4" />
            All
            <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              queueView === 'all' ? 'bg-slate-300 text-slate-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {totalCount}
            </span>
          </button>
        </div>
      </div>

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

        {pendingReviewCount > 0 && (
          <button
            onClick={() => handleChipClick('pendingReview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === 'pendingReview'
                ? 'bg-sky-600 text-white ring-2 ring-sky-300'
                : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
            <span>Pending Review</span>
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold">
              {pendingReviewCount}
            </span>
          </button>
        )}

        {manualPdfReviewCount > 0 && (
          <button
            onClick={() => handleChipClick('manualPdfReview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              activeFilter === 'manualPdfReview'
                ? 'bg-yellow-500 text-white ring-2 ring-yellow-300'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}
          >
            <FileWarning className="w-3.5 h-3.5" />
            <span>Manual PDF Review</span>
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
              activeFilter === 'manualPdfReview' ? 'bg-white/20' : 'bg-yellow-200/60'
            }`}>
              {manualPdfReviewCount}
            </span>
          </button>
        )}

        {manualReviewRequiredCount > 0 && (
          <button
            onClick={() => handleChipClick('manualReviewRequired')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === 'manualReviewRequired'
                ? 'bg-violet-600 text-white ring-2 ring-violet-300'
                : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Manual Review Required</span>
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
              activeFilter === 'manualReviewRequired' ? 'bg-white/20' : 'bg-violet-200/60'
            }`}>
              {manualReviewRequiredCount}
            </span>
          </button>
        )}

        {readyToFinalizeCount > 0 && (
          <button
            onClick={() => handleChipClick('readyToFinalize')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              activeFilter === 'readyToFinalize'
                ? 'bg-green-600 text-white ring-2 ring-green-300'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Ready to Finalize</span>
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
              activeFilter === 'readyToFinalize' ? 'bg-white/20' : 'bg-green-200/60'
            }`}>
              {readyToFinalizeCount}
            </span>
          </button>
        )}

        {activeFilter && (
          <button
            onClick={() => onFilterChange(null)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear filter
          </button>
        )}
      </div>
    </div>
  );
}

export function getFilterLabel(filter: FilterType): string {
  if (!filter) return '';
  return FILTER_LABELS[filter];
}
