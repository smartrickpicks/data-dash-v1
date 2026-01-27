import * as XLSX from 'xlsx';
import {
  HingesConfig,
  BuildOrderEntry,
  SheetAlias,
  HingeField,
  ParentChildSeed,
  KnowledgeKeeper,
  HingeLevel,
  RequirednessLevel,
  KnowledgeKeeperStatus,
} from '../types';

const STORAGE_KEY = 'hinges_config';

function createEmptyConfig(): HingesConfig {
  return {
    buildOrder: [],
    sheetAliases: [],
    hingeFields: [],
    parentChildSeeds: [],
    knowledgeKeepers: [],
    loadedAt: new Date().toISOString(),
  };
}

function normalizeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseHingeLevel(val: unknown): HingeLevel {
  const str = normalizeString(val).toLowerCase();
  if (str === 'primary' || str === '1' || str === 'p') return 'primary';
  if (str === 'secondary' || str === '2' || str === 's') return 'secondary';
  return 'tertiary';
}

function parseRequiredness(val: unknown): RequirednessLevel {
  const str = normalizeString(val).toLowerCase();
  if (str === 'required' || str === 'r' || str === 'yes') return 'required';
  if (str === 'conditional' || str === 'c' || str === 'cond') return 'conditional';
  return 'optional';
}

function parseConfidence(val: unknown): 'high' | 'medium' | 'low' {
  const str = normalizeString(val).toLowerCase();
  if (str === 'high' || str === 'h') return 'high';
  if (str === 'medium' || str === 'm' || str === 'med') return 'medium';
  return 'low';
}

function parseKnowledgeKeeperStatus(val: unknown): KnowledgeKeeperStatus {
  const str = normalizeString(val).toLowerCase();
  if (str === 'open' || str === 'o') return 'open';
  if (str === 'resolved' || str === 'r' || str === 'done') return 'resolved';
  return 'deferred';
}

function parseAliases(val: unknown): string[] {
  const str = normalizeString(val);
  if (!str) return [];
  return str.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
}

function parseDownstreamGroups(val: unknown): string[] {
  return parseAliases(val);
}

function findColumnIndex(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, ''));
  for (const candidate of candidates) {
    const target = candidate.toLowerCase().replace(/[_\s-]/g, '');
    const idx = normalized.findIndex(h => h.includes(target) || target.includes(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseAppBuildOrder(sheet: XLSX.WorkSheet): BuildOrderEntry[] {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const buildOrderIdx = findColumnIndex(headers, 'build_order', 'buildorder', 'order');
  const stereoSheetIdx = findColumnIndex(headers, 'stereo_sheet', 'stereosheet', 'sheet');
  const whyIdx = findColumnIndex(headers, 'why', 'reason', 'description');
  const outputsIdx = findColumnIndex(headers, 'outputs', 'output');
  const aliasesIdx = findColumnIndex(headers, 'aliases', 'alias', 'aka');

  return data.map((row, i) => {
    const values = Object.values(row);
    return {
      buildOrder: buildOrderIdx >= 0 ? Number(values[buildOrderIdx]) || (i + 1) : (i + 1),
      stereoSheet: stereoSheetIdx >= 0 ? normalizeString(values[stereoSheetIdx]) : '',
      why: whyIdx >= 0 ? normalizeString(values[whyIdx]) : '',
      outputs: outputsIdx >= 0 ? normalizeString(values[outputsIdx]) : '',
      aliases: aliasesIdx >= 0 ? parseAliases(values[aliasesIdx]) : [],
    };
  }).filter(e => e.stereoSheet);
}

function parseSheetAliases(sheet: XLSX.WorkSheet): SheetAlias[] {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const stereoSheetIdx = findColumnIndex(headers, 'stereo_sheet', 'stereosheet', 'sheet');
  const akaTermIdx = findColumnIndex(headers, 'aka_term', 'akaterm', 'aka', 'alias');
  const notesIdx = findColumnIndex(headers, 'notes', 'note', 'comment');

  return data.map(row => {
    const values = Object.values(row);
    return {
      stereoSheet: stereoSheetIdx >= 0 ? normalizeString(values[stereoSheetIdx]) : '',
      akaTerm: akaTermIdx >= 0 ? normalizeString(values[akaTermIdx]) : '',
      notes: notesIdx >= 0 ? normalizeString(values[notesIdx]) : '',
    };
  }).filter(e => e.stereoSheet && e.akaTerm);
}

function parseHingeFields(sheet: XLSX.WorkSheet): HingeField[] {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const stereoSheetIdx = findColumnIndex(headers, 'stereo_sheet', 'stereosheet', 'sheet');
  const fieldKeyIdx = findColumnIndex(headers, 'field_key', 'fieldkey', 'field');
  const hingeLevelIdx = findColumnIndex(headers, 'hinge_level', 'hingelevel', 'level');
  const whyIdx = findColumnIndex(headers, 'why_it_hinges', 'whyithinges', 'why');
  const downstreamIdx = findColumnIndex(headers, 'downstream_child_groups', 'downstreamchildgroups', 'downstream', 'children');

  return data.map(row => {
    const values = Object.values(row);
    return {
      stereoSheet: stereoSheetIdx >= 0 ? normalizeString(values[stereoSheetIdx]) : '',
      fieldKey: fieldKeyIdx >= 0 ? normalizeString(values[fieldKeyIdx]) : '',
      hingeLevel: hingeLevelIdx >= 0 ? parseHingeLevel(values[hingeLevelIdx]) : 'tertiary',
      whyItHinges: whyIdx >= 0 ? normalizeString(values[whyIdx]) : '',
      downstreamChildGroups: downstreamIdx >= 0 ? parseDownstreamGroups(values[downstreamIdx]) : [],
    };
  }).filter(e => e.stereoSheet && e.fieldKey);
}

function parseParentChildSeeds(sheet: XLSX.WorkSheet): ParentChildSeed[] {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const parentIdx = findColumnIndex(headers, 'parent');
  const triggerIdx = findColumnIndex(headers, 'trigger');
  const childIdx = findColumnIndex(headers, 'child');
  const requirednessIdx = findColumnIndex(headers, 'requiredness', 'required');
  const notesIdx = findColumnIndex(headers, 'notes', 'note');
  const confidenceIdx = findColumnIndex(headers, 'confidence', 'conf');

  return data.map(row => {
    const values = Object.values(row);
    return {
      parent: parentIdx >= 0 ? normalizeString(values[parentIdx]) : '',
      trigger: triggerIdx >= 0 ? normalizeString(values[triggerIdx]) : '',
      child: childIdx >= 0 ? normalizeString(values[childIdx]) : '',
      requiredness: requirednessIdx >= 0 ? parseRequiredness(values[requirednessIdx]) : 'optional',
      notes: notesIdx >= 0 ? normalizeString(values[notesIdx]) : '',
      confidence: confidenceIdx >= 0 ? parseConfidence(values[confidenceIdx]) : 'medium',
    };
  }).filter(e => e.parent && e.child);
}

function parseKnowledgeKeepers(sheet: XLSX.WorkSheet): KnowledgeKeeper[] {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const blockerIdIdx = findColumnIndex(headers, 'blocker_id', 'blockerid', 'id');
  const questionIdx = findColumnIndex(headers, 'question', 'q');
  const sheetsFieldsIdx = findColumnIndex(headers, 'sheets_fields', 'sheetsfields', 'sheets', 'fields');
  const whyNeededIdx = findColumnIndex(headers, 'why_needed', 'whyneeded', 'why');
  const statusIdx = findColumnIndex(headers, 'status');
  const ownerIdx = findColumnIndex(headers, 'owner');

  return data.map((row, i) => {
    const values = Object.values(row);
    return {
      blockerId: blockerIdIdx >= 0 ? normalizeString(values[blockerIdIdx]) : `blocker_${i + 1}`,
      question: questionIdx >= 0 ? normalizeString(values[questionIdx]) : '',
      sheetsFields: sheetsFieldsIdx >= 0 ? normalizeString(values[sheetsFieldsIdx]) : '',
      whyNeeded: whyNeededIdx >= 0 ? normalizeString(values[whyNeededIdx]) : '',
      status: statusIdx >= 0 ? parseKnowledgeKeeperStatus(values[statusIdx]) : 'open',
      owner: ownerIdx >= 0 ? normalizeString(values[ownerIdx]) : '',
    };
  }).filter(e => e.question);
}

function findSheet(workbook: XLSX.WorkBook, ...candidates: string[]): XLSX.WorkSheet | null {
  const sheetNames = workbook.SheetNames.map(n => n.toLowerCase().replace(/[_\s-]/g, ''));
  for (const candidate of candidates) {
    const target = candidate.toLowerCase().replace(/[_\s-]/g, '');
    const idx = sheetNames.findIndex(n => n.includes(target) || target.includes(n));
    if (idx !== -1) {
      return workbook.Sheets[workbook.SheetNames[idx]];
    }
  }
  return null;
}

export function parseHingesWorkbook(workbook: XLSX.WorkBook): HingesConfig {
  const config = createEmptyConfig();

  try {
    const buildOrderSheet = findSheet(workbook, 'App_Build_Order', 'BuildOrder', 'Build_Order');
    if (buildOrderSheet) {
      config.buildOrder = parseAppBuildOrder(buildOrderSheet);
    }

    const aliasesSheet = findSheet(workbook, 'Sheet_Aliases', 'SheetAliases', 'Aliases');
    if (aliasesSheet) {
      config.sheetAliases = parseSheetAliases(aliasesSheet);
    }

    const hingeFieldsSheet = findSheet(workbook, 'Hinge_Fields_By_Sheet', 'HingeFields', 'Hinges');
    if (hingeFieldsSheet) {
      config.hingeFields = parseHingeFields(hingeFieldsSheet);
    }

    const parentChildSheet = findSheet(workbook, 'CrossTab_ParentChild_Seed', 'ParentChild', 'Parent_Child');
    if (parentChildSheet) {
      config.parentChildSeeds = parseParentChildSeeds(parentChildSheet);
    }

    const knowledgeKeepersSheet = findSheet(workbook, 'Knowledge_Keepers', 'KnowledgeKeepers', 'Blockers');
    if (knowledgeKeepersSheet) {
      config.knowledgeKeepers = parseKnowledgeKeepers(knowledgeKeepersSheet);
    }

    config.loadedAt = new Date().toISOString();
  } catch (err) {
    config.error = err instanceof Error ? err.message : 'Unknown error parsing hinges config';
  }

  return config;
}

export async function loadHingesConfigFromFile(file: File): Promise<HingesConfig> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const config = parseHingesWorkbook(workbook);
        saveHingesConfig(config);
        resolve(config);
      } catch (err) {
        const config = createEmptyConfig();
        config.error = err instanceof Error ? err.message : 'Failed to parse hinges file';
        resolve(config);
      }
    };
    reader.onerror = () => {
      const config = createEmptyConfig();
      config.error = 'Failed to read hinges file';
      resolve(config);
    };
    reader.readAsArrayBuffer(file);
  });
}

export function saveHingesConfig(config: HingesConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    console.warn('Failed to save hinges config to localStorage');
  }
}

export function loadHingesConfig(): HingesConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as HingesConfig;
    }
  } catch {
    console.warn('Failed to load hinges config from localStorage');
  }
  return createEmptyConfig();
}

export function clearHingesConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn('Failed to clear hinges config from localStorage');
  }
}

export function getSheetBuildOrder(config: HingesConfig, sheetName: string): number {
  const normalized = sheetName.toLowerCase().replace(/[_\s-]/g, '');

  const directMatch = config.buildOrder.find(
    e => e.stereoSheet.toLowerCase().replace(/[_\s-]/g, '') === normalized
  );
  if (directMatch) return directMatch.buildOrder;

  for (const entry of config.buildOrder) {
    const aliasMatch = entry.aliases.some(
      a => a.toLowerCase().replace(/[_\s-]/g, '') === normalized
    );
    if (aliasMatch) return entry.buildOrder;
  }

  const aliasEntry = config.sheetAliases.find(
    a => a.akaTerm.toLowerCase().replace(/[_\s-]/g, '') === normalized
  );
  if (aliasEntry) {
    const stereoMatch = config.buildOrder.find(
      e => e.stereoSheet.toLowerCase().replace(/[_\s-]/g, '') ===
           aliasEntry.stereoSheet.toLowerCase().replace(/[_\s-]/g, '')
    );
    if (stereoMatch) return stereoMatch.buildOrder;
  }

  return 9999;
}

export function sortSheetsByBuildOrder(config: HingesConfig, sheetNames: string[]): string[] {
  return [...sheetNames].sort((a, b) => {
    const orderA = getSheetBuildOrder(config, a);
    const orderB = getSheetBuildOrder(config, b);
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });
}

export function getHingeFieldsForSheet(config: HingesConfig, sheetName: string): HingeField[] {
  const normalized = sheetName.toLowerCase().replace(/[_\s-]/g, '');
  return config.hingeFields.filter(
    f => f.stereoSheet.toLowerCase().replace(/[_\s-]/g, '') === normalized
  );
}

export function getParentChildSeedsForSheet(config: HingesConfig, sheetName: string): ParentChildSeed[] {
  const normalized = sheetName.toLowerCase().replace(/[_\s-]/g, '');
  return config.parentChildSeeds.filter(
    s => s.parent.toLowerCase().replace(/[_\s-]/g, '') === normalized ||
         s.child.toLowerCase().replace(/[_\s-]/g, '') === normalized
  );
}

export function getOpenKnowledgeKeepers(config: HingesConfig): KnowledgeKeeper[] {
  return config.knowledgeKeepers.filter(k => k.status === 'open');
}

export function getSheetDescription(config: HingesConfig, sheetName: string): string | null {
  const normalized = sheetName.toLowerCase().replace(/[_\s-]/g, '');
  const entry = config.buildOrder.find(
    e => e.stereoSheet.toLowerCase().replace(/[_\s-]/g, '') === normalized
  );
  return entry?.why || null;
}

export function resolveSheetAlias(config: HingesConfig, searchTerm: string): string | null {
  const normalized = searchTerm.toLowerCase().replace(/[_\s-]/g, '');

  const directMatch = config.buildOrder.find(
    e => e.stereoSheet.toLowerCase().replace(/[_\s-]/g, '') === normalized
  );
  if (directMatch) return directMatch.stereoSheet;

  for (const entry of config.buildOrder) {
    const aliasMatch = entry.aliases.some(
      a => a.toLowerCase().replace(/[_\s-]/g, '') === normalized
    );
    if (aliasMatch) return entry.stereoSheet;
  }

  const aliasEntry = config.sheetAliases.find(
    a => a.akaTerm.toLowerCase().replace(/[_\s-]/g, '') === normalized
  );
  if (aliasEntry) return aliasEntry.stereoSheet;

  return null;
}
