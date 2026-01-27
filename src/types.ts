export interface RowData {
  [key: string]: string | number | boolean | null;
}

export type CellValue = string | number | boolean | null | undefined;

export interface ParsedSheetData {
  headersRaw: string[];
  headersKey: string[];
  rows: CellValue[][];
  headerRowIndex: number;
  dataStartRowIndex: number;
}

export interface HeaderValidationResult {
  valid: boolean;
  error?: string;
  suspiciousHeaders?: string[];
}

export interface Sheet {
  name: string;
  headers: string[];
  rows: RowData[];
  _parsed?: ParsedSheetData;
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
  required_status?: string;
  data_type?: string;
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
  required_status: string | null;
  data_type: string | null;
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

export type AnomalyType = 'invalid_allowed_value' | 'unexpected_missing' | 'blacklist_hit' | 'contract_load_error' | 'contract_text_unreadable' | 'contract_extraction_suspect' | 'contract_not_applicable';

export type AnomalySeverity = 'warn' | 'error';

export type ContractErrorCode =
  | 'cors_blocked'
  | 'network_error'
  | 'not_pdf'
  | 'invalid_response'
  | 'pdf_parse_error'
  | 'timeout'
  | 'unknown'
  | 'http_error'
  | 'file_too_large'
  | 'host_not_allowed'
  | 'blocked_private_network'
  | 'invalid_url'
  | 'not_supported_type'
  | 'proxy_failed';

export type ContractFailureCategory =
  | 'cors_blocked'
  | 'http_unauthorized'
  | 'http_forbidden'
  | 'http_not_found'
  | 'http_rate_limited'
  | 'http_server_error'
  | 'http_other'
  | 'not_pdf'
  | 'file_too_large'
  | 'timeout'
  | 'network_error'
  | 'invalid_url'
  | 'hidden_chars'
  | 'parse_error'
  | 'unknown';

export type FailureConfidence = 'high' | 'medium' | 'low';

export interface ContractLoadFailureMeta {
  category: ContractFailureCategory;
  confidence: FailureConfidence;
  httpStatus?: number;
  contentType?: string;
  sizeBytes?: number;
  url?: string;
  message: string;
  detectedAt: string;
  overridden?: boolean;
  overrideReason?: string;
}

export interface ContractFailureOverride {
  category: ContractFailureCategory;
  overrideReason?: string;
  overriddenAt: string;
}

export interface ContractFailureOverrides {
  [sheetName: string]: {
    [rowIndex: number]: ContractFailureOverride;
  };
}

export interface UnreadableTextMeta {
  attemptedTerms: number;
  totalMatches: number;
  sizeBytes?: number;
  note?: string;
  detectedAt: string;
  eligibleFieldNames?: string[];
  eligibleFieldCount?: number;
  matchedFieldCount?: number;
  pdfSource?: 'direct' | 'proxy';
  decision?: 'unreadable' | 'matchable' | 'insufficient_evidence' | 'text_extraction_failed';
  confidence?: 'high' | 'medium' | 'low';
  extractedTextLength?: number;
  matchedEligibleFieldNames?: string[];
  gibberishRatio?: number;
  reason?: string;
}

export interface ExtractionSuspectMeta {
  decision: 'suspect' | 'ok';
  confidence: 'high' | 'medium' | 'low';
  requiredCheckedCount: number;
  placeholderFailures: Array<{ fieldName: string; value: string }>;
  invalidOptionFailures: Array<{ fieldName: string; value: string; allowedValues: string[] }>;
  reason: string;
  detectedAt: string;
}

export type NotApplicableReasonKey = 'wrong_doc_type' | 'duplicate' | 'not_in_scope' | 'termination_notice' | 'other';

export interface NotApplicableMeta {
  decision: 'not_applicable';
  confidence: 'manual';
  reasonKey: NotApplicableReasonKey;
  freeText?: string;
  timestampISO: string;
  analystName?: string;
}

export interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  allowedValues?: string[];
  blacklistEntryId?: string;
  blacklistValue?: string;
  blacklistMatchMode?: BlacklistMatchMode;
  blacklistScope?: BlacklistScope;
  contractErrorCode?: ContractErrorCode;
  contractFileSize?: number;
  failureMeta?: ContractLoadFailureMeta;
  unreadableTextMeta?: UnreadableTextMeta;
  extractionSuspectMeta?: ExtractionSuspectMeta;
  notApplicableMeta?: NotApplicableMeta;
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

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  iconLink?: string;
  webViewLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveProjectMeta {
  connectedEmail?: string;
  sourceFileId?: string;
  sourceFileName?: string;
  projectFolderId?: string;
  sourceFolderId?: string;
  exportsFolderId?: string;
  changeLogsFolderId?: string;
  folderUrl?: string;
  lastExportAt?: string;
  sourceCopied?: boolean;
}

export type DriveExportType = 'full' | 'spreadsheet' | 'logs';

export type DriveExportVariant = 'wip' | 'final';

export interface DriveExportOptions {
  type: DriveExportType;
  variant: DriveExportVariant;
  includeChangeLog: boolean;
}

export type RowReviewReason =
  | 'manual_pdf_review_required'
  | 'manual_data_review_required'
  | 'document_not_applicable'
  | 'blacklist_hit'
  | 'rfi_required'
  | 'anomaly_detected'
  | 'ready_to_finalize'
  | 'finalized';

export interface RowReviewStatus {
  reason: RowReviewReason;
  isBlocking: boolean;
  derivedAt: string;
  details?: string;
}

export interface RowReviewStatusMap {
  [sheetName: string]: {
    [rowIndex: number]: RowReviewStatus;
  };
}

export type QueueView = 'todo' | 'finalized' | 'all';

export interface FinalizedAction {
  sheetName: string;
  rowIndex: number;
  previousStatus: 'complete' | 'incomplete';
  timestamp: number;
}

export interface QueueState {
  view: QueueView;
  undoStack: FinalizedAction[];
}

export type HingeSheetType =
  | 'agreement_sheet'
  | 'accounts'
  | 'opportunity'
  | 'financials'
  | 'catalog'
  | 'schedule'
  | 'schedule_catalog'
  | 'contacts'
  | 'v2_add_ons';

export type HingeSeverity = 'info' | 'warning' | 'blocking';

export interface BuildOrderEntry {
  buildOrder: number;
  agreementSheet: string;
  why: string;
  outputs: string;
  aliases: string[];
}

export interface SheetAlias {
  agreementSheet: string;
  akaTerm: string;
  notes: string;
}

export type HingeLevel = 'primary' | 'secondary' | 'tertiary';

export type HingeConditionType = 'presence' | 'value';

export interface HingeCondition {
  type: HingeConditionType;
  value?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'not_empty';
}

export interface HingeField {
  sheet: HingeSheetType | string;
  primaryField: string;
  condition?: HingeCondition;
  affectedFields: string[];
  severity: HingeSeverity;
  description: string;
  hingeLevel?: HingeLevel;
  whyItHinges?: string;
  downstreamChildGroups?: string[];
}

export type RequirednessLevel = 'required' | 'conditional' | 'optional';

export interface ParentChildSeed {
  parent: string;
  trigger: string;
  child: string;
  requiredness: RequirednessLevel;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

export type KnowledgeKeeperStatus = 'open' | 'resolved' | 'deferred';

export interface KnowledgeKeeper {
  blockerId: string;
  question: string;
  sheetsFields: string;
  whyNeeded: string;
  status: KnowledgeKeeperStatus;
  owner: string;
}

export interface HingesConfig {
  buildOrder: BuildOrderEntry[];
  sheetAliases: SheetAlias[];
  hingeFields: HingeField[];
  parentChildSeeds: ParentChildSeed[];
  knowledgeKeepers: KnowledgeKeeper[];
  loadedAt: string;
  error?: string;
}

export interface ManualReviewRow {
  sheetName: string;
  rowIndex: number;
  contractUrl: string;
  contractFileName: string;
  reasons: ManualReviewReason[];
  priority: 'high' | 'medium' | 'low';
}

export interface ManualReviewReason {
  type: AnomalyType;
  message: string;
  confidence?: string;
  detectedAt?: string;
}

export interface RfiCommentRow {
  sheetName: string;
  rowIndex: number;
  fieldName: string;
  comment: string;
  severity: 'rfi' | 'comment';
}

export interface FlaggedDocumentRow {
  sheetName: string;
  rowIndex: number;
  contractUrl: string;
  contractFileName: string;
  reasonKey: NotApplicableReasonKey;
  freeText: string;
  flaggedAt: string;
}

export type ReviewerTab = 'qa-reviewer' | 'salesforce-verifier';
