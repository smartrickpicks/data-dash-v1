import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Dataset, Sheet, RowData, GlossarySheetData, GlossarySheetCandidate, ModificationHistory, ParsedSheetData, CellValue, HeaderValidationResult } from '../types';
import { normalizeDatasetAddresses } from './addressNormalization';

const HEADER_ROW_INDEX = 0;
const DATA_START_ROW_INDEX = 1;

const HEADER_SUSPICIOUS_PATTERNS = [
  /^https?:\/\//i,
  /\.pdf$/i,
  /s3\.amazonaws\.com/i,
  /\.com\/.*\//i,
];
const HEADER_MAX_LENGTH = 120;

function validateHeaders(headers: string[]): HeaderValidationResult {
  const suspiciousHeaders: string[] = [];

  for (const header of headers) {
    const trimmed = String(header || '').trim();

    if (trimmed.length > HEADER_MAX_LENGTH) {
      suspiciousHeaders.push(trimmed.substring(0, 50) + '...');
      continue;
    }

    for (const pattern of HEADER_SUSPICIOUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        suspiciousHeaders.push(trimmed.substring(0, 50));
        break;
      }
    }
  }

  if (suspiciousHeaders.length > 0) {
    return {
      valid: false,
      error: `Header detection failed: Found ${suspiciousHeaders.length} suspicious header(s) that look like data values`,
      suspiciousHeaders,
    };
  }

  return { valid: true };
}

function normalizeHeaderKey(header: string, existingKeys: Set<string>): string {
  let key = String(header || '')
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!key) {
    key = 'column';
  }

  let uniqueKey = key;
  let suffix = 2;
  while (existingKeys.has(uniqueKey)) {
    uniqueKey = `${key}_${suffix}`;
    suffix++;
  }

  return uniqueKey;
}

function buildParsedSheetData(rawData: any[][]): ParsedSheetData {
  if (!rawData || rawData.length === 0) {
    return {
      headersRaw: [],
      headersKey: [],
      rows: [],
      headerRowIndex: HEADER_ROW_INDEX,
      dataStartRowIndex: DATA_START_ROW_INDEX,
    };
  }

  const headersRaw = rawData[HEADER_ROW_INDEX].map(h => String(h ?? '').trim());

  const existingKeys = new Set<string>();
  const headersKey: string[] = [];
  for (const header of headersRaw) {
    const key = normalizeHeaderKey(header, existingKeys);
    headersKey.push(key);
    existingKeys.add(key);
  }

  const rows: CellValue[][] = [];
  for (let i = DATA_START_ROW_INDEX; i < rawData.length; i++) {
    const rawRow = rawData[i];
    const row: CellValue[] = [];

    for (let j = 0; j < headersRaw.length; j++) {
      const cellValue = rawRow[j];
      row.push(cellValue !== undefined ? cellValue : '');
    }

    while (row.length < headersRaw.length) {
      row.push('');
    }

    rows.push(row);
  }

  return {
    headersRaw,
    headersKey,
    rows,
    headerRowIndex: HEADER_ROW_INDEX,
    dataStartRowIndex: DATA_START_ROW_INDEX,
  };
}

function parsedToLegacySheet(name: string, parsed: ParsedSheetData): Sheet {
  const rows: RowData[] = parsed.rows.map((row) => {
    const obj: RowData = {};
    parsed.headersKey.forEach((key, index) => {
      const value = row[index];
      obj[key] = value !== undefined ? value : '';
    });
    return obj;
  });

  return {
    name,
    headers: parsed.headersKey,
    rows,
    _parsed: parsed,
  };
}

export function parseCSV(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (!results.data || results.data.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }

        const allData = results.data as string[][];

        if (allData.length < 1) {
          reject(new Error('CSV file has no header row'));
          return;
        }

        const headerRow = allData[HEADER_ROW_INDEX];
        const validation = validateHeaders(headerRow);
        if (!validation.valid) {
          reject(new Error(validation.error));
          return;
        }

        const parsed = buildParsedSheetData(allData);
        const sheet = parsedToLegacySheet('CSV', parsed);

        resolve({
          fileName: file.name,
          sheets: [sheet],
        });
      },
      error: (error: any) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

export function parseXLSX(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets: Sheet[] = [];
        const errors: string[] = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (!rawData || rawData.length === 0) {
            sheets.push({
              name: sheetName,
              headers: [],
              rows: [],
              _parsed: {
                headersRaw: [],
                headersKey: [],
                rows: [],
                headerRowIndex: HEADER_ROW_INDEX,
                dataStartRowIndex: DATA_START_ROW_INDEX,
              },
            });
            continue;
          }

          const headerRow = rawData[HEADER_ROW_INDEX];
          const validation = validateHeaders(headerRow);
          if (!validation.valid) {
            errors.push(`Sheet "${sheetName}": ${validation.error}`);
            continue;
          }

          const parsed = buildParsedSheetData(rawData);
          const sheet = parsedToLegacySheet(sheetName, parsed);
          sheets.push(sheet);
        }

        if (errors.length > 0 && sheets.length === 0) {
          reject(new Error(errors.join('\n')));
          return;
        }

        resolve({
          fileName: file.name,
          sheets,
        });
      } catch (error) {
        reject(new Error(`XLSX parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export async function parseFile(file: File): Promise<Dataset> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return parseCSV(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXLSX(file);
  } else {
    throw new Error('Unsupported file format. Please upload CSV or XLSX file.');
  }
}

export function parseGlossaryCSV(file: File): Promise<{ [key: string]: { term: string; definition: string } }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (!results.data || results.data.length === 0) {
          reject(new Error('Glossary file is empty'));
          return;
        }

        const allData = results.data as string[][];
        const glossary: { [key: string]: { term: string; definition: string } } = {};

        allData.slice(1).forEach((row) => {
          if (row.length >= 2) {
            const term = row[0].trim();
            const definition = row[1].trim();
            if (term && definition) {
              glossary[term.toLowerCase()] = { term, definition };
            }
          }
        });

        resolve(glossary);
      },
      error: (error: any) => {
        reject(new Error(`Glossary parsing error: ${error.message}`));
      },
    });
  });
}

const GLOSSARY_KEYWORDS = [
  'field', 'field_name', 'fieldname', 'operation', 'api', 'column',
  'definition', 'expected', 'example', 'allowed', 'options', 'values',
  'name', 'key', 'description', 'type', 'input'
];

function scoreSheetForGlossary(headers: string[]): { score: number; matchedKeywords: string[] } {
  const matchedKeywords: string[] = [];
  const normalizedHeaders = headers.map(h => String(h || '').toLowerCase().replace(/[_\s-]/g, ''));

  for (const keyword of GLOSSARY_KEYWORDS) {
    const normalizedKeyword = keyword.replace(/[_\s-]/g, '');
    for (const header of normalizedHeaders) {
      if (header.includes(normalizedKeyword)) {
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
        break;
      }
    }
  }

  return {
    score: matchedKeywords.length,
    matchedKeywords,
  };
}

export function parseGlossaryXLSX(file: File): Promise<GlossarySheetData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets: GlossarySheetData[] = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];

          if (!rawData || rawData.length === 0) {
            return {
              name: sheetName,
              headers: [],
              rows: [],
            };
          }

          const headers = rawData[0].map(h => String(h || ''));
          const rows = rawData.slice(1).map(row => row.map(cell => String(cell ?? '')));

          return {
            name: sheetName,
            headers,
            rows,
          };
        });

        resolve(sheets);
      } catch (error) {
        reject(new Error(`Glossary XLSX parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read glossary file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function detectGlossarySheetCandidates(sheets: GlossarySheetData[]): GlossarySheetCandidate[] {
  const candidates: GlossarySheetCandidate[] = sheets
    .filter(sheet => sheet.headers.length > 0 && sheet.rows.length > 0)
    .map(sheet => {
      const { score, matchedKeywords } = scoreSheetForGlossary(sheet.headers);
      return {
        sheetName: sheet.name,
        score,
        matchedKeywords,
      };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates;
}

export interface ParseResult {
  dataset: Dataset;
  originalDataset: Dataset;
  modificationHistory: ModificationHistory;
}

export async function parseFileWithNormalization(file: File): Promise<ParseResult> {
  const rawDataset = await parseFile(file);

  const originalDataset = JSON.parse(JSON.stringify(rawDataset));

  const { normalizedSheets, modificationHistory } = normalizeDatasetAddresses(rawDataset.sheets);

  const dataset: Dataset = {
    fileName: rawDataset.fileName,
    sheets: normalizedSheets,
  };

  return {
    dataset,
    originalDataset,
    modificationHistory,
  };
}

export function parseXLSXFromBuffer(buffer: ArrayBuffer, fileName: string): Dataset {
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheets: Sheet[] = [];
  const errors: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (!rawData || rawData.length === 0) {
      sheets.push({
        name: sheetName,
        headers: [],
        rows: [],
        _parsed: {
          headersRaw: [],
          headersKey: [],
          rows: [],
          headerRowIndex: HEADER_ROW_INDEX,
          dataStartRowIndex: DATA_START_ROW_INDEX,
        },
      });
      continue;
    }

    const headerRow = rawData[HEADER_ROW_INDEX];
    const validation = validateHeaders(headerRow);
    if (!validation.valid) {
      errors.push(`Sheet "${sheetName}": ${validation.error}`);
      continue;
    }

    const parsed = buildParsedSheetData(rawData);
    const sheet = parsedToLegacySheet(sheetName, parsed);
    sheets.push(sheet);
  }

  if (errors.length > 0 && sheets.length === 0) {
    throw new Error(errors.join('\n'));
  }

  return {
    fileName,
    sheets,
  };
}

export async function parseBlob(blob: Blob, fileName: string): Promise<ParseResult> {
  const buffer = await blob.arrayBuffer();
  const rawDataset = parseXLSXFromBuffer(buffer, fileName);

  const originalDataset = JSON.parse(JSON.stringify(rawDataset));

  const { normalizedSheets, modificationHistory } = normalizeDatasetAddresses(rawDataset.sheets);

  const dataset: Dataset = {
    fileName: rawDataset.fileName,
    sheets: normalizedSheets,
  };

  return {
    dataset,
    originalDataset,
    modificationHistory,
  };
}
