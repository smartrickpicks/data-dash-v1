import { useState } from 'react';
import { X, MessageSquare, Edit3, Check } from 'lucide-react';
import { RfiCommentEntry, RFI_TYPE_LABELS } from '../types';

interface AnswerRfiModalProps {
  rfi: RfiCommentEntry;
  currentValue: string;
  onClose: () => void;
  onSubmit: (response: string, applyFix: boolean, newValue: string) => void;
}

export function AnswerRfiModal({
  rfi,
  currentValue,
  onClose,
  onSubmit,
}: AnswerRfiModalProps) {
  const [response, setResponse] = useState('');
  const [applyFix, setApplyFix] = useState(false);
  const [newValue, setNewValue] = useState(currentValue);

  const handleSubmit = () => {
    if (!response.trim()) return;
    onSubmit(response, applyFix, newValue);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-800">Answer RFI</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Original Question</div>
            <p className="text-sm text-gray-800">{rfi.comment}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
              <span>Field: <strong className="text-gray-700">{rfi.fieldName}</strong></span>
              <span>Type: <strong className="text-gray-700">{RFI_TYPE_LABELS[rfi.rfiType]}</strong></span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-xs text-amber-600 mb-1">Current Field Value</div>
            <p className="text-sm text-gray-800 font-mono">
              {currentValue || <span className="text-gray-400 italic">Empty</span>}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Response <span className="text-red-500">*</span>
            </label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Enter your response to this question..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              rows={4}
              autoFocus
            />
          </div>

          <div className="border rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={applyFix}
                onChange={(e) => setApplyFix(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Apply fix to field value</span>
              </div>
            </label>

            {applyFix && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  New Value
                </label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter corrected value..."
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!response.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Answer
          </button>
        </div>
      </div>
    </div>
  );
}
