import { FieldStatus, RfiComments, ModificationHistory, AnomalyMap, Anomaly } from '../types';

export type RowAttentionCategory = 'rfi' | 'anomaly' | 'blacklist_hit' | 'incomplete_address' | 'manual_edit_unreviewed' | 'contract_error' | 'contract_text_unreadable' | 'contract_extraction_suspect' | 'contract_not_applicable' | 'none';

export interface RowAttentionResult {
  needsAttention: boolean;
  category: RowAttentionCategory;
  rfiCount: number;
  anomalyCount: number;
  blacklistHitCount: number;
  incompleteAddressCount: number;
  manualEditCount: number;
  contractErrorCount: number;
  unreadableTextCount: number;
  extractionSuspectCount: number;
  notApplicableCount: number;
}

export interface FieldAttentionResult {
  needsAttention: boolean;
  hasRfi: boolean;
  hasMustReviewAnomaly: boolean;
  hasBlacklistHit: boolean;
  hasIncompleteAddress: boolean;
  hasManualEdit: boolean;
  hasContractError: boolean;
  hasUnreadableText: boolean;
  hasExtractionSuspect: boolean;
  hasNotApplicable: boolean;
}

const MUST_REVIEW_ANOMALY_TYPES = new Set([
  'invalid_allowed_value',
  'unexpected_missing',
  'blacklist_hit',
  'contract_load_error',
  'contract_text_unreadable',
  'contract_extraction_suspect',
  'contract_not_applicable',
]);

const MUST_REVIEW_MODIFICATION_TYPES = new Set(['incomplete_address']);

export function isMustReviewAnomaly(anomaly: Anomaly): boolean {
  return MUST_REVIEW_ANOMALY_TYPES.has(anomaly.type);
}

export function isSystemFormatOnlyModification(modificationType: string): boolean {
  return modificationType === 'address_standardized';
}

export function getFieldAttention(
  sheetName: string,
  rowIndex: number,
  fieldName: string,
  fieldStatuses: FieldStatus,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap
): FieldAttentionResult {
  const hasRfi = fieldStatuses[sheetName]?.[rowIndex]?.[fieldName] === 'rfi' ||
    !!rfiComments[sheetName]?.[rowIndex]?.[fieldName];

  const fieldAnomalies = anomalyMap[sheetName]?.[rowIndex]?.[fieldName] || [];
  const hasMustReviewAnomaly = fieldAnomalies.some(isMustReviewAnomaly);
  const hasBlacklistHit = fieldAnomalies.some((a) => a.type === 'blacklist_hit');
  const hasContractError = fieldAnomalies.some((a) => a.type === 'contract_load_error');
  const hasUnreadableText = fieldAnomalies.some((a) => a.type === 'contract_text_unreadable');
  const hasExtractionSuspect = fieldAnomalies.some((a) => a.type === 'contract_extraction_suspect');
  const hasNotApplicable = fieldAnomalies.some((a) => a.type === 'contract_not_applicable');

  const modification = modificationHistory[sheetName]?.[rowIndex]?.[fieldName];
  const hasIncompleteAddress = modification?.modificationType === 'incomplete_address';
  const hasManualEdit = modification?.modificationType === 'manual_edit';

  const needsAttention = hasRfi || hasMustReviewAnomaly || hasIncompleteAddress || hasManualEdit || hasContractError || hasUnreadableText || hasExtractionSuspect || hasNotApplicable;

  return {
    needsAttention,
    hasRfi,
    hasMustReviewAnomaly,
    hasBlacklistHit,
    hasIncompleteAddress,
    hasManualEdit,
    hasContractError,
    hasUnreadableText,
    hasExtractionSuspect,
    hasNotApplicable,
  };
}

export function getRowAttention(
  sheetName: string,
  rowIndex: number,
  headers: string[],
  fieldStatuses: FieldStatus,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  anomalyMap: AnomalyMap
): RowAttentionResult {
  const editableHeaders = headers.slice(2);

  let rfiCount = 0;
  let anomalyCount = 0;
  let blacklistHitCount = 0;
  let incompleteAddressCount = 0;
  let manualEditCount = 0;
  let contractErrorCount = 0;
  let unreadableTextCount = 0;
  let extractionSuspectCount = 0;
  let notApplicableCount = 0;

  for (const header of editableHeaders) {
    const fieldAttention = getFieldAttention(
      sheetName,
      rowIndex,
      header,
      fieldStatuses,
      rfiComments,
      modificationHistory,
      anomalyMap
    );

    if (fieldAttention.hasRfi) rfiCount++;
    if (fieldAttention.hasMustReviewAnomaly) anomalyCount++;
    if (fieldAttention.hasBlacklistHit) blacklistHitCount++;
    if (fieldAttention.hasIncompleteAddress) incompleteAddressCount++;
    if (fieldAttention.hasManualEdit) manualEditCount++;
    if (fieldAttention.hasContractError) contractErrorCount++;
    if (fieldAttention.hasUnreadableText) unreadableTextCount++;
    if (fieldAttention.hasExtractionSuspect) extractionSuspectCount++;
    if (fieldAttention.hasNotApplicable) notApplicableCount++;
  }

  const contractFieldAnomalies = anomalyMap[sheetName]?.[rowIndex]?.[headers[1]] || [];
  const hasContractFieldError = contractFieldAnomalies.some((a) => a.type === 'contract_load_error');
  if (hasContractFieldError) contractErrorCount++;
  const hasContractUnreadableText = contractFieldAnomalies.some((a) => a.type === 'contract_text_unreadable');
  if (hasContractUnreadableText) unreadableTextCount++;
  const hasContractExtractionSuspect = contractFieldAnomalies.some((a) => a.type === 'contract_extraction_suspect');
  if (hasContractExtractionSuspect) extractionSuspectCount++;
  const hasContractNotApplicable = contractFieldAnomalies.some((a) => a.type === 'contract_not_applicable');
  if (hasContractNotApplicable) notApplicableCount++;

  const needsAttention = rfiCount > 0 || anomalyCount > 0 || incompleteAddressCount > 0 || contractErrorCount > 0 || unreadableTextCount > 0 || extractionSuspectCount > 0 || notApplicableCount > 0;

  let category: RowAttentionCategory = 'none';
  if (rfiCount > 0) {
    category = 'rfi';
  } else if (contractErrorCount > 0) {
    category = 'contract_error';
  } else if (unreadableTextCount > 0) {
    category = 'contract_text_unreadable';
  } else if (extractionSuspectCount > 0) {
    category = 'contract_extraction_suspect';
  } else if (notApplicableCount > 0) {
    category = 'contract_not_applicable';
  } else if (blacklistHitCount > 0) {
    category = 'blacklist_hit';
  } else if (anomalyCount > 0) {
    category = 'anomaly';
  } else if (incompleteAddressCount > 0) {
    category = 'incomplete_address';
  } else if (manualEditCount > 0) {
    category = 'manual_edit_unreviewed';
  }

  return {
    needsAttention,
    category,
    rfiCount,
    anomalyCount,
    blacklistHitCount,
    incompleteAddressCount,
    manualEditCount,
    contractErrorCount,
    unreadableTextCount,
    extractionSuspectCount,
    notApplicableCount,
  };
}

export function getAttentionSortPriority(attention: RowAttentionResult, rowStatus: 'complete' | 'incomplete'): number {
  if (attention.needsAttention) {
    if (attention.rfiCount > 0) return 0;
    if (attention.contractErrorCount > 0) return 1;
    if (attention.unreadableTextCount > 0) return 2;
    if (attention.extractionSuspectCount > 0) return 3;
    if (attention.notApplicableCount > 0) return 4;
    if (attention.blacklistHitCount > 0) return 5;
    if (attention.anomalyCount > 0) return 6;
    if (attention.incompleteAddressCount > 0) return 7;
    return 8;
  }
  if (rowStatus === 'incomplete') return 10;
  return 20;
}
