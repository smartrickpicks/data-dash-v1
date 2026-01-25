import { useState, useMemo } from 'react';
import { ExternalLink, Check, X } from 'lucide-react';
import { Dataset, RowStatus, FieldStatus, FieldStatusType, ChangeMap, ModificationHistory, RfiComments, AnomalyMap } from '../types';
import { formatFieldName } from '../utils/formatFieldName';
import { computeSheetAnalytics } from '../utils/analytics';
import { GridSummaryBar, FilterType, getFilterLabel } from './GridSummaryBar';
import { getRowAttention, getAttentionSortPriority } from '../utils/attentionLogic';

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
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
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
}: DataGridProps) {
  const activeSheet = dataset.sheets.find((s) => s.name === activeSheetName);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);

  const analytics = useMemo(() => {
    return computeSheetAnalytics(
      dataset,
      activeSheetName,
      rowStatuses,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap
    );
  }, [dataset, activeSheetName, rowStatuses, fieldStatuses, rfiComments, modificationHistory, anomalyMap]);

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

  if (!activeSheet) return null;

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

  const headers = activeSheet.headers;
  const displayHeaders = [
    'Row',
    'Status',
    ...headers,
  ];

  const isHeaderRow = (row: Record<string, unknown>): boolean => {
    const headerSet = new Set(headers.map((h) => String(h).toLowerCase().trim()));
    const values = headers.map((h) => String(row[h] || '').toLowerCase().trim());
    const matchCount = values.filter((v) => headerSet.has(v)).length;
    return matchCount >= Math.ceil(headers.length * 0.5);
  };

  const filteredSheetRows = activeSheet.rows.filter((row) => !isHeaderRow(row));

  let rows = filteredSheetRows.map((row, index) => ({
    ...row,
    _originalIndex: index,
    _status: (rowStatuses[activeSheetName]?.[index] || 'incomplete') as 'complete' | 'incomplete',
    _attention: rowsWithAttention.get(index)!,
  }));

  const totalRowsBeforeFilter = rows.length;

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
        default:
          return true;
      }
    });
  }

  const filteredRowCount = rows.length;

  if (sortBy === 'Row') {
    rows.sort((a, b) => {
      const comparison = a._originalIndex - b._originalIndex;
      return sortDesc ? -comparison : comparison;
    });
  } else if (sortBy) {
    rows.sort((a, b) => {
      const aVal = String(a[sortBy] || '').toLowerCase();
      const bVal = String(b[sortBy] || '').toLowerCase();
      const comparison = aVal.localeCompare(bVal);
      return sortDesc ? -comparison : comparison;
    });
  } else {
    rows.sort((a, b) => a._originalIndex - b._originalIndex);
  }

  const displayRows = rows.map((row, displayIndex) => ({
    ...row,
    _displayNumber: displayIndex + 1,
  }));

  const handleSort = (header: string) => {
    if (header === 'Status') return;
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
          {(activeFilter || searchTerm) && (
            <span className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{filteredRowCount}</span> of{' '}
              <span className="font-medium text-slate-700">{totalRowsBeforeFilter}</span> rows
              {activeFilter && !searchTerm && (
                <span className="text-slate-400"> ({getFilterLabel(activeFilter)})</span>
              )}
            </span>
          )}
        </div>
        <GridSummaryBar
          analytics={analytics}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-sm whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              {displayHeaders.map((header, idx) => {
                const isRowCol = header === 'Row';
                const isStatusCol = header === 'Status';
                const isSortable = !isStatusCol;

                return (
                  <th
                    key={idx}
                    onClick={() => isSortable && handleSort(header)}
                    className={`px-4 py-3 text-left font-semibold text-slate-700 ${
                      isSortable ? 'cursor-pointer hover:bg-slate-100' : ''
                    } ${isRowCol ? 'w-16' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {isRowCol || isStatusCol ? header : formatFieldName(header)}
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

              return (
                <tr
                  key={row._originalIndex}
                  className={`border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors ${
                    needsAttention ? 'bg-rose-50/30' : ''
                  }`}
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
                  {headers.map((header, colIdx) => {
                    const value = row[header];
                    const isUrl = typeof value === 'string' && isValidUrl(value);
                    const isFileName = colIdx === 0;

                    const fieldStatus = colIdx >= 2 ? getFieldStatus(row._originalIndex, header) : 'incomplete';
                    let backgroundClass = colIdx >= 2 ? getCellBackgroundClass(fieldStatus) : '';

                    const modification = modificationHistory[activeSheetName]?.[row._originalIndex]?.[header];
                    if (modification) {
                      if (modification.modificationType === 'address_standardized') {
                        backgroundClass = 'bg-slate-100/70';
                      } else if (modification.modificationType === 'incomplete_address') {
                        backgroundClass = 'bg-yellow-100/70';
                      } else if (modification.modificationType === 'manual_edit') {
                        backgroundClass = 'bg-blue-100/70';
                      }
                    }

                    if (colIdx >= 2 && hasBlacklistHit(row._originalIndex, header) && !modification) {
                      backgroundClass = 'bg-red-100/60';
                    } else if (colIdx >= 2 && hasRowAnomaly(row._originalIndex, header) && !modification) {
                      backgroundClass = 'bg-orange-100/60';
                    }

                    const hasChanged = changeMap[activeSheetName]?.[row._originalIndex]?.[header] || false;
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
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          String(value || '')
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
            {activeFilter || searchTerm ? 'No rows match the current filter' : 'No data available'}
          </p>
        </div>
      )}
    </div>
  );
}
