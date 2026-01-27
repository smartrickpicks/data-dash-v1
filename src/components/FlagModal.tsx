import { useState, useEffect } from 'react';
import { X, Flag, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import {
  FlagCategory,
  FlagSeverity,
  FLAG_REASONS,
  FLAG_CATEGORY_LABELS,
} from '../types';

interface FlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    category: FlagCategory,
    reason: string | null,
    comment: string | null,
    severity: FlagSeverity
  ) => void;
  fileName?: string;
  sheetName?: string;
  rowIndex?: number;
}

const SEVERITY_OPTIONS: { value: FlagSeverity; label: string; icon: typeof Info }[] = [
  { value: 'info', label: 'Info', icon: Info },
  { value: 'warning', label: 'Warning', icon: AlertTriangle },
  { value: 'blocking', label: 'Blocking', icon: AlertCircle },
];

export function FlagModal({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  sheetName,
  rowIndex,
}: FlagModalProps) {
  const [category, setCategory] = useState<FlagCategory>('extraction');
  const [reason, setReason] = useState<string>('');
  const [comment, setComment] = useState('');
  const [severity, setSeverity] = useState<FlagSeverity>('info');

  useEffect(() => {
    if (isOpen) {
      const reasons = FLAG_REASONS[category];
      setReason(reasons[0] || '');
    }
  }, [category, isOpen]);

  if (!isOpen) return null;

  const reasons = FLAG_REASONS[category];
  const isOtherReason = reason.toLowerCase().includes('other');
  const commentRequired = isOtherReason && !comment.trim();

  const handleConfirm = () => {
    onConfirm(category, reason || null, comment.trim() || null, severity);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setCategory('extraction');
    setReason('');
    setComment('');
    setSeverity('info');
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'extraction':
        return 'text-blue-600';
      case 'salesforce':
        return 'text-teal-600';
      case 'data_mgmt':
        return 'text-orange-600';
      case 'other':
        return 'text-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Flag className={`w-5 h-5 ${getCategoryIcon()}`} />
            <h2 className="text-lg font-semibold text-slate-900">Flag</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {(fileName || sheetName) && (
            <div className="text-sm text-slate-600 bg-slate-50 rounded-md p-2">
              {fileName && (
                <div>
                  File: <span className="font-medium text-slate-900">{fileName}</span>
                </div>
              )}
              {sheetName && rowIndex !== undefined && (
                <div>
                  Location: <span className="font-medium text-slate-900">{sheetName} - Row {rowIndex + 1}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FlagCategory)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {(Object.keys(FLAG_CATEGORY_LABELS) as FlagCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {FLAG_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {category === 'extraction' && 'Issues with PDF reading, data mapping, or formatting'}
              {category === 'salesforce' && 'Issues with business logic, record types, or Salesforce data'}
              {category === 'data_mgmt' && 'Issues with dataset structure, wrong documents, or duplicates'}
              {category === 'other' && 'Feature requests, suggestions, or other feedback'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Comment {isOtherReason && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isOtherReason ? 'Required for "Other" reasons...' : 'Add additional details (optional)...'}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
                commentRequired ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              rows={3}
            />
            {commentRequired && (
              <p className="mt-1 text-xs text-red-600">Comment is required when selecting "Other" reasons</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Severity
            </label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = severity === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      isSelected
                        ? opt.value === 'info'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : opt.value === 'warning'
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {severity === 'blocking' && (
              <p className="mt-2 text-xs text-red-600">
                Blocking flags prevent the row from being finalized until resolved.
              </p>
            )}
          </div>

          <div className={`rounded-md p-3 ${
            category === 'salesforce'
              ? 'bg-teal-50 border border-teal-200'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <p className={`text-sm ${
              category === 'salesforce' ? 'text-teal-800' : 'text-blue-800'
            }`}>
              {category === 'salesforce'
                ? 'This flag will appear in the Salesforce Verifier dashboard for business logic review.'
                : 'This flag will appear in the QA Reviewer dashboard for extraction and data quality review.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={commentRequired}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
              commentRequired
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Add Flag
          </button>
        </div>
      </div>
    </div>
  );
}
