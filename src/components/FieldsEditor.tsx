import { useState, useMemo } from 'react';
import { AlertCircle, Check, AlertTriangle, MessageSquare, Trash2, X, Edit3, Zap, XCircle, HelpCircle, Shield, Lightbulb, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { Dataset, FieldStatus, FieldStatusType, NormalizedGlossary, GlossaryEntry, RfiComments, ChangeMap, ModificationHistory, AnomalyMap, FieldViewMode, Anomaly, HingesConfig, HingeField, BuiltHingeGroup, HingeLevel } from '../types';
import { formatFieldName } from '../utils/formatFieldName';
import { matchFieldToGlossary, isValueEmpty, isValueInAllowedList, isNumericValue, shouldShowDropdown, filterAllowedValues } from '../utils/glossary';
import { GlossaryPopover } from './GlossaryPopover';
import { ModificationTooltip } from './ModificationTooltip';
import { getColorForField } from '../utils/highlightColors';
import { AttentionSummary } from './AttentionSummary';
import { getFieldAnomalies } from '../utils/anomalyDetection';
import { getFieldAttention } from '../utils/attentionLogic';
import { getHingeFieldsForSheet } from '../config/hingesConfig';
import { buildHingeGroupsForSheet, getHingeFieldInGroup, getFieldLevelInGroup, getUngroupedFields } from '../utils/hingeGroups';
import { getGroupColorClasses } from '../config/defaultHingeGroups';

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
  hingesConfig?: HingesConfig;
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
  hingesConfig,
}: FieldsEditorProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [editingRfiField, setEditingRfiField] = useState<string | null>(null);
  const [rfiInputValue, setRfiInputValue] = useState('');
  const [showHingeHints, setShowHingeHints] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const activeSheet = dataset.sheets.find((s) => s.name === activeSheetName);

  const hingeFieldsMap = useMemo(() => {
    if (!hingesConfig) return {};
    const hingeFields = getHingeFieldsForSheet(hingesConfig, activeSheetName);
    const map: Record<string, HingeField> = {};
    for (const field of hingeFields) {
      map[field.primaryField.toLowerCase()] = field;
    }
    return map;
  }, [hingesConfig, activeSheetName]);

  const hingeGroups = useMemo(() => {
    if (!hingesConfig || !activeSheet) return [];
    return buildHingeGroupsForSheet(hingesConfig, activeSheetName, activeSheet.headers);
  }, [hingesConfig, activeSheetName, activeSheet]);

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const getHingeInfo = (fieldName: string): HingeField | null => {
    return hingeFieldsMap[fieldName.toLowerCase()] || null;
  };

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
        <div className="flex items-center justify-between gap-2">
          <AttentionSummary
            rfiCount={rowCounts.rfiCount}
            attentionCount={rowCounts.attentionCount}
            anomalyCount={rowCounts.anomalyCount}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
          {Object.keys(hingeFieldsMap).length > 0 && (
            <button
              onClick={() => setShowHingeHints(!showHingeHints)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
                showHingeHints
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-600'
              }`}
              title={showHingeHints ? 'Hide field groups' : 'Show field groups'}
            >
              {showHingeHints ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <Lightbulb className="w-3 h-3" />
              Field Groups
            </button>
          )}
        </div>

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
        ) : showHingeHints && hingeGroups.length > 0 ? (
          <GroupedFieldsRenderer
            hingeGroups={hingeGroups}
            filteredHeaders={filteredHeaders}
            collapsedGroups={collapsedGroups}
            toggleGroupCollapsed={toggleGroupCollapsed}
            currentRow={currentRow}
            glossaryMatches={glossaryMatches}
            fieldAttentionMap={fieldAttentionMap}
            getFieldStatus={getFieldStatus}
            getRfiComment={getRfiComment}
            focusedField={focusedField}
            setFocusedField={setFocusedField}
            editingRfiField={editingRfiField}
            setEditingRfiField={setEditingRfiField}
            rfiInputValue={rfiInputValue}
            setRfiInputValue={setRfiInputValue}
            changeMap={changeMap}
            modificationHistory={modificationHistory}
            activeSheetName={activeSheetName}
            currentRowIndex={currentRowIndex}
            viewMode={viewMode}
            onFieldChange={onFieldChange}
            handleStatusButtonClick={handleStatusButtonClick}
            handleRfiClick={handleRfiClick}
            handleEditRfiComment={handleEditRfiComment}
            handleDeleteRfiComment={handleDeleteRfiComment}
            handleSaveRfiComment={handleSaveRfiComment}
            onQuickAddToBlacklist={onQuickAddToBlacklist}
          />
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
            const hingeInfo = getHingeInfo(header);

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

            const hingeLevel = hingeInfo?.hingeLevel || 'tertiary';
            const isHingeHighlighted = showHingeHints && hingeInfo;
            const isPrimary = hingeLevel === 'primary';
            const isSecondary = hingeLevel === 'secondary';

            return (
              <div
                key={header}
                className={`border-b border-slate-200 pb-3 last:border-b-0 transition-all ${
                  isHingeHighlighted
                    ? isPrimary
                      ? 'bg-red-50 border-l-4 border-l-red-400 pl-3 -ml-3 rounded-r'
                      : isSecondary
                      ? 'bg-amber-50 border-l-4 border-l-amber-400 pl-3 -ml-3 rounded-r'
                      : 'bg-gray-50 border-l-4 border-l-gray-300 pl-3 -ml-3 rounded-r'
                    : ''
                }`}
              >
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
                    {isPrimary && <span className="text-red-600 font-bold">*</span>}
                    {hingeInfo && (
                      <HingeBadge level={hingeLevel} description={hingeInfo.description || hingeInfo.whyItHinges} />
                    )}
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

function HingeBadge({ level, description }: { level: string; description?: string }) {
  const isPrimary = level === 'primary';
  const isSecondary = level === 'secondary';

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
        isPrimary
          ? 'bg-red-100 text-red-700 border border-red-200 font-bold'
          : isSecondary
          ? 'bg-amber-100 text-amber-700 border border-amber-200'
          : 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}
      title={description || `${level} hinge field`}
    >
      <Lightbulb className="w-2.5 h-2.5" />
      {isPrimary ? 'PRIMARY' : isSecondary ? 'SECONDARY' : 'HINGE'}
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

interface GroupedFieldsRendererProps {
  hingeGroups: BuiltHingeGroup[];
  filteredHeaders: string[];
  collapsedGroups: Set<string>;
  toggleGroupCollapsed: (groupId: string) => void;
  currentRow: Record<string, unknown>;
  glossaryMatches: Record<string, GlossaryEntry | null>;
  fieldAttentionMap: Record<string, FieldAttentionInfo>;
  getFieldStatus: (fieldName: string) => FieldStatusType;
  getRfiComment: (fieldName: string) => string | undefined;
  focusedField: string | null;
  setFocusedField: (field: string | null) => void;
  editingRfiField: string | null;
  setEditingRfiField: (field: string | null) => void;
  rfiInputValue: string;
  setRfiInputValue: (value: string) => void;
  changeMap: ChangeMap;
  modificationHistory: ModificationHistory;
  activeSheetName: string;
  currentRowIndex: number;
  viewMode: FieldViewMode;
  onFieldChange: (fieldName: string, value: string) => void;
  handleStatusButtonClick: (fieldName: string, status: FieldStatusType) => void;
  handleRfiClick: (fieldName: string) => void;
  handleEditRfiComment: (fieldName: string) => void;
  handleDeleteRfiComment: (fieldName: string) => void;
  handleSaveRfiComment: (fieldName: string) => void;
  onQuickAddToBlacklist?: (value: string) => void;
}

function GroupedFieldsRenderer({
  hingeGroups,
  filteredHeaders,
  collapsedGroups,
  toggleGroupCollapsed,
  currentRow,
  glossaryMatches,
  fieldAttentionMap,
  getFieldStatus,
  getRfiComment,
  focusedField,
  setFocusedField,
  editingRfiField,
  setEditingRfiField,
  rfiInputValue,
  setRfiInputValue,
  changeMap,
  modificationHistory,
  activeSheetName,
  currentRowIndex,
  viewMode,
  onFieldChange,
  handleStatusButtonClick,
  handleRfiClick,
  handleEditRfiComment,
  handleDeleteRfiComment,
  handleSaveRfiComment,
  onQuickAddToBlacklist,
}: GroupedFieldsRendererProps) {
  const filteredSet = new Set(filteredHeaders.map(h => h.toLowerCase()));

  const groupedFieldsSet = new Set<string>();
  for (const group of hingeGroups) {
    for (const fieldName of group.allFieldNames) {
      groupedFieldsSet.add(fieldName.toLowerCase());
    }
  }

  const ungroupedHeaders = filteredHeaders.filter(
    h => !groupedFieldsSet.has(h.toLowerCase())
  );

  const renderSingleField = (header: string, index: number, hingeLevel?: HingeLevel) => {
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

    const isPrimary = hingeLevel === 'primary';
    const isSecondary = hingeLevel === 'secondary';

    return (
      <div
        key={header}
        className={`border-b border-slate-200 pb-3 last:border-b-0 transition-all ${
          isPrimary
            ? 'bg-red-50/50 border-l-4 border-l-red-400 pl-3 -ml-3 rounded-r'
            : isSecondary
            ? 'bg-amber-50/50 border-l-4 border-l-amber-400 pl-3 -ml-3 rounded-r'
            : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 min-w-0 flex-1" title={displayLabel}>
            {hasValue && (
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: fieldColor.bg, border: `2px solid ${fieldColor.border}` }}
                title="Color in Contract view"
              />
            )}
            <span className="truncate">{displayLabel}</span>
            {isPrimary && <span className="text-red-600 font-bold">*</span>}
            {hingeLevel && <HingeBadge level={hingeLevel} />}
            {modification && <ModificationTooltip modification={modification} />}
            {!modification && hasChanged && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full flex-shrink-0">
                <Edit3 className="w-2.5 h-2.5" />
                Mod
              </span>
            )}
          </label>
          <div className="flex items-center gap-1 flex-shrink-0">
            {viewMode !== 'all' && attentionInfo && <AttentionBadges info={attentionInfo} />}
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
            <label className="block text-[10px] font-medium text-orange-700 mb-1">RFI Comment:</label>
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
  };

  return (
    <div className="space-y-4">
      {hingeGroups.map((group) => {
        const groupFieldsInFilter = group.allFieldNames.filter(f =>
          filteredSet.has(f.toLowerCase())
        );

        if (groupFieldsInFilter.length === 0) return null;

        const colorClasses = getGroupColorClasses(group.group_id);
        const isCollapsed = collapsedGroups.has(group.group_id);
        const primaryCount = group.primary_fields.filter(f => filteredSet.has(f.toLowerCase())).length;
        const secondaryCount = group.secondary_fields.filter(f => filteredSet.has(f.toLowerCase())).length;
        const tertiaryCount = group.tertiary_fields.filter(f => filteredSet.has(f.toLowerCase())).length;

        return (
          <div
            key={group.group_id}
            className={`rounded-lg border-2 ${colorClasses.border} overflow-hidden`}
          >
            <button
              onClick={() => toggleGroupCollapsed(group.group_id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 ${colorClasses.headerBg} hover:opacity-95 transition-opacity`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCollapsed ? (
                  <ChevronRight className={`w-4 h-4 ${colorClasses.text} flex-shrink-0`} />
                ) : (
                  <ChevronDown className={`w-4 h-4 ${colorClasses.text} flex-shrink-0`} />
                )}
                <Lightbulb className={`w-4 h-4 ${colorClasses.text} flex-shrink-0`} />
                <span className={`font-semibold text-sm ${colorClasses.text}`}>
                  {group.group_label}
                </span>
                <span className="flex gap-1">
                  {primaryCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-medium">
                      {primaryCount} Primary
                    </span>
                  )}
                  {secondaryCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-medium">
                      {secondaryCount} Secondary
                    </span>
                  )}
                  {tertiaryCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded font-medium">
                      {tertiaryCount} Other
                    </span>
                  )}
                </span>
              </div>
              <span className="text-xs text-slate-500 truncate ml-2 max-w-[180px]" title={group.group_description}>
                {group.group_description}
              </span>
            </button>

            {!isCollapsed && (
              <div className={`p-3 space-y-3 ${colorClasses.bg}`}>
                {group.primary_fields
                  .filter(f => filteredSet.has(f.toLowerCase()))
                  .map((fieldName, idx) => {
                    const headerMatch = filteredHeaders.find(h => h.toLowerCase() === fieldName.toLowerCase());
                    if (!headerMatch) return null;
                    return renderSingleField(headerMatch, idx, 'primary');
                  })}

                {group.secondary_fields
                  .filter(f => filteredSet.has(f.toLowerCase()))
                  .map((fieldName, idx) => {
                    const headerMatch = filteredHeaders.find(h => h.toLowerCase() === fieldName.toLowerCase());
                    if (!headerMatch) return null;
                    return renderSingleField(headerMatch, idx + 100, 'secondary');
                  })}

                {group.tertiary_fields
                  .filter(f => filteredSet.has(f.toLowerCase()))
                  .map((fieldName, idx) => {
                    const headerMatch = filteredHeaders.find(h => h.toLowerCase() === fieldName.toLowerCase());
                    if (!headerMatch) return null;
                    return renderSingleField(headerMatch, idx + 200, 'tertiary');
                  })}
              </div>
            )}
          </div>
        );
      })}

      {ungroupedHeaders.length > 0 && (
        <div className="rounded-lg border-2 border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-100">
            <span className="font-semibold text-sm text-slate-700">Other Fields</span>
            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded font-medium">
              {ungroupedHeaders.length} fields
            </span>
          </div>
          <div className="p-3 space-y-3 bg-slate-50">
            {ungroupedHeaders.map((header, idx) => renderSingleField(header, idx + 500))}
          </div>
        </div>
      )}
    </div>
  );
}
