import { useState } from 'react';
import { X, FileX } from 'lucide-react';
import { NotApplicableReasonKey } from '../types';

interface DocumentNotApplicableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonKey: NotApplicableReasonKey, freeText: string) => void;
  fileName?: string;
}

const REASON_OPTIONS: { key: NotApplicableReasonKey; label: string }[] = [
  { key: 'wrong_doc_type', label: 'Wrong document type' },
  { key: 'duplicate', label: 'Duplicate document' },
  { key: 'not_in_scope', label: 'Not in scope' },
  { key: 'termination_notice', label: 'Termination notice' },
  { key: 'other', label: 'Other' },
];

export function DocumentNotApplicableModal({
  isOpen,
  onClose,
  onConfirm,
  fileName,
}: DocumentNotApplicableModalProps) {
  const [reasonKey, setReasonKey] = useState<NotApplicableReasonKey>('wrong_doc_type');
  const [freeText, setFreeText] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(reasonKey, freeText.trim());
    setReasonKey('wrong_doc_type');
    setFreeText('');
  };

  const handleClose = () => {
    setReasonKey('wrong_doc_type');
    setFreeText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileX className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Flag Document Not Applicable</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {fileName && (
            <div className="text-sm text-slate-600">
              Flagging: <span className="font-medium text-slate-900">{fileName}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason
            </label>
            <select
              value={reasonKey}
              onChange={(e) => setReasonKey(e.target.value as NotApplicableReasonKey)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Additional notes (optional)
            </label>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Enter any additional details..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="text-sm text-amber-800">
              This will flag the document as not applicable and require manual resolution before the row can be finalized.
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
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors"
          >
            Flag Document
          </button>
        </div>
      </div>
    </div>
  );
}
