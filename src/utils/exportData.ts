import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Dataset, RowStatus, FieldStatus, RfiComments, ModificationHistory, AnomalyMap, ContractFailureOverrides } from '../types';
import { generateChangeMap } from './changeDetection';
import { getCategoryLabel } from './contractFailureClassifier';

type EventType = 'data_change' | 'blacklist_hit' | 'contract_failure' | 'contract_text_unreadable' | 'contract_extraction_suspect' | 'contract_not_applicable';

type ChangeLogCategory = 'SYSTEM_CHANGE' | 'HUMAN_CHANGE' | 'BLACKLIST_HIT' | 'CONTRACT_FAILURE' | 'RFI_COMMENT';

const CATEGORY_COLORS: Record<ChangeLogCategory, { fill: string; border: string }> = {
  SYSTEM_CHANGE: { fill: 'FFEAEAEA', border: 'FF9E9E9E' },
  HUMAN_CHANGE: { fill: 'FFD0E8FF', border: 'FF6BA3E8' },
  BLACKLIST_HIT: { fill: 'FFFFCCCC', border: 'FFDC3545' },
  CONTRACT_FAILURE: { fill: 'FFFFD9B3', border: 'FFFF9800' },
  RFI_COMMENT: { fill: 'FFFFFACD', border: 'FFFFC107' },
};

interface RfiNoteEntry {
  timestamp: string;
  sheet: string;
  rowNumber: number;
  fieldName: string;
  noteType: 'RFI' | 'Manual Review' | 'Doc Not Applicable' | 'Analyst Comment';
  category: ChangeLogCategory;
  confidence: string;
  detectedBy: 'System' | 'Analyst';
  summary: string;
  details: string;
  sourceUrl: string;
  pdfSizeMB: string;
  linkHint: string;
}

const MUST_REVIEW_ANOMALY_TYPES = new Set([
  'blacklist_hit',
  'contract_load_error',
  'contract_text_unreadable',
  'contract_extraction_suspect',
  'contract_not_applicable',
]);

function hasRowMustReviewAnomaly(
  sheetAnomalies: { [rowIndex: number]: { [fieldName: string]: { type: string }[] } } | undefined,
  rowIndex: number
): boolean {
  if (!sheetAnomalies) return false;
  const rowAnomalies = sheetAnomalies[rowIndex];
  if (!rowAnomalies) return false;

  for (const fieldAnomalies of Object.values(rowAnomalies)) {
    for (const anomaly of fieldAnomalies) {
      if (MUST_REVIEW_ANOMALY_TYPES.has(anomaly.type)) {
        return true;
      }
    }
  }
  return false;
}

function hasCellMustReviewAnomaly(
  sheetAnomalies: { [rowIndex: number]: { [fieldName: string]: { type: string }[] } } | undefined,
  rowIndex: number,
  fieldName: string
): { hasAnomaly: boolean; isBlacklist: boolean } {
  if (!sheetAnomalies) return { hasAnomaly: false, isBlacklist: false };
  const cellAnomalies = sheetAnomalies[rowIndex]?.[fieldName];
  if (!cellAnomalies) return { hasAnomaly: false, isBlacklist: false };

  let hasAnomaly = false;
  let isBlacklist = false;

  for (const anomaly of cellAnomalies) {
    if (MUST_REVIEW_ANOMALY_TYPES.has(anomaly.type)) {
      hasAnomaly = true;
      if (anomaly.type === 'blacklist_hit') {
        isBlacklist = true;
      }
    }
  }

  return { hasAnomaly, isBlacklist };
}

function isSystemOnlyChange(
  modificationHistory: ModificationHistory,
  sheetName: string,
  rowIndex: number,
  fieldName: string
): boolean {
  const mod = modificationHistory[sheetName]?.[rowIndex]?.[fieldName];
  if (!mod) return false;
  return mod.modificationType === 'address_standardized' || mod.modificationType === 'incomplete_address';
}

interface ChangeLogEntry {
  event_type: EventType;
  category: ChangeLogCategory;
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
  failure_category: string;
  confidence: string;
  http_status: string;
  file_size: string;
  overridden: string;
  override_reason: string;
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
  sheetNames: string[],
  contractFailureOverrides: ContractFailureOverrides = {}
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
              category: isSystemChange ? 'SYSTEM_CHANGE' : 'HUMAN_CHANGE',
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
              failure_category: '',
              confidence: '',
              http_status: '',
              file_size: '',
              overridden: '',
              override_reason: '',
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
          const override = contractFailureOverrides[sheet.name]?.[rowIndex];

          Object.entries(fieldAnomalies).forEach(([fieldName, anomalies]) => {
            anomalies
              .filter((a) => a.type === 'blacklist_hit')
              .forEach((anomaly) => {
                const cellValue = String(row[fieldName] ?? '');
                entries.push({
                  event_type: 'blacklist_hit',
                  category: 'BLACKLIST_HIT',
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
                  failure_category: '',
                  confidence: '',
                  http_status: '',
                  file_size: '',
                  overridden: '',
                  override_reason: '',
                });
              });

            anomalies
              .filter((a) => a.type === 'contract_load_error')
              .forEach((anomaly) => {
                const meta = anomaly.failureMeta;
                const effectiveCategory = override?.category || meta?.category || 'unknown';
                const isOverridden = !!override || meta?.overridden;

                entries.push({
                  event_type: 'contract_failure',
                  category: 'CONTRACT_FAILURE',
                  sheet_name: sheet.name,
                  row_index: rowIndex,
                  file_name: fileName,
                  field_name: fieldName,
                  old_value: '',
                  new_value: '',
                  matched_value: '',
                  blacklist_value: '',
                  match_mode: '',
                  scope: '',
                  reason: meta?.message || anomaly.message,
                  changed_by: isOverridden ? 'user' : 'system',
                  changed_at: meta?.detectedAt || override?.overriddenAt || '',
                  rule_id: 'contract_failure',
                  failure_category: getCategoryLabel(effectiveCategory),
                  confidence: meta?.confidence || '',
                  http_status: meta?.httpStatus?.toString() || '',
                  file_size: meta?.sizeBytes ? `${(meta.sizeBytes / 1024 / 1024).toFixed(1)} MB` : '',
                  overridden: isOverridden ? 'true' : 'false',
                  override_reason: override?.overrideReason || meta?.overrideReason || '',
                });
              });

            anomalies
              .filter((a) => a.type === 'contract_text_unreadable')
              .forEach((anomaly) => {
                const meta = anomaly.unreadableTextMeta;

                entries.push({
                  event_type: 'contract_text_unreadable',
                  category: 'CONTRACT_FAILURE',
                  sheet_name: sheet.name,
                  row_index: rowIndex,
                  file_name: fileName,
                  field_name: fieldName,
                  old_value: '',
                  new_value: '',
                  matched_value: '',
                  blacklist_value: '',
                  match_mode: '',
                  scope: '',
                  reason: meta?.note || meta?.reason || anomaly.message,
                  changed_by: 'system',
                  changed_at: meta?.detectedAt || '',
                  rule_id: 'contract_text_unreadable',
                  failure_category: 'Unreadable Text Layer',
                  confidence: meta?.confidence || 'high',
                  http_status: '',
                  file_size: meta?.sizeBytes ? `${(meta.sizeBytes / 1024 / 1024).toFixed(1)} MB` : '',
                  overridden: 'false',
                  override_reason: '',
                });
              });

            anomalies
              .filter((a) => a.type === 'contract_extraction_suspect')
              .forEach((anomaly) => {
                const meta = anomaly.extractionSuspectMeta;

                entries.push({
                  event_type: 'contract_extraction_suspect',
                  category: 'CONTRACT_FAILURE',
                  sheet_name: sheet.name,
                  row_index: rowIndex,
                  file_name: fileName,
                  field_name: fieldName,
                  old_value: '',
                  new_value: '',
                  matched_value: '',
                  blacklist_value: '',
                  match_mode: '',
                  scope: '',
                  reason: meta?.reason || anomaly.message,
                  changed_by: 'system',
                  changed_at: meta?.detectedAt || '',
                  rule_id: 'contract_extraction_suspect',
                  failure_category: 'Suspect Extraction',
                  confidence: meta?.confidence || 'medium',
                  http_status: '',
                  file_size: '',
                  overridden: 'false',
                  override_reason: '',
                });
              });

            anomalies
              .filter((a) => a.type === 'contract_not_applicable')
              .forEach((anomaly) => {
                const meta = anomaly.notApplicableMeta;

                entries.push({
                  event_type: 'contract_not_applicable',
                  category: 'CONTRACT_FAILURE',
                  sheet_name: sheet.name,
                  row_index: rowIndex,
                  file_name: fileName,
                  field_name: fieldName,
                  old_value: '',
                  new_value: '',
                  matched_value: '',
                  blacklist_value: '',
                  match_mode: '',
                  scope: meta?.reasonKey || '',
                  reason: meta?.freeText || anomaly.message,
                  changed_by: 'user',
                  changed_at: meta?.timestampISO || '',
                  rule_id: 'contract_not_applicable',
                  failure_category: 'Document Not Applicable',
                  confidence: 'manual',
                  http_status: '',
                  file_size: '',
                  overridden: 'false',
                  override_reason: '',
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
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap
): void {
  const sheet = dataset.sheets.find((s) => s.name === sheetName);
  if (!sheet) return;

  const changeMap = generateChangeMap(originalDataset, dataset);
  const sheetAnomalies = anomalyMap[sheetName];
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
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  sheet.rows.forEach((row, rowIndex) => {
    const status = rowStatuses[sheetName]?.[rowIndex] || 'incomplete';
    const changeCount = countChangesInRow(sheetName, rowIndex, modificationHistory);
    const rowData: (string | number)[] = [];
    const rowHasNotApplicable = hasRowMustReviewAnomaly(sheetAnomalies, rowIndex) &&
      Object.values(sheetAnomalies?.[rowIndex] || {}).some(
        anomalies => anomalies.some(a => a.type === 'contract_not_applicable')
      );

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
      const cellAnomaly = hasCellMustReviewAnomaly(sheetAnomalies, rowIndex, header);
      const isSystemChange = isSystemOnlyChange(modificationHistory, sheetName, rowIndex, header);

      const cell = excelRow.getCell(colIndex + 1);

      let fillColor = '';

      if (cellAnomaly.isBlacklist) {
        fillColor = 'FFFFB3B3';
      } else if (cellAnomaly.hasAnomaly) {
        fillColor = 'FFFFB3B3';
      } else if (rowHasNotApplicable) {
        fillColor = 'FFFFEB9C';
      } else if (fieldStatus === 'rfi' || hasRfiComment) {
        fillColor = 'FFFFEB9C';
      } else if (hasChanged && !isSystemChange) {
        fillColor = 'FFD0E8FF';
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

  const worksheet = workbook.addWorksheet(`${sheetName}_change_log`);
  const headers = [
    'category',
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
    'failure_category',
    'confidence',
    'http_status',
    'file_size',
    'overridden',
    'override_reason',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF1F2937' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
    };
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  if (filteredEntries.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: filteredEntries.length + 1, column: headers.length },
    };
  }

  filteredEntries.forEach((entry) => {
    const row = worksheet.addRow([
      entry.category,
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
      entry.failure_category,
      entry.confidence,
      entry.http_status,
      entry.file_size,
      entry.overridden,
      entry.override_reason,
    ]);

    const categoryColors = CATEGORY_COLORS[entry.category];
    const colCount = headers.length;

    for (let i = 1; i <= colCount; i++) {
      const cell = row.getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: categoryColors.fill },
      };
      if (i === 1) {
        cell.border = {
          left: { style: 'thick', color: { argb: categoryColors.border } },
        };
      }
    }
  });

  const columnWidths: Record<string, number> = {
    category: 16,
    event_type: 22,
    sheet_name: 16,
    row_index: 10,
    file_name: 25,
    field_name: 20,
    old_value: 25,
    new_value: 25,
    matched_value: 20,
    blacklist_value: 18,
    match_mode: 12,
    scope: 14,
    reason: 40,
    changed_by: 12,
    changed_at: 22,
    rule_id: 24,
    failure_category: 22,
    confidence: 12,
    http_status: 12,
    file_size: 12,
    overridden: 10,
    override_reason: 20,
  };

  worksheet.columns.forEach((column, index) => {
    const headerName = headers[index];
    column.width = columnWidths[headerName] || 18;
  });
}

function buildRfiNotesEntries(
  dataset: Dataset,
  rfiComments: RfiComments,
  fieldStatuses: FieldStatus,
  anomalyMap: AnomalyMap,
  sheetNames: string[],
  contractFailureOverrides: ContractFailureOverrides = {}
): RfiNoteEntry[] {
  const entries: RfiNoteEntry[] = [];
  const processedKeys = new Set<string>();

  dataset.sheets
    .filter((sheet) => sheetNames.includes(sheet.name))
    .forEach((sheet) => {
      const sheetRfiComments = rfiComments[sheet.name];
      const sheetFieldStatuses = fieldStatuses[sheet.name];
      const sheetAnomalies = anomalyMap[sheet.name];

      if (sheetRfiComments) {
        Object.entries(sheetRfiComments).forEach(([rowIndexStr, fieldComments]) => {
          const rowIndex = parseInt(rowIndexStr, 10);
          const row = sheet.rows[rowIndex];
          if (!row) return;

          Object.entries(fieldComments).forEach(([fieldName, comment]) => {
            if (!comment) return;
            const key = `rfi_${sheet.name}_${rowIndex}_${fieldName}`;
            if (processedKeys.has(key)) return;
            processedKeys.add(key);

            entries.push({
              timestamp: new Date().toISOString(),
              sheet: sheet.name,
              rowNumber: rowIndex + 1,
              fieldName,
              noteType: 'RFI',
              category: 'RFI_COMMENT',
              confidence: '',
              detectedBy: 'Analyst',
              summary: `RFI comment on ${fieldName}`,
              details: comment,
              sourceUrl: '',
              pdfSizeMB: '',
              linkHint: '',
            });
          });
        });
      }

      if (sheetFieldStatuses) {
        Object.entries(sheetFieldStatuses).forEach(([rowIndexStr, fieldStatusMap]) => {
          const rowIndex = parseInt(rowIndexStr, 10);
          Object.entries(fieldStatusMap).forEach(([fieldName, status]) => {
            if (status === 'rfi') {
              const hasComment = sheetRfiComments?.[rowIndex]?.[fieldName];
              if (!hasComment) {
                const key = `rfi_status_${sheet.name}_${rowIndex}_${fieldName}`;
                if (processedKeys.has(key)) return;
                processedKeys.add(key);

                entries.push({
                  timestamp: new Date().toISOString(),
                  sheet: sheet.name,
                  rowNumber: rowIndex + 1,
                  fieldName,
                  noteType: 'RFI',
                  category: 'RFI_COMMENT',
                  confidence: '',
                  detectedBy: 'Analyst',
                  summary: `Field marked as RFI`,
                  details: `Field "${fieldName}" requires further information`,
                  sourceUrl: '',
                  pdfSizeMB: '',
                  linkHint: '',
                });
              }
            }
          });
        });
      }

      if (sheetAnomalies) {
        Object.entries(sheetAnomalies).forEach(([rowIndexStr, fieldAnomalies]) => {
          const rowIndex = parseInt(rowIndexStr, 10);
          const row = sheet.rows[rowIndex];
          if (!row) return;

          const contractUrlField = sheet.headers.find(h =>
            h.toLowerCase().includes('contract') || h.toLowerCase().includes('url') || h.toLowerCase().includes('link')
          );
          const sourceUrl = contractUrlField ? String(row[contractUrlField] ?? '') : '';

          Object.entries(fieldAnomalies).forEach(([fieldName, anomalies]) => {
            anomalies.forEach((anomaly) => {
              if (anomaly.type === 'contract_load_error') {
                const key = `load_error_${sheet.name}_${rowIndex}_${fieldName}`;
                if (processedKeys.has(key)) return;
                processedKeys.add(key);

                const meta = anomaly.failureMeta;
                const override = contractFailureOverrides[sheet.name]?.[rowIndex];
                const effectiveCategory = override?.category || meta?.category || 'unknown';
                const pdfSize = meta?.sizeBytes ? `${(meta.sizeBytes / 1024 / 1024).toFixed(2)}` : '';

                entries.push({
                  timestamp: meta?.detectedAt || new Date().toISOString(),
                  sheet: sheet.name,
                  rowNumber: rowIndex + 1,
                  fieldName,
                  noteType: 'Manual Review',
                  category: 'CONTRACT_FAILURE',
                  confidence: meta?.confidence || '',
                  detectedBy: 'System',
                  summary: `Contract load failure: ${getCategoryLabel(effectiveCategory)}`,
                  details: `${meta?.message || anomaly.message}${meta?.httpStatus ? ` | HTTP ${meta.httpStatus}` : ''}${pdfSize ? ` | Size: ${pdfSize} MB` : ''}`,
                  sourceUrl,
                  pdfSizeMB: pdfSize,
                  linkHint: sourceUrl ? 'Open contract in viewer' : '',
                });
              }

              if (anomaly.type === 'contract_text_unreadable') {
                const key = `unreadable_${sheet.name}_${rowIndex}_${fieldName}`;
                if (processedKeys.has(key)) return;
                processedKeys.add(key);

                const meta = anomaly.unreadableTextMeta;
                const pdfSize = meta?.sizeBytes ? `${(meta.sizeBytes / 1024 / 1024).toFixed(2)}` : '';

                entries.push({
                  timestamp: meta?.detectedAt || new Date().toISOString(),
                  sheet: sheet.name,
                  rowNumber: rowIndex + 1,
                  fieldName,
                  noteType: 'Manual Review',
                  category: 'CONTRACT_FAILURE',
                  confidence: meta?.confidence || 'high',
                  detectedBy: 'System',
                  summary: 'Unreadable text layer detected',
                  details: meta?.note || meta?.reason || anomaly.message,
                  sourceUrl,
                  pdfSizeMB: pdfSize,
                  linkHint: sourceUrl ? 'Open contract in viewer' : '',
                });
              }

              if (anomaly.type === 'contract_extraction_suspect') {
                const key = `suspect_${sheet.name}_${rowIndex}_${fieldName}`;
                if (processedKeys.has(key)) return;
                processedKeys.add(key);

                const meta = anomaly.extractionSuspectMeta;

                entries.push({
                  timestamp: meta?.detectedAt || new Date().toISOString(),
                  sheet: sheet.name,
                  rowNumber: rowIndex + 1,
                  fieldName,
                  noteType: 'Manual Review',
                  category: 'CONTRACT_FAILURE',
                  confidence: meta?.confidence || 'medium',
                  detectedBy: 'System',
                  summary: 'Suspect data extraction',
                  details: meta?.reason || anomaly.message,
                  sourceUrl,
                  pdfSizeMB: '',
                  linkHint: sourceUrl ? 'Open contract in viewer' : '',
                });
              }

              if (anomaly.type === 'contract_not_applicable') {
                const key = `not_applicable_${sheet.name}_${rowIndex}_${fieldName}`;
                if (processedKeys.has(key)) return;
                processedKeys.add(key);

                const meta = anomaly.notApplicableMeta;
                const reasonLabels: Record<string, string> = {
                  wrong_doc_type: 'Wrong document type',
                  duplicate: 'Duplicate document',
                  not_in_scope: 'Not in scope',
                  termination_notice: 'Termination notice',
                  other: 'Other',
                };

                entries.push({
                  timestamp: meta?.timestampISO || new Date().toISOString(),
                  sheet: sheet.name,
                  rowNumber: rowIndex + 1,
                  fieldName: '',
                  noteType: 'Doc Not Applicable',
                  category: 'CONTRACT_FAILURE',
                  confidence: 'manual',
                  detectedBy: 'Analyst',
                  summary: `Document not applicable: ${reasonLabels[meta?.reasonKey || 'other'] || meta?.reasonKey}`,
                  details: meta?.freeText || anomaly.message,
                  sourceUrl,
                  pdfSizeMB: '',
                  linkHint: sourceUrl ? 'Open contract in viewer' : '',
                });
              }
            });
          });
        });
      }
    });

  entries.sort((a, b) => {
    if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
    if (a.rowNumber !== b.rowNumber) return a.rowNumber - b.rowNumber;
    return a.fieldName.localeCompare(b.fieldName);
  });

  return entries;
}

function addRfiAnalystNotesSheet(
  workbook: ExcelJS.Workbook,
  entries: RfiNoteEntry[]
): void {
  const worksheet = workbook.addWorksheet('RFIs & Analyst Notes');

  const headers = [
    'Timestamp',
    'Sheet',
    'Row #',
    'Field Name',
    'Note Type',
    'Category',
    'Confidence',
    'Detected By',
    'Summary',
    'Details',
    'Source URL',
    'PDF Size (MB)',
    'Link Hint',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF1F2937' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFF59E0B' } },
    };
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  if (entries.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: entries.length + 1, column: headers.length },
    };
  }

  entries.forEach((entry) => {
    const row = worksheet.addRow([
      entry.timestamp,
      entry.sheet,
      entry.rowNumber,
      entry.fieldName,
      entry.noteType,
      entry.category,
      entry.confidence,
      entry.detectedBy,
      entry.summary,
      entry.details,
      entry.sourceUrl,
      entry.pdfSizeMB,
      entry.linkHint,
    ]);

    const categoryColors = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.RFI_COMMENT;
    const colCount = headers.length;

    for (let i = 1; i <= colCount; i++) {
      const cell = row.getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: categoryColors.fill },
      };
      if (i === 1) {
        cell.border = {
          left: { style: 'thick', color: { argb: categoryColors.border } },
        };
      }
    }
  });

  const columnWidths = [22, 16, 8, 20, 18, 18, 12, 12, 35, 50, 40, 14, 22];
  worksheet.columns.forEach((column, index) => {
    column.width = columnWidths[index] || 18;
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
  options: ExportOptions,
  contractFailureOverrides: ContractFailureOverrides = {}
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
      modificationHistory,
      anomalyMap
    );
  });

  if (options.includeChangeLog) {
    const changeLogEntries = buildChangeLogEntries(dataset, modificationHistory, anomalyMap, sheetsToExport, contractFailureOverrides);
    sheetsToExport.forEach((sheetName) => {
      addChangeLogSheet(workbook, sheetName, changeLogEntries);
    });

    const rfiNotesEntries = buildRfiNotesEntries(dataset, rfiComments, fieldStatuses, anomalyMap, sheetsToExport, contractFailureOverrides);
    addRfiAnalystNotesSheet(workbook, rfiNotesEntries);
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
  options: ExportOptions = { includeChangeLog: false, exportAllSheets: false },
  contractFailureOverrides: ContractFailureOverrides = {}
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
      options,
      contractFailureOverrides
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
