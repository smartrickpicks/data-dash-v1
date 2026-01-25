import { Anomaly, AnomalyType } from '../types';

const MANUAL_REVIEW_ANOMALY_TYPES: AnomalyType[] = [
  'contract_load_error',
  'contract_text_unreadable',
  'contract_extraction_suspect',
  'contract_not_applicable',
];

const MANUAL_REVIEW_PRIORITY: Record<AnomalyType, number> = {
  'contract_load_error': 1,
  'contract_text_unreadable': 2,
  'contract_extraction_suspect': 3,
  'contract_not_applicable': 4,
  'blacklist_hit': 5,
  'invalid_allowed_value': 6,
  'unexpected_missing': 7,
};

const MANUAL_REVIEW_LABELS: Record<AnomalyType, string> = {
  'contract_load_error': 'Manual PDF Review: Contract failed to load',
  'contract_text_unreadable': 'Manual PDF Review: Unreadable text layer',
  'contract_extraction_suspect': 'Manual Data Review: Suspect extraction',
  'contract_not_applicable': 'Manual Review: Not applicable document',
  'blacklist_hit': 'Blacklist hit',
  'invalid_allowed_value': 'Invalid option value',
  'unexpected_missing': 'Unexpected missing value',
};

const MANUAL_REVIEW_SHORT_LABELS: Record<AnomalyType, string> = {
  'contract_load_error': 'PDF Load Error',
  'contract_text_unreadable': 'Unreadable PDF',
  'contract_extraction_suspect': 'Suspect Data',
  'contract_not_applicable': 'Not Applicable',
  'blacklist_hit': 'Blacklist',
  'invalid_allowed_value': 'Invalid Value',
  'unexpected_missing': 'Missing Value',
};

export function isManualReviewRequired(anomalies: Anomaly[]): boolean {
  if (!anomalies || anomalies.length === 0) return false;
  return anomalies.some(a => MANUAL_REVIEW_ANOMALY_TYPES.includes(a.type));
}

export function isManualReviewAnomalyType(type: AnomalyType): boolean {
  return MANUAL_REVIEW_ANOMALY_TYPES.includes(type);
}

export function getManualReviewReasons(anomalies: Anomaly[]): string[] {
  if (!anomalies || anomalies.length === 0) return [];

  const reasons: string[] = [];
  const seen = new Set<AnomalyType>();

  for (const anomaly of anomalies) {
    if (MANUAL_REVIEW_ANOMALY_TYPES.includes(anomaly.type) && !seen.has(anomaly.type)) {
      seen.add(anomaly.type);
      reasons.push(MANUAL_REVIEW_LABELS[anomaly.type]);
    }
  }

  return reasons.sort((a, b) => {
    const typeA = Object.entries(MANUAL_REVIEW_LABELS).find(([, v]) => v === a)?.[0] as AnomalyType;
    const typeB = Object.entries(MANUAL_REVIEW_LABELS).find(([, v]) => v === b)?.[0] as AnomalyType;
    return (MANUAL_REVIEW_PRIORITY[typeA] || 99) - (MANUAL_REVIEW_PRIORITY[typeB] || 99);
  });
}

export function getManualReviewPriority(type: AnomalyType): number {
  return MANUAL_REVIEW_PRIORITY[type] || 99;
}

export interface ManualReviewBadge {
  label: string;
  shortLabel: string;
  severity: 'error' | 'warning' | 'info';
  anomalyType: AnomalyType;
}

export function getManualReviewBadge(anomalies: Anomaly[]): ManualReviewBadge | null {
  if (!anomalies || anomalies.length === 0) return null;

  const manualReviewAnomalies = anomalies
    .filter(a => MANUAL_REVIEW_ANOMALY_TYPES.includes(a.type))
    .sort((a, b) => getManualReviewPriority(a.type) - getManualReviewPriority(b.type));

  if (manualReviewAnomalies.length === 0) return null;

  const highest = manualReviewAnomalies[0];
  const severity: 'error' | 'warning' | 'info' =
    highest.type === 'contract_load_error' || highest.type === 'contract_text_unreadable'
      ? 'error'
      : highest.type === 'contract_extraction_suspect'
        ? 'warning'
        : 'info';

  return {
    label: MANUAL_REVIEW_LABELS[highest.type],
    shortLabel: MANUAL_REVIEW_SHORT_LABELS[highest.type],
    severity,
    anomalyType: highest.type,
  };
}

export function getAllRowAnomalies(
  sheetAnomalies: { [rowIndex: number]: { [fieldName: string]: Anomaly[] } } | undefined,
  rowIndex: number
): Anomaly[] {
  if (!sheetAnomalies) return [];
  const rowAnomalies = sheetAnomalies[rowIndex];
  if (!rowAnomalies) return [];

  const allAnomalies: Anomaly[] = [];
  for (const fieldAnomalies of Object.values(rowAnomalies)) {
    allAnomalies.push(...fieldAnomalies);
  }
  return allAnomalies;
}

export function hasManualReviewAnomaly(
  sheetAnomalies: { [rowIndex: number]: { [fieldName: string]: Anomaly[] } } | undefined,
  rowIndex: number
): boolean {
  const anomalies = getAllRowAnomalies(sheetAnomalies, rowIndex);
  return isManualReviewRequired(anomalies);
}
