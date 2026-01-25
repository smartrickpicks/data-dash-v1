import { useState } from 'react';
import { Download, Grid, Eye, AlertCircle, Upload, BookOpen, X, RefreshCw, ChevronDown, FileSpreadsheet, Files, MessageSquare, Zap, Pencil, CheckCircle2, Shield } from 'lucide-react';
import { Dataset, RowStatus, FieldStatus, MultiSheetGlossaryConfig, RfiComments, ModificationHistory, AnomalyMap } from '../types';
import { exportData, ExportOptions } from '../utils/exportData';
import { computeSheetAnalytics } from '../utils/analytics';

interface SidebarProps {
  dataset: Dataset;
  originalDataset: Dataset | null;
  activeSheetName: string;
  onSheetChange: (sheetName: string) => void;
  viewMode: 'single' | 'grid';
  onViewModeChange: (mode: 'single' | 'grid') => void;
  rowStatuses: RowStatus;
  fieldStatuses: FieldStatus;
  rfiComments: RfiComments;
  modificationHistory: ModificationHistory;
  anomalyMap: AnomalyMap;
  glossaryConfig: MultiSheetGlossaryConfig | null;
  glossaryEntryCount: number;
  blacklistEntryCount: number;
  onGlossaryUpload: (file: File) => void;
  onGlossaryRemove: () => void;
  onOpenBlacklistManager: () => void;
}

export function Sidebar({
  dataset,
  originalDataset,
  activeSheetName,
  onSheetChange,
  viewMode,
  onViewModeChange,
  rowStatuses,
  fieldStatuses,
  rfiComments,
  modificationHistory,
  anomalyMap,
  glossaryConfig,
  glossaryEntryCount,
  blacklistEntryCount,
  onGlossaryUpload,
  onGlossaryRemove,
  onOpenBlacklistManager,
}: SidebarProps) {
  const analytics = computeSheetAnalytics(
    dataset,
    activeSheetName,
    rowStatuses,
    fieldStatuses,
    rfiComments,
    modificationHistory,
    anomalyMap
  );

  const isXLSX = dataset.fileName.toLowerCase().endsWith('.xlsx');
  const hasMultipleSheets = dataset.sheets.length > 1;
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = (options: ExportOptions) => {
    exportData(
      dataset,
      activeSheetName,
      rowStatuses,
      fieldStatuses,
      isXLSX,
      originalDataset,
      rfiComments,
      modificationHistory,
      anomalyMap,
      options
    );
    setShowExportMenu(false);
  };

  return (
    <div className="w-72 bg-slate-900 text-slate-50 flex flex-col h-screen shadow-xl">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-bold text-blue-400 mb-2">Reviewer</h2>
        <div className="text-xs text-slate-400">
          <p className="truncate">{dataset.fileName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Progress</h3>
          <div className="bg-slate-800 rounded-lg p-4 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">
                  {analytics.completedRows} / {analytics.totalRows} rows
                </span>
                <span className="text-lg font-bold text-blue-400">{analytics.progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${analytics.progressPercent}%` }}
                />
              </div>
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span>Verified cells</span>
                </div>
                <span className="text-slate-200 font-medium">
                  {analytics.verifiedCellCount} / {analytics.totalEditableCells}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>RFIs</span>
                </div>
                <span className="text-slate-200 font-medium">{analytics.rfiCount}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Zap className="w-3.5 h-3.5 text-red-400" />
                  <span>System changes</span>
                </div>
                <span className="text-slate-200 font-medium">{analytics.systemChangeCount}</span>
              </div>

              {analytics.manualChangeCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Pencil className="w-3.5 h-3.5 text-blue-400" />
                    <span>Manual changes</span>
                  </div>
                  <span className="text-slate-200 font-medium">{analytics.manualChangeCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Glossary</h3>
          {glossaryConfig ? (
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-start gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{glossaryConfig.fileName}</p>
                  <p className="text-xs text-slate-400">{glossaryEntryCount} entries</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium text-slate-300 cursor-pointer transition-colors">
                  <RefreshCw className="w-3 h-3" />
                  Replace
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onGlossaryUpload(file);
                      e.target.value = '';
                    }}
                    hidden
                  />
                </label>
                <button
                  onClick={onGlossaryRemove}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-700 hover:bg-red-600 rounded text-xs font-medium text-slate-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 rounded-lg text-sm text-slate-400 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              Upload Glossary (.xlsx)
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onGlossaryUpload(file);
                  e.target.value = '';
                }}
                hidden
              />
            </label>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Blacklist</h3>
          <button
            onClick={onOpenBlacklistManager}
            className="w-full flex items-center gap-3 py-3 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            <Shield className="w-4 h-4 text-red-400" />
            <span className="flex-1 text-left">Manage Blacklist</span>
            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
              {blacklistEntryCount}
            </span>
          </button>
          {analytics.blacklistHitRowCount > 0 && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              {analytics.blacklistHitRowCount} rows flagged
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Sheets</h3>
          <select
            value={activeSheetName}
            onChange={(e) => onSheetChange(e.target.value)}
            className="w-full bg-slate-800 text-slate-50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {dataset.sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">View Mode</h3>
          <div className="space-y-2">
            <button
              onClick={() => onViewModeChange('single')}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Eye className="w-4 h-4" />
              Single Row Review
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Grid className="w-4 h-4" />
              All Data Grid
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-700 space-y-3">
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>

          {showExportMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
              <div className="p-2 border-b border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1">Current Sheet ({activeSheetName})</p>
                <button
                  onClick={() => handleExport({ includeChangeLog: false, exportAllSheets: false })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  Export Sheet
                </button>
                {isXLSX && (
                  <button
                    onClick={() => handleExport({ includeChangeLog: true, exportAllSheets: false })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                    Export Sheet + Change Log
                  </button>
                )}
              </div>

              {hasMultipleSheets && isXLSX && (
                <div className="p-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1">All Sheets</p>
                  <button
                    onClick={() => handleExport({ includeChangeLog: false, exportAllSheets: true })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                  >
                    <Files className="w-4 h-4 text-slate-400" />
                    Export All Sheets
                  </button>
                  <button
                    onClick={() => handleExport({ includeChangeLog: true, exportAllSheets: true })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                  >
                    <Files className="w-4 h-4 text-blue-400" />
                    Export All + Change Logs
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {isXLSX
              ? 'XLSX exports include color-coded cells and optional change logs.'
              : 'CSV export for current sheet only.'}
          </span>
        </div>
      </div>
    </div>
  );
}
