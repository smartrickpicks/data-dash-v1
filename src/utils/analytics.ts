import { Dataset, RowStatus, FieldStatus, RfiComments, ModificationHistory, AnomalyMap, RowReviewStatusMap } from '../types';
import { getRowAttention } from './attentionLogic';

export interface SheetAnalytics {
  totalRows: number;
  completedRows: number;
  progressPercent: number;
  rfiRowCount: number;
  systemChangeRowCount: number;
  manualEditRowCount: number;
  anomalyRowCount: number;
  blacklistHitRowCount: number;
  verifiedCellCount: number;
  totalEditableCells: number;
  rowsWithRfi: Set<number>;
  rowsWithSystemChanges: Set<number>;
  rowsWithManualEdits: Set<number>;
  rowsWithAnomalies: Set<number>;
  rowsWithBlacklistHits: Set<number>;
  rowsNeedingAttention: Set<number>;
  rowsWithManualReviewRequired: Set<number>;
  pendingReviewCount: number;
  manualPdfReviewCount: number;
  manualReviewRequiredCount: number;
  readyToFinalizeCount: number;
  finalizedCount: number;
}

export function computeSheetAnalytics(
  dataset: Dataset | null,
  sheetName: string,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap?: AnomalyMap,
  rowReviewStatuses?: RowReviewStatusMap
): SheetAnalytics {
  const emptyResult: SheetAnalytics = {
    totalRows: 0,
    completedRows: 0,
    progressPercent: 0,
    rfiRowCount: 0,
    systemChangeRowCount: 0,
    manualEditRowCount: 0,
    anomalyRowCount: 0,
    blacklistHitRowCount: 0,
    verifiedCellCount: 0,
    totalEditableCells: 0,
    rowsWithRfi: new Set(),
    rowsWithSystemChanges: new Set(),
    rowsWithManualEdits: new Set(),
    rowsWithAnomalies: new Set(),
    rowsWithBlacklistHits: new Set(),
    rowsNeedingAttention: new Set(),
    rowsWithManualReviewRequired: new Set(),
    pendingReviewCount: 0,
    manualPdfReviewCount: 0,
    manualReviewRequiredCount: 0,
    readyToFinalizeCount: 0,
    finalizedCount: 0,
  };

  if (!dataset) return emptyResult;

  const sheet = dataset.sheets.find((s) => s.name === sheetName);
  if (!sheet) return emptyResult;

  const totalRows = sheet.rows.length;
  const editableHeaders = sheet.headers.slice(2);
  const totalEditableCells = totalRows * editableHeaders.length;

  const sheetRowStatuses = rowStatuses[sheetName] || {};
  const sheetFieldStatuses = fieldStatuses[sheetName] || {};
  const sheetRfiComments = rfiComments[sheetName] || {};
  const sheetModHistory = modificationHistory[sheetName] || {};

  let completedRows = 0;
  let verifiedCellCount = 0;

  const rowsWithRfi = new Set<number>();
  const rowsWithSystemChanges = new Set<number>();
  const rowsWithManualEdits = new Set<number>();
  const rowsWithAnomalies = new Set<number>();
  const rowsWithBlacklistHits = new Set<number>();
  const rowsNeedingAttention = new Set<number>();

  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const rowStatus = sheetRowStatuses[rowIndex];
    const isRowComplete = rowStatus === 'complete';

    if (isRowComplete) {
      completedRows++;
    }

    const attention = getRowAttention(
      sheetName,
      rowIndex,
      sheet.headers,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap || {}
    );

    if (attention.rfiCount > 0) {
      rowsWithRfi.add(rowIndex);
    }

    if (attention.anomalyCount > 0) {
      rowsWithAnomalies.add(rowIndex);
    }

    if (attention.blacklistHitCount > 0) {
      rowsWithBlacklistHits.add(rowIndex);
    }

    if (attention.manualEditCount > 0) {
      rowsWithManualEdits.add(rowIndex);
    }

    const rowMods = sheetModHistory[rowIndex] || {};
    for (const header of editableHeaders) {
      const mod = rowMods[header];
      if (mod && (mod.modificationType === 'address_standardized' || mod.modificationType === 'incomplete_address')) {
        rowsWithSystemChanges.add(rowIndex);
        break;
      }
    }

    if (attention.needsAttention) {
      rowsNeedingAttention.add(rowIndex);
    }

    const rowFieldStatuses = sheetFieldStatuses[rowIndex] || {};
    for (const header of editableHeaders) {
      const hasRfi = rowFieldStatuses[header] === 'rfi' || !!sheetRfiComments[rowIndex]?.[header];
      const mod = rowMods[header];
      const hasSystemChange = mod && (mod.modificationType === 'address_standardized' || mod.modificationType === 'incomplete_address');
      const hasManualChange = mod && mod.modificationType === 'manual_edit';
      const fieldAnomalies = anomalyMap?.[sheetName]?.[rowIndex]?.[header] || [];

      const isVerified = !hasRfi && !hasSystemChange && !hasManualChange && fieldAnomalies.length === 0 && isRowComplete;
      if (isVerified) {
        verifiedCellCount++;
      }
    }
  }

  const progressPercent = totalRows > 0 ? Math.round((completedRows / totalRows) * 100) : 0;

  let pendingReviewCount = 0;
  let manualPdfReviewCount = 0;
  let manualReviewRequiredCount = 0;
  let readyToFinalizeCount = 0;
  let finalizedCount = 0;
  const rowsWithManualReviewRequired = new Set<number>();

  if (rowReviewStatuses) {
    const sheetReviewStatuses = rowReviewStatuses[sheetName] || {};
    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const reviewStatus = sheetReviewStatuses[rowIndex];
      if (reviewStatus) {
        if (reviewStatus.isBlocking) {
          pendingReviewCount++;
        }
        if (reviewStatus.reason === 'manual_pdf_review_required') {
          manualPdfReviewCount++;
          rowsWithManualReviewRequired.add(rowIndex);
        } else if (reviewStatus.reason === 'manual_data_review_required') {
          rowsWithManualReviewRequired.add(rowIndex);
        } else if (reviewStatus.reason === 'document_not_applicable') {
          rowsWithManualReviewRequired.add(rowIndex);
        } else if (reviewStatus.reason === 'ready_to_finalize') {
          readyToFinalizeCount++;
        } else if (reviewStatus.reason === 'finalized') {
          finalizedCount++;
        }
      }
    }
    manualReviewRequiredCount = rowsWithManualReviewRequired.size;
  }

  return {
    totalRows,
    completedRows,
    progressPercent,
    rfiRowCount: rowsWithRfi.size,
    systemChangeRowCount: rowsWithSystemChanges.size,
    manualEditRowCount: rowsWithManualEdits.size,
    anomalyRowCount: rowsWithAnomalies.size,
    blacklistHitRowCount: rowsWithBlacklistHits.size,
    verifiedCellCount,
    totalEditableCells,
    rowsWithRfi,
    rowsWithSystemChanges,
    rowsWithManualEdits,
    rowsWithAnomalies,
    rowsWithBlacklistHits,
    rowsNeedingAttention,
    rowsWithManualReviewRequired,
    pendingReviewCount,
    manualPdfReviewCount,
    manualReviewRequiredCount,
    readyToFinalizeCount,
    finalizedCount,
  };
}
