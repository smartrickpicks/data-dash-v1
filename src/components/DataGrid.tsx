import { useState, useMemo } from 'react';
import { ExternalLink, Check, X } from 'lucide-react';
import { Dataset, RowStatus, FieldStatus, FieldStatusType, ChangeMap, ModificationHistory, RfiComments, AnomalyMap, RowReviewStatusMap, CellValue, QueueView } from '../types';
import { formatFieldName } from '../utils/formatFieldName';
import { computeSheetAnalytics } from '../utils/analytics';
import { GridSummaryBar, FilterType, getFilterLabel } from './GridSummaryBar';
import { getRowAttention } from '../utils/attentionLogic';
import { getReviewReasonLabel, getReviewReasonColor } from '../utils/rowReviewLogic';

interface DataGridProps {
  dataset: Dataset;
  activeSheetName: string;
  onRowSelect: (rowIndex: number) => void;
  onStatusToggle: (rowIndex: number, status: 'complete' | 'incomplete') => void;
  rowStatuses: RowStatus;
  fieldStatuses: FieldStatus;
  changeMap: ChangeMap;
  modificationHistory: ModificationHistory;
  rfiComments: RfiComments;
  anomalyMap: AnomalyMap;
  rowReviewStatuses: RowReviewStatusMap;
  showDebugOverlay?: boolean;
  queueView: QueueView;
  onQueueViewChange: (view: QueueView) => void;
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function getCellValueByIndex(
  sheet: { _parsed?: { rows: CellValue[][] }; rows: Record<string, unknown>[] },
  rowIndex: number,
  colIndex: number,
  headerKey: string
): CellValue {
  if (sheet._parsed && sheet._parsed.rows[rowIndex]) {
    return sheet._parsed.rows[rowIndex][colIndex];
  }
  return sheet.rows[rowIndex]?.[headerKey] as CellValue;
}

function isRowFinalized(
  rowStatuses: RowStatus,
  sheetName: string,
  rowIndex: number
): boolean {
  return rowStatuses[sheetName]?.[rowIndex] === 'complete';
}

export function DataGrid({
  dataset,
  activeSheetName,
  onRowSelect,
  onStatusToggle,
  rowStatuses,
  fieldStatuses,
  changeMap,
  modificationHistory,
  rfiComments,
  anomalyMap,
  rowReviewStatuses,
  showDebugOverlay = false,
  queueView,
  onQueueViewChange,
  activeFilter: externalFilter,
  onFilterChange: externalOnFilterChange,
}: DataGridProps) {
  const activeSheet = dataset.sheets.find((s) => s.name === activeSheetName);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [internalFilter, setInternalFilter] = useState<FilterType>(null);

  const activeFilter = externalFilter !== undefined ? externalFilter : internalFilter;
  const setActiveFilter = externalOnFilterChange || setInternalFilter;

  const analytics = useMemo(() => {
    return computeSheetAnalytics(
      dataset,
      activeSheetName,
      rowStatuses,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap,
      rowReviewStatuses
    );
  }, [dataset, activeSheetName, rowStatuses, fieldStatuses, rfiComments, modificationHistory, anomalyMap, rowReviewStatuses]);

  const rowsWithAttention = useMemo(() => {
    if (!activeSheet) return new Map();
    const map = new Map<number, ReturnType<typeof getRowAttention>>();
    for (let i = 0; i < activeSheet.rows.length; i++) {
      const attention = getRowAttention(
        activeSheetName,
        i,
        activeSheet.headers,
        fieldStatuses,
        rfiComments,
        modificationHistory,
        anomalyMap
      );
      map.set(i, attention);
    }
    return map;
  }, [activeSheet, activeSheetName, fieldStatuses, rfiComments, modificationHistory, anomalyMap]);

  const queueCounts = useMemo(() => {
    if (!activeSheet) return { todo: 0, finalized: 0, total: 0 };

    let todo = 0;
    let finalized = 0;

    for (let i = 0; i < activeSheet.rows.length; i++) {
      if (isRowFinalized(rowStatuses, activeSheetName, i)) {
        finalized++;
      } else {
        todo++;
      }
    }

    return {
      todo,
      finalized,
      total: activeSheet.rows.length,
    };
  }, [activeSheet, activeSheetName, rowStatuses]);

  if (!activeSheet) return null;

  const parsed = activeSheet._parsed;
  const headersRaw = parsed?.headersRaw || activeSheet.headers;
  const headersKey = parsed?.headersKey || activeSheet.headers;

  const getFieldStatus = (rowIndex: number, fieldName: string): FieldStatusType => {
    if (!fieldStatuses || !fieldStatuses[activeSheetName]) {
      return 'incomplete';
    }
    return fieldStatuses[activeSheetName]?.[rowIndex]?.[fieldName] || 'incomplete';
  };

  const getCellBackgroundClass = (status: FieldStatusType): string => {
    switch (status) {
      case 'complete':
        return 'bg-green-100/60';
      case 'rfi':
        return 'bg-orange-100/60';
      default:
        return '';
    }
  };

  const derivedColumnHeaders = ['Row', 'Status', 'Review Reason'];
  const displayHeaders = [...derivedColumnHeaders, ...headersRaw];

  const filteredSheetRows = activeSheet.rows;

  let rows = filteredSheetRows.map((row, index) => ({
    ...row,
    _originalIndex: index,
    _status: (rowStatuses[activeSheetName]?.[index] || 'incomplete') as 'complete' | 'incomplete',
    _attention: rowsWithAttention.get(index)!,
  }));

  const totalRowsBeforeFilter = rows.length;

  rows = rows.filter((row) => {
    const finalized = isRowFinalized(rowStatuses, activeSheetName, row._originalIndex);
    switch (queueView) {
      case 'todo':
        return !finalized;
      case 'finalized':
        return finalized;
      case 'all':
      default:
        return true;
    }
  });

  const rowsAfterQueueFilter = rows.length;

  if (searchTerm) {
    rows = rows.filter((row) =>
      Object.entries(row).some(([key, val]) => {
        if (key.startsWith('_')) return false;
        return String(val).toLowerCase().includes(searchTerm.toLowerCase());
      }),
    );
  }

  if (activeFilter) {
    rows = rows.filter((row) => {
      const rowIndex = row._originalIndex;
      const reviewStatus = rowReviewStatuses[activeSheetName]?.[rowIndex];

      switch (activeFilter) {
        case 'needsAttention':
          return analytics.rowsNeedingAttention.has(rowIndex);
        case 'rfi':
          return analytics.rowsWithRfi.has(rowIndex);
        case 'anomaly':
          return analytics.rowsWithAnomalies.has(rowIndex);
        case 'blacklistHit':
          return analytics.rowsWithBlacklistHits.has(rowIndex);
        case 'manualEdit':
          return analytics.rowsWithManualEdits.has(rowIndex);
        case 'systemChange':
          return analytics.rowsWithSystemChanges.has(rowIndex);
        case 'pendingReview':
          return reviewStatus?.isBlocking === true;
        case 'manualPdfReview':
          return reviewStatus?.reason === 'manual_pdf_review_required';
        case 'manualReviewRequired':
          return reviewStatus?.reason === 'manual_pdf_review_required' ||
                 reviewStatus?.reason === 'manual_data_review_required' ||
                 reviewStatus?.reason === 'document_not_applicable';
        case 'readyToFinalize':
          return reviewStatus?.reason === 'ready_to_finalize';
        default:
          return true;
      }
    });
  }

  const filteredRowCount = rows.length;

  const headerIndexMap = new Map<string, number>();
  headersKey.forEach((key, idx) => headerIndexMap.set(key, idx));

  if (sortBy === 'Row') {
    rows.sort((a, b) => {
      const comparison = a._originalIndex - b._originalIndex;
      return sortDesc ? -comparison : comparison;
    });
  } else if (sortBy) {
    const sortColIndex = headerIndexMap.get(sortBy) ?? -1;
    rows.sort((a, b) => {
      const aVal = sortColIndex >= 0
        ? String(getCellValueByIndex(activeSheet, a._originalIndex, sortColIndex, sortBy) ?? '').toLowerCase()
        : '';
      const bVal = sortColIndex >= 0
        ? String(getCellValueByIndex(activeSheet, b._originalIndex, sortColIndex, sortBy) ?? '').toLowerCase()
        : '';
      const comparison = aVal.localeCompare(bVal);
      return sortDesc ? -comparison : comparison;
    });
  } else {
    rows.sort((a, b) => a._originalIndex - b._originalIndex);
  }

  const displayRows = rows.map((row, displayIndex) => ({
    ...row,
    _displayNumber: row._originalIndex + 1,
    _displayIndex: displayIndex,
  }));

  const handleSort = (header: string) => {
    if (header === 'Status' || header === 'Review Reason') return;
    if (header === 'Row') {
      if (sortBy === 'Row') {
        setSortDesc(!sortDesc);
      } else {
        setSortBy('Row');
        setSortDesc(false);
      }
      return;
    }
    if (sortBy === header) {
      if (sortDesc) {
        setSortBy(null);
        setSortDesc(false);
      } else {
        setSortDesc(true);
      }
    } else {
      setSortBy(header);
      setSortDesc(false);
    }
  };

  const hasRowAnomaly = (rowIndex: number, fieldName: string): boolean => {
    const fieldAnomalies = anomalyMap[activeSheetName]?.[rowIndex]?.[fieldName];
    return fieldAnomalies && fieldAnomalies.length > 0;
  };

  const hasBlacklistHit = (rowIndex: number, fieldName: string): boolean => {
    const fieldAnomalies = anomalyMap[activeSheetName]?.[rowIndex]?.[fieldName];
    return fieldAnomalies?.some((a) => a.type === 'blacklist_hit') || false;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search rows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-md"
          />
          {(activeFilter || searchTerm || queueView !== 'all') && (
            <span className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{filteredRowCount}</span> of{' '}
              <span className="font-medium text-slate-700">{rowsAfterQueueFilter}</span> rows
              {activeFilter && !searchTerm && (
                <span className="text-slate-400"> ({getFilterLabel(activeFilter)})</span>
              )}
            </span>
          )}
        </div>
        <GridSummaryBar
          analytics={analytics}
          queueView={queueView}
          onQueueViewChange={onQueueViewChange}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          todoCount={queueCounts.todo}
          finalizedCount={queueCounts.finalized}
          totalCount={queueCounts.total}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-sm whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              {displayHeaders.map((header, idx) => {
                const isRowCol = header === 'Row';
                const isStatusCol = header === 'Status';
                const isReviewReasonCol = header === 'Review Reason';
                const isSortable = !isStatusCol && !isReviewReasonCol;

                return (
                  <th
                    key={idx}
                    onClick={() => isSortable && handleSort(header)}
                    className={`px-4 py-3 text-left font-semibold text-slate-700 ${
                      isSortable ? 'cursor-pointer hover:bg-slate-100' : ''
                    } ${isRowCol ? 'w-16' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {isRowCol || isStatusCol || isReviewReasonCol ? header : formatFieldName(header)}
                      {header === sortBy && (
                        <span>{sortDesc ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const attention = row._attention;
              const needsAttention = attention?.needsAttention;
              const isNotApplicable = attention?.notApplicableCount > 0;

              const getRowBackgroundClass = () => {
                if (isNotApplicable) return 'bg-orange-100/50';
                if (needsAttention) return 'bg-rose-50/30';
                return '';
              };

              return (
                <tr
                  key={row._originalIndex}
                  className={`border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors ${getRowBackgroundClass()}`}
                  onClick={() => onRowSelect(row._originalIndex)}
                >
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                    {row._displayNumber}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusToggle(
                          row._originalIndex,
                          row._status === 'complete' ? 'incomplete' : 'complete',
                        );
                      }}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        row._status === 'complete'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                    >
                      {row._status === 'complete' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      {row._status === 'complete' ? 'Done' : 'Pending'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {rowReviewStatuses[activeSheetName]?.[row._originalIndex] ? (
                      <div className="group relative">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getReviewReasonColor(
                            rowReviewStatuses[activeSheetName][row._originalIndex].reason
                          )}`}
                        >
                          {rowReviewStatuses[activeSheetName][row._originalIndex].isBlocking && (
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          )}
                          {getReviewReasonLabel(rowReviewStatuses[activeSheetName][row._originalIndex].reason)}
                        </span>
                        {rowReviewStatuses[activeSheetName][row._originalIndex].details && (
                          <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 w-64 p-2 bg-slate-900 text-white text-xs rounded shadow-lg">
                            {rowReviewStatuses[activeSheetName][row._originalIndex].details}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  {headersKey.map((headerKey, colIdx) => {
                    const value = getCellValueByIndex(activeSheet, row._originalIndex, colIdx, headerKey);
                    const stringValue = String(value ?? '');
                    const isUrl = typeof value === 'string' && isValidUrl(value);
                    const isFileName = colIdx === 0;

                    const fieldStatus = colIdx >= 2 ? getFieldStatus(row._originalIndex, headerKey) : 'incomplete';
                    let backgroundClass = colIdx >= 2 ? getCellBackgroundClass(fieldStatus) : '';

                    const modification = modificationHistory[activeSheetName]?.[row._originalIndex]?.[headerKey];
                    if (modification) {
                      if (modification.modificationType === 'address_standardized') {
                        backgroundClass = 'bg-slate-100/70';
                      } else if (modification.modificationType === 'incomplete_address') {
                        backgroundClass = 'bg-yellow-100/70';
                      } else if (modification.modificationType === 'manual_edit') {
                        backgroundClass = 'bg-blue-100/70';
                      }
                    }

                    if (colIdx >= 2 && hasBlacklistHit(row._originalIndex, headerKey) && !modification) {
                      backgroundClass = 'bg-red-100/60';
                    } else if (colIdx >= 2 && hasRowAnomaly(row._originalIndex, headerKey) && !modification) {
                      backgroundClass = 'bg-orange-100/60';
                    }

                    const hasChanged = changeMap[activeSheetName]?.[row._originalIndex]?.[headerKey] || false;
                    const changeIndicator = hasChanged && !modification ? 'border-l-4 border-l-blue-500' : '';

                    return (
                      <td
                        key={colIdx}
                        className={`px-4 py-3 ${backgroundClass} ${changeIndicator} ${
                          isFileName
                            ? 'text-blue-600 hover:text-blue-700 font-medium hover:underline'
                            : 'text-slate-700'
                        }`}
                      >
                        {isUrl ? (
                          <a
                            href={stringValue}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          stringValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayRows.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">
            {queueView === 'todo' && queueCounts.todo === 0
              ? 'All rows have been finalized!'
              : queueView === 'finalized' && queueCounts.finalized === 0
              ? 'No finalized rows yet'
              : activeFilter || searchTerm
              ? 'No rows match the current filter'
              : 'No data available'}
          </p>
        </div>
      )}

      {showDebugOverlay && parsed && (
        <div className="fixed bottom-4 left-4 z-50 max-w-md p-4 bg-slate-900 text-white text-xs font-mono rounded-lg shadow-xl overflow-auto max-h-80">
          <div className="font-bold text-yellow-400 mb-2">Parser Debug</div>
          <div className="space-y-2">
            <div>
              <span className="text-slate-400">headerRowIndex:</span>{' '}
              <span className="text-green-400">{parsed.headerRowIndex}</span>
            </div>
            <div>
              <span className="text-slate-400">dataStartRowIndex:</span>{' '}
              <span className="text-green-400">{parsed.dataStartRowIndex}</span>
            </div>
            <div>
              <span className="text-slate-400">headersRaw count:</span>{' '}
              <span className="text-green-400">{parsed.headersRaw.length}</span>
            </div>
            <div>
              <span className="text-slate-400">rows count:</span>{' '}
              <span className="text-green-400">{parsed.rows.length}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="text-slate-400 mb-1">First 10 headersRaw:</div>
              {parsed.headersRaw.slice(0, 10).map((h, i) => (
                <div key={i} className="text-blue-300 truncate">
                  [{i}] {h}
                </div>
              ))}
            </div>
            {parsed.rows.length > 0 && (
              <div className="border-t border-slate-700 pt-2 mt-2">
                <div className="text-slate-400 mb-1">First row values (by index):</div>
                {parsed.rows[0].slice(0, 10).map((v, i) => (
                  <div key={i} className="truncate">
                    <span className="text-slate-500">[{i}]</span>{' '}
                    <span className="text-sky-300">{String(v ?? '').substring(0, 40)}</span>
                  </div>
                ))}
                <div className="text-slate-400 mt-1">
                  row length: {parsed.rows[0].length} | headers length: {parsed.headersRaw.length}
                  {parsed.rows[0].length !== parsed.headersRaw.length && (
                    <span className="text-red-400 ml-2">MISMATCH</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
