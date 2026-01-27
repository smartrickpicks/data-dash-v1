import {
  Dataset,
  AnomalyMap,
  Anomaly,
  RfiComments,
  FieldStatus,
  ManualReviewRow,
  ManualReviewReason,
  RfiCommentRow,
  FlaggedDocumentRow,
  AnomalyType,
} from '../types';
import { getAllRowAnomalies, getManualReviewPriority } from './manualReviewLogic';

const MANUAL_REVIEW_ANOMALY_TYPES: AnomalyType[] = [
  'contract_load_error',
  'contract_text_unreadable',
  'contract_extraction_suspect',
  'contract_not_applicable',
];

export interface AnomalyCounts {
  contractLoadError: number;
  contractTextUnreadable: number;
  contractExtractionSuspect: number;
  contractNotApplicable: number;
  blacklistHit: number;
  totalRfis: number;
  totalManualReviewRows: number;
}

function findContractUrlField(headers: string[]): string | null {
  const candidates = ['contract_url', 'contracturl', 'contract', 'url', 'link', 'pdf_url', 'pdfurl'];
  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[_\s-]/g, '');
    if (candidates.some(c => normalized.includes(c) || c.includes(normalized))) {
      return header;
    }
  }
  return null;
}

function findFileNameField(headers: string[]): string | null {
  const candidates = ['file_name', 'filename', 'contract_name', 'contractname', 'name', 'document'];
  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[_\s-]/g, '');
    if (candidates.some(c => normalized.includes(c) || c.includes(normalized))) {
      return header;
    }
  }
  return headers[0] || null;
}

function getPriorityFromReasons(reasons: ManualReviewReason[]): 'high' | 'medium' | 'low' {
  if (reasons.length === 0) return 'low';
  const highPriority = reasons.some(r =>
    r.type === 'contract_load_error' || r.type === 'contract_text_unreadable'
  );
  if (highPriority) return 'high';
  const mediumPriority = reasons.some(r =>
    r.type === 'contract_extraction_suspect' || r.type === 'blacklist_hit'
  );
  if (mediumPriority) return 'medium';
  return 'low';
}

export function getAnomalyCounts(
  dataset: Dataset | null,
  anomalyMap: AnomalyMap,
  rfiComments: RfiComments,
  fieldStatuses: FieldStatus
): AnomalyCounts {
  const counts: AnomalyCounts = {
    contractLoadError: 0,
    contractTextUnreadable: 0,
    contractExtractionSuspect: 0,
    contractNotApplicable: 0,
    blacklistHit: 0,
    totalRfis: 0,
    totalManualReviewRows: 0,
  };

  if (!dataset) return counts;

  const countedRows = new Set<string>();

  for (const sheet of dataset.sheets) {
    const sheetAnomalies = anomalyMap[sheet.name];
    if (!sheetAnomalies) continue;

    for (const [rowIndexStr, fieldAnomalies] of Object.entries(sheetAnomalies)) {
      const rowIndex = parseInt(rowIndexStr, 10);
      const rowKey = `${sheet.name}_${rowIndex}`;
      let hasManualReview = false;

      for (const anomalies of Object.values(fieldAnomalies)) {
        for (const anomaly of anomalies) {
          switch (anomaly.type) {
            case 'contract_load_error':
              counts.contractLoadError++;
              hasManualReview = true;
              break;
            case 'contract_text_unreadable':
              counts.contractTextUnreadable++;
              hasManualReview = true;
              break;
            case 'contract_extraction_suspect':
              counts.contractExtractionSuspect++;
              hasManualReview = true;
              break;
            case 'contract_not_applicable':
              counts.contractNotApplicable++;
              hasManualReview = true;
              break;
            case 'blacklist_hit':
              counts.blacklistHit++;
              break;
          }
        }
      }

      if (hasManualReview && !countedRows.has(rowKey)) {
        countedRows.add(rowKey);
        counts.totalManualReviewRows++;
      }
    }
  }

  for (const sheet of dataset.sheets) {
    const sheetRfis = rfiComments[sheet.name];
    const sheetFieldStatuses = fieldStatuses[sheet.name];

    if (sheetRfis) {
      for (const fieldComments of Object.values(sheetRfis)) {
        for (const comment of Object.values(fieldComments)) {
          if (comment) counts.totalRfis++;
        }
      }
    }

    if (sheetFieldStatuses) {
      for (const fieldStatusMap of Object.values(sheetFieldStatuses)) {
        for (const status of Object.values(fieldStatusMap)) {
          if (status === 'rfi') {
            const hasComment = Object.values(sheetRfis || {}).some(
              fc => Object.values(fc).some(c => c)
            );
            if (!hasComment) counts.totalRfis++;
          }
        }
      }
    }
  }

  return counts;
}

export function getRowsNeedingManualReview(
  dataset: Dataset | null,
  anomalyMap: AnomalyMap
): ManualReviewRow[] {
  if (!dataset) return [];

  const rows: ManualReviewRow[] = [];

  for (const sheet of dataset.sheets) {
    const sheetAnomalies = anomalyMap[sheet.name];
    if (!sheetAnomalies) continue;

    const contractUrlField = findContractUrlField(sheet.headers);
    const fileNameField = findFileNameField(sheet.headers);

    for (const [rowIndexStr, fieldAnomalies] of Object.entries(sheetAnomalies)) {
      const rowIndex = parseInt(rowIndexStr, 10);
      const row = sheet.rows[rowIndex];
      if (!row) continue;

      const allAnomalies = getAllRowAnomalies(sheetAnomalies, rowIndex);
      const manualReviewAnomalies = allAnomalies.filter(a =>
        MANUAL_REVIEW_ANOMALY_TYPES.includes(a.type)
      );

      if (manualReviewAnomalies.length === 0) continue;

      const reasons: ManualReviewReason[] = [];
      const seenTypes = new Set<AnomalyType>();

      for (const anomaly of manualReviewAnomalies) {
        if (seenTypes.has(anomaly.type)) continue;
        seenTypes.add(anomaly.type);

        let detectedAt: string | undefined;
        let confidence: string | undefined;

        if (anomaly.type === 'contract_load_error' && anomaly.failureMeta) {
          detectedAt = anomaly.failureMeta.detectedAt;
          confidence = anomaly.failureMeta.confidence;
        } else if (anomaly.type === 'contract_text_unreadable' && anomaly.unreadableTextMeta) {
          detectedAt = anomaly.unreadableTextMeta.detectedAt;
          confidence = anomaly.unreadableTextMeta.confidence;
        } else if (anomaly.type === 'contract_extraction_suspect' && anomaly.extractionSuspectMeta) {
          detectedAt = anomaly.extractionSuspectMeta.detectedAt;
          confidence = anomaly.extractionSuspectMeta.confidence;
        } else if (anomaly.type === 'contract_not_applicable' && anomaly.notApplicableMeta) {
          detectedAt = anomaly.notApplicableMeta.timestampISO;
          confidence = 'manual';
        }

        reasons.push({
          type: anomaly.type,
          message: anomaly.message,
          confidence,
          detectedAt,
        });
      }

      reasons.sort((a, b) => getManualReviewPriority(a.type) - getManualReviewPriority(b.type));

      rows.push({
        sheetName: sheet.name,
        rowIndex,
        contractUrl: contractUrlField ? String(row[contractUrlField] ?? '') : '',
        contractFileName: fileNameField ? String(row[fileNameField] ?? '') : `Row ${rowIndex + 1}`,
        reasons,
        priority: getPriorityFromReasons(reasons),
      });
    }
  }

  rows.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.sheetName !== b.sheetName) return a.sheetName.localeCompare(b.sheetName);
    return a.rowIndex - b.rowIndex;
  });

  return rows;
}

export function getRfiAndCommentRows(
  dataset: Dataset | null,
  rfiComments: RfiComments,
  fieldStatuses: FieldStatus
): RfiCommentRow[] {
  if (!dataset) return [];

  const rows: RfiCommentRow[] = [];

  for (const sheet of dataset.sheets) {
    const sheetRfis = rfiComments[sheet.name];
    const sheetFieldStatuses = fieldStatuses[sheet.name];

    if (sheetRfis) {
      for (const [rowIndexStr, fieldComments] of Object.entries(sheetRfis)) {
        const rowIndex = parseInt(rowIndexStr, 10);
        for (const [fieldName, comment] of Object.entries(fieldComments)) {
          if (comment) {
            rows.push({
              sheetName: sheet.name,
              rowIndex,
              fieldName,
              comment,
              severity: 'rfi',
            });
          }
        }
      }
    }

    if (sheetFieldStatuses) {
      for (const [rowIndexStr, fieldStatusMap] of Object.entries(sheetFieldStatuses)) {
        const rowIndex = parseInt(rowIndexStr, 10);
        for (const [fieldName, status] of Object.entries(fieldStatusMap)) {
          if (status === 'rfi') {
            const existingComment = sheetRfis?.[rowIndex]?.[fieldName];
            if (!existingComment) {
              rows.push({
                sheetName: sheet.name,
                rowIndex,
                fieldName,
                comment: 'Field requires further information',
                severity: 'rfi',
              });
            }
          }
        }
      }
    }
  }

  rows.sort((a, b) => {
    if (a.sheetName !== b.sheetName) return a.sheetName.localeCompare(b.sheetName);
    if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
    return a.fieldName.localeCompare(b.fieldName);
  });

  return rows;
}

export function getFlaggedDocuments(
  dataset: Dataset | null,
  anomalyMap: AnomalyMap
): FlaggedDocumentRow[] {
  if (!dataset) return [];

  const rows: FlaggedDocumentRow[] = [];

  for (const sheet of dataset.sheets) {
    const sheetAnomalies = anomalyMap[sheet.name];
    if (!sheetAnomalies) continue;

    const contractUrlField = findContractUrlField(sheet.headers);
    const fileNameField = findFileNameField(sheet.headers);

    for (const [rowIndexStr, fieldAnomalies] of Object.entries(sheetAnomalies)) {
      const rowIndex = parseInt(rowIndexStr, 10);
      const row = sheet.rows[rowIndex];
      if (!row) continue;

      for (const anomalies of Object.values(fieldAnomalies)) {
        for (const anomaly of anomalies) {
          if (anomaly.type === 'contract_not_applicable' && anomaly.notApplicableMeta) {
            rows.push({
              sheetName: sheet.name,
              rowIndex,
              contractUrl: contractUrlField ? String(row[contractUrlField] ?? '') : '',
              contractFileName: fileNameField ? String(row[fileNameField] ?? '') : `Row ${rowIndex + 1}`,
              reasonKey: anomaly.notApplicableMeta.reasonKey,
              freeText: anomaly.notApplicableMeta.freeText || '',
              flaggedAt: anomaly.notApplicableMeta.timestampISO,
            });
            break;
          }
        }
      }
    }
  }

  rows.sort((a, b) => {
    if (a.sheetName !== b.sheetName) return a.sheetName.localeCompare(b.sheetName);
    return a.rowIndex - b.rowIndex;
  });

  return rows;
}

export const NOT_APPLICABLE_REASON_LABELS: Record<string, string> = {
  wrong_doc_type: 'Wrong Document Type',
  duplicate: 'Duplicate Document',
  not_in_scope: 'Not in Scope',
  termination_notice: 'Termination Notice',
  other: 'Other',
};

export function getNotApplicableReasonLabel(reasonKey: string): string {
  return NOT_APPLICABLE_REASON_LABELS[reasonKey] || reasonKey;
}
