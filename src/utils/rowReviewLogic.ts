import {
  RowReviewReason,
  RowReviewStatus,
  FieldStatus,
  AnomalyMap,
  RfiComments,
  ModificationHistory,
  RowStatus,
} from '../types';
import { getRowAttention } from './attentionLogic';

export function deriveRowReviewReason(
  sheetName: string,
  rowIndex: number,
  headers: string[],
  fieldStatuses: FieldStatus,
  anomalyMap: AnomalyMap,
  rfiComments: RfiComments,
  modificationHistory: ModificationHistory,
  rowStatuses: RowStatus
): RowReviewStatus {
  const attention = getRowAttention(
    sheetName,
    rowIndex,
    headers,
    fieldStatuses,
    rfiComments,
    modificationHistory,
    anomalyMap
  );

  const rowStatus = rowStatuses[sheetName]?.[rowIndex] || 'incomplete';
  const now = new Date().toISOString();

  if (attention.notApplicableCount > 0) {
    return {
      reason: 'document_not_applicable',
      isBlocking: true,
      derivedAt: now,
      details: 'Document flagged as not applicable',
    };
  }

  if (attention.contractErrorCount > 0) {
    return {
      reason: 'manual_pdf_review_required',
      isBlocking: true,
      derivedAt: now,
      details: `${attention.contractErrorCount} contract(s) failed to load and need manual review`,
    };
  }

  if (attention.unreadableTextCount > 0) {
    return {
      reason: 'manual_pdf_review_required',
      isBlocking: true,
      derivedAt: now,
      details: `${attention.unreadableTextCount} contract(s) have unreadable text layers`,
    };
  }

  if (attention.extractionSuspectCount > 0) {
    return {
      reason: 'manual_data_review_required',
      isBlocking: true,
      derivedAt: now,
      details: `${attention.extractionSuspectCount} field(s) have suspect data extraction`,
    };
  }

  if (attention.blacklistHitCount > 0) {
    return {
      reason: 'blacklist_hit',
      isBlocking: true,
      derivedAt: now,
      details: `${attention.blacklistHitCount} field(s) contain blacklisted values`,
    };
  }

  if (attention.rfiCount > 0) {
    return {
      reason: 'rfi_required',
      isBlocking: true,
      derivedAt: now,
      details: `${attention.rfiCount} field(s) require additional information`,
    };
  }

  if (attention.anomalyCount > 0) {
    return {
      reason: 'anomaly_detected',
      isBlocking: true,
      derivedAt: now,
      details: `${attention.anomalyCount} field(s) have anomalies that need review`,
    };
  }

  if (rowStatus === 'complete') {
    return {
      reason: 'finalized',
      isBlocking: false,
      derivedAt: now,
      details: 'Row has been reviewed and finalized',
    };
  }

  return {
    reason: 'ready_to_finalize',
    isBlocking: false,
    derivedAt: now,
    details: 'All blocking issues resolved, ready to finalize',
  };
}

export function getReviewReasonLabel(reason: RowReviewReason): string {
  switch (reason) {
    case 'manual_pdf_review_required':
      return 'Manual PDF Review';
    case 'manual_data_review_required':
      return 'Manual Data Review';
    case 'document_not_applicable':
      return 'Not Applicable';
    case 'blacklist_hit':
      return 'Blacklist Hit';
    case 'rfi_required':
      return 'RFI Required';
    case 'anomaly_detected':
      return 'Anomaly Detected';
    case 'ready_to_finalize':
      return 'Ready to Finalize';
    case 'finalized':
      return 'Finalized';
  }
}

export function getReviewReasonColor(reason: RowReviewReason): string {
  switch (reason) {
    case 'manual_pdf_review_required':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'manual_data_review_required':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'document_not_applicable':
      return 'bg-slate-100 text-slate-800 border-slate-300';
    case 'blacklist_hit':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'rfi_required':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'anomaly_detected':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'ready_to_finalize':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'finalized':
      return 'bg-gray-100 text-gray-600 border-gray-300';
  }
}

export function getReviewReasonPriority(reason: RowReviewReason): number {
  switch (reason) {
    case 'document_not_applicable':
      return 0;
    case 'manual_pdf_review_required':
      return 1;
    case 'manual_data_review_required':
      return 2;
    case 'blacklist_hit':
      return 3;
    case 'rfi_required':
      return 4;
    case 'anomaly_detected':
      return 5;
    case 'ready_to_finalize':
      return 6;
    case 'finalized':
      return 7;
  }
}

export function isBlockingReason(reason: RowReviewReason): boolean {
  return [
    'manual_pdf_review_required',
    'manual_data_review_required',
    'document_not_applicable',
    'blacklist_hit',
    'rfi_required',
    'anomaly_detected',
  ].includes(reason);
}
