import { memo } from 'react';
import { X } from 'lucide-react';
import { ContractViewer } from './ContractViewer';
import { RowData, FieldStatusType } from '../types';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: string;
  onContractChange?: (newUrl: string) => void;
  sheetName: string;
  rowIndex: number;
  headers?: string[];
  currentRow?: RowData;
  fieldStatuses?: Record<string, FieldStatusType>;
  onFieldStatusChange?: (fieldName: string, status: FieldStatusType) => void;
}

export const ContractModal = memo(function ContractModal({
  isOpen,
  onClose,
  source,
  onContractChange,
  sheetName,
  rowIndex,
  headers,
  currentRow,
  fieldStatuses,
  onFieldStatusChange,
}: ContractModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-[90vw] h-[90vh] max-w-6xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Contract Viewer</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ContractViewer
            source={source}
            onContractChange={onContractChange}
            sheetName={sheetName}
            rowIndex={rowIndex}
            headers={headers}
            currentRow={currentRow}
            fieldStatuses={fieldStatuses}
            onFieldStatusChange={onFieldStatusChange}
          />
        </div>
      </div>
    </div>
  );
});
