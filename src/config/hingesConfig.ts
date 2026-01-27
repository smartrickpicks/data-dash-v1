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
  HingeSeverity,
} from '../types';
import { createEmptyHingesConfig } from './defaultHingesConfig';

const STORAGE_KEY = 'hinges_config';

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

function parseHingeSeverity(val: unknown): HingeSeverity {
  const str = normalizeString(val).toLowerCase();
  if (str === 'blocking' || str === 'block' || str === 'error') return 'blocking';
  if (str === 'warning' || str === 'warn') return 'warning';
  return 'info';
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

function normalizeSheetName(name: string): string {
  const normalized = name.toLowerCase().replace(/[_\s-]/g, '');
  if (normalized === 'stereosheet' || normalized === 'stereo') {
    return 'agreement_sheet';
  }
  return name;
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
  const sheetIdx = findColumnIndex(headers, 'agreement_sheet', 'agreementsheet', 'stereo_sheet', 'stereosheet', 'sheet');
  const whyIdx = findColumnIndex(headers, 'why', 'reason', 'description');
  const outputsIdx = findColumnIndex(headers, 'outputs', 'output');
  const aliasesIdx = findColumnIndex(headers, 'aliases', 'alias', 'aka');

  return data.map((row, i) => {
    const values = Object.values(row);
    const rawSheet = sheetIdx >= 0 ? normalizeString(values[sheetIdx]) : '';
    return {
      buildOrder: buildOrderIdx >= 0 ? Number(values[buildOrderIdx]) || (i + 1) : (i + 1),
      agreementSheet: normalizeSheetName(rawSheet),
      why: whyIdx >= 0 ? normalizeString(values[whyIdx]) : '',
      outputs: outputsIdx >= 0 ? normalizeString(values[outputsIdx]) : '',
      aliases: aliasesIdx >= 0 ? parseAliases(values[aliasesIdx]) : [],
    };
  }).filter(e => e.agreementSheet);
}

function parseSheetAliases(sheet: XLSX.WorkSheet): SheetAlias[] {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const sheetIdx = findColumnIndex(headers, 'agreement_sheet', 'agreementsheet', 'stereo_sheet', 'stereosheet', 'sheet');
  const akaTermIdx = findColumnIndex(headers, 'aka_term', 'akaterm', 'aka', 'alias');
  const notesIdx = findColumnIndex(headers, 'notes', 'note', 'comment');

  return data.map(row => {
    const values = Object.values(row);
    const rawSheet = sheetIdx >= 0 ? normalizeString(values[sheetIdx]) : '';
    return {
      agreementSheet: normalizeSheetName(rawSheet),
      akaTerm: akaTermIdx >= 0 ? normalizeString(values[akaTermIdx]) : '',
      notes: notesIdx >= 0 ? normalizeString(values[notesIdx]) : '',
    };
  }).filter(e => e.agreementSheet && e.akaTerm);
}

function parseHingeFields(sheet: XLSX.WorkSheet): HingeField[] {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const sheetIdx = findColumnIndex(headers, 'agreement_sheet', 'agreementsheet', 'stereo_sheet', 'stereosheet', 'sheet');
  const fieldKeyIdx = findColumnIndex(headers, 'primary_field', 'primaryfield', 'field_key', 'fieldkey', 'field');
  const hingeLevelIdx = findColumnIndex(headers, 'hinge_level', 'hingelevel', 'level');
  const severityIdx = findColumnIndex(headers, 'severity');
  const descriptionIdx = findColumnIndex(headers, 'description', 'why_it_hinges', 'whyithinges', 'why');
  const affectedIdx = findColumnIndex(headers, 'affected_fields', 'affectedfields', 'downstream_child_groups', 'downstreamchildgroups', 'downstream', 'children');

  return data.map(row => {
    const values = Object.values(row);
    const rawSheet = sheetIdx >= 0 ? normalizeString(values[sheetIdx]) : '';
    const description = descriptionIdx >= 0 ? normalizeString(values[descriptionIdx]) : '';
    return {
      sheet: normalizeSheetName(rawSheet),
      primaryField: fieldKeyIdx >= 0 ? normalizeString(values[fieldKeyIdx]) : '',
      affectedFields: affectedIdx >= 0 ? parseDownstreamGroups(values[affectedIdx]) : [],
      severity: severityIdx >= 0 ? parseHingeSeverity(values[severityIdx]) : 'info',
      description: description,
      hingeLevel: hingeLevelIdx >= 0 ? parseHingeLevel(values[hingeLevelIdx]) : 'tertiary',
      whyItHinges: description,
      downstreamChildGroups: affectedIdx >= 0 ? parseDownstreamGroups(values[affectedIdx]) : [],
    };
  }).filter(e => e.sheet && e.primaryField);
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
  const config = createEmptyHingesConfig();

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

export function loadHingesConfigFromJSON(json: string | object): HingesConfig {
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    const config: HingesConfig = {
      buildOrder: Array.isArray(parsed.buildOrder) ? parsed.buildOrder : [],
      sheetAliases: Array.isArray(parsed.sheetAliases) ? parsed.sheetAliases : [],
      hingeFields: Array.isArray(parsed.hingeFields) ? parsed.hingeFields : [],
      parentChildSeeds: Array.isArray(parsed.parentChildSeeds) ? parsed.parentChildSeeds : [],
      knowledgeKeepers: Array.isArray(parsed.knowledgeKeepers) ? parsed.knowledgeKeepers : [],
      loadedAt: new Date().toISOString(),
    };
    saveHingesConfig(config);
    return config;
  } catch (err) {
    const config = createEmptyHingesConfig();
    config.error = err instanceof Error ? err.message : 'Failed to parse JSON hinges config';
    return config;
  }
}

export async function loadHingesConfigFromFile(file: File): Promise<HingesConfig> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.json')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const config = loadHingesConfigFromJSON(text);
          resolve(config);
        } catch (err) {
          const config = createEmptyHingesConfig();
          config.error = err instanceof Error ? err.message : 'Failed to parse JSON hinges file';
          resolve(config);
        }
      };
      reader.onerror = () => {
        const config = createEmptyHingesConfig();
        config.error = 'Failed to read JSON hinges file';
        resolve(config);
      };
      reader.readAsText(file);
    });
  }

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
        const config = createEmptyHingesConfig();
        config.error = err instanceof Error ? err.message : 'Failed to parse hinges file';
        resolve(config);
      }
    };
    reader.onerror = () => {
      const config = createEmptyHingesConfig();
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

function migrateHingesConfig(config: Record<string, unknown>): HingesConfig {
  const migrated = createEmptyHingesConfig();

  if (Array.isArray(config.buildOrder)) {
    migrated.buildOrder = config.buildOrder.map((entry: Record<string, unknown>) => ({
      buildOrder: Number(entry.buildOrder) || 0,
      agreementSheet: String(entry.agreementSheet || entry.stereoSheet || ''),
      why: String(entry.why || ''),
      outputs: String(entry.outputs || ''),
      aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
    }));
  }

  if (Array.isArray(config.sheetAliases)) {
    migrated.sheetAliases = config.sheetAliases.map((entry: Record<string, unknown>) => ({
      agreementSheet: String(entry.agreementSheet || entry.stereoSheet || ''),
      akaTerm: String(entry.akaTerm || ''),
      notes: String(entry.notes || ''),
    }));
  }

  if (Array.isArray(config.hingeFields)) {
    migrated.hingeFields = config.hingeFields.map((entry: Record<string, unknown>) => ({
      sheet: String(entry.sheet || entry.stereoSheet || ''),
      primaryField: String(entry.primaryField || entry.fieldKey || ''),
      affectedFields: Array.isArray(entry.affectedFields) ? entry.affectedFields :
                      Array.isArray(entry.downstreamChildGroups) ? entry.downstreamChildGroups : [],
      severity: (entry.severity as 'info' | 'warning' | 'blocking') || 'info',
      description: String(entry.description || entry.whyItHinges || ''),
      hingeLevel: (entry.hingeLevel as 'primary' | 'secondary' | 'tertiary') || 'tertiary',
      whyItHinges: String(entry.whyItHinges || entry.description || ''),
      downstreamChildGroups: Array.isArray(entry.downstreamChildGroups) ? entry.downstreamChildGroups : [],
    }));
  }

  if (Array.isArray(config.parentChildSeeds)) {
    migrated.parentChildSeeds = config.parentChildSeeds as ParentChildSeed[];
  }

  if (Array.isArray(config.knowledgeKeepers)) {
    migrated.knowledgeKeepers = config.knowledgeKeepers as KnowledgeKeeper[];
  }

  migrated.loadedAt = String(config.loadedAt || new Date().toISOString());
  if (config.error) {
    migrated.error = String(config.error);
  }

  return migrated;
}

export function loadHingesConfig(): HingesConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateHingesConfig(parsed);
    }
  } catch {
    console.warn('Failed to load hinges config from localStorage');
  }
  return createEmptyHingesConfig();
}

export function clearHingesConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn('Failed to clear hinges config from localStorage');
  }
}

function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[_\s-]/g, '');
}

export function getSheetBuildOrder(config: HingesConfig, sheetName: string): number {
  const normalized = normalizeForComparison(sheetName);

  const directMatch = config.buildOrder.find(
    e => normalizeForComparison(e.agreementSheet) === normalized
  );
  if (directMatch) return directMatch.buildOrder;

  for (const entry of config.buildOrder) {
    const aliasMatch = entry.aliases.some(
      a => normalizeForComparison(a) === normalized
    );
    if (aliasMatch) return entry.buildOrder;
  }

  const aliasEntry = config.sheetAliases.find(
    a => normalizeForComparison(a.akaTerm) === normalized
  );
  if (aliasEntry) {
    const match = config.buildOrder.find(
      e => normalizeForComparison(e.agreementSheet) === normalizeForComparison(aliasEntry.agreementSheet)
    );
    if (match) return match.buildOrder;
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
  const normalized = normalizeForComparison(sheetName);
  return config.hingeFields.filter(
    f => normalizeForComparison(f.sheet) === normalized
  );
}

export function getParentChildSeedsForSheet(config: HingesConfig, sheetName: string): ParentChildSeed[] {
  const normalized = normalizeForComparison(sheetName);
  return config.parentChildSeeds.filter(
    s => normalizeForComparison(s.parent) === normalized ||
         normalizeForComparison(s.child) === normalized
  );
}

export function getOpenKnowledgeKeepers(config: HingesConfig): KnowledgeKeeper[] {
  return config.knowledgeKeepers.filter(k => k.status === 'open');
}

export function getSheetDescription(config: HingesConfig, sheetName: string): string | null {
  const normalized = normalizeForComparison(sheetName);
  const entry = config.buildOrder.find(
    e => normalizeForComparison(e.agreementSheet) === normalized
  );
  return entry?.why || null;
}

export function resolveSheetAlias(config: HingesConfig, searchTerm: string): string | null {
  const normalized = normalizeForComparison(searchTerm);

  const directMatch = config.buildOrder.find(
    e => normalizeForComparison(e.agreementSheet) === normalized
  );
  if (directMatch) return directMatch.agreementSheet;

  for (const entry of config.buildOrder) {
    const aliasMatch = entry.aliases.some(
      a => normalizeForComparison(a) === normalized
    );
    if (aliasMatch) return entry.agreementSheet;
  }

  const aliasEntry = config.sheetAliases.find(
    a => normalizeForComparison(a.akaTerm) === normalized
  );
  if (aliasEntry) return aliasEntry.agreementSheet;

  return null;
}
