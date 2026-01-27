import { useState, useEffect } from 'react';
import {
  Download,
  Grid,
  Eye,
  ChevronDown,
  FileSpreadsheet,
  Files,
  MessageSquare,
  Zap,
  Pencil,
  CheckCircle2,
  HardDrive,
  ExternalLink,
  Cloud,
  FileText,
  LogOut,
  Database,
  Trash2,
  ClipboardList,
} from 'lucide-react';
import {
  Dataset,
  RowStatus,
  FieldStatus,
  MultiSheetGlossaryConfig,
  RfiComments,
  ModificationHistory,
  AnomalyMap,
  DriveProjectMeta,
  DriveExportVariant,
  RowReviewStatusMap,
  RfiCommentEntry,
  FlagMap,
} from '../types';
import { getTotalOpenRfis } from '../utils/rfiUtils';
import { exportData, ExportOptions } from '../utils/exportData';
import { computeSheetAnalytics } from '../utils/analytics';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';
import { contractCache, formatCacheSize, CacheStats } from '../utils/contractCache';

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
  driveMeta?: DriveProjectMeta | null;
  onDriveExport?: (variant: DriveExportVariant, type: 'full' | 'spreadsheet' | 'logs') => void;
  isDriveExporting?: boolean;
  rowReviewStatuses: RowReviewStatusMap;
  rfiEntriesV2: RfiCommentEntry[];
  flagMap: FlagMap;
  onOpenReviewerHub: () => void;
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
  driveMeta,
  onDriveExport,
  isDriveExporting,
  rowReviewStatuses,
  rfiEntriesV2,
  flagMap,
  onOpenReviewerHub,
}: SidebarProps) {
  const analytics = computeSheetAnalytics(
    dataset,
    activeSheetName,
    rowStatuses,
    fieldStatuses,
    rfiComments,
    modificationHistory,
    anomalyMap,
    rowReviewStatuses
  );

  const { isAuthenticated, signOut } = useGoogleAuth();

  const isXLSX = dataset.fileName.toLowerCase().endsWith('.xlsx');
  const hasMultipleSheets = dataset.sheets.length > 1;
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    const loadCacheStats = async () => {
      try {
        const stats = await contractCache.getCacheStats();
        setCacheStats(stats);
      } catch {
        setCacheStats(null);
      }
    };
    loadCacheStats();
  }, []);

  const handleClearContractCache = async () => {
    if (!window.confirm('Clear all cached contract PDFs? You will need to re-fetch them when viewing.')) {
      return;
    }
    setIsClearingCache(true);
    try {
      await contractCache.clearAllContractCaches();
      setCacheStats({ count: 0, totalSize: 0, maxSize: cacheStats?.maxSize || 500 * 1024 * 1024 });
    } catch (err) {
      console.error('Failed to clear contract cache:', err);
    } finally {
      setIsClearingCache(false);
    }
  };

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

  const handleDriveExport = (variant: DriveExportVariant, type: 'full' | 'spreadsheet' | 'logs') => {
    if (onDriveExport) {
      onDriveExport(variant, type);
    }
  };

  const hasDriveConnection = driveMeta?.projectFolderId;

  return (
    <div className="w-64 bg-slate-900 text-slate-50 flex flex-col h-screen shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-emerald-400 mb-1">Data Dash</h2>
        <p className="text-xs text-slate-400 truncate">{dataset.fileName}</p>

        {isAuthenticated && driveMeta?.connectedEmail && (
          <div className="mt-3 p-2 bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-300 truncate flex-1">{driveMeta.connectedEmail}</span>
              <button
                onClick={signOut}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
                title="Disconnect"
              >
                <LogOut className="w-3 h-3 text-slate-400" />
              </button>
            </div>
            {driveMeta.folderUrl && (
              <a
                href={driveMeta.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open Drive folder
              </a>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* PROGRESS (Read-only) */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Progress
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">
                  {analytics.completedRows} / {analytics.totalRows} rows
                </span>
                <span className="text-lg font-bold text-emerald-400">{analytics.progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${analytics.progressPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span>Verified cells</span>
                </div>
                <span className="text-slate-200">{analytics.verifiedCellCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3 text-amber-400" />
                  <span>RFIs</span>
                </div>
                <span className="text-slate-200">{analytics.rfiRowCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-red-400" />
                  <span>System changes</span>
                </div>
                <span className="text-slate-200">{analytics.systemChangeRowCount}</span>
              </div>
              {analytics.manualEditRowCount > 0 && (
                <div className="flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Pencil className="w-3 h-3 text-blue-400" />
                    <span>Manual changes</span>
                  </div>
                  <span className="text-slate-200">{analytics.manualEditRowCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Navigation
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Sheet</label>
              <select
                value={activeSheetName}
                onChange={(e) => onSheetChange(e.target.value)}
                className="w-full bg-slate-800 text-slate-50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {dataset.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">View Mode</label>
              <div className="space-y-1.5">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  All Data Grid
                </button>
                <button
                  onClick={() => onViewModeChange('single')}
                  className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'single'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Single Row Review
                </button>
              </div>
            </div>

            {/* Reviewer Hub Button */}
            <div className="pt-3 border-t border-slate-700">
              {(() => {
                const openRfiCount = getTotalOpenRfis(rfiEntriesV2);
                const openFlagCount = Object.values(flagMap).reduce(
                  (sum, rowFlags) => sum + rowFlags.length,
                  0
                );
                const totalOpenItems = openRfiCount + openFlagCount;

                return (
                  <button
                    onClick={onOpenReviewerHub}
                    className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span className="flex-1 text-left">Reviewer Hub</span>
                    {totalOpenItems > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full font-bold min-w-[20px] text-center">
                        {totalOpenItems}
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Cache + Export */}
      <div className="border-t border-slate-700">
        {/* CACHE */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cache</span>
          </div>

          {cacheStats && cacheStats.count > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Cached PDFs</span>
                <span className="text-slate-200">{cacheStats.count}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Storage used</span>
                <span className="text-slate-200">{formatCacheSize(cacheStats.totalSize)}</span>
              </div>
              <button
                onClick={handleClearContractCache}
                disabled={isClearingCache}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-800 hover:bg-red-600/80 rounded text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                {isClearingCache ? 'Clearing...' : 'Clear All Cached PDFs'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No cached contracts</p>
          )}
        </div>

        {/* EXPORT */}
        <div className="p-4">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export / Save
              <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
                <div className="p-2 border-b border-slate-700">
                  <p className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1">Export Locally</p>
                  <button
                    onClick={() => handleExport({ includeChangeLog: false, exportAllSheets: false })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                    Current Sheet
                  </button>
                  {isXLSX && (
                    <button
                      onClick={() => handleExport({ includeChangeLog: true, exportAllSheets: false })}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      Sheet + Change Log
                    </button>
                  )}
                  {hasMultipleSheets && isXLSX && (
                    <>
                      <button
                        onClick={() => handleExport({ includeChangeLog: false, exportAllSheets: true })}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Files className="w-4 h-4 text-slate-400" />
                        All Sheets
                      </button>
                      <button
                        onClick={() => handleExport({ includeChangeLog: true, exportAllSheets: true })}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Files className="w-4 h-4 text-emerald-400" />
                        All + Change Logs
                      </button>
                    </>
                  )}
                </div>

                {hasDriveConnection && (
                  <div className="p-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1">Save to Google Drive</p>
                    <button
                      onClick={() => handleDriveExport('wip', 'full')}
                      disabled={isDriveExporting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                    >
                      <Cloud className="w-4 h-4 text-blue-400" />
                      WIP + Logs (Full Export)
                    </button>
                    <button
                      onClick={() => handleDriveExport('final', 'full')}
                      disabled={isDriveExporting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                    >
                      <Cloud className="w-4 h-4 text-green-400" />
                      FINAL + Logs (Full Export)
                    </button>
                    <button
                      onClick={() => handleDriveExport('wip', 'spreadsheet')}
                      disabled={isDriveExporting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                      Spreadsheet Only (WIP)
                    </button>
                    <button
                      onClick={() => handleDriveExport('wip', 'logs')}
                      disabled={isDriveExporting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 text-amber-400" />
                      Logs Only
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
