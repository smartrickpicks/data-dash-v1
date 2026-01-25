import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { ExternalLink, Edit2, Save, X, ZoomIn, ZoomOut, Upload, FileX, Search, ChevronUp, ChevronDown, Eye, EyeOff, Check, Palette, AlertTriangle, RefreshCw, Database, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import {
  RowData,
  FieldStatusType,
  AnomalyMap,
  ContractFailureCategory,
  ContractFailureOverride,
  ContractLoadFailureMeta,
  UnreadableTextMeta,
  NormalizedGlossary,
  ExtractionSuspectMeta,
} from '../types';
import { prepareFieldHighlights, FieldHighlight } from '../utils/highlightColors';
import { formatFieldName } from '../utils/formatFieldName';
import { usePdfFetch, isPdfUrl, PdfFetchError } from '../hooks/usePdfFetch';
import { formatCacheSize } from '../utils/contractCache';
import {
  getCategoryLabel,
  getGuidanceForCategory,
  getConfidenceColor,
  getCategoryOrder,
} from '../utils/contractFailureClassifier';
import { getEligibleFieldsForPdfMatching, getFallbackFieldsForPdfMatching, EligibleField, MIN_ELIGIBLE_FIELDS } from '../utils/pdfEligibility';
import { computeGibberishRatio } from '../utils/pdfTextNormalize';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type HighlightFilter =
  | { mode: 'all' }
  | { mode: 'legendGroup'; groupId: string }
  | { mode: 'term'; term: string; fieldName: string; groupId?: string };

interface ActiveHighlightBubble {
  fieldName: string;
  term: string;
  occurrences: number;
  x: number;
  y: number;
  groupId: string;
}

interface ContractViewerProps {
  source: string;
  onContractChange?: (newUrl: string) => void;
  sheetName: string;
  rowIndex: number;
  headers?: string[];
  currentRow?: RowData;
  fieldStatuses?: Record<string, FieldStatusType>;
  onFieldStatusChange?: (fieldName: string, status: FieldStatusType) => void;
  onContractLoadError?: (error: PdfFetchError) => void;
  anomalyMap?: AnomalyMap;
  failureOverride?: ContractFailureOverride;
  onFailureCategoryOverride?: (category: ContractFailureCategory, reason?: string) => void;
  onUnreadableTextDetected?: (meta: UnreadableTextMeta) => void;
  glossary?: NormalizedGlossary;
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

const OVERRIDE_REASONS = [
  'False positive',
  'New edge case',
  'Data source issue',
  'Temporary error',
  'Other',
];

export const ContractViewer = React.memo(function ContractViewer({
  source,
  onContractChange,
  sheetName,
  rowIndex,
  headers,
  currentRow,
  fieldStatuses,
  onFieldStatusChange,
  onContractLoadError,
  anomalyMap,
  failureOverride,
  onFailureCategoryOverride,
  onUnreadableTextDetected,
  glossary,
}: ContractViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedUrl, setEditedUrl] = useState(source);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.5);
  const [pdfParseError, setPdfParseError] = useState(false);
  const [manualPdfUrl, setManualPdfUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number>(0);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(0);
  const [showFieldHighlights, setShowFieldHighlights] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [highlightedFields, setHighlightedFields] = useState<FieldHighlight[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<{ fieldName: string; x: number; y: number } | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedOverrideReason, setSelectedOverrideReason] = useState<string>('');
  const [unreadableTextDetected, setUnreadableTextDetected] = useState(false);
  const [highlightsApplied, setHighlightsApplied] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [extractedTextLength, setExtractedTextLength] = useState(0);
  const [gibberishRatio, setGibberishRatio] = useState(0);
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>({ mode: 'all' });
  const [activeBubble, setActiveBubble] = useState<ActiveHighlightBubble | null>(null);
  const [hoveredLegendGroup, setHoveredLegendGroup] = useState<string | null>(null);
  const errorReportedRef = useRef<string | null>(null);
  const unreadableReportedRef = useRef<string | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const isDebugMode = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('debug') === '1' ||
    localStorage.getItem('pdfDebug') === '1'
  );

  const trimmedSource = String(source || '').trim();
  const isUrl = isValidUrl(trimmedSource);
  const isPdf = isPdfUrl(trimmedSource);

  const {
    pdfUrl: fetchedPdfUrl,
    isLoading,
    error: fetchError,
    isCached,
    fileSize,
    refetch,
    fetchStatus,
  } = usePdfFetch(trimmedSource, sheetName, rowIndex);

  const activePdfUrl = manualPdfUrl || fetchedPdfUrl;

  const currentFailureMeta = useMemo((): ContractLoadFailureMeta | null => {
    if (failureOverride && fetchError?.failureMeta) {
      return {
        ...fetchError.failureMeta,
        category: failureOverride.category,
        overridden: true,
        overrideReason: failureOverride.overrideReason,
      };
    }
    return fetchError?.failureMeta || null;
  }, [fetchError?.failureMeta, failureOverride]);

  useEffect(() => {
    if (fetchError && onContractLoadError) {
      const errorKey = `${sheetName}_${rowIndex}_${fetchError.code}`;
      if (errorReportedRef.current !== errorKey) {
        errorReportedRef.current = errorKey;
        onContractLoadError(fetchError);
      }
    }
  }, [fetchError, sheetName, rowIndex, onContractLoadError]);

  useEffect(() => {
    if (fetchedPdfUrl) {
      errorReportedRef.current = null;
    }
  }, [fetchedPdfUrl]);

  useEffect(() => {
    setManualPdfUrl(null);
    setPdfParseError(false);
    setNumPages(0);
    setUnreadableTextDetected(false);
    setHighlightsApplied(false);
    setHighlightFilter({ mode: 'all' });
    setActiveBubble(null);
    setHoveredLegendGroup(null);
    errorReportedRef.current = null;
    unreadableReportedRef.current = null;
  }, [trimmedSource, sheetName, rowIndex]);

  useEffect(() => {
    setEditedUrl(trimmedSource);
  }, [trimmedSource]);

  const fieldHighlights = useMemo(() => {
    if (!headers || !currentRow) return [];
    return prepareFieldHighlights(headers, currentRow, 2);
  }, [headers, currentRow]);

  const applyFieldHighlights = useCallback(() => {
    if (!showFieldHighlights || fieldHighlights.length === 0) {
      removeFieldHighlights();
      setHighlightsApplied(true);
      return;
    }

    setTimeout(() => {
      const textLayers = document.querySelectorAll('.textLayer, .react-pdf__Page__textContent');
      const updatedHighlights = [...fieldHighlights].map(h => ({ ...h, occurrences: 0 }));
      let fullExtractedText = '';

      textLayers.forEach((layer) => {
        const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT, null);
        const textNodes: { node: Node; parent: HTMLElement }[] = [];
        let node;
        while ((node = walker.nextNode())) {
          if (node.parentElement && !node.parentElement.classList.contains('field-highlight')) {
            textNodes.push({ node, parent: node.parentElement });
            fullExtractedText += (node.textContent || '') + ' ';
          }
        }

        textNodes.forEach(({ node, parent }) => {
          const text = node.textContent || '';
          let newHTML = text;
          let hasMatch = false;

          updatedHighlights.forEach((highlight, idx) => {
            const escapedValue = highlight.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedValue})`, 'gi');
            const matches = newHTML.match(regex);

            if (matches) {
              hasMatch = true;
              updatedHighlights[idx].occurrences += matches.length;
              const groupId = highlight.color.name;
              newHTML = newHTML.replace(
                regex,
                `<span class="field-highlight" data-field="${highlight.fieldName}" data-group="${groupId}" data-term="${encodeURIComponent(highlight.value)}" style="background-color: ${highlight.color.bg}; border-bottom: 2px solid ${highlight.color.border}; padding: 1px 2px; border-radius: 2px; cursor: pointer;">$1</span>`
              );
            }
          });

          if (hasMatch) {
            parent.innerHTML = newHTML;
          }
        });
      });

      setExtractedTextLength(fullExtractedText.length);
      setGibberishRatio(computeGibberishRatio(fullExtractedText));
      setHighlightedFields(updatedHighlights);
      setHighlightsApplied(true);

      document.querySelectorAll('.field-highlight').forEach((el) => {
        el.addEventListener('click', handleHighlightClick as EventListener);
      });
    }, 200);
  }, [fieldHighlights, showFieldHighlights]);

  const removeFieldHighlights = useCallback(() => {
    document.querySelectorAll('.field-highlight').forEach((el) => {
      el.removeEventListener('click', handleHighlightClick as EventListener);
      const parent = el.parentElement;
      if (parent) {
        const textContent = el.textContent || '';
        el.replaceWith(document.createTextNode(textContent));
        parent.normalize();
      }
    });
    setHighlightedFields([]);
  }, []);

  const handleHighlightClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const fieldName = target.dataset.field;
    const groupId = target.dataset.group;
    const encodedTerm = target.dataset.term;

    if (fieldName && encodedTerm && groupId) {
      const term = decodeURIComponent(encodedTerm);
      const rect = target.getBoundingClientRect();

      const field = highlightedFields.find((f) => f.fieldName === fieldName);
      const occurrences = field?.occurrences || 1;

      if (highlightFilter.mode === 'term' && highlightFilter.term === term && highlightFilter.fieldName === fieldName) {
        setHighlightFilter({ mode: 'all' });
        setActiveBubble(null);
      } else {
        setHighlightFilter({ mode: 'term', term, fieldName, groupId });
        setActiveBubble({
          fieldName,
          term,
          occurrences,
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          groupId,
        });
      }
      setActiveTooltip(null);
    }
  }, [highlightedFields, highlightFilter]);

  const handleMarkAsDone = useCallback((fieldName: string, closeBubble = true) => {
    if (onFieldStatusChange) {
      const currentStatus = fieldStatuses?.[fieldName];
      if (currentStatus === 'complete') {
        onFieldStatusChange(fieldName, 'incomplete');
      } else {
        onFieldStatusChange(fieldName, 'complete');
      }
    }
    setActiveTooltip(null);
    if (closeBubble) {
      setActiveBubble(null);
    }
  }, [onFieldStatusChange, fieldStatuses]);

  const handleClearFilter = useCallback(() => {
    setHighlightFilter({ mode: 'all' });
    setActiveBubble(null);
    setHoveredLegendGroup(null);
  }, []);

  const handleLegendGroupClick = useCallback((groupId: string) => {
    if (highlightFilter.mode === 'legendGroup' && highlightFilter.groupId === groupId) {
      setHighlightFilter({ mode: 'all' });
    } else {
      setHighlightFilter({ mode: 'legendGroup', groupId });
      setActiveBubble(null);
    }
  }, [highlightFilter]);

  useEffect(() => {
    if (activePdfUrl && numPages > 0 && showFieldHighlights) {
      applyFieldHighlights();
    } else {
      removeFieldHighlights();
    }
  }, [activePdfUrl, numPages, showFieldHighlights, applyFieldHighlights, removeFieldHighlights]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeTooltip && !(e.target as HTMLElement).closest('.field-highlight-tooltip')) {
        setActiveTooltip(null);
      }
      if (activeBubble && !(e.target as HTMLElement).closest('.highlight-action-bubble') && !(e.target as HTMLElement).closest('.field-highlight')) {
        setActiveBubble(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeTooltip, activeBubble]);

  useEffect(() => {
    const highlights = document.querySelectorAll('.field-highlight');
    const activeFilter = hoveredLegendGroup ? { mode: 'legendGroup' as const, groupId: hoveredLegendGroup } : highlightFilter;

    highlights.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const elGroup = htmlEl.dataset.group;
      const elTerm = htmlEl.dataset.term ? decodeURIComponent(htmlEl.dataset.term) : '';
      const elField = htmlEl.dataset.field;

      let isVisible = true;

      if (activeFilter.mode === 'legendGroup') {
        isVisible = elGroup === activeFilter.groupId;
      } else if (activeFilter.mode === 'term') {
        isVisible = elTerm === activeFilter.term && elField === activeFilter.fieldName;
      }

      if (isVisible) {
        htmlEl.style.opacity = '1';
        htmlEl.style.pointerEvents = 'auto';
      } else {
        htmlEl.style.opacity = '0.15';
        htmlEl.style.pointerEvents = 'none';
      }
    });
  }, [highlightFilter, hoveredLegendGroup, highlightedFields]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeBubble) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleMarkAsDone(activeBubble.fieldName, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setActiveBubble(null);
        setHighlightFilter({ mode: 'all' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeBubble, handleMarkAsDone]);

  useEffect(() => {
    if (!highlightsApplied || !onUnreadableTextDetected) return;
    if (numPages === 0 || fetchError || pdfParseError || manualPdfUrl) return;
    if (!headers || !currentRow) return;

    const eligibleFields = glossary
      ? getEligibleFieldsForPdfMatching(headers, currentRow, glossary)
      : getFallbackFieldsForPdfMatching(headers, currentRow);

    if (eligibleFields.length === 0) {
      return;
    }

    const eligibleFieldNames = eligibleFields.map(f => f.fieldName);
    const matchedFields = highlightedFields.filter(
      h => eligibleFieldNames.includes(h.fieldName) && h.occurrences > 0
    );

    const eligibleFieldCount = eligibleFields.length;
    const matchedFieldCount = matchedFields.length;

    const reportKey = `${sheetName}_${rowIndex}_unreadable`;
    if (eligibleFieldCount >= MIN_ELIGIBLE_FIELDS && matchedFieldCount === 0 && unreadableReportedRef.current !== reportKey) {
      unreadableReportedRef.current = reportKey;
      setUnreadableTextDetected(true);

      const confidence = extractedTextLength > 200 && gibberishRatio < 0.02 ? 'high' : 'medium';
      const decision = 'unreadable' as const;
      const reason = `No eligible fields found in PDF text (0/${eligibleFieldCount} matched)`;

      const meta: UnreadableTextMeta = {
        attemptedTerms: eligibleFieldCount,
        totalMatches: 0,
        sizeBytes: fileSize || undefined,
        note: `PDF loaded successfully but ${eligibleFieldCount} eligible required fields could not be found in the document text. This may indicate a scanned or corrupted PDF.`,
        detectedAt: new Date().toISOString(),
        eligibleFieldNames,
        eligibleFieldCount,
        matchedFieldCount: 0,
        pdfSource: fetchStatus === 'proxy' ? 'proxy' : 'direct',
        decision,
        confidence,
        extractedTextLength,
        matchedEligibleFieldNames: [],
        gibberishRatio,
        reason,
      };

      onUnreadableTextDetected(meta);
    }
  }, [
    highlightsApplied,
    highlightedFields,
    fieldHighlights,
    numPages,
    fetchError,
    pdfParseError,
    manualPdfUrl,
    sheetName,
    rowIndex,
    fileSize,
    onUnreadableTextDetected,
    headers,
    currentRow,
    glossary,
    fetchStatus,
    extractedTextLength,
    gibberishRatio,
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a valid PDF file');
      return;
    }

    const url = URL.createObjectURL(file);
    setManualPdfUrl(url);
    setPdfParseError(false);
  };

  const handleClearManualPdf = () => {
    if (manualPdfUrl) {
      URL.revokeObjectURL(manualPdfUrl);
    }
    setManualPdfUrl(null);
    setPdfParseError(false);
  };

  const handleOpenInNewTab = () => {
    window.open(trimmedSource, '_blank');
  };

  const handleSave = () => {
    if (onContractChange && editedUrl.trim() !== trimmedSource) {
      onContractChange(editedUrl.trim());
    }
    setIsEditing(false);
    setPdfParseError(false);
  };

  const handleCancel = () => {
    setEditedUrl(trimmedSource);
    setIsEditing(false);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfParseError(false);

    if (searchTerm) {
      setTimeout(() => handleSearch(searchTerm), 500);
    }
  };

  const onDocumentLoadError = () => {
    setPdfParseError(true);
    if (onContractLoadError && !manualPdfUrl) {
      const errorKey = `${sheetName}_${rowIndex}_pdf_parse_error`;
      if (errorReportedRef.current !== errorKey) {
        errorReportedRef.current = errorKey;
        onContractLoadError({
          code: 'pdf_parse_error',
          message: 'Failed to parse the PDF file. It may be corrupted.',
          fileSize: fileSize || undefined,
        });
      }
    }
  };

  const zoomIn = () => setScale((prev) => Math.min(2.0, prev + 0.2));
  const zoomOut = () => setScale((prev) => Math.max(0.5, prev - 0.2));

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentSearchIndex(0);
    setSearchResults(0);

    if (!term.trim()) {
      removeHighlights();
      return;
    }

    setTimeout(() => {
      const textLayers = document.querySelectorAll('.textLayer, .react-pdf__Page__textContent');
      let totalMatches = 0;

      textLayers.forEach((layer) => {
        const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT, null);
        const textNodes: Node[] = [];
        let node;
        while ((node = walker.nextNode())) {
          textNodes.push(node);
        }

        textNodes.forEach((textNode) => {
          const parent = textNode.parentElement;
          if (!parent) return;

          const text = textNode.textContent || '';
          const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const matches = text.match(searchRegex);

          if (matches) {
            totalMatches += matches.length;
            const newHTML = text.replace(searchRegex, (match) =>
              `<mark class="pdf-search-highlight" style="background-color: #ffeb3b; padding: 2px 0;">${match}</mark>`
            );
            parent.innerHTML = newHTML;
          }
        });
      });

      setSearchResults(totalMatches);
      if (totalMatches > 0) {
        highlightCurrentResult(0);
      }
    }, 100);
  };

  const removeHighlights = () => {
    const highlights = document.querySelectorAll('.pdf-search-highlight');
    highlights.forEach((highlight) => {
      const parent = highlight.parentElement;
      if (parent) {
        parent.innerHTML = parent.textContent || '';
      }
    });
    document.querySelectorAll('.pdf-search-active').forEach((el) => el.classList.remove('pdf-search-active'));
  };

  const highlightCurrentResult = (index: number) => {
    const highlights = document.querySelectorAll('.pdf-search-highlight');
    highlights.forEach((el, i) => {
      if (i === index) {
        el.classList.add('pdf-search-active');
        (el as HTMLElement).style.backgroundColor = '#ff9800';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.classList.remove('pdf-search-active');
        (el as HTMLElement).style.backgroundColor = '#ffeb3b';
      }
    });
  };

  const goToNextResult = () => {
    if (searchResults === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults;
    setCurrentSearchIndex(nextIndex);
    highlightCurrentResult(nextIndex);
  };

  const goToPrevResult = () => {
    if (searchResults === 0) return;
    const prevIndex = currentSearchIndex === 0 ? searchResults - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    highlightCurrentResult(prevIndex);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults(0);
    setCurrentSearchIndex(0);
    removeHighlights();
  };

  const handleCategoryOverride = (category: ContractFailureCategory) => {
    if (onFailureCategoryOverride) {
      onFailureCategoryOverride(category, selectedOverrideReason || undefined);
    }
    setShowCategoryDropdown(false);
  };

  if (!isUrl) {
    const hasContent = source && source.toString().trim().length > 0;

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Contract Text</p>
            {hasContent && (
              <p className="text-xs text-slate-500 mt-1">
                {source.toString().length.toLocaleString()} characters
              </p>
            )}
          </div>
          {!hasContent && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Add Contract Source
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {hasContent ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 min-h-full">
              <div
                className="text-base leading-relaxed text-slate-900 whitespace-pre-wrap break-words font-normal"
                style={{
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  lineHeight: '1.75',
                  letterSpacing: '0.01em'
                }}
              >
                {source}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileX className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Contract Text</h3>
                <p className="text-sm text-slate-600 mb-4">
                  The contract source field is empty. You can add a URL or paste contract text.
                </p>
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editedUrl}
                      onChange={(e) => setEditedUrl(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] font-mono"
                      placeholder="Enter contract URL or paste contract text here..."
                      autoFocus
                    />
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleSave}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Add Contract Source
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const showError = (fetchError || pdfParseError) && !manualPdfUrl && !isLoading;
  const showPdfViewer = activePdfUrl && !pdfParseError;
  const showLoading = isLoading && !activePdfUrl;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          {isEditing ? (
            <>
              <input
                type="text"
                value={editedUrl}
                onChange={(e) => setEditedUrl(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contract URL"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                title="Save"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-1">Contract URL</p>
                <p className="text-sm font-medium text-slate-700 truncate">{trimmedSource}</p>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                title="Edit URL"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <a
                href={trimmedSource}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </a>
            </>
          )}
        </div>

        {isPdf && !isEditing && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">PDF URL</span>
            {isCached && !manualPdfUrl && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded flex items-center gap-1">
                <Database className="w-3 h-3" />
                Cached
              </span>
            )}
            {!isCached && !manualPdfUrl && !fetchError && fetchedPdfUrl && (
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded">Not cached</span>
            )}
            {manualPdfUrl && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">Manual Upload</span>
            )}
            {fileSize && !manualPdfUrl ? (
              <span className="text-slate-500">{formatCacheSize(fileSize)}</span>
            ) : !manualPdfUrl && !isLoading && !fetchError ? null : !manualPdfUrl && fetchError && !fetchError.fileSize ? (
              <span className="text-slate-400">Size unknown</span>
            ) : null}
            {fetchError && (
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {fetchError.usedProxy ? 'Proxy failed' : 'Load failed'}
              </span>
            )}
          </div>
        )}

        {isPdf && !isEditing && showPdfViewer && (
          <>
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Find in document..."
                  className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchTerm && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {searchResults > 0 ? (
                        <span>{currentSearchIndex + 1} of {searchResults}</span>
                      ) : (
                        <span>No matches</span>
                      )}
                    </div>
                    <button
                      onClick={goToPrevResult}
                      disabled={searchResults === 0}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Previous match"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToNextResult}
                      disabled={searchResults === 0}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Next match"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={clearSearch}
                      className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {fieldHighlights.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowFieldHighlights(!showFieldHighlights)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        showFieldHighlights
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={showFieldHighlights ? 'Hide field highlights' : 'Show field highlights'}
                    >
                      {showFieldHighlights ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Highlights
                    </button>
                    {showFieldHighlights && (
                      <button
                        onClick={() => setShowLegend(!showLegend)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          showLegend
                            ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={showLegend ? 'Hide legend' : 'Show legend'}
                      >
                        <Palette className="w-3.5 h-3.5" />
                        Legend
                      </button>
                    )}
                  </>
                )}
                {manualPdfUrl && (
                  <button
                    onClick={handleClearManualPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    title="Clear manual upload and retry auto-fetch"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear Upload
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600 min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  disabled={scale >= 2.0}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 relative">
        {isPdf ? (
          <div className="flex flex-col items-center py-6">
            {showLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-slate-600">
                    {fetchStatus === 'proxy_retry' ? 'Retrying via secure proxy...' : 'Fetching PDF...'}
                  </p>
                  {fetchStatus === 'proxy_retry' && (
                    <p className="text-xs text-slate-400 mt-1">Direct fetch failed due to CORS</p>
                  )}
                </div>
              </div>
            )}

            {showError && (
              <div className="max-w-lg mx-auto mt-12">
                <div className="bg-white border border-red-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-slate-900 mb-1">Failed to Load PDF</h3>
                      <p className="text-sm text-slate-600">
                        {currentFailureMeta?.message || fetchError?.message || 'Failed to parse the PDF file.'}
                      </p>
                      {(fetchError?.fileSize || fileSize) && (
                        <p className="text-xs text-slate-500 mt-1">
                          File size: {formatCacheSize(fetchError?.fileSize || fileSize || 0)}
                        </p>
                      )}
                      {fetchError?.httpStatus && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          HTTP Status: {fetchError.httpStatus}
                        </p>
                      )}
                    </div>
                  </div>

                  {currentFailureMeta && (
                    <div className="mb-4 space-y-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Failure Category</span>
                          {currentFailureMeta.overridden && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                              Overridden
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {getCategoryLabel(currentFailureMeta.category)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                            getConfidenceColor(currentFailureMeta.confidence).bg
                          } ${getConfidenceColor(currentFailureMeta.confidence).text} ${
                            getConfidenceColor(currentFailureMeta.confidence).border
                          }`}>
                            {currentFailureMeta.confidence}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {getGuidanceForCategory(currentFailureMeta.category)}
                        </p>
                      </div>

                      {onFailureCategoryOverride && (
                        <div className="relative">
                          <button
                            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <span className="text-slate-700">Override category</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${showCategoryDropdown ? 'rotate-90' : ''}`} />
                          </button>
                          {showCategoryDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-64 overflow-auto">
                              <div className="p-2 border-b border-slate-100">
                                <select
                                  value={selectedOverrideReason}
                                  onChange={(e) => setSelectedOverrideReason(e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="">Select reason (optional)</option>
                                  {OVERRIDE_REASONS.map((reason) => (
                                    <option key={reason} value={reason}>{reason}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="py-1">
                                {getCategoryOrder().map((cat) => (
                                  <button
                                    key={cat}
                                    onClick={() => handleCategoryOverride(cat)}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                                      cat === currentFailureMeta.category ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                                    }`}
                                  >
                                    {getCategoryLabel(cat)}
                                    {cat === currentFailureMeta.category && (
                                      <span className="ml-2 text-xs text-blue-500">(current)</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
                    <p className="text-xs text-amber-800">
                      This row has been flagged for attention. The contract link may need to be reviewed or updated.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleOpenInNewTab}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </button>
                    <button
                      onClick={() => {
                        errorReportedRef.current = null;
                        refetch();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry Fetch
                    </button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-2 text-slate-400">or</span>
                      </div>
                    </div>
                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload PDF Manually
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {showPdfViewer && (
              <>
                {showFieldHighlights && showLegend && highlightedFields.length > 0 && (
                  <div className="fixed right-6 top-40 z-40 w-64 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Field Legend</span>
                        {highlightFilter.mode !== 'all' && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                            <Filter className="w-2.5 h-2.5" />
                            Filtered
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {highlightFilter.mode !== 'all' && (
                          <button
                            onClick={handleClearFilter}
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            title="Clear filter"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                        )}
                        <button
                          onClick={() => setShowLegend(false)}
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-auto p-2 space-y-1">
                      {highlightedFields.filter(f => f.occurrences > 0).map((field) => {
                        const isComplete = fieldStatuses?.[field.fieldName] === 'complete';
                        const groupId = field.color.name;
                        const isSelectedGroup = highlightFilter.mode === 'legendGroup' && highlightFilter.groupId === groupId;
                        const isSelectedTerm = highlightFilter.mode === 'term' && highlightFilter.fieldName === field.fieldName;
                        const isSelected = isSelectedGroup || isSelectedTerm;
                        const isDimmed = highlightFilter.mode !== 'all' && !isSelected;

                        return (
                          <div
                            key={field.fieldName}
                            onClick={() => handleLegendGroupClick(groupId)}
                            onMouseEnter={() => setHoveredLegendGroup(groupId)}
                            onMouseLeave={() => setHoveredLegendGroup(null)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-50 ring-1 ring-blue-300'
                                : isComplete
                                ? 'bg-green-50 hover:bg-green-100'
                                : 'hover:bg-slate-100'
                            } ${isDimmed ? 'opacity-40' : ''}`}
                          >
                            <span
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: field.color.bg, border: `2px solid ${field.color.border}` }}
                            />
                            <span className="flex-1 truncate font-medium text-slate-700" title={field.fieldName}>
                              {formatFieldName(field.fieldName)}
                            </span>
                            <span className="text-slate-400 flex-shrink-0">
                              {field.occurrences}
                            </span>
                            {isComplete && <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                          </div>
                        );
                      })}
                      {highlightedFields.filter(f => f.occurrences === 0).length > 0 && (
                        <div className="pt-2 mt-2 border-t border-slate-100">
                          <p className="text-xs text-slate-400 px-2 mb-1">Not found in document:</p>
                          {highlightedFields.filter(f => f.occurrences === 0).map((field) => (
                            <div
                              key={field.fieldName}
                              className="flex items-center gap-2 px-2 py-1 text-xs text-slate-400"
                            >
                              <span
                                className="w-3 h-3 rounded-sm flex-shrink-0 opacity-40"
                                style={{ backgroundColor: field.color.bg, border: `2px solid ${field.color.border}` }}
                              />
                              <span className="truncate" title={field.fieldName}>
                                {formatFieldName(field.fieldName)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {highlightFilter.mode !== 'all' && (
                      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                        <p className="text-[10px] text-slate-500">
                          Click highlighted item to toggle filter. Press <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[9px]">Esc</kbd> to clear.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeBubble && (
                  <div
                    ref={bubbleRef}
                    className="highlight-action-bubble fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden min-w-56"
                    style={{
                      left: Math.min(Math.max(activeBubble.x, 140), window.innerWidth - 140),
                      top: Math.max(activeBubble.y - 8, 80),
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="absolute left-1/2 bottom-0 w-3 h-3 bg-white border-r border-b border-slate-200 transform -translate-x-1/2 translate-y-1/2 rotate-45" />
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Field</p>
                          <p className="text-sm font-semibold text-slate-900 truncate" title={activeBubble.fieldName}>
                            {formatFieldName(activeBubble.fieldName)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveBubble(null);
                            setHighlightFilter({ mode: 'all' });
                          }}
                          className="p-1 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: highlightedFields.find(f => f.fieldName === activeBubble.fieldName)?.color.bg,
                            border: `2px solid ${highlightedFields.find(f => f.fieldName === activeBubble.fieldName)?.color.border}`,
                          }}
                        />
                        <span className="text-xs text-slate-600 truncate flex-1" title={activeBubble.term}>
                          "{activeBubble.term.length > 30 ? activeBubble.term.slice(0, 30) + '...' : activeBubble.term}"
                        </span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {activeBubble.occurrences} match{activeBubble.occurrences !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => handleMarkAsDone(activeBubble.fieldName, true)}
                        disabled={fieldStatuses?.[activeBubble.fieldName] === 'complete'}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                          fieldStatuses?.[activeBubble.fieldName] === 'complete'
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {fieldStatuses?.[activeBubble.fieldName] === 'complete' ? 'Already Done' : 'Mark Done'}
                      </button>
                      {fieldStatuses?.[activeBubble.fieldName] !== 'complete' && (
                        <p className="text-[10px] text-slate-400 text-center mt-2">
                          Press <kbd className="px-1 py-0.5 bg-slate-100 rounded">Enter</kbd> to confirm
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTooltip && !activeBubble && (
                  <div
                    className="field-highlight-tooltip fixed z-50 bg-slate-900 text-white rounded-lg shadow-xl p-3 min-w-48"
                    style={{
                      left: activeTooltip.x,
                      top: activeTooltip.y,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-slate-900 transform -translate-x-1/2 translate-y-1/2 rotate-45" />
                    <p className="text-xs text-slate-400 mb-1">Field</p>
                    <p className="text-sm font-medium mb-3">{formatFieldName(activeTooltip.fieldName)}</p>
                    <button
                      onClick={() => handleMarkAsDone(activeTooltip.fieldName)}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                        fieldStatuses?.[activeTooltip.fieldName] === 'complete'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {fieldStatuses?.[activeTooltip.fieldName] === 'complete' ? 'Marked as Done' : 'Mark as Done'}
                    </button>
                  </div>
                )}

                {unreadableTextDetected && (
                  <div className="w-full max-w-2xl mx-auto mb-4">
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-amber-900 mb-1">Unreadable Text Layer Detected</h4>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            The PDF loaded successfully, but required contract fields could not be found in the document text.
                            This may indicate a scanned or corrupted PDF. Manual verification required.
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">
                              Manual verification required
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isDebugMode && (
                  <div className="w-full max-w-2xl mx-auto mb-4">
                    <button
                      onClick={() => setShowDebugPanel(!showDebugPanel)}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors mb-2"
                    >
                      <Database className="w-3 h-3" />
                      {showDebugPanel ? 'Hide' : 'Show'} PDF Debug Info
                      <ChevronRight className={`w-3 h-3 transition-transform ${showDebugPanel ? 'rotate-90' : ''}`} />
                    </button>
                    {showDebugPanel && (
                      <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 text-xs font-mono space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-slate-500">pdfSource:</span>
                          <span className="text-slate-800">{fetchStatus === 'proxy' ? 'proxy' : 'direct'}</span>
                          <span className="text-slate-500">fetchOk:</span>
                          <span className={fetchError ? 'text-red-600' : 'text-green-600'}>{fetchError ? 'false' : 'true'}</span>
                          <span className="text-slate-500">numPages:</span>
                          <span className="text-slate-800">{numPages}</span>
                          <span className="text-slate-500">extractedTextLength:</span>
                          <span className="text-slate-800">{extractedTextLength.toLocaleString()} chars</span>
                          <span className="text-slate-500">gibberishRatio:</span>
                          <span className={gibberishRatio > 0.02 ? 'text-amber-600' : 'text-slate-800'}>
                            {(gibberishRatio * 100).toFixed(2)}%
                          </span>
                          <span className="text-slate-500">eligibleFieldCount:</span>
                          <span className="text-slate-800">
                            {glossary
                              ? getEligibleFieldsForPdfMatching(headers || [], currentRow, glossary).length
                              : getFallbackFieldsForPdfMatching(headers || [], currentRow).length}
                          </span>
                          <span className="text-slate-500">matchedFieldCount:</span>
                          <span className="text-slate-800">{highlightedFields.filter(h => h.occurrences > 0).length}</span>
                        </div>
                        <div className="border-t border-slate-300 pt-2 mt-2">
                          <span className="text-slate-500">eligibleFields:</span>
                          <div className="text-slate-700 mt-1">
                            {(glossary
                              ? getEligibleFieldsForPdfMatching(headers || [], currentRow, glossary)
                              : getFallbackFieldsForPdfMatching(headers || [], currentRow)
                            ).map(f => f.fieldName).join(', ') || 'none'}
                          </div>
                        </div>
                        <div className="border-t border-slate-300 pt-2">
                          <span className="text-slate-500">matchedFields:</span>
                          <div className="text-green-700 mt-1">
                            {highlightedFields.filter(h => h.occurrences > 0).map(h => h.fieldName).join(', ') || 'none'}
                          </div>
                        </div>
                        <div className="border-t border-slate-300 pt-2">
                          <span className="text-slate-500">finalDecision:</span>
                          <span className={`ml-2 ${unreadableTextDetected ? 'text-amber-600' : fetchError ? 'text-red-600' : 'text-green-600'}`}>
                            {fetchError ? 'contract_load_error' : unreadableTextDetected ? 'contract_text_unreadable' : 'none'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Document
                  file={activePdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                        <p className="text-sm text-slate-600">Loading PDF...</p>
                      </div>
                    </div>
                  }
                >
                  {Array.from(new Array(numPages), (_, index) => (
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1}
                      scale={scale}
                      className="shadow-lg mb-4"
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  ))}
                </Document>
              </>
            )}
          </div>
        ) : (
          <iframe src={trimmedSource} className="w-full h-full border-0" title="Contract" />
        )}
      </div>
    </div>
  );
});
