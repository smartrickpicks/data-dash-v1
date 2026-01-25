export interface RowData {
  [key: string]: string | number | boolean | null;
}

export interface Sheet {
  name: string;
  headers: string[];
  rows: RowData[];
}

export interface Dataset {
  fileName: string;
  sheets: Sheet[];
}

export type FieldStatusType = 'incomplete' | 'complete' | 'rfi';

export interface FieldStatus {
  [sheetName: string]: {
    [rowIndex: number]: {
      [fieldName: string]: FieldStatusType;
    };
  };
}

export interface RowStatus {
  [sheetName: string]: {
    [rowIndex: number]: 'complete' | 'incomplete';
  };
}

export interface RfiComments {
  [sheetName: string]: {
    [rowIndex: number]: {
      [fieldName: string]: string;
    };
  };
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface GlossaryMap {
  [fieldName: string]: GlossaryTerm;
}

export type GlossaryInputType = 'text' | 'number' | 'date' | 'select';

export interface GlossaryEntry {
  field_key: string;
  label?: string;
  definition?: string;
  expected_output?: string;
  example_output?: string;
  allowed_values?: string[];
  input_type?: GlossaryInputType;
  synonyms?: string[];
}

export interface NormalizedGlossary {
  [normalizedKey: string]: GlossaryEntry;
}

export interface GlossaryColumnMapping {
  field_key: string | null;
  label: string | null;
  definition: string | null;
  expected_output: string | null;
  example_output: string | null;
  allowed_values: string | null;
  input_type: string | null;
  synonyms: string | null;
}

export interface GlossaryConfig {
  fileName: string;
  sheetName: string;
  columnMapping: GlossaryColumnMapping;
  importedAt: string;
}

export interface SheetMapping {
  contractSheetName: string;
  glossarySheetName: string;
  columnMapping: GlossaryColumnMapping;
}

export interface MultiSheetGlossaryConfig {
  fileName: string;
  sheetMappings: SheetMapping[];
  importedAt: string;
}

export interface MultiSheetGlossary {
  [contractSheetName: string]: NormalizedGlossary;
}

export interface GlossaryState {
  entries: NormalizedGlossary;
  config: GlossaryConfig | null;
}

export interface GlossarySheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface GlossarySheetCandidate {
  sheetName: string;
  score: number;
  matchedKeywords: string[];
}

export interface ChangeMap {
  [sheetName: string]: {
    [rowIndex: number]: {
      [fieldName: string]: boolean;
    };
  };
}

export interface ModificationMetadata {
  originalValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  timestamp: string;
  modificationType: 'address_standardized' | 'incomplete_address' | 'manual_edit';
  reason: string;
}

export interface ModificationHistory {
  [sheetName: string]: {
    [rowIndex: number]: {
      [fieldName: string]: ModificationMetadata;
    };
  };
}

export interface AnalystRemarks {
  [sheetName: string]: {
    [rowIndex: number]: string;
  };
}

export interface AppState {
  dataset: Dataset | null;
  originalDataset: Dataset | null;
  activeSheetName: string;
  currentRowIndex: number;
  viewMode: 'single' | 'grid';
  rowStatuses: RowStatus;
  fieldStatuses: FieldStatus;
  glossary: GlossaryMap;
}

export type AnomalyType = 'invalid_allowed_value' | 'unexpected_missing' | 'blacklist_hit';

export type AnomalySeverity = 'warn' | 'error';

export interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  allowedValues?: string[];
  blacklistEntryId?: string;
  blacklistValue?: string;
  blacklistMatchMode?: BlacklistMatchMode;
  blacklistScope?: BlacklistScope;
}

export type BlacklistEntryType = 'name' | 'address' | 'email' | 'domain' | 'custom';

export type BlacklistMatchMode = 'contains' | 'exact';

export type BlacklistScope = 'global' | 'field_specific';

export interface BlacklistEntry {
  id: string;
  value: string;
  type: BlacklistEntryType;
  matchMode: BlacklistMatchMode;
  scope: BlacklistScope;
  fields: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnomalyMap {
  [sheetName: string]: {
    [rowIndex: number]: {
      [fieldName: string]: Anomaly[];
    };
  };
}

export type FocusMode = 'full' | 'focus';

export type FieldViewMode = 'all' | 'attention' | 'rfi';
