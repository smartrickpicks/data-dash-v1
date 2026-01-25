import { ChevronLeft, ChevronRight, FileText, Grid } from 'lucide-react';
import { Dataset, RowStatus, RowReviewStatusMap } from '../types';
import { getReviewReasonLabel, getReviewReasonColor } from '../utils/rowReviewLogic';

interface RowHeaderProps {
  dataset: Dataset;
  activeSheetName: string;
  currentRowIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onRowStatusChange: (status: 'complete' | 'incomplete') => void;
  rowStatuses: RowStatus;
  rowReviewStatuses?: RowReviewStatusMap;
  onOpenContract?: () => void;
  showContractButton?: boolean;
  onBackToGrid?: () => void;
}

export function RowHeader({
  dataset,
  activeSheetName,
  currentRowIndex,
  onPrevious,
  onNext,
  onRowStatusChange,
  rowStatuses,
  rowReviewStatuses,
  onOpenContract,
  showContractButton = false,
  onBackToGrid,
}: RowHeaderProps) {
  const activeSheet = dataset.sheets.find((s) => s.name === activeSheetName);
  if (!activeSheet || !activeSheet.rows[currentRowIndex]) return null;

  const currentRow = activeSheet.rows[currentRowIndex];
  const rawFileName = currentRow[activeSheet.headers[0]] || 'N/A';
  const fileName = rawFileName.replace(/_/g, ' ');
  const totalRows = activeSheet.rows.length;
  const currentStatus = rowStatuses[activeSheetName]?.[currentRowIndex] || 'incomplete';
  const reviewStatus = rowReviewStatuses?.[activeSheetName]?.[currentRowIndex];
  const canGoBack = currentRowIndex > 0;
  const canGoNext = currentRowIndex < totalRows - 1;

  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-sm sticky top-0 z-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-shrink">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate max-w-xs sm:max-w-md lg:max-w-lg">
              {fileName}
            </h1>
            {reviewStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getReviewReasonColor(
                  reviewStatus.reason
                )}`}
                title={reviewStatus.details}
              >
                {reviewStatus.isBlocking && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
                {getReviewReasonLabel(reviewStatus.reason)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Row {currentRowIndex + 1} of {totalRows}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onBackToGrid && (
            <button
              onClick={onBackToGrid}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              title="Back to All Data Grid"
            >
              <Grid className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Grid</span>
            </button>
          )}

          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

          <button
            onClick={onPrevious}
            disabled={!canGoBack}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous row"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>

          <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-sm font-medium text-slate-600 tabular-nums">
              {currentRowIndex + 1} / {totalRows}
            </span>
          </div>

          <button
            onClick={onNext}
            disabled={!canGoNext}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next row"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

          {showContractButton && onOpenContract && (
            <button
              onClick={onOpenContract}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              title="Open Contract"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Contract</span>
            </button>
          )}

          <button
            onClick={() => onRowStatusChange(currentStatus === 'complete' ? 'incomplete' : 'complete')}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
              currentStatus === 'complete'
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            {currentStatus === 'complete' ? 'Complete' : 'Incomplete'}
          </button>
        </div>
      </div>
    </div>
  );
}
