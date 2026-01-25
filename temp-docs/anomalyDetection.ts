import { Sheet, NormalizedGlossary, Anomaly, AnomalyMap, BlacklistEntry } from '../types';
import { matchFieldToGlossary, filterAllowedValues } from './glossary';
import { isCanonicalNA } from './naNormalization';
import { detectBlacklistAnomalies } from './blacklistDetection';

const MIN_ROWS_FOR_FILL_RATE = 10;
const FILL_RATE_THRESHOLD = 0.90;

function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed === '-';
  }
  return false;
}

function isValueEmptyOrNA(value: unknown): boolean {
  return isValueEmpty(value) || isCanonicalNA(value);
}

export interface FieldFillRates {
  [fieldName: string]: {
    fillRate: number;
    naRate: number;
    totalRows: number;
    nonEmptyNonNA: number;
  };
}

export function computeFieldFillRates(sheet: Sheet): FieldFillRates {
  const editableHeaders = sheet.headers.slice(2);
  const totalRows = sheet.rows.length;
  const rates: FieldFillRates = {};

  for (const header of editableHeaders) {
    let nonEmpty = 0;
    let naCount = 0;

    for (const row of sheet.rows) {
      const value = row[header];
      if (isCanonicalNA(value)) {
        naCount++;
      } else if (!isValueEmpty(value)) {
        nonEmpty++;
      }
    }

    const nonEmptyNonNA = nonEmpty;
    const fillRate = totalRows > 0 ? nonEmptyNonNA / totalRows : 0;
    const naRate = totalRows > 0 ? naCount / totalRows : 0;

    rates[header] = {
      fillRate,
      naRate,
      totalRows,
      nonEmptyNonNA,
    };
  }

  return rates;
}

export function detectInvalidAllowedValue(
  value: unknown,
  allowedValues: string[] | undefined
): Anomaly | null {
  if (!allowedValues || allowedValues.length === 0) return null;

  const filtered = filterAllowedValues(allowedValues);
  if (filtered.length === 0) return null;

  if (isValueEmptyOrNA(value)) return null;

  const stringValue = String(value).trim().toLowerCase();
  const isValid = filtered.some(av => av.toLowerCase().trim() === stringValue);

  if (!isValid) {
    return {
      type: 'invalid_allowed_value',
      severity: 'warn',
      message: 'Value not in allowed options',
      allowedValues: filtered,
    };
  }

  return null;
}

export function detectUnexpectedMissing(
  value: unknown,
  fieldFillRate: number,
  totalRows: number
): Anomaly | null {
  if (totalRows < MIN_ROWS_FOR_FILL_RATE) return null;
  if (fieldFillRate < FILL_RATE_THRESHOLD) return null;
  if (!isValueEmpty(value)) return null;
  if (isCanonicalNA(value)) return null;

  return {
    type: 'unexpected_missing',
    severity: 'warn',
    message: 'Unexpectedly empty (field usually has values)',
  };
}

export function detectFieldAnomalies(
  value: unknown,
  allowedValues: string[] | undefined,
  fieldFillRate: number,
  totalRows: number,
  fieldName?: string,
  blacklistEntries?: BlacklistEntry[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const invalidAllowed = detectInvalidAllowedValue(value, allowedValues);
  if (invalidAllowed) anomalies.push(invalidAllowed);

  const unexpectedMissing = detectUnexpectedMissing(value, fieldFillRate, totalRows);
  if (unexpectedMissing) anomalies.push(unexpectedMissing);

  if (blacklistEntries && blacklistEntries.length > 0 && fieldName) {
    const stringValue = value != null ? String(value) : '';
    const blacklistAnomalies = detectBlacklistAnomalies(stringValue, fieldName, blacklistEntries);
    anomalies.push(...blacklistAnomalies);
  }

  return anomalies;
}

export function computeSheetAnomalies(
  sheet: Sheet,
  glossary: NormalizedGlossary,
  blacklistEntries?: BlacklistEntry[]
): { [rowIndex: number]: { [fieldName: string]: Anomaly[] } } {
  const fillRates = computeFieldFillRates(sheet);
  const editableHeaders = sheet.headers.slice(2);
  const result: { [rowIndex: number]: { [fieldName: string]: Anomaly[] } } = {};

  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
    const row = sheet.rows[rowIndex];
    const rowAnomalies: { [fieldName: string]: Anomaly[] } = {};

    for (const header of editableHeaders) {
      const value = row[header];
      const glossaryEntry = matchFieldToGlossary(header, glossary);
      const allowedValues = glossaryEntry?.allowed_values;
      const fieldRate = fillRates[header];

      const anomalies = detectFieldAnomalies(
        value,
        allowedValues,
        fieldRate?.fillRate ?? 0,
        fieldRate?.totalRows ?? 0,
        header,
        blacklistEntries
      );

      if (anomalies.length > 0) {
        rowAnomalies[header] = anomalies;
      }
    }

    if (Object.keys(rowAnomalies).length > 0) {
      result[rowIndex] = rowAnomalies;
    }
  }

  return result;
}

export function computeDatasetAnomalies(
  sheets: Sheet[],
  glossaryBySheet: { [sheetName: string]: NormalizedGlossary },
  blacklistEntries?: BlacklistEntry[]
): AnomalyMap {
  const result: AnomalyMap = {};

  for (const sheet of sheets) {
    const glossary = glossaryBySheet[sheet.name] || {};
    const sheetAnomalies = computeSheetAnomalies(sheet, glossary, blacklistEntries);
    if (Object.keys(sheetAnomalies).length > 0) {
      result[sheet.name] = sheetAnomalies;
    }
  }

  return result;
}

export function getRowAnomalyCount(
  anomalyMap: AnomalyMap,
  sheetName: string,
  rowIndex: number
): number {
  const sheetAnomalies = anomalyMap[sheetName];
  if (!sheetAnomalies) return 0;
  const rowAnomalies = sheetAnomalies[rowIndex];
  if (!rowAnomalies) return 0;

  let count = 0;
  for (const fieldName in rowAnomalies) {
    count += rowAnomalies[fieldName].length;
  }
  return count;
}

export function getFieldAnomalies(
  anomalyMap: AnomalyMap,
  sheetName: string,
  rowIndex: number,
  fieldName: string
): Anomaly[] {
  return anomalyMap[sheetName]?.[rowIndex]?.[fieldName] || [];
}
