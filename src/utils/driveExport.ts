import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import {
  Dataset,
  RowStatus,
  FieldStatus,
  RfiComments,
  ModificationHistory,
  AnomalyMap,
  DriveProjectMeta,
  DriveExportVariant,
  AnalystRemarks,
} from '../types';
import { generateChangeMap } from './changeDetection';
import { computeSheetAnalytics } from './analytics';
import {
  uploadOrUpdateFile,
  copyFileToDrive,
  XLSX_MIME,
  CSV_MIME,
  JSON_MIME,
} from '../services/googleDrive';

interface ChangeLogRow {
  timestamp: string;
  sheet_name: string;
  row_index: number;
  field_name: string;
  change_type: 'system' | 'manual';
  category: string;
  old_value: string;
  new_value: string;
  analyst_comment: string;
}

interface AnalystSummary {
  exportedAt: string;
  exportType: DriveExportVariant;
  fileName: string;
  overallProgress: number;
  sheets: {
    name: string;
    totalRows: number;
    completedRows: number;
    progressPercent: number;
    rfiCount: number;
    anomalyCount: number;
    blacklistHitCount: number;
    manualEditCount: number;
    systemChangeCount: number;
  }[];
  totals: {
    totalRows: number;
    completedRows: number;
    rfiCount: number;
    anomalyCount: number;
    blacklistHitCount: number;
    manualEditCount: number;
    systemChangeCount: number;
  };
}

function getBaseFileName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '');
}

export function calculateOverallProgress(
  dataset: Dataset,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap
): number {
  if (!dataset || dataset.sheets.length === 0) return 0;

  let totalRows = 0;
  let completedRows = 0;

  dataset.sheets.forEach((sheet) => {
    const analytics = computeSheetAnalytics(
      dataset,
      sheet.name,
      rowStatuses,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap
    );
    totalRows += analytics.totalRows;
    completedRows += analytics.completedRows;
  });

  return totalRows > 0 ? Math.round((completedRows / totalRows) * 100) : 0;
}

export function buildExportFileName(
  baseName: string,
  variant: DriveExportVariant,
  progressPercent?: number
): string {
  if (variant === 'final') {
    return `FINAL - ${baseName}.xlsx`;
  }
  return `WIP - ${baseName} (${progressPercent || 0}% Complete).xlsx`;
}

export function buildChangeLogFileName(baseName: string): string {
  return `ChangeLog - ${baseName}.csv`;
}

export function buildAnalystSummaryFileName(baseName: string): string {
  return `AnalystSummary - ${baseName}.json`;
}

function buildChangeLogRows(
  dataset: Dataset,
  modificationHistory: ModificationHistory,
  _rfiComments: RfiComments,
  analystRemarks: AnalystRemarks
): ChangeLogRow[] {
  const rows: ChangeLogRow[] = [];

  dataset.sheets.forEach((sheet) => {
    const sheetMods = modificationHistory[sheet.name] || {};
    const sheetRemarks = analystRemarks[sheet.name] || {};

    Object.entries(sheetMods).forEach(([rowIndexStr, fieldMods]) => {
      const rowIndex = parseInt(rowIndexStr, 10);
      const rowRemark = sheetRemarks[rowIndex] || '';

      Object.entries(fieldMods).forEach(([fieldName, mod]) => {
        const isSystem =
          mod.modificationType === 'address_standardized' ||
          mod.modificationType === 'incomplete_address';

        rows.push({
          timestamp: mod.timestamp,
          sheet_name: sheet.name,
          row_index: rowIndex,
          field_name: fieldName,
          change_type: isSystem ? 'system' : 'manual',
          category: mod.modificationType,
          old_value: String(mod.originalValue ?? ''),
          new_value: String(mod.newValue ?? ''),
          analyst_comment: rowRemark,
        });
      });
    });
  });

  return rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function generateChangeLogCSV(
  dataset: Dataset,
  modificationHistory: ModificationHistory,
  rfiComments: RfiComments,
  analystRemarks: AnalystRemarks
): string {
  const rows = buildChangeLogRows(dataset, modificationHistory, rfiComments, analystRemarks);

  return Papa.unparse({
    fields: [
      'timestamp',
      'sheet_name',
      'row_index',
      'field_name',
      'change_type',
      'category',
      'old_value',
      'new_value',
      'analyst_comment',
    ],
    data: rows.map((r) => [
      r.timestamp,
      r.sheet_name,
      r.row_index,
      r.field_name,
      r.change_type,
      r.category,
      r.old_value,
      r.new_value,
      r.analyst_comment,
    ]),
  });
}

export function generateAnalystSummary(
  dataset: Dataset,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap,
  variant: DriveExportVariant
): AnalystSummary {
  const sheetStats: AnalystSummary['sheets'] = [];
  const totals = {
    totalRows: 0,
    completedRows: 0,
    rfiCount: 0,
    anomalyCount: 0,
    blacklistHitCount: 0,
    manualEditCount: 0,
    systemChangeCount: 0,
  };

  dataset.sheets.forEach((sheet) => {
    const analytics = computeSheetAnalytics(
      dataset,
      sheet.name,
      rowStatuses,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap
    );

    sheetStats.push({
      name: sheet.name,
      totalRows: analytics.totalRows,
      completedRows: analytics.completedRows,
      progressPercent: analytics.progressPercent,
      rfiCount: analytics.rfiRowCount,
      anomalyCount: analytics.anomalyRowCount,
      blacklistHitCount: analytics.blacklistHitRowCount,
      manualEditCount: analytics.manualEditRowCount,
      systemChangeCount: analytics.systemChangeRowCount,
    });

    totals.totalRows += analytics.totalRows;
    totals.completedRows += analytics.completedRows;
    totals.rfiCount += analytics.rfiRowCount;
    totals.anomalyCount += analytics.anomalyRowCount;
    totals.blacklistHitCount += analytics.blacklistHitRowCount;
    totals.manualEditCount += analytics.manualEditRowCount;
    totals.systemChangeCount += analytics.systemChangeRowCount;
  });

  const overallProgress =
    totals.totalRows > 0 ? Math.round((totals.completedRows / totals.totalRows) * 100) : 0;

  return {
    exportedAt: new Date().toISOString(),
    exportType: variant,
    fileName: dataset.fileName,
    overallProgress,
    sheets: sheetStats,
    totals,
  };
}

async function buildWorkbookBuffer(
  dataset: Dataset,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  originalDataset: Dataset | null,
  rfiComments: RfiComments,
  _modificationHistory: ModificationHistory
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const changeMap = generateChangeMap(originalDataset, dataset);

  dataset.sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.name);
    const headers = [...sheet.headers, 'row_status'];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    sheet.rows.forEach((row, rowIndex) => {
      const status = rowStatuses[sheet.name]?.[rowIndex] || 'incomplete';
      const rowData: (string | number)[] = [];

      sheet.headers.forEach((header) => {
        let cellValue = row[header] ?? '';
        const comment = rfiComments[sheet.name]?.[rowIndex]?.[header];
        if (comment) {
          cellValue = `${cellValue}//${comment}`;
        }
        rowData.push(cellValue as string | number);
      });

      rowData.push(status);
      const excelRow = worksheet.addRow(rowData);

      sheet.headers.forEach((header, colIndex) => {
        const fieldStatus = fieldStatuses[sheet.name]?.[rowIndex]?.[header] || 'incomplete';
        const hasChanged = changeMap[sheet.name]?.[rowIndex]?.[header] || false;
        const hasRfiComment = !!rfiComments[sheet.name]?.[rowIndex]?.[header];

        const cell = excelRow.getCell(colIndex + 1);

        let fillColor = '';
        if (hasChanged) {
          fillColor = 'FFFFB3B3';
        } else if (fieldStatus === 'rfi' || hasRfiComment) {
          fillColor = 'FFFFEB9C';
        } else if (fieldStatus === 'complete') {
          fillColor = 'FFC6EFCE';
        }

        if (fillColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillColor },
          };
        }
      });
    });

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export interface DriveExportResult {
  success: boolean;
  spreadsheetUrl?: string;
  changeLogUrl?: string;
  summaryUrl?: string;
  error?: string;
}

export async function exportSpreadsheetToDrive(
  accessToken: string,
  driveMeta: DriveProjectMeta,
  dataset: Dataset,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  originalDataset: Dataset | null,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap,
  variant: DriveExportVariant
): Promise<DriveExportResult> {
  if (!driveMeta.exportsFolderId) {
    return { success: false, error: 'Exports folder not configured' };
  }

  try {
    const baseName = getBaseFileName(driveMeta.sourceFileName || dataset.fileName);
    const progress = calculateOverallProgress(
      dataset,
      rowStatuses,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap
    );

    const fileName = buildExportFileName(baseName, variant, progress);
    const buffer = await buildWorkbookBuffer(
      dataset,
      rowStatuses,
      fieldStatuses,
      originalDataset,
      rfiComments,
      modificationHistory
    );

    const file = await uploadOrUpdateFile(
      accessToken,
      driveMeta.exportsFolderId,
      fileName,
      buffer,
      XLSX_MIME
    );

    return {
      success: true,
      spreadsheetUrl: file.webViewLink,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export spreadsheet',
    };
  }
}

export async function exportChangeLogsToDrive(
  accessToken: string,
  driveMeta: DriveProjectMeta,
  dataset: Dataset,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap,
  analystRemarks: AnalystRemarks,
  variant: DriveExportVariant
): Promise<DriveExportResult> {
  if (!driveMeta.changeLogsFolderId) {
    return { success: false, error: 'Change logs folder not configured' };
  }

  try {
    const baseName = getBaseFileName(driveMeta.sourceFileName || dataset.fileName);

    const csvContent = generateChangeLogCSV(
      dataset,
      modificationHistory,
      rfiComments,
      analystRemarks
    );
    const csvFileName = buildChangeLogFileName(baseName);
    const csvFile = await uploadOrUpdateFile(
      accessToken,
      driveMeta.changeLogsFolderId,
      csvFileName,
      csvContent,
      CSV_MIME
    );

    const summary = generateAnalystSummary(
      dataset,
      rowStatuses,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap,
      variant
    );
    const jsonFileName = buildAnalystSummaryFileName(baseName);
    const jsonFile = await uploadOrUpdateFile(
      accessToken,
      driveMeta.changeLogsFolderId,
      jsonFileName,
      JSON.stringify(summary, null, 2),
      JSON_MIME
    );

    return {
      success: true,
      changeLogUrl: csvFile.webViewLink,
      summaryUrl: jsonFile.webViewLink,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export change logs',
    };
  }
}

export async function copySourceToDrive(
  accessToken: string,
  driveMeta: DriveProjectMeta
): Promise<DriveExportResult> {
  if (!driveMeta.sourceFolderId || !driveMeta.sourceFileId) {
    return { success: false, error: 'Source folder or file not configured' };
  }

  if (driveMeta.sourceCopied) {
    return { success: true };
  }

  try {
    const copyName = `Original - ${driveMeta.sourceFileName}`;
    await copyFileToDrive(
      accessToken,
      driveMeta.sourceFileId,
      driveMeta.sourceFolderId,
      copyName
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy source file',
    };
  }
}

export async function exportFullToDrive(
  accessToken: string,
  driveMeta: DriveProjectMeta,
  dataset: Dataset,
  originalDataset: Dataset | null,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap,
  analystRemarks: AnalystRemarks,
  variant: DriveExportVariant,
  onProgress?: (step: string) => void
): Promise<DriveExportResult> {
  const result: DriveExportResult = { success: true };

  try {
    if (!driveMeta.sourceCopied) {
      onProgress?.('Copying source file...');
      const sourceResult = await copySourceToDrive(accessToken, driveMeta);
      if (!sourceResult.success) {
        console.warn('Failed to copy source:', sourceResult.error);
      }
    }

    onProgress?.('Exporting spreadsheet...');
    const spreadsheetResult = await exportSpreadsheetToDrive(
      accessToken,
      driveMeta,
      dataset,
      rowStatuses,
      fieldStatuses,
      originalDataset,
      rfiComments,
      modificationHistory,
      anomalyMap,
      variant
    );

    if (!spreadsheetResult.success) {
      return spreadsheetResult;
    }
    result.spreadsheetUrl = spreadsheetResult.spreadsheetUrl;

    onProgress?.('Exporting change logs...');
    const logsResult = await exportChangeLogsToDrive(
      accessToken,
      driveMeta,
      dataset,
      rowStatuses,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap,
      analystRemarks,
      variant
    );

    if (!logsResult.success) {
      return { ...result, ...logsResult };
    }
    result.changeLogUrl = logsResult.changeLogUrl;
    result.summaryUrl = logsResult.summaryUrl;

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export to Drive',
    };
  }
}
