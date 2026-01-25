import { GlossaryEntry, NormalizedGlossary, GlossaryInputType, MultiSheetGlossary, MultiSheetGlossaryConfig } from '../types';
import { smartParseValues, hasDelimiter } from './smartValueParser';

const METADATA_VALUES = new Set([
  'optional',
  'required',
  'mandatory',
  'n/a',
  'na',
  'null',
  'empty',
  '-',
]);

export function isMetadataValue(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  return METADATA_VALUES.has(normalized);
}

export function filterAllowedValues(values: string[]): string[] {
  if (!values || values.length === 0) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed || METADATA_VALUES.has(trimmed.toLowerCase())) continue;

    if (trimmed.length > 40 && !hasDelimiter(trimmed)) {
      const parsed = smartParseValues(trimmed);
      if (parsed && parsed.length > 1) {
        for (const item of parsed) {
          const itemTrimmed = item.trim();
          const key = itemTrimmed.toLowerCase();
          if (itemTrimmed && !seen.has(key) && !METADATA_VALUES.has(key)) {
            seen.add(key);
            result.push(itemTrimmed);
          }
        }
        continue;
      }
    }

    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }

  return result;
}

export function shouldShowDropdown(allowedValues: string[] | undefined): boolean {
  if (!allowedValues || allowedValues.length === 0) return false;
  const validOptions = filterAllowedValues(allowedValues);
  return validOptions.length >= 1;
}

export function normalizeFieldKey(fieldName: string): string {
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

export function matchFieldToGlossary(
  fieldHeader: string,
  glossary: NormalizedGlossary
): GlossaryEntry | null {
  const normalizedHeader = normalizeFieldKey(fieldHeader);

  if (glossary[normalizedHeader]) {
    return glossary[normalizedHeader];
  }

  for (const key in glossary) {
    const entry = glossary[key];
    if (entry.synonyms && entry.synonyms.length > 0) {
      const normalizedSynonyms = entry.synonyms.map(s => normalizeFieldKey(s));
      if (normalizedSynonyms.includes(normalizedHeader)) {
        return entry;
      }
    }
  }

  return null;
}

export function parseCommaSeparated(value: string | null | undefined): string[] {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (hasDelimiter(trimmed)) {
    let separator = ',';
    if (trimmed.includes(';') && !trimmed.includes(',')) {
      separator = ';';
    } else if (trimmed.includes('|') && !trimmed.includes(',') && !trimmed.includes(';')) {
      separator = '|';
    } else if (trimmed.includes('\n') && !trimmed.includes(',') && !trimmed.includes(';') && !trimmed.includes('|')) {
      separator = '\n';
    }

    return trimmed
      .split(separator)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  const smartParsed = smartParseValues(trimmed);
  if (smartParsed && smartParsed.length > 1) {
    return smartParsed;
  }

  return [trimmed];
}

export function parseInputType(value: string | null | undefined): GlossaryInputType | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (['text', 'number', 'date', 'select'].includes(normalized)) {
    return normalized as GlossaryInputType;
  }
  return undefined;
}

export function parseRequiredStatus(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();

  if (['required', 'mandatory', 'req', 'must', 'yes', 'y'].includes(normalized)) {
    return 'Required';
  }

  if (['optional', 'opt', 'no', 'n'].includes(normalized)) {
    return 'Optional';
  }

  if (['n/a', 'na', 'not needed', 'not applicable', 'none', '-'].includes(normalized)) {
    return 'Not Needed';
  }

  return undefined;
}

export function parseDataType(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();

  if (['text', 'string', 'str', 'varchar', 'char'].includes(normalized)) {
    return 'text';
  }

  if (['number', 'numeric', 'num', 'int', 'integer', 'float', 'decimal'].includes(normalized)) {
    return 'number';
  }

  if (['date', 'datetime', 'timestamp', 'time'].includes(normalized)) {
    return 'date';
  }

  if (['address', 'addr', 'location'].includes(normalized)) {
    return 'address';
  }

  if (['identifier', 'id', 'key', 'uid', 'uuid'].includes(normalized)) {
    return 'identifier';
  }

  if (['enum', 'option', 'select', 'dropdown', 'choice', 'list'].includes(normalized)) {
    return 'enum';
  }

  if (['boolean', 'bool', 'flag', 'yes/no'].includes(normalized)) {
    return 'boolean';
  }

  return normalized;
}

export function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    return trimmed === '' ||
      trimmed === 'n/a' ||
      trimmed === 'na' ||
      trimmed === 'unknown' ||
      trimmed === 'empty' ||
      trimmed === '-' ||
      trimmed === 'none';
  }
  return false;
}

export function isValueInAllowedList(
  value: unknown,
  allowedValues: string[] | undefined
): boolean {
  if (!allowedValues || allowedValues.length === 0) return true;
  if (value === null || value === undefined) return true;
  const stringValue = String(value).trim().toLowerCase();
  return allowedValues.some(av => av.toLowerCase().trim() === stringValue);
}

export function isNumericValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  const stringValue = String(value).trim();
  if (stringValue === '') return true;
  return !isNaN(Number(stringValue)) && isFinite(Number(stringValue));
}

const GLOSSARY_STORAGE_KEY = 'contractReviewerGlossary';

export function saveGlossaryToStorage(
  entries: NormalizedGlossary,
  config: { fileName: string; sheetName: string; columnMapping: Record<string, string | null> }
): void {
  const data = {
    entries,
    config: {
      ...config,
      importedAt: new Date().toISOString(),
    },
  };
  localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(data));
}

export function loadGlossaryFromStorage(): {
  entries: NormalizedGlossary;
  config: { fileName: string; sheetName: string; columnMapping: Record<string, string | null>; importedAt: string } | null;
} | null {
  const stored = localStorage.getItem(GLOSSARY_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearGlossaryFromStorage(): void {
  localStorage.removeItem(GLOSSARY_STORAGE_KEY);
  localStorage.removeItem(MULTI_GLOSSARY_STORAGE_KEY);
}

const MULTI_GLOSSARY_STORAGE_KEY = 'contractReviewerMultiGlossary';

export function saveMultiSheetGlossaryToStorage(
  entries: MultiSheetGlossary,
  config: MultiSheetGlossaryConfig
): void {
  const data = { entries, config };
  localStorage.setItem(MULTI_GLOSSARY_STORAGE_KEY, JSON.stringify(data));
}

export function loadMultiSheetGlossaryFromStorage(): {
  entries: MultiSheetGlossary;
  config: MultiSheetGlossaryConfig;
} | null {
  const stored = localStorage.getItem(MULTI_GLOSSARY_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function getGlossaryForSheet(
  multiGlossary: MultiSheetGlossary,
  sheetName: string
): NormalizedGlossary {
  return multiGlossary[sheetName] || {};
}

function normalizeSheetName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, '');
}

function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function extractCoreName(sheetName: string): string {
  let name = sheetName.toLowerCase();
  name = name.replace(/[\s_-]+/g, ' ').trim();
  name = name.replace(/\s*(fields?|definitions?|glossary|data|info|list)\s*/gi, ' ');
  name = name.replace(/\s*(v\d+|[-_]\d+|\d+)$/gi, '');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

export function findMatchingGlossarySheet(
  contractSheetName: string,
  glossarySheetNames: string[]
): string | null {
  const normalizedContract = normalizeSheetName(contractSheetName);
  const contractCore = extractCoreName(contractSheetName);
  const contractCoreSingular = singularize(contractCore.replace(/\s+/g, ''));

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const glossarySheet of glossarySheetNames) {
    const normalizedGlossary = normalizeSheetName(glossarySheet);
    const glossaryCore = extractCoreName(glossarySheet);
    const glossaryCoreSingular = singularize(glossaryCore.replace(/\s+/g, ''));

    if (normalizedGlossary === normalizedContract) {
      return glossarySheet;
    }

    if (glossaryCoreSingular === contractCoreSingular) {
      return glossarySheet;
    }

    if (glossaryCore.includes(contractCore) || contractCore.includes(glossaryCore)) {
      const score = Math.min(glossaryCore.length, contractCore.length) / Math.max(glossaryCore.length, contractCore.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = glossarySheet;
      }
    }

    if (normalizedGlossary.includes(normalizedContract) || normalizedContract.includes(normalizedGlossary)) {
      const score = Math.min(normalizedGlossary.length, normalizedContract.length) / Math.max(normalizedGlossary.length, normalizedContract.length) * 0.8;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = glossarySheet;
      }
    }

    const contractWords = contractCore.split(' ').filter(w => w.length > 2);
    const glossaryWords = glossaryCore.split(' ').filter(w => w.length > 2);
    const matchingWords = contractWords.filter(cw =>
      glossaryWords.some(gw => singularize(gw) === singularize(cw) || gw.includes(cw) || cw.includes(gw))
    );
    if (matchingWords.length > 0 && contractWords.length > 0) {
      const score = matchingWords.length / Math.max(contractWords.length, glossaryWords.length) * 0.7;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = glossarySheet;
      }
    }
  }

  return bestScore >= 0.3 ? bestMatch : null;
}
