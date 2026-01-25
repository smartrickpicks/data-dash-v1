import { useState, useMemo } from 'react';
import { AlertCircle, Check, AlertTriangle, MessageSquare, Trash2, X, Edit3, Zap, XCircle, HelpCircle, Shield } from 'lucide-react';
import { Dataset, FieldStatus, FieldStatusType, NormalizedGlossary, GlossaryEntry, RfiComments, ChangeMap, ModificationHistory, AnomalyMap, FieldViewMode, Anomaly } from '../types';
import { formatFieldName } from '../utils/formatFieldName';
import { matchFieldToGlossary, isValueEmpty, isValueInAllowedList, isNumericValue, shouldShowDropdown, filterAllowedValues } from '../utils/glossary';
import { GlossaryPopover } from './GlossaryPopover';
import { ModificationTooltip } from './ModificationTooltip';
import { getColorForField } from '../utils/highlightColors';
import { AttentionSummary } from './AttentionSummary';
import { normalizeNAForDisplay } from '../utils/naNormalization';
import { getFieldAnomalies } from '../utils/anomalyDetection';
import { getFieldAttention } from '../utils/attentionLogic';

interface FieldsEditorProps {
  dataset: Dataset;
  activeSheetName: string;
  currentRowIndex: number;
  onFieldChange: (fieldName: string, value: string) => void;
  fieldStatuses: FieldStatus;
  onFieldStatusChange: (fieldName: string, status: FieldStatusType) => void;
  glossary: NormalizedGlossary;
  rfiComments: RfiComments;
  onRfiCommentChange: (fieldName: string, comment: string | null) => void;
  changeMap: ChangeMap;
  modificationHistory: ModificationHistory;
  anomalyMap: AnomalyMap;
  viewMode: FieldViewMode;
  onViewModeChange: (mode: FieldViewMode) => void;
  onQuickAddToBlacklist?: (value: string) => void;
}

interface FieldAttentionInfo {
  hasRfi: boolean;
  needsAttention: boolean;
  hasMustReviewAnomaly: boolean;
  hasBlacklistHit: boolean;
  hasIncompleteAddress: boolean;
  hasManualEdit: boolean;
  anomalies: Anomaly[];
}

export function FieldsEditor({
  dataset,
  activeSheetName,
  currentRowIndex,
  onFieldChange,
  fieldStatuses,
  onFieldStatusChange,
  glossary,
  rfiComments,
  onRfiCommentChange,
  changeMap,
  modificationHistory,
  anomalyMap,
  viewMode,
  onViewModeChange,
  onQuickAddToBlacklist,
}: FieldsEditorProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [editingRfiField, setEditingRfiField] = useState<string | null>(null);
  const [rfiInputValue, setRfiInputValue] = useState('');
  const activeSheet = dataset.sheets.find((s) => s.name === activeSheetName);

  const glossaryMatches = useMemo(() => {
    if (!activeSheet) return {};
    const matches: Record<string, GlossaryEntry | null> = {};
    const editableHeaders = activeSheet.headers.slice(2);
    for (const header of editableHeaders) {
      matches[header] = matchFieldToGlossary(header, glossary);
    }
    return matches;
  }, [activeSheet, glossary]);

  const fieldAttentionMap = useMemo(() => {
    if (!activeSheet) return {};
    const editableHeaders = activeSheet.headers.slice(2);

    const map: Record<string, FieldAttentionInfo> = {};
    for (const header of editableHeaders) {
      const attention = getFieldAttention(
        activeSheetName,
        currentRowIndex,
        header,
        fieldStatuses,
        rfiComments,
        modificationHistory,
        anomalyMap
      );
      const anomalies = getFieldAnomalies(anomalyMap, activeSheetName, currentRowIndex, header);

      map[header] = {
        hasRfi: attention.hasRfi,
        needsAttention: attention.needsAttention,
        hasMustReviewAnomaly: attention.hasMustReviewAnomaly,
        hasBlacklistHit: attention.hasBlacklistHit,
        hasIncompleteAddress: attention.hasIncompleteAddress,
        hasManualEdit: attention.hasManualEdit,
        anomalies,
      };
    }
    return map;
  }, [activeSheet, currentRowIndex, fieldStatuses, activeSheetName, rfiComments, modificationHistory, anomalyMap]);

  const rowCounts = useMemo(() => {
    let rfiCount = 0;
    let attentionCount = 0;
    let anomalyCount = 0;
    for (const key in fieldAttentionMap) {
      const info = fieldAttentionMap[key];
      if (info.hasRfi) rfiCount++;
      if (info.needsAttention) attentionCount++;
      anomalyCount += info.anomalies.length;
    }
    return { rfiCount, attentionCount, anomalyCount };
  }, [fieldAttentionMap]);

  if (!activeSheet || !activeSheet.rows[currentRowIndex]) return null;

  const currentRow = activeSheet.rows[currentRowIndex];
  const headers = activeSheet.headers;
  const editableHeaders = headers.slice(2);

  const filteredHeaders = useMemo(() => {
    switch (viewMode) {
      case 'attention':
        return editableHeaders.filter(header => fieldAttentionMap[header]?.needsAttention);
      case 'rfi':
        return editableHeaders.filter(header => fieldAttentionMap[header]?.hasRfi);
      default:
        return editableHeaders;
    }
  }, [editableHeaders, fieldAttentionMap, viewMode]);

  const getFieldStatus = (fieldName: string): FieldStatusType => {
    if (!fieldStatuses || !fieldStatuses[activeSheetName]) {
      return 'incomplete';
    }
    return fieldStatuses[activeSheetName]?.[currentRowIndex]?.[fieldName] || 'incomplete';
  };

  const getRfiComment = (fieldName: string): string | undefined => {
    return rfiComments[activeSheetName]?.[currentRowIndex]?.[fieldName];
  };

  const handleRfiClick = (fieldName: string) => {
    const currentStatus = getFieldStatus(fieldName);
    const existingComment = getRfiComment(fieldName);

    if (currentStatus === 'rfi') {
      onFieldStatusChange(fieldName, 'incomplete');
      onRfiCommentChange(fieldName, null);
      setEditingRfiField(null);
      setRfiInputValue('');
    } else {
      onFieldStatusChange(fieldName, 'rfi');
      if (existingComment) {
        setRfiInputValue(existingComment);
      } else {
        setRfiInputValue('');
      }
      setEditingRfiField(fieldName);
    }
  };

  const handleSaveRfiComment = (fieldName: string) => {
    if (rfiInputValue.trim()) {
      onRfiCommentChange(fieldName, rfiInputValue.trim());
    }
    setEditingRfiField(null);
    setRfiInputValue('');
  };

  const handleEditRfiComment = (fieldName: string) => {
    const existingComment = getRfiComment(fieldName);
    setRfiInputValue(existingComment || '');
    setEditingRfiField(fieldName);
  };

  const handleDeleteRfiComment = (fieldName: string) => {
    onRfiCommentChange(fieldName, null);
    onFieldStatusChange(fieldName, 'incomplete');
    setEditingRfiField(null);
    setRfiInputValue('');
  };

  const handleStatusButtonClick = (fieldName: string, newStatus: FieldStatusType) => {
    const currentStatus = getFieldStatus(fieldName);
    if (currentStatus === newStatus) {
      onFieldStatusChange(fieldName, 'incomplete');
    } else {
      onFieldStatusChange(fieldName, newStatus);
    }
  };

  const getEmptyStateMessage = () => {
    switch (viewMode) {
      case 'attention':
        return {
          title: 'All clear - no items need attention',
          subtitle: 'Switch to All Data to see all fields',
        };
      case 'rfi':
        return {
          title: 'No RFIs on this row',
          subtitle: 'Switch to All Data to see all fields',
        };
      default:
        return {
          title: 'No fields to review',
          subtitle: '',
        };
    }
  };

  return (
    <div className="bg-white h-full overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <AttentionSummary
          rfiCount={rowCounts.rfiCount}
          attentionCount={rowCounts.attentionCount}
          anomalyCount={rowCounts.anomalyCount}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />

        {filteredHeaders.length === 0 ? (
          <div className="text-center py-12">
            {viewMode !== 'all' ? (
              <>
                <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">{getEmptyStateMessage().title}</p>
                <p className="text-slate-500 text-sm mt-1">{getEmptyStateMessage().subtitle}</p>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <p className="text-slate-600">No fields to review</p>
              </>
            )}
          </div>
        ) : (
          filteredHeaders.map((header, index) => {
            const value = currentRow[header] ?? '';
            const stringValue = String(value);
            const glossaryEntry = glossaryMatches[header];
            const fieldStatus = getFieldStatus(header);
            const isFocused = focusedField === header;
            const rfiComment = getRfiComment(header);
            const isEditingRfi = editingRfiField === header;
            const isRfiActive = fieldStatus === 'rfi';
            const isFieldLocked = isRfiActive && !isEditingRfi;
            const attentionInfo = fieldAttentionMap[header];

            const fieldEmpty = isValueEmpty(value);
            const allowedValues = glossaryEntry?.allowed_values || [];
            const useDropdown = shouldShowDropdown(allowedValues);
            const filteredAllowedValues = useDropdown ? filterAllowedValues(allowedValues) : [];
            const isNumber = glossaryEntry?.input_type === 'number';

            const valueOutsideAllowed = useDropdown && !fieldEmpty && !isValueInAllowedList(value, filteredAllowedValues);
            const valueNotNumeric = isNumber && !fieldEmpty && !isNumericValue(value);

            const displayLabel = glossaryEntry?.label || formatFieldName(header);
            const hasChanged = changeMap[activeSheetName]?.[currentRowIndex]?.[header] || false;
            const modification = modificationHistory[activeSheetName]?.[currentRowIndex]?.[header];
            const fieldColor = getColorForField(header, index);
            const hasValue = !fieldEmpty && String(value).trim().length >= 2;

            return (
              <div key={header} className="border-b border-slate-200 pb-3 last:border-b-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 min-w-0 flex-1"
                    title={displayLabel}
                  >
                    {hasValue && (
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: fieldColor.bg, border: `2px solid ${fieldColor.border}` }}
                        title="Color in Contract view"
                      />
                    )}
                    <span className="truncate">{displayLabel}</span>
                    {modification && <ModificationTooltip modification={modification} />}
                    {!modification && hasChanged && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full flex-shrink-0">
                        <Edit3 className="w-2.5 h-2.5" />
                        Mod
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {viewMode !== 'all' && attentionInfo && (
                      <AttentionBadges info={attentionInfo} />
                    )}
                    {glossaryEntry && <GlossaryPopover entry={glossaryEntry} />}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <button
                    onClick={() => handleStatusButtonClick(header, 'complete')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      fieldStatus === 'complete'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-green-100 hover:text-green-700'
                    }`}
                    title="Mark as complete"
                  >
                    <Check className="w-3 h-3" />
                    Done
                  </button>
                  <button
                    onClick={() => handleRfiClick(header)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      isRfiActive
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-700'
                    }`}
                    title="Request for information"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    RFI
                  </button>
                  {isRfiActive && rfiComment && !isEditingRfi && (
                    <>
                      <button
                        onClick={() => handleEditRfiComment(header)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-all"
                        title="Edit comment"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRfiComment(header)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-all"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {onQuickAddToBlacklist && !fieldEmpty && (
                    <button
                      onClick={() => onQuickAddToBlacklist(stringValue)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 transition-all"
                      title="Add to blacklist"
                    >
                      <Shield className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {fieldEmpty && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Empty field</span>
                    </p>
                  )}

                  {valueOutsideAllowed && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Value not in allowed list</span>
                    </p>
                  )}

                  {valueNotNumeric && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Expected numeric value</span>
                    </p>
                  )}

                  {attentionInfo?.anomalies.map((anomaly, i) => (
                    <p key={i} className="text-xs text-orange-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{anomaly.message}</span>
                    </p>
                  ))}
                </div>

                <div className={`mt-1 ${isRfiActive ? 'ring-2 ring-orange-300 rounded-lg' : ''}`}>
                  {useDropdown ? (
                    <SelectField
                      value={stringValue}
                      allowedValues={filteredAllowedValues}
                      onChange={(val) => onFieldChange(header, val)}
                      fieldEmpty={fieldEmpty}
                      valueOutsideAllowed={valueOutsideAllowed}
                      disabled={isFieldLocked}
                    />
                  ) : (
                    <textarea
                      value={stringValue}
                      onChange={(e) => onFieldChange(header, e.target.value)}
                      onFocus={() => setFocusedField(header)}
                      onBlur={() => setFocusedField(null)}
                      placeholder={glossaryEntry?.input_type === 'date' ? 'YYYY-MM-DD' : undefined}
                      disabled={isFieldLocked}
                      className={`w-full px-2 py-1.5 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all ${
                        fieldEmpty || valueNotNumeric
                          ? 'border-amber-300 bg-amber-50 focus:ring-amber-500'
                          : isFieldLocked
                          ? 'border-orange-300 bg-orange-50 cursor-not-allowed'
                          : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                      }`}
                      rows={isFocused ? 4 : 1}
                    />
                  )}
                </div>

                {isRfiActive && rfiComment && !isEditingRfi && (
                  <div className="mt-1.5 px-2 py-1.5 bg-orange-50 border border-orange-200 rounded">
                    <p className="text-[10px] text-orange-700 font-medium">RFI:</p>
                    <p className="text-xs text-orange-900 font-mono truncate" title={rfiComment}>//{rfiComment}</p>
                  </div>
                )}

                {isEditingRfi && (
                  <div className="mt-1.5 p-2 bg-orange-50 border border-orange-200 rounded">
                    <label className="block text-[10px] font-medium text-orange-700 mb-1">
                      RFI Comment:
                    </label>
                    <input
                      type="text"
                      value={rfiInputValue}
                      onChange={(e) => setRfiInputValue(e.target.value)}
                      placeholder="Enter comment..."
                      className="w-full px-2 py-1.5 border border-orange-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveRfiComment(header);
                        } else if (e.key === 'Escape') {
                          setEditingRfiField(null);
                          setRfiInputValue('');
                        }
                      }}
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        onClick={() => handleSaveRfiComment(header)}
                        className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingRfiField(null);
                          setRfiInputValue('');
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-medium hover:bg-slate-300 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AttentionBadges({ info }: { info: FieldAttentionInfo }) {
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {info.hasRfi && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-medium">
          <MessageSquare className="w-2.5 h-2.5" />
          RFI
        </span>
      )}
      {info.hasBlacklistHit && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-medium">
          <Shield className="w-2.5 h-2.5" />
          Blacklist
        </span>
      )}
      {info.hasIncompleteAddress && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded font-medium">
          <Zap className="w-2.5 h-2.5" />
          Incomplete
        </span>
      )}
      {info.anomalies.some(a => a.type === 'unexpected_missing') && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded font-medium">
          <HelpCircle className="w-2.5 h-2.5" />
          Missing
        </span>
      )}
      {info.anomalies.some(a => a.type === 'invalid_allowed_value') && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] rounded font-medium">
          <XCircle className="w-2.5 h-2.5" />
          Invalid
        </span>
      )}
      {info.hasManualEdit && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">
          <Edit3 className="w-2.5 h-2.5" />
          Edited
        </span>
      )}
    </span>
  );
}

interface SelectFieldProps {
  value: string;
  allowedValues: string[];
  onChange: (value: string) => void;
  fieldEmpty: boolean;
  valueOutsideAllowed: boolean;
  disabled?: boolean;
}

function SelectField({ value, allowedValues, onChange, fieldEmpty, valueOutsideAllowed, disabled }: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const trimmedValue = value.trim();
  const isCustomValue = trimmedValue !== '' && !allowedValues.some(av => av.toLowerCase() === trimmedValue.toLowerCase());

  const filteredValues = useMemo(() => {
    if (!searchTerm) return allowedValues;
    const search = searchTerm.toLowerCase();
    return allowedValues.filter(av => av.toLowerCase().includes(search));
  }, [allowedValues, searchTerm]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleInputBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={isOpen && searchTerm !== '' ? searchTerm : value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        disabled={disabled}
        placeholder="Type to search or select..."
        className={`w-full px-2 py-1.5 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          fieldEmpty || valueOutsideAllowed
            ? 'border-amber-300 bg-amber-50 focus:ring-amber-500'
            : disabled
            ? 'border-orange-300 bg-orange-50 cursor-not-allowed'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      />
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredValues.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              No matches found. Press Enter to use custom value.
            </div>
          ) : (
            filteredValues.map((av, idx) => {
              const isSelected = av.toLowerCase() === trimmedValue.toLowerCase();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(av)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    isSelected ? 'bg-blue-100 text-blue-900 font-medium' : 'text-slate-700'
                  }`}
                >
                  {av}
                </button>
              );
            })
          )}
        </div>
      )}
      {isCustomValue && (
        <p className="mt-0.5 text-[10px] text-amber-600">
          Using custom value (not in allowed list)
        </p>
      )}
    </div>
  );
}
