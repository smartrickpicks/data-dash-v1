import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Dataset, Sheet, RowData, GlossarySheetData, GlossarySheetCandidate, ModificationHistory } from '../types';
import { normalizeDatasetAddresses } from './addressNormalization';

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
        const headers = allData[0];
        const rows: RowData[] = allData.slice(1).map((row) => {
          const obj: RowData = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        const sheet: Sheet = {
          name: 'CSV',
          headers,
          rows,
        };

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

        const sheets: Sheet[] = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (!rawData || rawData.length === 0) {
            return {
              name: sheetName,
              headers: [],
              rows: [],
            };
          }

          const headers = rawData[0];
          const rows: RowData[] = rawData.slice(1).map((row) => {
            const obj: RowData = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] !== undefined ? row[index] : '';
            });
            return obj;
          });

          return {
            name: sheetName,
            headers,
            rows,
          };
        });

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
