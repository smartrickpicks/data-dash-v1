import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Dataset, RowStatus, FieldStatus, RfiComments, ModificationHistory, AnomalyMap } from '../types';
import { generateChangeMap } from './changeDetection';

type EventType = 'data_change' | 'blacklist_hit';

interface ChangeLogEntry {
  event_type: EventType;
  sheet_name: string;
  row_index: number;
  file_name: string;
  field_name: string;
  old_value: string;
  new_value: string;
  matched_value: string;
  blacklist_value: string;
  match_mode: string;
  scope: string;
  reason: string;
  changed_by: 'system' | 'user' | '';
  changed_at: string;
  rule_id: string;
}

export interface ExportOptions {
  includeChangeLog: boolean;
  exportAllSheets: boolean;
}

function countChangesInRow(
  sheetName: string,
  rowIndex: number,
  modificationHistory: ModificationHistory
): number {
  const rowMods = modificationHistory[sheetName]?.[rowIndex];
  if (!rowMods) return 0;
  return Object.keys(rowMods).length;
}

function buildChangeLogEntries(
  dataset: Dataset,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap,
  sheetNames: string[]
): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = [];

  dataset.sheets
    .filter((sheet) => sheetNames.includes(sheet.name))
    .forEach((sheet) => {
      const sheetMods = modificationHistory[sheet.name];
      const sheetAnomalies = anomalyMap[sheet.name];
      const firstHeader = sheet.headers[0] || '';

      if (sheetMods) {
        Object.entries(sheetMods).forEach(([rowIndexStr, fieldMods]) => {
          const rowIndex = parseInt(rowIndexStr, 10);
          const row = sheet.rows[rowIndex];
          if (!row) return;

          const fileName = String(row[firstHeader] ?? '');

          Object.entries(fieldMods).forEach(([fieldName, mod]) => {
            const isSystemChange =
              mod.modificationType === 'address_standardized' ||
              mod.modificationType === 'incomplete_address';

            entries.push({
              event_type: 'data_change',
              sheet_name: sheet.name,
              row_index: rowIndex,
              file_name: fileName,
              field_name: fieldName,
              old_value: String(mod.originalValue ?? ''),
              new_value: String(mod.newValue ?? ''),
              matched_value: '',
              blacklist_value: '',
              match_mode: '',
              scope: '',
              reason: mod.reason,
              changed_by: isSystemChange ? 'system' : 'user',
              changed_at: mod.timestamp,
              rule_id: mod.modificationType,
            });
          });
        });
      }

      if (sheetAnomalies) {
        Object.entries(sheetAnomalies).forEach(([rowIndexStr, fieldAnomalies]) => {
          const rowIndex = parseInt(rowIndexStr, 10);
          const row = sheet.rows[rowIndex];
          if (!row) return;

          const fileName = String(row[firstHeader] ?? '');

          Object.entries(fieldAnomalies).forEach(([fieldName, anomalies]) => {
            anomalies
              .filter((a) => a.type === 'blacklist_hit')
              .forEach((anomaly) => {
                const cellValue = String(row[fieldName] ?? '');
                entries.push({
                  event_type: 'blacklist_hit',
                  sheet_name: sheet.name,
                  row_index: rowIndex,
                  file_name: fileName,
                  field_name: fieldName,
                  old_value: '',
                  new_value: '',
                  matched_value: cellValue,
                  blacklist_value: anomaly.blacklistValue || '',
                  match_mode: anomaly.blacklistMatchMode || '',
                  scope: anomaly.blacklistScope || '',
                  reason: anomaly.message,
                  changed_by: '',
                  changed_at: '',
                  rule_id: 'blacklist_hit',
                });
              });
          });
        });
      }
    });

  return entries;
}

export function exportAsCSV(
  dataset: Dataset,
  sheetName: string,
  rowStatuses: RowStatus,
  modificationHistory: ModificationHistory
): void {
  const sheet = dataset.sheets.find((s) => s.name === sheetName);
  if (!sheet) return;

  const headers = [...sheet.headers, 'row_status', 'change_count'];

  const data = sheet.rows.map((row, rowIndex) => {
    const status = rowStatuses[sheetName]?.[rowIndex] || 'incomplete';
    const changeCount = countChangesInRow(sheetName, rowIndex, modificationHistory);
    const rowData: Record<string, string | number | boolean | null> = {};

    sheet.headers.forEach((header) => {
      rowData[header] = row[header] ?? '';
    });

    rowData['row_status'] = status;
    rowData['change_count'] = changeCount;

    return rowData;
  });

  const csv = Papa.unparse({
    fields: headers,
    data: data.map((row) => headers.map((h) => row[h] ?? '')),
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${dataset.fileName.split('.')[0]}_${sheetName}__reviewed.csv`);
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  dataset: Dataset,
  sheetName: string,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  originalDataset: Dataset | null,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory
): void {
  const sheet = dataset.sheets.find((s) => s.name === sheetName);
  if (!sheet) return;

  const changeMap = generateChangeMap(originalDataset, dataset);
  const worksheet = workbook.addWorksheet(sheet.name);
  const headers = [...sheet.headers, 'row_status', 'change_count'];

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
    const status = rowStatuses[sheetName]?.[rowIndex] || 'incomplete';
    const changeCount = countChangesInRow(sheetName, rowIndex, modificationHistory);
    const rowData: (string | number)[] = [];

    sheet.headers.forEach((header) => {
      let cellValue = row[header] ?? '';
      const comment = rfiComments[sheetName]?.[rowIndex]?.[header];
      if (comment) {
        cellValue = `${cellValue}//${comment}`;
      }
      rowData.push(cellValue as string | number);
    });

    rowData.push(status);
    rowData.push(changeCount);

    const excelRow = worksheet.addRow(rowData);

    sheet.headers.forEach((header, colIndex) => {
      const fieldStatus = fieldStatuses[sheetName]?.[rowIndex]?.[header] || 'incomplete';
      const hasChanged = changeMap[sheetName]?.[rowIndex]?.[header] || false;
      const hasRfiComment = !!rfiComments[sheetName]?.[rowIndex]?.[header];

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
}

function addChangeLogSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  entries: ChangeLogEntry[]
): void {
  const filteredEntries = entries.filter((e) => e.sheet_name === sheetName);
  if (filteredEntries.length === 0) return;

  const worksheet = workbook.addWorksheet(`${sheetName}_change_log`);
  const headers = [
    'event_type',
    'sheet_name',
    'row_index',
    'file_name',
    'field_name',
    'old_value',
    'new_value',
    'matched_value',
    'blacklist_value',
    'match_mode',
    'scope',
    'reason',
    'changed_by',
    'changed_at',
    'rule_id',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E8FB' },
    };
  });

  filteredEntries.forEach((entry) => {
    const row = worksheet.addRow([
      entry.event_type,
      entry.sheet_name,
      entry.row_index,
      entry.file_name,
      entry.field_name,
      entry.old_value,
      entry.new_value,
      entry.matched_value,
      entry.blacklist_value,
      entry.match_mode,
      entry.scope,
      entry.reason,
      entry.changed_by,
      entry.changed_at,
      entry.rule_id,
    ]);

    if (entry.event_type === 'blacklist_hit') {
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCCCC' },
      };
    }
  });

  worksheet.columns.forEach((column) => {
    column.width = 18;
  });
}

export async function exportAsXLSX(
  dataset: Dataset,
  activeSheetName: string,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  originalDataset: Dataset | null,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap,
  options: ExportOptions
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheetsToExport = options.exportAllSheets
    ? dataset.sheets.map((s) => s.name)
    : [activeSheetName];

  sheetsToExport.forEach((sheetName) => {
    addDataSheet(
      workbook,
      dataset,
      sheetName,
      rowStatuses,
      fieldStatuses,
      originalDataset,
      rfiComments,
      modificationHistory
    );
  });

  if (options.includeChangeLog) {
    const changeLogEntries = buildChangeLogEntries(dataset, modificationHistory, anomalyMap, sheetsToExport);
    sheetsToExport.forEach((sheetName) => {
      addChangeLogSheet(workbook, sheetName, changeLogEntries);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  let suffix = '__reviewed';
  if (!options.exportAllSheets) {
    suffix = `_${activeSheetName}${suffix}`;
  }
  if (options.includeChangeLog) {
    suffix = `${suffix}_with_changelog`;
  }

  const fileName = `${dataset.fileName.split('.')[0]}${suffix}.xlsx`;
  downloadFile(blob, fileName);
}

export function exportData(
  dataset: Dataset,
  sheetName: string,
  rowStatuses: RowStatus,
  fieldStatuses: FieldStatus,
  isXLSX: boolean,
  originalDataset: Dataset | null,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap,
  options: ExportOptions = { includeChangeLog: false, exportAllSheets: false }
): void {
  if (isXLSX) {
    exportAsXLSX(
      dataset,
      sheetName,
      rowStatuses,
      fieldStatuses,
      originalDataset,
      rfiComments,
      modificationHistory,
      anomalyMap,
      options
    );
  } else {
    exportAsCSV(dataset, sheetName, rowStatuses, modificationHistory);
  }
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
