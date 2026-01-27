import { useState, useRef } from 'react';
import {
  ClipboardCheck,
  Database,
  Upload,
  X,
  Check,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Dataset,
  AnomalyMap,
  RfiComments,
  FieldStatus,
  HingesConfig,
  ReviewerTab,
  FlagMap,
} from '../types';
import { QAReviewerDashboard } from './QAReviewerDashboard';
import { SalesforceVerifierDashboard } from './SalesforceVerifierDashboard';
import { loadHingesConfigFromFile, clearHingesConfig } from '../config/hingesConfig';

interface ReviewerDashboardProps {
  dataset: Dataset | null;
  anomalyMap: AnomalyMap;
  rfiComments: RfiComments;
  fieldStatuses: FieldStatus;
  hingesConfig: HingesConfig;
  flagMap: FlagMap;
  activeSheetName: string;
  onOpenRow: (sheetName: string, rowIndex: number) => void;
  onHingesConfigChange: (config: HingesConfig) => void;
  onClose: () => void;
}

export function ReviewerDashboard({
  dataset,
  anomalyMap,
  rfiComments,
  fieldStatuses,
  hingesConfig,
  flagMap,
  activeSheetName,
  onOpenRow,
  onHingesConfigChange,
  onClose,
}: ReviewerDashboardProps) {
  const [activeTab, setActiveTab] = useState<ReviewerTab>('qa-reviewer');
  const [isUploadingHinges, setIsUploadingHinges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHingesFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHinges(true);
    try {
      const config = await loadHingesConfigFromFile(file);
      onHingesConfigChange(config);
    } finally {
      setIsUploadingHinges(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearHingesConfig = () => {
    clearHingesConfig();
    onHingesConfigChange({
      buildOrder: [],
      sheetAliases: [],
      hingeFields: [],
      parentChildSeeds: [],
      knowledgeKeepers: [],
      loadedAt: new Date().toISOString(),
    });
  };

  const hasHingesData =
    hingesConfig.buildOrder.length > 0 ||
    hingesConfig.hingeFields.length > 0 ||
    hingesConfig.knowledgeKeepers.length > 0;

  if (!dataset) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Reviewer Dashboard</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="text-center py-8">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600">No dataset loaded</p>
            <p className="text-sm text-gray-500 mt-1">Upload a spreadsheet to use the reviewer dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Reviewer Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.json"
              onChange={handleHingesFileChange}
              className="hidden"
              id="hinges-file-input"
            />

            {hasHingesData ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Hinges loaded
                </span>
                <button
                  onClick={handleClearHingesConfig}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear
                </button>
              </div>
            ) : (
              <label
                htmlFor="hinges-file-input"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  isUploadingHinges
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploadingHinges ? 'Loading...' : 'Load Hinges Config'}
              </label>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="border-b bg-white px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('qa-reviewer')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'qa-reviewer'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                QA Reviewer
              </span>
            </button>
            <button
              onClick={() => setActiveTab('salesforce-verifier')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'salesforce-verifier'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Salesforce Verifier
              </span>
            </button>
          </div>
        </div>

        {hingesConfig.error && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Hinge config unavailable: {hingesConfig.error}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'qa-reviewer' ? (
            <QAReviewerDashboard
              dataset={dataset}
              anomalyMap={anomalyMap}
              rfiComments={rfiComments}
              fieldStatuses={fieldStatuses}
              hingesConfig={hingesConfig}
              flagMap={flagMap}
              activeSheetName={activeSheetName}
              onOpenRow={(sheetName, rowIndex) => {
                onOpenRow(sheetName, rowIndex);
                onClose();
              }}
            />
          ) : (
            <SalesforceVerifierDashboard
              dataset={dataset}
              anomalyMap={anomalyMap}
              rfiComments={rfiComments}
              fieldStatuses={fieldStatuses}
              flagMap={flagMap}
              onOpenRow={(sheetName, rowIndex) => {
                onOpenRow(sheetName, rowIndex);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
