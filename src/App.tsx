import { useState, useCallback, useEffect, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { Sidebar } from './components/Sidebar';
import { RowHeader } from './components/RowHeader';
import { FieldsEditor } from './components/FieldsEditor';
import { ContractViewer } from './components/ContractViewer';
import { ContractModal } from './components/ContractModal';
import { SplitView } from './components/SplitView';
import { DataGrid } from './components/DataGrid';
import { GlossaryWizard } from './components/GlossaryWizard';
import { BlacklistManager } from './components/BlacklistManager';
import { ReviewerDashboard } from './components/ReviewerDashboard';
import { parseGlossaryXLSX, parseFileWithNormalization, parseBlob } from './utils/fileParser';
import { getGlossaryForSheet } from './utils/glossary';
import { generateChangeMap } from './utils/changeDetection';
import { computeDatasetAnomalies } from './utils/anomalyDetection';
import { useIsDesktop } from './hooks/useMediaQuery';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import {
  downloadFile,
  createProjectFolderStructure,
  buildDriveProjectMeta,
} from './services/googleDrive';
import {
  exportFullToDrive,
  exportSpreadsheetToDrive,
  exportChangeLogsToDrive,
} from './utils/driveExport';
import {
  RowStatus,
  AppState,
  FieldStatus,
  FieldStatusType,
  MultiSheetGlossary,
  MultiSheetGlossaryConfig,
  GlossarySheetData,
  RfiComments,
  ModificationHistory,
  AnalystRemarks,
  AnomalyMap,
  FieldViewMode,
  BlacklistEntry,
  BlacklistEntryType,
  BlacklistMatchMode,
  BlacklistScope,
  DriveFile,
  DriveProjectMeta,
  DriveExportVariant,
  Anomaly,
  ContractLoadFailureMeta,
  ContractFailureCategory,
  ContractFailureOverrides,
  UnreadableTextMeta,
  RowReviewStatusMap,
  QueueView,
  FinalizedAction,
  NotApplicableReasonKey,
  NotApplicableMeta,
  HingesConfig,
  FlagMap,
  FlagCategory,
  FlagSeverity,
} from './types';
import { deriveRowReviewReason } from './utils/rowReviewLogic';
import { buildRfiComment } from './utils/contractFailureClassifier';
import { computeExtractionSuspectAnomaly } from './utils/extractionAnomalyDetection';
import { FlagModal } from './components/FlagModal';
import {
  createFlag,
  addFlag,
  removeFlag,
  clearFlagsForRow,
  migrateContractNotApplicableToFlags,
} from './utils/flagUtils';
import { Upload, BookOpen } from 'lucide-react';
import { storage } from './lib/storage';
import { QuickActionBar } from './components/QuickActionBar';
import { FilterType } from './components/GridSummaryBar';
import { FinalizedToast } from './components/FinalizedToast';
import { loadHingesConfig } from './config/hingesConfig';

interface GlossaryState {
  entries: MultiSheetGlossary;
  config: MultiSheetGlossaryConfig | null;
}

function App() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>({
    dataset: null,
    originalDataset: null,
    activeSheetName: '',
    currentRowIndex: 0,
    viewMode: 'grid',
    rowStatuses: {},
    fieldStatuses: {},
    glossary: {},
  });

  const [glossaryState, setGlossaryState] = useState<GlossaryState>({
    entries: {},
    config: null,
  });

  const [rfiComments, setRfiComments] = useState<RfiComments>({});
  const [modificationHistory, setModificationHistory] = useState<ModificationHistory>({});
  const [analystRemarks, setAnalystRemarks] = useState<AnalystRemarks>({});
  const [anomalyMap, setAnomalyMap] = useState<AnomalyMap>({});
  const [rowReviewStatuses, setRowReviewStatuses] = useState<RowReviewStatusMap>({});
  const [fieldViewMode, setFieldViewMode] = useState<FieldViewMode>('all');

  const [wizardState, setWizardState] = useState<{
    isOpen: boolean;
    sheets: GlossarySheetData[];
    fileName: string;
  }>({
    isOpen: false,
    sheets: [],
    fileName: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([]);
  const [showBlacklistManager, setShowBlacklistManager] = useState(false);
  const [blacklistQuickAddValue, setBlacklistQuickAddValue] = useState<string | null>(null);
  const [contractFailureOverrides, setContractFailureOverrides] = useState<ContractFailureOverrides>({});
  const [showParserDebug, setShowParserDebug] = useState(false);
  const [queueView, setQueueView] = useState<QueueView>('todo');
  const [activeQueueFilter, setActiveQueueFilter] = useState<FilterType>(null);
  const [undoStack, setUndoStack] = useState<FinalizedAction[]>([]);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [showReviewerDashboard, setShowReviewerDashboard] = useState(false);
  const [flagMap, setFlagMap] = useState<FlagMap>({});
  const [hingesConfig, setHingesConfig] = useState<HingesConfig>(() => loadHingesConfig());

  const isDesktop = useIsDesktop();
  const { accessToken, user } = useGoogleAuth();

  const [driveMeta, setDriveMeta] = useState<DriveProjectMeta | null>(null);
  const [isDriveExporting, setIsDriveExporting] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      try {
        await storage.init();

        const globalBlacklist = await storage.getAllBlacklistEntries();
        setBlacklistEntries(globalBlacklist);

        const project = await storage.getCurrentProject();

        if (project) {
          setCurrentProjectId(project.id);
          setAppState({
            dataset: project.currentDataset,
            originalDataset: project.originalDataset,
            activeSheetName: project.activeSheetName,
            currentRowIndex: project.currentRowIndex,
            viewMode: project.viewMode,
            rowStatuses: project.rowStatuses,
            fieldStatuses: project.fieldStatuses,
            glossary: {},
          });
          setRfiComments(project.rfiComments);
          setModificationHistory(project.modificationHistory || {});
          setAnalystRemarks(project.analystRemarks || {});
          setAnomalyMap(project.anomalyMap || {});
          setRowReviewStatuses(project.rowReviewStatuses || {});
          setContractFailureOverrides(project.contractFailureOverrides || {});
          setDriveMeta(project.driveMeta || null);
          setGlossaryState({
            entries: project.glossaryEntries || {},
            config: project.glossaryConfig,
          });

          let loadedFlags = project.flagMap || {};
          if (Object.keys(loadedFlags).length === 0 && project.anomalyMap) {
            loadedFlags = migrateContractNotApplicableToFlags(project.anomalyMap);
          }
          setFlagMap(loadedFlags);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    };

    loadProject();
  }, []);

  useEffect(() => {
    if (appState.dataset && glossaryState.entries) {
      const newAnomalies = computeDatasetAnomalies(
        appState.dataset.sheets,
        glossaryState.entries,
        blacklistEntries
      );
      setAnomalyMap(newAnomalies);
    }
  }, [appState.dataset, glossaryState.entries, blacklistEntries]);

  useEffect(() => {
    if (!appState.dataset || Object.keys(glossaryState.entries).length === 0) return;

    setAnomalyMap((prevAnomalies) => {
      const newAnomalies = { ...prevAnomalies };
      let changed = false;

      for (const sheet of appState.dataset!.sheets) {
        const sheetGlossary = glossaryState.entries[sheet.name];
        if (!sheetGlossary || Object.keys(sheetGlossary).length === 0) continue;

        const contractField = sheet.headers[1];
        if (!contractField) continue;

        for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
          const row = sheet.rows[rowIndex];
          const existingFieldAnomalies = newAnomalies[sheet.name]?.[rowIndex]?.[contractField] || [];
          const existingExtraction = existingFieldAnomalies.find((a) => a.type === 'contract_extraction_suspect');

          const newAnomaly = computeExtractionSuspectAnomaly(row, sheet.headers, sheetGlossary);

          if (!existingExtraction && newAnomaly) {
            if (!newAnomalies[sheet.name]) newAnomalies[sheet.name] = {};
            if (!newAnomalies[sheet.name][rowIndex]) newAnomalies[sheet.name][rowIndex] = {};
            const filtered = existingFieldAnomalies.filter((a) => a.type !== 'contract_extraction_suspect');
            newAnomalies[sheet.name][rowIndex][contractField] = [...filtered, newAnomaly];
            changed = true;
          } else if (existingExtraction && !newAnomaly) {
            if (!newAnomalies[sheet.name]) newAnomalies[sheet.name] = {};
            if (!newAnomalies[sheet.name][rowIndex]) newAnomalies[sheet.name][rowIndex] = {};
            newAnomalies[sheet.name][rowIndex][contractField] = existingFieldAnomalies.filter((a) => a.type !== 'contract_extraction_suspect');
            changed = true;
          }
        }
      }

      return changed ? newAnomalies : prevAnomalies;
    });
  }, [appState.dataset, glossaryState.entries]);

  useEffect(() => {
    if (!appState.dataset) return;

    const newReviewStatuses: RowReviewStatusMap = {};

    appState.dataset.sheets.forEach((sheet) => {
      newReviewStatuses[sheet.name] = {};

      for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
        const status = deriveRowReviewReason(
          sheet.name,
          rowIndex,
          sheet.headers,
          appState.fieldStatuses,
          anomalyMap,
          rfiComments,
          modificationHistory,
          appState.rowStatuses
        );
        newReviewStatuses[sheet.name][rowIndex] = status;
      }
    });

    setRowReviewStatuses(newReviewStatuses);
  }, [appState.dataset, appState.fieldStatuses, appState.rowStatuses, anomalyMap, rfiComments, modificationHistory]);

  useEffect(() => {
    const saveProject = async () => {
      if (currentProjectId && appState.dataset) {
        try {
          await storage.updateProject(currentProjectId, {
            currentDataset: appState.dataset,
            activeSheetName: appState.activeSheetName,
            currentRowIndex: appState.currentRowIndex,
            viewMode: appState.viewMode,
            rowStatuses: appState.rowStatuses,
            fieldStatuses: appState.fieldStatuses,
            rfiComments,
            modificationHistory,
            analystRemarks,
            anomalyMap,
            rowReviewStatuses,
            contractFailureOverrides,
            glossaryConfig: glossaryState.config,
            glossaryEntries: glossaryState.entries,
            driveMeta,
            flagMap,
          });
        } catch (err) {
          console.error('Failed to save project:', err);
        }
      }
    };

    const timeoutId = setTimeout(saveProject, 500);
    return () => clearTimeout(timeoutId);
  }, [currentProjectId, appState, rfiComments, modificationHistory, analystRemarks, anomalyMap, contractFailureOverrides, glossaryState, driveMeta, flagMap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!appState.dataset || wizardState.isOpen) return;

      const activeSheet = appState.dataset.sheets.find((s) => s.name === appState.activeSheetName);
      if (!activeSheet) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (appState.currentRowIndex > 0) {
          setAppState((prev) => ({ ...prev, currentRowIndex: prev.currentRowIndex - 1 }));
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (appState.currentRowIndex < activeSheet.rows.length - 1) {
          setAppState((prev) => ({ ...prev, currentRowIndex: prev.currentRowIndex + 1 }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, wizardState.isOpen]);

  const handleFileSelect = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const { dataset, originalDataset, modificationHistory: importModifications } = await parseFileWithNormalization(file);
      const firstSheetName = dataset.sheets[0]?.name || '';

      const newRowStatuses: RowStatus = {};
      const newFieldStatuses: FieldStatus = {};

      dataset.sheets.forEach((sheet) => {
        newRowStatuses[sheet.name] = {};
        newFieldStatuses[sheet.name] = {};

        sheet.rows.forEach((_row, index) => {
          newRowStatuses[sheet.name][index] = 'incomplete';
          newFieldStatuses[sheet.name][index] = {};

          sheet.headers.slice(2).forEach((header) => {
            newFieldStatuses[sheet.name][index][header] = 'incomplete';
          });
        });
      });

      const initialAnomalies = computeDatasetAnomalies(dataset.sheets, {});

      const project = await storage.createProject(dataset, importModifications, initialAnomalies);

      await storage.updateProject(project.id, {
        originalDataset,
        rowStatuses: newRowStatuses,
        fieldStatuses: newFieldStatuses,
        activeSheetName: firstSheetName,
        viewMode: 'grid',
      });

      setCurrentProjectId(project.id);
      setAppState({
        dataset: project.currentDataset,
        originalDataset: project.originalDataset,
        activeSheetName: firstSheetName,
        currentRowIndex: 0,
        viewMode: 'grid',
        rowStatuses: newRowStatuses,
        fieldStatuses: newFieldStatuses,
        glossary: {},
      });
      setRfiComments({});
      setModificationHistory(importModifications);
      setAnalystRemarks({});
      setAnomalyMap(initialAnomalies);
      setFieldViewMode('all');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDriveFileSelect = useCallback(async (driveFile: DriveFile) => {
    if (!accessToken || !user?.email) {
      setError('Please connect to Google Drive first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const blob = await downloadFile(accessToken, driveFile.id, driveFile.mimeType);
      const fileName = driveFile.name.endsWith('.xlsx') ? driveFile.name : `${driveFile.name}.xlsx`;
      const { dataset, originalDataset, modificationHistory: importModifications } = await parseBlob(blob, fileName);
      const firstSheetName = dataset.sheets[0]?.name || '';

      const folders = await createProjectFolderStructure(accessToken, driveFile.name);
      const newDriveMeta = buildDriveProjectMeta(user.email, driveFile, folders);

      const newRowStatuses: RowStatus = {};
      const newFieldStatuses: FieldStatus = {};

      dataset.sheets.forEach((sheet) => {
        newRowStatuses[sheet.name] = {};
        newFieldStatuses[sheet.name] = {};

        sheet.rows.forEach((_row, index) => {
          newRowStatuses[sheet.name][index] = 'incomplete';
          newFieldStatuses[sheet.name][index] = {};

          sheet.headers.slice(2).forEach((header) => {
            newFieldStatuses[sheet.name][index][header] = 'incomplete';
          });
        });
      });

      const initialAnomalies = computeDatasetAnomalies(dataset.sheets, {});

      const project = await storage.createProject(dataset, importModifications, initialAnomalies, newDriveMeta);

      await storage.updateProject(project.id, {
        originalDataset,
        rowStatuses: newRowStatuses,
        fieldStatuses: newFieldStatuses,
        activeSheetName: firstSheetName,
        viewMode: 'grid',
      });

      setCurrentProjectId(project.id);
      setAppState({
        dataset: project.currentDataset,
        originalDataset: project.originalDataset,
        activeSheetName: firstSheetName,
        currentRowIndex: 0,
        viewMode: 'grid',
        rowStatuses: newRowStatuses,
        fieldStatuses: newFieldStatuses,
        glossary: {},
      });
      setRfiComments({});
      setModificationHistory(importModifications);
      setAnalystRemarks({});
      setAnomalyMap(initialAnomalies);
      setDriveMeta(newDriveMeta);
      setFieldViewMode('all');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import from Drive');
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.email]);

  const handleDriveExport = useCallback(async (variant: DriveExportVariant, type: 'full' | 'spreadsheet' | 'logs') => {
    if (!accessToken || !driveMeta || !appState.dataset || !appState.originalDataset) {
      setError('Cannot export: Drive not connected or no data loaded');
      return;
    }

    setIsDriveExporting(true);
    setError(null);

    try {
      let result;

      if (type === 'full') {
        result = await exportFullToDrive(
          accessToken,
          driveMeta,
          appState.dataset,
          appState.originalDataset,
          appState.rowStatuses,
          appState.fieldStatuses,
          rfiComments,
          modificationHistory,
          anomalyMap,
          analystRemarks,
          variant
        );
      } else if (type === 'spreadsheet') {
        result = await exportSpreadsheetToDrive(
          accessToken,
          driveMeta,
          appState.dataset,
          appState.rowStatuses,
          appState.fieldStatuses,
          appState.originalDataset,
          rfiComments,
          modificationHistory,
          anomalyMap,
          variant
        );
      } else {
        result = await exportChangeLogsToDrive(
          accessToken,
          driveMeta,
          appState.dataset,
          appState.rowStatuses,
          appState.fieldStatuses,
          rfiComments,
          modificationHistory,
          anomalyMap,
          analystRemarks,
          variant
        );
      }

      if (result.success) {
        const updatedMeta: DriveProjectMeta = {
          ...driveMeta,
          lastExportAt: new Date().toISOString(),
          sourceCopied: true,
        };
        setDriveMeta(updatedMeta);
      } else {
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export to Drive');
    } finally {
      setIsDriveExporting(false);
    }
  }, [accessToken, driveMeta, appState.dataset, appState.originalDataset, appState.rowStatuses, appState.fieldStatuses, rfiComments, modificationHistory, anomalyMap, analystRemarks]);

  const calculateRowStatus = useCallback((
    sheetName: string,
    rowIndex: number,
    fieldStatuses: FieldStatus
  ): 'complete' | 'incomplete' => {
    const rowFields = fieldStatuses[sheetName]?.[rowIndex];
    if (!rowFields) return 'incomplete';

    const allFieldStatuses = Object.values(rowFields);
    if (allFieldStatuses.length === 0) return 'incomplete';

    return allFieldStatuses.every((status) => status === 'complete') ? 'complete' : 'incomplete';
  }, []);

  const handleFieldStatusChange = useCallback((
    fieldName: string,
    status: FieldStatusType
  ) => {
    setAppState((prev) => {
      if (!prev.dataset) return prev;

      const newFieldStatuses = { ...prev.fieldStatuses };
      if (!newFieldStatuses[prev.activeSheetName]) {
        newFieldStatuses[prev.activeSheetName] = {};
      }
      if (!newFieldStatuses[prev.activeSheetName][prev.currentRowIndex]) {
        newFieldStatuses[prev.activeSheetName][prev.currentRowIndex] = {};
      }

      newFieldStatuses[prev.activeSheetName][prev.currentRowIndex][fieldName] = status;

      const newRowStatuses = { ...prev.rowStatuses };
      if (!newRowStatuses[prev.activeSheetName]) {
        newRowStatuses[prev.activeSheetName] = {};
      }
      newRowStatuses[prev.activeSheetName][prev.currentRowIndex] = calculateRowStatus(
        prev.activeSheetName,
        prev.currentRowIndex,
        newFieldStatuses
      );

      return { ...prev, fieldStatuses: newFieldStatuses, rowStatuses: newRowStatuses };
    });
  }, [calculateRowStatus]);

  const handleRfiCommentChange = useCallback((fieldName: string, comment: string | null) => {
    setRfiComments((prev) => {
      const newComments = { ...prev };
      if (!newComments[appState.activeSheetName]) {
        newComments[appState.activeSheetName] = {};
      }
      if (!newComments[appState.activeSheetName][appState.currentRowIndex]) {
        newComments[appState.activeSheetName][appState.currentRowIndex] = {};
      }

      if (comment === null) {
        delete newComments[appState.activeSheetName][appState.currentRowIndex][fieldName];
      } else {
        newComments[appState.activeSheetName][appState.currentRowIndex][fieldName] = comment;
      }

      return newComments;
    });
  }, [appState.activeSheetName, appState.currentRowIndex]);

  const handleGlossaryUpload = useCallback(async (file: File) => {
    try {
      const sheets = await parseGlossaryXLSX(file);
      setWizardState({
        isOpen: true,
        sheets,
        fileName: file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse glossary file');
    }
  }, []);

  const handleGlossaryWizardComplete = useCallback((
    entries: MultiSheetGlossary,
    config: MultiSheetGlossaryConfig
  ) => {
    setGlossaryState({
      entries,
      config,
    });

    setWizardState({
      isOpen: false,
      sheets: [],
      fileName: '',
    });
  }, []);

  const handleGlossaryWizardCancel = useCallback(() => {
    setWizardState({
      isOpen: false,
      sheets: [],
      fileName: '',
    });
  }, []);

  const handleGlossaryRemove = useCallback(() => {
    if (window.confirm('Remove the current glossary?')) {
      setGlossaryState({
        entries: {},
        config: null,
      });
    }
  }, []);

  const allEditableHeaders = useMemo(() => {
    if (!appState.dataset) return [];
    const headers = new Set<string>();
    appState.dataset.sheets.forEach((sheet) => {
      sheet.headers.slice(2).forEach((h) => headers.add(h));
    });
    return Array.from(headers).sort();
  }, [appState.dataset]);

  const handleBlacklistAdd = useCallback(async (
    value: string,
    type: BlacklistEntryType,
    matchMode: BlacklistMatchMode,
    scope: BlacklistScope,
    fields: string[]
  ) => {
    try {
      const newEntry = await storage.createBlacklistEntry(value, type, matchMode, scope, fields);
      setBlacklistEntries((prev) => [...prev, newEntry]);
      setBlacklistQuickAddValue(null);
    } catch (err) {
      console.error('Failed to add blacklist entry:', err);
    }
  }, []);

  const handleBlacklistUpdate = useCallback(async (
    id: string,
    updates: Partial<BlacklistEntry>
  ) => {
    try {
      await storage.updateBlacklistEntry(id, updates);
      const updatedEntries = await storage.getAllBlacklistEntries();
      setBlacklistEntries(updatedEntries);
    } catch (err) {
      console.error('Failed to update blacklist entry:', err);
    }
  }, []);

  const handleBlacklistDelete = useCallback(async (id: string) => {
    try {
      await storage.deleteBlacklistEntry(id);
      setBlacklistEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete blacklist entry:', err);
    }
  }, []);

  const handleBlacklistToggle = useCallback(async (id: string) => {
    try {
      await storage.toggleBlacklistEntry(id);
      const updatedEntries = await storage.getAllBlacklistEntries();
      setBlacklistEntries(updatedEntries);
    } catch (err) {
      console.error('Failed to toggle blacklist entry:', err);
    }
  }, []);

  const handleOpenBlacklistManager = useCallback(() => {
    setShowBlacklistManager(true);
  }, []);

  const handleCloseBlacklistManager = useCallback(() => {
    setShowBlacklistManager(false);
    setBlacklistQuickAddValue(null);
  }, []);

  const handleQuickAddToBlacklist = useCallback((value: string) => {
    setBlacklistQuickAddValue(value);
    setShowBlacklistManager(true);
  }, []);

  const handleSheetChange = useCallback((sheetName: string) => {
    setAppState((prev) => ({
      ...prev,
      activeSheetName: sheetName,
      currentRowIndex: 0,
    }));
  }, []);

  const handleViewModeChange = useCallback((mode: 'single' | 'grid') => {
    setAppState((prev) => ({ ...prev, viewMode: mode }));
  }, []);

  const handleFieldViewModeChange = useCallback((mode: FieldViewMode) => {
    setFieldViewMode(mode);
  }, []);

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setAppState((prev) => {
      if (!prev.dataset) return prev;

      const newDataset = { ...prev.dataset };
      const sheet = newDataset.sheets.find((s) => s.name === prev.activeSheetName);
      if (sheet && sheet.rows[prev.currentRowIndex]) {
        const originalSheet = prev.originalDataset?.sheets.find((s) => s.name === prev.activeSheetName);
        const originalValue = originalSheet?.rows[prev.currentRowIndex]?.[fieldName];
        const currentValue = sheet.rows[prev.currentRowIndex][fieldName];

        if (currentValue !== value) {
          setModificationHistory((prevHistory) => {
            const newHistory = { ...prevHistory };
            if (!newHistory[prev.activeSheetName]) {
              newHistory[prev.activeSheetName] = {};
            }
            if (!newHistory[prev.activeSheetName][prev.currentRowIndex]) {
              newHistory[prev.activeSheetName][prev.currentRowIndex] = {};
            }

            const existingMod = newHistory[prev.activeSheetName][prev.currentRowIndex][fieldName];
            const baseOriginal = existingMod?.originalValue ?? originalValue ?? currentValue;

            if (String(baseOriginal) === value) {
              delete newHistory[prev.activeSheetName][prev.currentRowIndex][fieldName];
            } else {
              newHistory[prev.activeSheetName][prev.currentRowIndex][fieldName] = {
                originalValue: baseOriginal,
                newValue: value,
                timestamp: new Date().toISOString(),
                modificationType: 'manual_edit',
                reason: 'Manual edit by user',
              };
            }

            return newHistory;
          });
        }

        sheet.rows[prev.currentRowIndex][fieldName] = value;
      }

      return { ...prev, dataset: newDataset };
    });
  }, []);

  const handleRowStatusChange = useCallback((status: 'complete' | 'incomplete') => {
    setAppState((prev) => {
      if (!prev.dataset) return prev;

      const sheet = prev.dataset.sheets.find((s) => s.name === prev.activeSheetName);
      if (!sheet) return prev;

      const newRowStatuses = { ...prev.rowStatuses };
      if (!newRowStatuses[prev.activeSheetName]) {
        newRowStatuses[prev.activeSheetName] = {};
      }
      newRowStatuses[prev.activeSheetName][prev.currentRowIndex] = status;

      const newFieldStatuses = { ...prev.fieldStatuses };
      if (!newFieldStatuses[prev.activeSheetName]) {
        newFieldStatuses[prev.activeSheetName] = {};
      }
      if (!newFieldStatuses[prev.activeSheetName][prev.currentRowIndex]) {
        newFieldStatuses[prev.activeSheetName][prev.currentRowIndex] = {};
      }

      const fieldHeaders = sheet.headers.slice(2);
      fieldHeaders.forEach((header) => {
        newFieldStatuses[prev.activeSheetName][prev.currentRowIndex][header] = status;
      });

      return { ...prev, rowStatuses: newRowStatuses, fieldStatuses: newFieldStatuses };
    });
  }, []);

  const handleStatusToggle = useCallback((rowIndex: number, status: 'complete' | 'incomplete') => {
    const previousStatus = appState.rowStatuses[appState.activeSheetName]?.[rowIndex] || 'incomplete';

    if (status === 'complete' && previousStatus !== 'complete') {
      const action: FinalizedAction = {
        sheetName: appState.activeSheetName,
        rowIndex,
        previousStatus,
        timestamp: Date.now(),
      };
      setUndoStack((prev) => [...prev.slice(-4), action]);
    }

    setAppState((prev) => {
      const newRowStatuses = { ...prev.rowStatuses };
      if (!newRowStatuses[prev.activeSheetName]) {
        newRowStatuses[prev.activeSheetName] = {};
      }
      newRowStatuses[prev.activeSheetName][rowIndex] = status;
      return { ...prev, rowStatuses: newRowStatuses };
    });
  }, [appState.activeSheetName, appState.rowStatuses]);

  const handleUndoFinalize = useCallback((action: FinalizedAction) => {
    setAppState((prev) => {
      const newRowStatuses = { ...prev.rowStatuses };
      if (!newRowStatuses[action.sheetName]) {
        newRowStatuses[action.sheetName] = {};
      }
      newRowStatuses[action.sheetName][action.rowIndex] = action.previousStatus;
      return { ...prev, rowStatuses: newRowStatuses };
    });
    setUndoStack((prev) => prev.filter((a) => a.timestamp !== action.timestamp));
  }, []);

  const handleDismissFinalize = useCallback((action: FinalizedAction) => {
    setUndoStack((prev) => prev.filter((a) => a.timestamp !== action.timestamp));
  }, []);

  const handlePrevious = useCallback(() => {
    setAppState((prev) => ({
      ...prev,
      currentRowIndex: Math.max(0, prev.currentRowIndex - 1),
    }));
  }, []);

  const handleNext = useCallback(() => {
    setAppState((prev) => {
      if (!prev.dataset) return prev;
      const sheet = prev.dataset.sheets.find((s) => s.name === prev.activeSheetName);
      if (!sheet) return prev;
      return {
        ...prev,
        currentRowIndex: Math.min(sheet.rows.length - 1, prev.currentRowIndex + 1),
      };
    });
  }, []);

  const handleRowSelect = useCallback((rowIndex: number) => {
    setAppState((prev) => ({ ...prev, currentRowIndex: rowIndex, viewMode: 'single' }));
  }, []);

  const handleOpenContractModal = useCallback(() => {
    setIsContractModalOpen(true);
  }, []);

  const handleCloseContractModal = useCallback(() => {
    setIsContractModalOpen(false);
  }, []);

  const handleContractChange = useCallback((newUrl: string) => {
    setAppState((prev) => {
      if (!prev.dataset) return prev;

      const newDataset = { ...prev.dataset };
      const sheet = newDataset.sheets.find((s) => s.name === prev.activeSheetName);
      if (sheet && sheet.rows[prev.currentRowIndex] && sheet.headers[1]) {
        sheet.rows[prev.currentRowIndex][sheet.headers[1]] = newUrl;
      }

      return { ...prev, dataset: newDataset };
    });
  }, []);

  const handleContractLoadError = useCallback((error: {
    code: string;
    message: string;
    fileSize?: number;
    httpStatus?: number;
    failureMeta?: ContractLoadFailureMeta;
  }) => {
    const sheet = appState.dataset?.sheets.find((s) => s.name === appState.activeSheetName);
    if (!sheet) return;

    const contractField = sheet.headers[1];
    if (!contractField) return;

    const failureMeta = error.failureMeta;

    const contractAnomaly: Anomaly = {
      type: 'contract_load_error',
      severity: 'warn',
      message: failureMeta?.message || error.message,
      contractErrorCode: error.code as Anomaly['contractErrorCode'],
      contractFileSize: error.fileSize,
      failureMeta,
    };

    setAnomalyMap((prev) => {
      const newMap = { ...prev };
      if (!newMap[appState.activeSheetName]) {
        newMap[appState.activeSheetName] = {};
      }
      if (!newMap[appState.activeSheetName][appState.currentRowIndex]) {
        newMap[appState.activeSheetName][appState.currentRowIndex] = {};
      }

      const existingAnomalies = newMap[appState.activeSheetName][appState.currentRowIndex][contractField] || [];
      const filteredAnomalies = existingAnomalies.filter((a) => a.type !== 'contract_load_error');
      newMap[appState.activeSheetName][appState.currentRowIndex][contractField] = [
        ...filteredAnomalies,
        contractAnomaly,
      ];

      return newMap;
    });

    setAppState((prev) => {
      const newFieldStatuses = { ...prev.fieldStatuses };
      if (!newFieldStatuses[prev.activeSheetName]) {
        newFieldStatuses[prev.activeSheetName] = {};
      }
      if (!newFieldStatuses[prev.activeSheetName][prev.currentRowIndex]) {
        newFieldStatuses[prev.activeSheetName][prev.currentRowIndex] = {};
      }

      const currentStatus = newFieldStatuses[prev.activeSheetName][prev.currentRowIndex][contractField];
      if (currentStatus !== 'rfi') {
        newFieldStatuses[prev.activeSheetName][prev.currentRowIndex][contractField] = 'rfi';
      }

      return { ...prev, fieldStatuses: newFieldStatuses };
    });

    setRfiComments((prev) => {
      const existingComment = prev[appState.activeSheetName]?.[appState.currentRowIndex]?.[contractField];
      if (existingComment) return prev;

      const rfiMessage = failureMeta
        ? buildRfiComment(failureMeta)
        : `[AUTO] Contract load failed\nError: ${error.code}\nAction: Try "Open in New Tab"`;

      const newComments = { ...prev };
      if (!newComments[appState.activeSheetName]) {
        newComments[appState.activeSheetName] = {};
      }
      if (!newComments[appState.activeSheetName][appState.currentRowIndex]) {
        newComments[appState.activeSheetName][appState.currentRowIndex] = {};
      }
      newComments[appState.activeSheetName][appState.currentRowIndex][contractField] = rfiMessage;

      return newComments;
    });
  }, [appState.dataset, appState.activeSheetName, appState.currentRowIndex]);

  const handleContractFailureOverride = useCallback((
    category: ContractFailureCategory,
    overrideReason?: string
  ) => {
    setContractFailureOverrides((prev) => {
      const newOverrides = { ...prev };
      if (!newOverrides[appState.activeSheetName]) {
        newOverrides[appState.activeSheetName] = {};
      }
      newOverrides[appState.activeSheetName][appState.currentRowIndex] = {
        category,
        overrideReason,
        overriddenAt: new Date().toISOString(),
      };
      return newOverrides;
    });

    setAnomalyMap((prev) => {
      const sheet = appState.dataset?.sheets.find((s) => s.name === appState.activeSheetName);
      if (!sheet) return prev;

      const contractField = sheet.headers[1];
      if (!contractField) return prev;

      const newMap = { ...prev };
      const existingAnomalies = newMap[appState.activeSheetName]?.[appState.currentRowIndex]?.[contractField] || [];
      const contractErrorAnomaly = existingAnomalies.find((a) => a.type === 'contract_load_error');

      if (contractErrorAnomaly?.failureMeta) {
        const updatedAnomaly: Anomaly = {
          ...contractErrorAnomaly,
          failureMeta: {
            ...contractErrorAnomaly.failureMeta,
            category,
            overridden: true,
            overrideReason,
          },
        };

        if (!newMap[appState.activeSheetName]) {
          newMap[appState.activeSheetName] = {};
        }
        if (!newMap[appState.activeSheetName][appState.currentRowIndex]) {
          newMap[appState.activeSheetName][appState.currentRowIndex] = {};
        }

        newMap[appState.activeSheetName][appState.currentRowIndex][contractField] = existingAnomalies.map((a) =>
          a.type === 'contract_load_error' ? updatedAnomaly : a
        );
      }

      return newMap;
    });
  }, [appState.dataset, appState.activeSheetName, appState.currentRowIndex]);

  const handleUnreadableTextDetected = useCallback((meta: UnreadableTextMeta) => {
    const sheet = appState.dataset?.sheets.find((s) => s.name === appState.activeSheetName);
    if (!sheet) return;

    const contractField = sheet.headers[1];
    if (!contractField) return;

    const unreadableAnomaly: Anomaly = {
      type: 'contract_text_unreadable',
      severity: 'warn',
      message: `PDF text layer may be unreadable: ${meta.attemptedTerms} field values searched, ${meta.totalMatches} matches found`,
      unreadableTextMeta: meta,
    };

    setAnomalyMap((prev) => {
      const newMap = { ...prev };
      if (!newMap[appState.activeSheetName]) {
        newMap[appState.activeSheetName] = {};
      }
      if (!newMap[appState.activeSheetName][appState.currentRowIndex]) {
        newMap[appState.activeSheetName][appState.currentRowIndex] = {};
      }

      const existingAnomalies = newMap[appState.activeSheetName][appState.currentRowIndex][contractField] || [];
      const filteredAnomalies = existingAnomalies.filter((a) => a.type !== 'contract_text_unreadable');
      newMap[appState.activeSheetName][appState.currentRowIndex][contractField] = [
        ...filteredAnomalies,
        unreadableAnomaly,
      ];

      return newMap;
    });

    setAppState((prev) => {
      const newFieldStatuses = { ...prev.fieldStatuses };
      if (!newFieldStatuses[prev.activeSheetName]) {
        newFieldStatuses[prev.activeSheetName] = {};
      }
      if (!newFieldStatuses[prev.activeSheetName][prev.currentRowIndex]) {
        newFieldStatuses[prev.activeSheetName][prev.currentRowIndex] = {};
      }

      const currentStatus = newFieldStatuses[prev.activeSheetName][prev.currentRowIndex][contractField];
      if (currentStatus !== 'rfi') {
        newFieldStatuses[prev.activeSheetName][prev.currentRowIndex][contractField] = 'rfi';
      }

      return { ...prev, fieldStatuses: newFieldStatuses };
    });

    setRfiComments((prev) => {
      const existingComment = prev[appState.activeSheetName]?.[appState.currentRowIndex]?.[contractField];
      if (existingComment) return prev;

      const rfiMessage = `[AUTO] Unreadable PDF Text Layer\nTerms searched: ${meta.attemptedTerms}\nMatches found: 0\nAction: Verify PDF text is selectable. Consider re-scanning or OCR.`;

      const newComments = { ...prev };
      if (!newComments[appState.activeSheetName]) {
        newComments[appState.activeSheetName] = {};
      }
      if (!newComments[appState.activeSheetName][appState.currentRowIndex]) {
        newComments[appState.activeSheetName][appState.currentRowIndex] = {};
      }
      newComments[appState.activeSheetName][appState.currentRowIndex][contractField] = rfiMessage;

      return newComments;
    });
  }, [appState.dataset, appState.activeSheetName, appState.currentRowIndex]);

  const handleAddFlag = useCallback((
    category: FlagCategory,
    reason: string | null,
    comment: string | null,
    severity: FlagSeverity
  ) => {
    const sheet = appState.dataset?.sheets.find((s) => s.name === appState.activeSheetName);
    if (!sheet) return;

    const contractUrl = String(sheet.rows[appState.currentRowIndex]?.[sheet.headers[1]] || '');

    const flag = createFlag(
      appState.activeSheetName,
      appState.currentRowIndex,
      category,
      reason,
      comment,
      severity,
      contractUrl
    );

    setFlagMap((prev) => addFlag(prev, flag));

    if (category === 'data_mgmt' && (reason === 'Wrong document type in this dataset' || reason === 'Not in scope')) {
      const contractField = sheet.headers[1];
      if (contractField) {
        const meta: NotApplicableMeta = {
          decision: 'not_applicable',
          confidence: 'manual',
          reasonKey: reason === 'Wrong document type in this dataset' ? 'wrong_doc_type' : 'not_in_scope',
          freeText: comment || undefined,
          timestampISO: new Date().toISOString(),
        };

        const notApplicableAnomaly: Anomaly = {
          type: 'contract_not_applicable',
          severity: 'warn',
          message: `Document flagged: ${reason}${comment ? ` - ${comment}` : ''}`,
          notApplicableMeta: meta,
        };

        setAnomalyMap((prev) => {
          const newMap = { ...prev };
          if (!newMap[appState.activeSheetName]) {
            newMap[appState.activeSheetName] = {};
          }
          if (!newMap[appState.activeSheetName][appState.currentRowIndex]) {
            newMap[appState.activeSheetName][appState.currentRowIndex] = {};
          }

          const existingAnomalies = newMap[appState.activeSheetName][appState.currentRowIndex][contractField] || [];
          const filteredAnomalies = existingAnomalies.filter((a) => a.type !== 'contract_not_applicable');
          newMap[appState.activeSheetName][appState.currentRowIndex][contractField] = [
            ...filteredAnomalies,
            notApplicableAnomaly,
          ];

          return newMap;
        });
      }
    }

    setIsFlagModalOpen(false);
  }, [appState.dataset, appState.activeSheetName, appState.currentRowIndex]);

  const handleClearFlags = useCallback(() => {
    setFlagMap((prev) => clearFlagsForRow(prev, appState.activeSheetName, appState.currentRowIndex));
  }, [appState.activeSheetName, appState.currentRowIndex]);

  const handleRemoveFlag = useCallback((flagId: string) => {
    setFlagMap((prev) => removeFlag(prev, appState.activeSheetName, appState.currentRowIndex, flagId));
  }, [appState.activeSheetName, appState.currentRowIndex]);

  const handleClearSession = useCallback(async () => {
    if (window.confirm('Clear all progress and start over?')) {
      try {
        if (currentProjectId) {
          await storage.deleteProject(currentProjectId);
        }
        setCurrentProjectId(null);
        setAppState({
          dataset: null,
          originalDataset: null,
          activeSheetName: '',
          currentRowIndex: 0,
          viewMode: 'grid',
          rowStatuses: {},
          fieldStatuses: {},
          glossary: {},
        });
        setRfiComments({});
        setModificationHistory({});
        setAnalystRemarks({});
        setAnomalyMap({});
        setContractFailureOverrides({});
        setFieldViewMode('all');
        setFlagMap({});
        setGlossaryState({
          entries: {},
          config: null,
        });
        setError(null);
      } catch (err) {
        console.error('Failed to clear session:', err);
        setError('Failed to clear session');
      }
    }
  }, [currentProjectId]);

  const glossaryEntryCount = Object.values(glossaryState.entries).reduce(
    (sum, sheetEntries) => sum + Object.keys(sheetEntries).length,
    0
  );

  const changeMap = useMemo(() => {
    return generateChangeMap(appState.originalDataset, appState.dataset);
  }, [appState.originalDataset, appState.dataset]);

  if (!appState.dataset) {
    return (
      <div className="relative">
        <FileUpload
          onFileSelect={handleFileSelect}
          onDriveFileSelect={handleDriveFileSelect}
          loading={loading}
        />

        {error && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg max-w-md z-50">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs mt-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="fixed bottom-6 right-6 z-50">
          {glossaryState.config ? (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm text-sm">
              <BookOpen className="w-4 h-4 text-teal-600" />
              <span className="text-slate-700">
                Glossary: <span className="font-medium">{glossaryEntryCount}</span> entries
              </span>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-sm hover:bg-white rounded-lg border border-slate-200 shadow-sm text-sm font-medium text-slate-600 cursor-pointer transition-all hover:shadow-md">
              <Upload className="w-4 h-4" />
              Upload Glossary
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleGlossaryUpload(file);
                  e.target.value = '';
                }}
                hidden
              />
            </label>
          )}
        </div>
      </div>
    );
  }

  const activeSheet = appState.dataset.sheets.find((s) => s.name === appState.activeSheetName);
  const currentRow = activeSheet?.rows[appState.currentRowIndex];

  if (!activeSheet || !currentRow) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  const contractSource = String(currentRow[activeSheet.headers[1]] || '');

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar
        dataset={appState.dataset}
        originalDataset={appState.originalDataset}
        activeSheetName={appState.activeSheetName}
        onSheetChange={handleSheetChange}
        viewMode={appState.viewMode}
        onViewModeChange={handleViewModeChange}
        rowStatuses={appState.rowStatuses}
        fieldStatuses={appState.fieldStatuses}
        rfiComments={rfiComments}
        modificationHistory={modificationHistory}
        anomalyMap={anomalyMap}
        glossaryConfig={glossaryState.config}
        driveMeta={driveMeta}
        onDriveExport={handleDriveExport}
        isDriveExporting={isDriveExporting}
        rowReviewStatuses={rowReviewStatuses}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <QuickActionBar
          onGlossaryUpload={handleGlossaryUpload}
          onOpenBlacklistManager={handleOpenBlacklistManager}
          onOpenReviewerDashboard={() => setShowReviewerDashboard(true)}
          glossaryLoaded={!!glossaryState.config}
          canFlag={appState.viewMode === 'single'}
          onFlag={() => setIsFlagModalOpen(true)}
        />

        {appState.viewMode === 'single' && (
          <>
            <RowHeader
              dataset={appState.dataset}
              activeSheetName={appState.activeSheetName}
              currentRowIndex={appState.currentRowIndex}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onRowStatusChange={handleRowStatusChange}
              rowStatuses={appState.rowStatuses}
              rowReviewStatuses={rowReviewStatuses}
              onOpenContract={handleOpenContractModal}
              showContractButton={!isDesktop}
              onBackToGrid={() => handleViewModeChange('grid')}
            />

            {isDesktop ? (
              <SplitView
                leftPanel={
                  <FieldsEditor
                    dataset={appState.dataset}
                    activeSheetName={appState.activeSheetName}
                    currentRowIndex={appState.currentRowIndex}
                    onFieldChange={handleFieldChange}
                    fieldStatuses={appState.fieldStatuses}
                    onFieldStatusChange={handleFieldStatusChange}
                    glossary={getGlossaryForSheet(glossaryState.entries, appState.activeSheetName)}
                    rfiComments={rfiComments}
                    onRfiCommentChange={handleRfiCommentChange}
                    changeMap={changeMap}
                    modificationHistory={modificationHistory}
                    anomalyMap={anomalyMap}
                    viewMode={fieldViewMode}
                    onViewModeChange={handleFieldViewModeChange}
                    onQuickAddToBlacklist={handleQuickAddToBlacklist}
                    hingesConfig={hingesConfig}
                  />
                }
                rightPanel={
                  <ContractViewer
                    source={contractSource}
                    onContractChange={handleContractChange}
                    sheetName={appState.activeSheetName}
                    rowIndex={appState.currentRowIndex}
                    headers={activeSheet.headers}
                    currentRow={currentRow}
                    fieldStatuses={appState.fieldStatuses[appState.activeSheetName]?.[appState.currentRowIndex]}
                    onFieldStatusChange={handleFieldStatusChange}
                    onContractLoadError={handleContractLoadError}
                    anomalyMap={anomalyMap}
                    failureOverride={contractFailureOverrides[appState.activeSheetName]?.[appState.currentRowIndex]}
                    onFailureCategoryOverride={handleContractFailureOverride}
                    onUnreadableTextDetected={handleUnreadableTextDetected}
                    glossary={getGlossaryForSheet(glossaryState.entries, appState.activeSheetName)}
                  />
                }
                hasContract={!!contractSource.trim()}
                onOpenContractModal={handleOpenContractModal}
              />
            ) : (
              <div className="flex-1 overflow-hidden">
                <FieldsEditor
                  dataset={appState.dataset}
                  activeSheetName={appState.activeSheetName}
                  currentRowIndex={appState.currentRowIndex}
                  onFieldChange={handleFieldChange}
                  fieldStatuses={appState.fieldStatuses}
                  onFieldStatusChange={handleFieldStatusChange}
                  glossary={getGlossaryForSheet(glossaryState.entries, appState.activeSheetName)}
                  rfiComments={rfiComments}
                  onRfiCommentChange={handleRfiCommentChange}
                  changeMap={changeMap}
                  modificationHistory={modificationHistory}
                  anomalyMap={anomalyMap}
                  viewMode={fieldViewMode}
                  onViewModeChange={handleFieldViewModeChange}
                  onQuickAddToBlacklist={handleQuickAddToBlacklist}
                  hingesConfig={hingesConfig}
                />
              </div>
            )}
          </>
        )}

        {appState.viewMode === 'grid' && (
          <DataGrid
            dataset={appState.dataset}
            activeSheetName={appState.activeSheetName}
            onRowSelect={handleRowSelect}
            onStatusToggle={handleStatusToggle}
            rowStatuses={appState.rowStatuses}
            fieldStatuses={appState.fieldStatuses}
            changeMap={changeMap}
            modificationHistory={modificationHistory}
            rfiComments={rfiComments}
            anomalyMap={anomalyMap}
            rowReviewStatuses={rowReviewStatuses}
            showDebugOverlay={showParserDebug}
            queueView={queueView}
            onQueueViewChange={setQueueView}
            activeFilter={activeQueueFilter}
            onFilterChange={setActiveQueueFilter}
          />
        )}
      </div>

      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg max-w-md z-50">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs mt-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <FinalizedToast
        actions={undoStack}
        onUndo={handleUndoFinalize}
        onDismiss={handleDismissFinalize}
      />

      <div className="fixed bottom-6 right-6 space-y-2">
        {import.meta.env.DEV && (
          <button
            onClick={() => setShowParserDebug((prev) => !prev)}
            className={`block w-32 text-center px-3 py-2 text-xs rounded-lg transition-colors ${
              showParserDebug
                ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                : 'bg-slate-600 text-white hover:bg-slate-700'
            }`}
          >
            {showParserDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        )}
        <button
          onClick={handleClearSession}
          className="block w-32 text-center px-3 py-2 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Clear Session
        </button>
      </div>

      {wizardState.isOpen && appState.dataset && (
        <GlossaryWizard
          glossarySheets={wizardState.sheets}
          contractSheets={appState.dataset.sheets}
          fileName={wizardState.fileName}
          onComplete={handleGlossaryWizardComplete}
          onCancel={handleGlossaryWizardCancel}
        />
      )}

      <ContractModal
        isOpen={isContractModalOpen}
        onClose={handleCloseContractModal}
        source={contractSource}
        onContractChange={handleContractChange}
        sheetName={appState.activeSheetName}
        rowIndex={appState.currentRowIndex}
        headers={activeSheet.headers}
        currentRow={currentRow}
        fieldStatuses={appState.fieldStatuses[appState.activeSheetName]?.[appState.currentRowIndex]}
        onFieldStatusChange={handleFieldStatusChange}
        onContractLoadError={handleContractLoadError}
        anomalyMap={anomalyMap}
        failureOverride={contractFailureOverrides[appState.activeSheetName]?.[appState.currentRowIndex]}
        onFailureCategoryOverride={handleContractFailureOverride}
        onUnreadableTextDetected={handleUnreadableTextDetected}
        glossary={getGlossaryForSheet(glossaryState.entries, appState.activeSheetName)}
      />

      <BlacklistManager
        isOpen={showBlacklistManager}
        onClose={handleCloseBlacklistManager}
        entries={blacklistEntries}
        onAdd={handleBlacklistAdd}
        onUpdate={handleBlacklistUpdate}
        onDelete={handleBlacklistDelete}
        onToggle={handleBlacklistToggle}
        availableFields={allEditableHeaders}
        prefillValue={blacklistQuickAddValue}
      />

      <FlagModal
        isOpen={isFlagModalOpen}
        onClose={() => setIsFlagModalOpen(false)}
        onConfirm={handleAddFlag}
        fileName={activeSheet?.rows[appState.currentRowIndex]?.[activeSheet.headers[1]] as string | undefined}
        sheetName={appState.activeSheetName}
        rowIndex={appState.currentRowIndex}
      />

      {showReviewerDashboard && (
        <ReviewerDashboard
          dataset={appState.dataset}
          anomalyMap={anomalyMap}
          rfiComments={rfiComments}
          fieldStatuses={appState.fieldStatuses}
          hingesConfig={hingesConfig}
          flagMap={flagMap}
          activeSheetName={appState.activeSheetName}
          onOpenRow={(sheetName, rowIndex) => {
            setAppState((prev) => ({
              ...prev,
              activeSheetName: sheetName,
              currentRowIndex: rowIndex,
              viewMode: 'single',
            }));
          }}
          onHingesConfigChange={setHingesConfig}
          onClose={() => setShowReviewerDashboard(false)}
        />
      )}
    </div>
  );
}

export default App;
