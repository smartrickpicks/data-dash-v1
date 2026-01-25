import { Anomaly, ExtractionSuspectMeta, NormalizedGlossary, RowData, GlossaryEntry } from '../types';

const INVALID_PLACEHOLDERS = new Set([
  '',
  'n/a',
  'na',
  'not applicable',
  '-',
  'none',
  'null',
  'unknown',
]);

const MIN_REQUIRED_FIELDS_FOR_CHECK = 2;

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

function normalizeFieldNameForGlossary(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/[^\w_]/g, '')
    .replace(/(__c|_c)$/i, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isSubAddressField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[\s_-]+/g, '');
  return SUB_ADDRESS_FIELDS.has(normalized);
}

function isPlaceholderValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return INVALID_PLACEHOLDERS.has(normalized);
}

function isRequiredTextField(glossaryEntry: GlossaryEntry | null | undefined): boolean {
  if (!glossaryEntry) return false;
  if (glossaryEntry.required_status !== 'Required') return false;

  const dataType = glossaryEntry.data_type?.toLowerCase();
  const eligibleTypes = ['text', 'string', 'address', 'identifier'];
  if (!dataType || !eligibleTypes.includes(dataType)) return false;

  if (glossaryEntry.allowed_values && glossaryEntry.allowed_values.length > 0) {
    return false;
  }

  return true;
}

function isEnumField(glossaryEntry: GlossaryEntry | null | undefined): boolean {
  if (!glossaryEntry) return false;
  return !!(glossaryEntry.allowed_values && glossaryEntry.allowed_values.length > 0);
}

export interface PlaceholderFailure {
  fieldName: string;
  value: string;
}

export interface InvalidOptionFailure {
  fieldName: string;
  value: string;
  allowedValues: string[];
}

export function detectPlaceholderFailures(
  row: RowData,
  headers: string[],
  glossary: NormalizedGlossary
): PlaceholderFailure[] {
  const failures: PlaceholderFailure[] = [];
  const editableHeaders = headers.slice(2);

  for (const fieldName of editableHeaders) {
    if (isSubAddressField(fieldName)) continue;

    const normalizedKey = normalizeFieldNameForGlossary(fieldName);
    const glossaryEntry = glossary[normalizedKey];

    if (!isRequiredTextField(glossaryEntry)) continue;

    const value = row[fieldName];
    if (isPlaceholderValue(value)) {
      failures.push({
        fieldName,
        value: value === null || value === undefined ? '' : String(value),
      });
    }
  }

  return failures;
}

export function detectInvalidOptionValues(
  row: RowData,
  headers: string[],
  glossary: NormalizedGlossary
): InvalidOptionFailure[] {
  const failures: InvalidOptionFailure[] = [];
  const editableHeaders = headers.slice(2);

  for (const fieldName of editableHeaders) {
    const normalizedKey = normalizeFieldNameForGlossary(fieldName);
    const glossaryEntry = glossary[normalizedKey];

    if (!isEnumField(glossaryEntry)) continue;

    const value = row[fieldName];
    if (isPlaceholderValue(value)) continue;

    if (value === null || value === undefined) continue;
    const stringValue = String(value).trim();
    if (stringValue === '') continue;

    const allowedValues = glossaryEntry!.allowed_values!;
    const normalizedAllowed = allowedValues.map(v => v.toLowerCase().trim());
    const normalizedValue = stringValue.toLowerCase();

    if (!normalizedAllowed.includes(normalizedValue)) {
      failures.push({
        fieldName,
        value: stringValue,
        allowedValues,
      });
    }
  }

  return failures;
}

export function getRequiredTextFieldCount(
  headers: string[],
  glossary: NormalizedGlossary
): number {
  const editableHeaders = headers.slice(2);
  let count = 0;

  for (const fieldName of editableHeaders) {
    if (isSubAddressField(fieldName)) continue;

    const normalizedKey = normalizeFieldNameForGlossary(fieldName);
    const glossaryEntry = glossary[normalizedKey];

    if (isRequiredTextField(glossaryEntry)) {
      count++;
    }
  }

  return count;
}

export function computeExtractionSuspectAnomaly(
  row: RowData,
  headers: string[],
  glossary: NormalizedGlossary
): Anomaly | null {
  if (!glossary || Object.keys(glossary).length === 0) {
    return null;
  }

  const requiredCheckedCount = getRequiredTextFieldCount(headers, glossary);

  if (requiredCheckedCount < MIN_REQUIRED_FIELDS_FOR_CHECK) {
    return null;
  }

  const placeholderFailures = detectPlaceholderFailures(row, headers, glossary);
  const invalidOptionFailures = detectInvalidOptionValues(row, headers, glossary);

  if (placeholderFailures.length === 0 && invalidOptionFailures.length === 0) {
    return null;
  }

  const reasons: string[] = [];
  if (placeholderFailures.length > 0) {
    const fieldNames = placeholderFailures.map(f => f.fieldName).join(', ');
    reasons.push(`Placeholder values in required fields: ${fieldNames}`);
  }
  if (invalidOptionFailures.length > 0) {
    const fieldNames = invalidOptionFailures.map(f => f.fieldName).join(', ');
    reasons.push(`Invalid option values: ${fieldNames}`);
  }

  const confidence: 'high' | 'medium' | 'low' =
    placeholderFailures.length >= 2 || invalidOptionFailures.length >= 2
      ? 'high'
      : 'medium';

  const meta: ExtractionSuspectMeta = {
    decision: 'suspect',
    confidence,
    requiredCheckedCount,
    placeholderFailures,
    invalidOptionFailures,
    reason: reasons.join('; '),
    detectedAt: new Date().toISOString(),
  };

  return {
    type: 'contract_extraction_suspect',
    severity: 'warn',
    message: `Suspect extraction detected: ${reasons.join('; ')}`,
    extractionSuspectMeta: meta,
  };
}

export function shouldRecomputeExtractionAnomaly(
  existingAnomaly: Anomaly | undefined,
  row: RowData,
  headers: string[],
  glossary: NormalizedGlossary
): { changed: boolean; newAnomaly: Anomaly | null } {
  const newAnomaly = computeExtractionSuspectAnomaly(row, headers, glossary);

  if (!existingAnomaly && !newAnomaly) {
    return { changed: false, newAnomaly: null };
  }

  if (!existingAnomaly && newAnomaly) {
    return { changed: true, newAnomaly };
  }

  if (existingAnomaly && !newAnomaly) {
    return { changed: true, newAnomaly: null };
  }

  const existingMeta = existingAnomaly!.extractionSuspectMeta;
  const newMeta = newAnomaly!.extractionSuspectMeta;

  if (!existingMeta || !newMeta) {
    return { changed: true, newAnomaly };
  }

  const existingPlaceholders = existingMeta.placeholderFailures.map(f => f.fieldName).sort().join(',');
  const newPlaceholders = newMeta.placeholderFailures.map(f => f.fieldName).sort().join(',');
  const existingInvalid = existingMeta.invalidOptionFailures.map(f => f.fieldName).sort().join(',');
  const newInvalid = newMeta.invalidOptionFailures.map(f => f.fieldName).sort().join(',');

  if (existingPlaceholders !== newPlaceholders || existingInvalid !== newInvalid) {
    return { changed: true, newAnomaly };
  }

  return { changed: false, newAnomaly: existingAnomaly };
}
