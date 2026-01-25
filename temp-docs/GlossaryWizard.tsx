import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Check, FileSpreadsheet, AlertCircle, Link2, Unlink } from 'lucide-react';
import { GlossarySheetData, GlossaryColumnMapping, NormalizedGlossary, GlossaryEntry, MultiSheetGlossary, MultiSheetGlossaryConfig, SheetMapping, Sheet } from '../types';
import { normalizeFieldKey, parseCommaSeparated, parseInputType, findMatchingGlossarySheet } from '../utils/glossary';

type WizardStep = 'match' | 'mapping' | 'review';

interface SheetMatch {
  contractSheetName: string;
  glossarySheetName: string | null;
}

interface GlossaryWizardProps {
  glossarySheets: GlossarySheetData[];
  contractSheets: Sheet[];
  fileName: string;
  onComplete: (entries: MultiSheetGlossary, config: MultiSheetGlossaryConfig) => void;
  onCancel: () => void;
}

const TARGET_FIELDS: { key: keyof GlossaryColumnMapping; label: string; required: boolean }[] = [
  { key: 'field_key', label: 'Field Key / API Name', required: true },
  { key: 'label', label: 'Display Label', required: false },
  { key: 'definition', label: 'Definition', required: false },
  { key: 'expected_output', label: 'Expected Output', required: false },
  { key: 'example_output', label: 'Example Output', required: false },
  { key: 'allowed_values', label: 'Allowed Values', required: false },
  { key: 'input_type', label: 'Input Type', required: false },
  { key: 'synonyms', label: 'Synonyms', required: false },
];

const DEFAULT_COLUMN_MAPPINGS: { key: keyof GlossaryColumnMapping; defaultColumns: string[] }[] = [
  { key: 'field_key', defaultColumns: ['Field Name', 'field_name', 'FieldName', 'Field Key', 'field_key', 'API Name'] },
  { key: 'label', defaultColumns: ['Field Label', 'field_label', 'FieldLabel', 'Label', 'Display Label', 'display_label'] },
  { key: 'definition', defaultColumns: ['Definition', 'definition', 'Description', 'description'] },
  { key: 'expected_output', defaultColumns: ['Expected Output', 'expected_output', 'ExpectedOutput', 'Expected Value', 'expected_value'] },
  { key: 'example_output', defaultColumns: ['Example Output', 'example_output', 'ExampleOutput', 'Example', 'example'] },
  { key: 'allowed_values', defaultColumns: ['Options', 'options', 'Allowed Values', 'allowed_values', 'Picklist Values', 'picklist_values', 'Select Options', 'select_options', 'Dropdown Values', 'dropdown_values', 'Valid Values', 'valid_values'] },
  { key: 'input_type', defaultColumns: ['Return Format', 'return_format', 'ReturnFormat', 'Input Type', 'input_type', 'Type', 'Format'] },
  { key: 'synonyms', defaultColumns: ['Synonyms', 'synonyms', 'Aliases', 'aliases'] },
];

const createEmptyColumnMapping = (): GlossaryColumnMapping => ({
  field_key: null,
  label: null,
  definition: null,
  expected_output: null,
  example_output: null,
  allowed_values: null,
  input_type: null,
  synonyms: null,
});

const createDefaultColumnMapping = (headers: string[]): GlossaryColumnMapping => {
  const mapping = createEmptyColumnMapping();
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  for (const { key, defaultColumns } of DEFAULT_COLUMN_MAPPINGS) {
    for (const defaultCol of defaultColumns) {
      const normalizedDefault = defaultCol.toLowerCase().trim();
      const headerIndex = normalizedHeaders.findIndex(h => h === normalizedDefault);
      if (headerIndex !== -1) {
        mapping[key] = headers[headerIndex];
        break;
      }
    }
  }

  return mapping;
};

export function GlossaryWizard({ glossarySheets, contractSheets, fileName, onComplete, onCancel }: GlossaryWizardProps) {
  const [step, setStep] = useState<WizardStep>('match');

  const glossarySheetNames = useMemo(() => glossarySheets.map(s => s.name), [glossarySheets]);

  const [sheetMatches, setSheetMatches] = useState<SheetMatch[]>(() => {
    return contractSheets.map(sheet => ({
      contractSheetName: sheet.name,
      glossarySheetName: findMatchingGlossarySheet(sheet.name, glossarySheetNames),
    }));
  });

  const [columnMappings, setColumnMappings] = useState<Record<string, GlossaryColumnMapping>>(() => {
    const mappings: Record<string, GlossaryColumnMapping> = {};
    contractSheets.forEach(sheet => {
      const matchedGlossaryName = findMatchingGlossarySheet(sheet.name, glossarySheetNames);
      if (matchedGlossaryName) {
        const glossarySheet = glossarySheets.find(g => g.name === matchedGlossaryName);
        if (glossarySheet) {
          mappings[sheet.name] = createDefaultColumnMapping(glossarySheet.headers);
        } else {
          mappings[sheet.name] = createEmptyColumnMapping();
        }
      } else {
        mappings[sheet.name] = createEmptyColumnMapping();
      }
    });
    return mappings;
  });

  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const matchedSheets = useMemo(() =>
    sheetMatches.filter(m => m.glossarySheetName !== null),
    [sheetMatches]
  );

  const currentMatch = matchedSheets[activeMatchIndex];

  const currentGlossarySheetData = useMemo(() => {
    if (!currentMatch?.glossarySheetName) return null;
    return glossarySheets.find(s => s.name === currentMatch.glossarySheetName) || null;
  }, [glossarySheets, currentMatch]);

  const currentColumnMapping = currentMatch
    ? columnMappings[currentMatch.contractSheetName]
    : null;

  const processedEntries = useMemo((): MultiSheetGlossary => {
    const result: MultiSheetGlossary = {};

    for (const match of matchedSheets) {
      const glossarySheet = glossarySheets.find(s => s.name === match.glossarySheetName);
      const mapping = columnMappings[match.contractSheetName];

      if (!glossarySheet || !mapping?.field_key) continue;

      const entries: NormalizedGlossary = {};
      const headers = glossarySheet.headers;
      const fieldKeyIdx = headers.indexOf(mapping.field_key);
      if (fieldKeyIdx === -1) continue;

      const getColumnIndex = (col: string | null) => col ? headers.indexOf(col) : -1;
      const labelIdx = getColumnIndex(mapping.label);
      const definitionIdx = getColumnIndex(mapping.definition);
      const expectedIdx = getColumnIndex(mapping.expected_output);
      const exampleIdx = getColumnIndex(mapping.example_output);
      const allowedIdx = getColumnIndex(mapping.allowed_values);
      const inputTypeIdx = getColumnIndex(mapping.input_type);
      const synonymsIdx = getColumnIndex(mapping.synonyms);

      for (const row of glossarySheet.rows) {
        const fieldKey = row[fieldKeyIdx]?.trim();
        if (!fieldKey) continue;

        const normalizedKey = normalizeFieldKey(fieldKey);
        if (!normalizedKey) continue;

        const entry: GlossaryEntry = { field_key: fieldKey };

        if (labelIdx >= 0 && row[labelIdx]) entry.label = row[labelIdx].trim();
        if (definitionIdx >= 0 && row[definitionIdx]) entry.definition = row[definitionIdx].trim();
        if (expectedIdx >= 0 && row[expectedIdx]) entry.expected_output = row[expectedIdx].trim();
        if (exampleIdx >= 0 && row[exampleIdx]) entry.example_output = row[exampleIdx].trim();
        if (allowedIdx >= 0 && row[allowedIdx]) entry.allowed_values = parseCommaSeparated(row[allowedIdx]);
        if (inputTypeIdx >= 0 && row[inputTypeIdx]) entry.input_type = parseInputType(row[inputTypeIdx]);
        if (synonymsIdx >= 0 && row[synonymsIdx]) entry.synonyms = parseCommaSeparated(row[synonymsIdx]);

        entries[normalizedKey] = entry;
      }

      result[match.contractSheetName] = entries;
    }

    return result;
  }, [matchedSheets, glossarySheets, columnMappings]);

  const handleSheetMatchChange = (contractSheetName: string, glossarySheetName: string | null) => {
    setSheetMatches(prev => prev.map(m =>
      m.contractSheetName === contractSheetName
        ? { ...m, glossarySheetName }
        : m
    ));

    if (glossarySheetName) {
      const glossarySheet = glossarySheets.find(g => g.name === glossarySheetName);
      if (glossarySheet) {
        setColumnMappings(prev => ({
          ...prev,
          [contractSheetName]: createDefaultColumnMapping(glossarySheet.headers),
        }));
      }
    } else {
      setColumnMappings(prev => ({
        ...prev,
        [contractSheetName]: createEmptyColumnMapping(),
      }));
    }
  };

  const handleColumnMappingChange = (
    contractSheetName: string,
    targetField: keyof GlossaryColumnMapping,
    sourceColumn: string | null
  ) => {
    setColumnMappings(prev => ({
      ...prev,
      [contractSheetName]: {
        ...prev[contractSheetName],
        [targetField]: sourceColumn,
      },
    }));
  };

  const handleComplete = () => {
    const sheetMappings: SheetMapping[] = matchedSheets.map(match => ({
      contractSheetName: match.contractSheetName,
      glossarySheetName: match.glossarySheetName!,
      columnMapping: columnMappings[match.contractSheetName],
    }));

    const config: MultiSheetGlossaryConfig = {
      fileName,
      sheetMappings,
      importedAt: new Date().toISOString(),
    };

    onComplete(processedEntries, config);
  };

  const canProceedFromMatch = matchedSheets.length > 0;

  const allMappingsValid = useMemo(() => {
    return matchedSheets.every(match =>
      columnMappings[match.contractSheetName]?.field_key !== null
    );
  }, [matchedSheets, columnMappings]);

  const totalEntryCount = Object.values(processedEntries).reduce(
    (sum, entries) => sum + Object.keys(entries).length,
    0
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Import Glossary</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-200">
          <StepIndicator step={1} label="Match Sheets" active={step === 'match'} completed={step !== 'match'} />
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <StepIndicator step={2} label="Map Columns" active={step === 'mapping'} completed={step === 'review'} />
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <StepIndicator step={3} label="Review & Import" active={step === 'review'} completed={false} />
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 'match' && (
            <SheetMatchingStep
              contractSheets={contractSheets}
              glossarySheets={glossarySheets}
              sheetMatches={sheetMatches}
              onMatchChange={handleSheetMatchChange}
            />
          )}

          {step === 'mapping' && currentMatch && currentGlossarySheetData && currentColumnMapping && (
            <ColumnMappingStep
              contractSheetName={currentMatch.contractSheetName}
              glossarySheetName={currentMatch.glossarySheetName!}
              headers={currentGlossarySheetData.headers}
              columnMapping={currentColumnMapping}
              onMappingChange={(field, col) => handleColumnMappingChange(currentMatch.contractSheetName, field, col)}
              previewRows={currentGlossarySheetData.rows.slice(0, 5)}
              currentIndex={activeMatchIndex}
              totalMatches={matchedSheets.length}
              onPrevious={() => setActiveMatchIndex(i => Math.max(0, i - 1))}
              onNext={() => setActiveMatchIndex(i => Math.min(matchedSheets.length - 1, i + 1))}
            />
          )}

          {step === 'review' && (
            <ReviewStep
              fileName={fileName}
              matchedSheets={matchedSheets}
              processedEntries={processedEntries}
              columnMappings={columnMappings}
            />
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => {
              if (step === 'mapping') {
                setStep('match');
                setActiveMatchIndex(0);
              } else if (step === 'review') {
                setStep('mapping');
              }
            }}
            disabled={step === 'match'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>

            {step === 'match' && (
              <button
                onClick={() => setStep('mapping')}
                disabled={!canProceedFromMatch}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'mapping' && (
              <button
                onClick={() => setStep('review')}
                disabled={!allMappingsValid}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'review' && (
              <button
                onClick={handleComplete}
                disabled={totalEntryCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                Import {totalEntryCount} Entries
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step, label, active, completed }: { step: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
      active ? 'bg-blue-100 text-blue-700' : completed ? 'bg-green-100 text-green-700' : 'text-slate-500'
    }`}>
      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium ${
        active ? 'bg-blue-600 text-white' : completed ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
      }`}>
        {completed ? <Check className="w-3 h-3" /> : step}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

interface SheetMatchingStepProps {
  contractSheets: Sheet[];
  glossarySheets: GlossarySheetData[];
  sheetMatches: SheetMatch[];
  onMatchChange: (contractSheetName: string, glossarySheetName: string | null) => void;
}

function SheetMatchingStep({ contractSheets, glossarySheets, sheetMatches, onMatchChange }: SheetMatchingStepProps) {
  const matchedCount = sheetMatches.filter(m => m.glossarySheetName !== null).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Match contract data sheets to glossary sheets</h3>
        <p className="text-sm text-slate-500 mb-4">
          Select which glossary sheet contains the field definitions for each contract data sheet.
        </p>

        {matchedCount > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              Auto-matched {matchedCount} of {contractSheets.length} sheets based on name similarity.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {sheetMatches.map((match) => {
          const contractSheet = contractSheets.find(s => s.name === match.contractSheetName);
          const isMatched = match.glossarySheetName !== null;

          return (
            <div
              key={match.contractSheetName}
              className={`p-4 rounded-lg border transition-colors ${
                isMatched
                  ? 'border-green-200 bg-green-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-900">
                      {match.contractSheetName}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({contractSheet?.rows.length || 0} rows, {contractSheet?.headers.length || 0} columns)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isMatched ? (
                    <Link2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Unlink className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="w-64">
                  <select
                    value={match.glossarySheetName || ''}
                    onChange={(e) => onMatchChange(match.contractSheetName, e.target.value || null)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isMatched
                        ? 'border-green-300 bg-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    <option value="">Skip this sheet</option>
                    {glossarySheets.map(sheet => (
                      <option key={sheet.name} value={sheet.name}>
                        {sheet.name} ({sheet.rows.length} rows)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {matchedCount === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Please match at least one contract sheet to a glossary sheet to continue.
          </p>
        </div>
      )}
    </div>
  );
}

interface ColumnMappingStepProps {
  contractSheetName: string;
  glossarySheetName: string;
  headers: string[];
  columnMapping: GlossaryColumnMapping;
  onMappingChange: (targetField: keyof GlossaryColumnMapping, sourceColumn: string | null) => void;
  previewRows: string[][];
  currentIndex: number;
  totalMatches: number;
  onPrevious: () => void;
  onNext: () => void;
}

function ColumnMappingStep({
  contractSheetName,
  glossarySheetName,
  headers,
  columnMapping,
  onMappingChange,
  previewRows,
  currentIndex,
  totalMatches,
  onPrevious,
  onNext
}: ColumnMappingStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Map columns for: {contractSheetName}
          </h3>
          <p className="text-sm text-slate-500">
            Glossary sheet: <span className="font-medium">{glossarySheetName}</span>
          </p>
        </div>

        {totalMatches > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">
              {currentIndex + 1} of {totalMatches}
            </span>
            <button
              onClick={onNext}
              disabled={currentIndex === totalMatches - 1}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-slate-500 mb-4">
          Select which column in the glossary sheet corresponds to each field. Only Field Key is required.
        </p>

        <div className="grid gap-3">
          {TARGET_FIELDS.map(({ key, label, required }) => (
            <div key={key} className="flex items-center gap-4">
              <div className="w-44 flex-shrink-0">
                <span className="text-sm font-medium text-slate-700">
                  {label}
                  {required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
              </div>
              <select
                value={columnMapping[key] || ''}
                onChange={(e) => onMappingChange(key, e.target.value || null)}
                className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  required && !columnMapping[key] ? 'border-amber-300 bg-amber-50' : 'border-slate-300'
                }`}
              >
                <option value="">{required ? 'Select a column (required)' : 'Options'}</option>
                {headers.map((h, i) => (
                  <option key={i} value={h}>
                    {h || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {columnMapping.field_key && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Preview</h4>
          <div className="border border-slate-200 rounded-lg overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  {TARGET_FIELDS.filter(f => columnMapping[f.key]).map(f => (
                    <th key={f.key} className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50">
                    {TARGET_FIELDS.filter(f => columnMapping[f.key]).map(f => {
                      const colIdx = headers.indexOf(columnMapping[f.key]!);
                      return (
                        <td key={f.key} className="px-3 py-2 border-b border-slate-100 text-slate-600 max-w-xs truncate">
                          {colIdx >= 0 ? row[colIdx] || '-' : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!columnMapping.field_key && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">Please map the Field Key column to continue.</p>
        </div>
      )}
    </div>
  );
}

interface ReviewStepProps {
  fileName: string;
  matchedSheets: SheetMatch[];
  processedEntries: MultiSheetGlossary;
  columnMappings: Record<string, GlossaryColumnMapping>;
}

function ReviewStep({ fileName, matchedSheets, processedEntries, columnMappings }: ReviewStepProps) {
  const totalEntryCount = Object.values(processedEntries).reduce(
    (sum, entries) => sum + Object.keys(entries).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Source File</p>
          <p className="text-sm font-medium text-slate-900 truncate">{fileName}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-600 uppercase tracking-wider mb-1">Total Entries</p>
          <p className="text-lg font-bold text-blue-700">{totalEntryCount}</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Sheet Mappings</h4>
        <div className="space-y-2">
          {matchedSheets.map((match) => {
            const entryCount = Object.keys(processedEntries[match.contractSheetName] || {}).length;
            const mapping = columnMappings[match.contractSheetName];
            const mappedFieldCount = Object.values(mapping || {}).filter(Boolean).length;

            return (
              <div
                key={match.contractSheetName}
                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-900">{match.contractSheetName}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{match.glossarySheetName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{mappedFieldCount} columns mapped</span>
                  <span className="font-medium text-blue-600">{entryCount} entries</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {totalEntryCount > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Sample Entries</h4>
          <div className="space-y-3">
            {matchedSheets.slice(0, 2).map((match) => {
              const entries = Object.values(processedEntries[match.contractSheetName] || {});
              const sampleEntries = entries.slice(0, 2);

              if (sampleEntries.length === 0) return null;

              return (
                <div key={match.contractSheetName}>
                  <p className="text-xs text-slate-500 mb-1.5">{match.contractSheetName}:</p>
                  <div className="space-y-2">
                    {sampleEntries.map((entry, idx) => (
                      <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-white">
                        <p className="text-sm font-medium text-slate-900 mb-1">{entry.field_key}</p>
                        {entry.label && <p className="text-xs text-slate-600">Label: {entry.label}</p>}
                        {entry.definition && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{entry.definition}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalEntryCount === 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">No valid entries found. Please check your column mappings.</p>
        </div>
      )}
    </div>
  );
}
