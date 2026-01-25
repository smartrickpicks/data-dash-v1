import { GlossaryEntry, NormalizedGlossary, RowData, UnreadableTextMeta } from '../types';
import { isValueEmpty } from './glossary';
import { computeGibberishRatio, textContainsValue, isMatchableValue } from './pdfTextNormalize';

export const MIN_ELIGIBLE_FIELDS = 2;
export const MIN_EXTRACTED_TEXT_LENGTH = 200;
export const GIBBERISH_RATIO_THRESHOLD = 0.02;

const SUB_ADDRESS_FIELDS = new Set([
  'city',
  'state',
  'zip',
  'zipcode',
  'postal',
  'postalcode',
  'postal_code',
  'zip_code',
  'country',
]);

export interface EligibleField {
  fieldName: string;
  value: string;
}

/**
 * Determines if a field is eligible for PDF text matching based on glossary-driven rules.
 *
 * A field is eligible if ALL of the following are true:
 * - Has a glossary entry
 * - required_status === "Required"
 * - data_type is one of: "text", "string", "address", "identifier"
 * - Field value is NOT empty AND NOT "N/A"
 * - Field does NOT have allowed_values (enum/option fields are excluded)
 * - Field is NOT a sub-address component (city/state/zip)
 *
 * This ensures only fields expected to appear verbatim in the contract PDF
 * are checked, eliminating false positives from optional, enum, numeric, or derived fields.
 *
 * @param fieldName - The header name of the field
 * @param fieldValue - The current value in the row
 * @param glossaryEntry - The matched glossary entry for this field (if any)
 * @returns true if the field should be checked for PDF text matching
 */
export function isPdfMatchEligibleField(
  fieldName: string,
  fieldValue: unknown,
  glossaryEntry: GlossaryEntry | null | undefined
): boolean {
  if (!glossaryEntry) {
    return false;
  }

  if (glossaryEntry.required_status !== 'Required') {
    return false;
  }

  const dataType = glossaryEntry.data_type?.toLowerCase();
  const eligibleTypes = ['text', 'string', 'address', 'identifier'];
  if (!dataType || !eligibleTypes.includes(dataType)) {
    return false;
  }

  if (isValueEmpty(fieldValue)) {
    return false;
  }

  if (glossaryEntry.allowed_values && glossaryEntry.allowed_values.length > 0) {
    return false;
  }

  const normalizedFieldName = fieldName.toLowerCase().replace(/[\s_-]+/g, '');
  if (SUB_ADDRESS_FIELDS.has(normalizedFieldName)) {
    return false;
  }

  return true;
}

/**
 * Extracts all fields eligible for PDF text matching from a data row.
 *
 * This function:
 * 1. Filters out non-editable fields (first 2 columns)
 * 2. Applies glossary-driven eligibility rules via isPdfMatchEligibleField
 * 3. Returns only fields that should be verified against the PDF text layer
 *
 * When no glossary is loaded or no fields meet eligibility criteria,
 * returns an empty array (which prevents false positive "unreadable" alerts).
 *
 * @param headers - All column headers from the sheet
 * @param currentRow - The data row being analyzed
 * @param glossary - Normalized glossary entries for the current sheet
 * @returns Array of eligible fields with their names and values
 */
export function getEligibleFieldsForPdfMatching(
  headers: string[],
  currentRow: RowData | undefined,
  glossary: NormalizedGlossary
): EligibleField[] {
  if (!currentRow || !headers || headers.length <= 2) {
    return [];
  }

  const editableHeaders = headers.slice(2);
  const eligibleFields: EligibleField[] = [];

  for (const fieldName of editableHeaders) {
    const fieldValue = currentRow[fieldName];

    const normalizedFieldName = fieldName
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/[^\w_]/g, '')
      .replace(/(__c|_c)$/i, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const glossaryEntry = glossary[normalizedFieldName];

    if (isPdfMatchEligibleField(fieldName, fieldValue, glossaryEntry)) {
      eligibleFields.push({
        fieldName,
        value: String(fieldValue).trim(),
      });
    }
  }

  return eligibleFields;
}

/**
 * Fallback logic for when no glossary is loaded.
 * Returns fields with non-empty values longer than 3 characters,
 * maintaining backward compatibility with the original detection logic.
 *
 * @param headers - All column headers from the sheet
 * @param currentRow - The data row being analyzed
 * @returns Array of fields to check against PDF
 */
export function getFallbackFieldsForPdfMatching(
  headers: string[],
  currentRow: RowData | undefined
): EligibleField[] {
  if (!currentRow || !headers || headers.length <= 2) {
    return [];
  }

  const editableHeaders = headers.slice(2);
  const fields: EligibleField[] = [];

  for (const fieldName of editableHeaders) {
    const fieldValue = currentRow[fieldName];

    if (
      fieldValue &&
      typeof fieldValue === 'string' &&
      fieldValue.trim().length > 3 &&
      !isValueEmpty(fieldValue)
    ) {
      fields.push({
        fieldName,
        value: fieldValue.trim(),
      });
    }
  }

  return fields;
}

export interface PdfTextMatchResult {
  eligibleFields: EligibleField[];
  eligibleFieldCount: number;
  matchedFields: EligibleField[];
  matchedFieldCount: number;
  extractedTextLength: number;
  gibberishRatio: number;
  decision: 'unreadable' | 'matchable' | 'insufficient_evidence' | 'text_extraction_failed';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export function evaluatePdfTextMatch(
  extractedText: string,
  eligibleFields: EligibleField[]
): PdfTextMatchResult {
  const extractedTextLength = extractedText?.length || 0;
  const gibberishRatio = computeGibberishRatio(extractedText || '');
  const eligibleFieldCount = eligibleFields.length;

  if (extractedTextLength < MIN_EXTRACTED_TEXT_LENGTH) {
    return {
      eligibleFields,
      eligibleFieldCount,
      matchedFields: [],
      matchedFieldCount: 0,
      extractedTextLength,
      gibberishRatio,
      decision: 'text_extraction_failed',
      confidence: 'medium',
      reason: `Extracted text too short (${extractedTextLength} chars, minimum ${MIN_EXTRACTED_TEXT_LENGTH})`,
    };
  }

  if (gibberishRatio > GIBBERISH_RATIO_THRESHOLD) {
    return {
      eligibleFields,
      eligibleFieldCount,
      matchedFields: [],
      matchedFieldCount: 0,
      extractedTextLength,
      gibberishRatio,
      decision: 'unreadable',
      confidence: 'medium',
      reason: `High gibberish ratio (${(gibberishRatio * 100).toFixed(1)}%, threshold ${GIBBERISH_RATIO_THRESHOLD * 100}%)`,
    };
  }

  if (eligibleFieldCount < MIN_ELIGIBLE_FIELDS) {
    return {
      eligibleFields,
      eligibleFieldCount,
      matchedFields: [],
      matchedFieldCount: 0,
      extractedTextLength,
      gibberishRatio,
      decision: 'insufficient_evidence',
      confidence: 'low',
      reason: `Insufficient eligible fields (${eligibleFieldCount}, minimum ${MIN_ELIGIBLE_FIELDS})`,
    };
  }

  const matchedFields: EligibleField[] = [];
  for (const field of eligibleFields) {
    if (!isMatchableValue(field.value)) continue;
    if (textContainsValue(extractedText, field.value)) {
      matchedFields.push(field);
    }
  }

  const matchedFieldCount = matchedFields.length;

  if (matchedFieldCount === 0) {
    return {
      eligibleFields,
      eligibleFieldCount,
      matchedFields,
      matchedFieldCount,
      extractedTextLength,
      gibberishRatio,
      decision: 'unreadable',
      confidence: 'high',
      reason: `No eligible fields found in PDF text (0/${eligibleFieldCount} matched)`,
    };
  }

  return {
    eligibleFields,
    eligibleFieldCount,
    matchedFields,
    matchedFieldCount,
    extractedTextLength,
    gibberishRatio,
    decision: 'matchable',
    confidence: 'high',
    reason: `${matchedFieldCount}/${eligibleFieldCount} eligible fields found in PDF text`,
  };
}

export function buildUnreadableTextMeta(
  result: PdfTextMatchResult,
  pdfSource: 'direct' | 'proxy',
  sizeBytes?: number
): UnreadableTextMeta {
  return {
    attemptedTerms: result.eligibleFieldCount,
    totalMatches: result.matchedFieldCount,
    sizeBytes,
    note: result.reason,
    detectedAt: new Date().toISOString(),
    eligibleFieldNames: result.eligibleFields.map(f => f.fieldName),
    eligibleFieldCount: result.eligibleFieldCount,
    matchedFieldCount: result.matchedFieldCount,
    pdfSource,
    decision: result.decision,
    confidence: result.confidence,
    extractedTextLength: result.extractedTextLength,
    matchedEligibleFieldNames: result.matchedFields.map(f => f.fieldName),
    gibberishRatio: result.gibberishRatio,
    reason: result.reason,
  };
}
