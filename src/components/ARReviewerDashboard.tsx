import { useState, useMemo } from 'react';
import { ExternalLink, MessageSquare, CheckCircle, Clock, FileText } from 'lucide-react';
import { Dataset, RfiCommentEntry, RFI_TYPE_LABELS, RFI_ROUTING_COLORS } from '../types';
import { getAllRfisByTarget, getRfiStatusColor } from '../utils/rfiUtils';
import { AnswerRfiModal } from './AnswerRfiModal';

interface ARReviewerDashboardProps {
  dataset: Dataset | null;
  rfiEntriesV2: RfiCommentEntry[];
  onOpenRow: (sheetName: string, rowIndex: number) => void;
  onUpdateRfiEntry: (entryId: string, updates: Partial<RfiCommentEntry>) => void;
  onFieldChange: (sheetName: string, rowIndex: number, fieldName: string, value: string) => void;
}

export function ARReviewerDashboard({
  dataset,
  rfiEntriesV2,
  onOpenRow,
  onUpdateRfiEntry,
  onFieldChange,
}: ARReviewerDashboardProps) {
  const [answerModalEntry, setAnswerModalEntry] = useState<RfiCommentEntry | null>(null);

  const arRfis = useMemo(() => getAllRfisByTarget(rfiEntriesV2, 'ar'), [rfiEntriesV2]);

  const openRfis = arRfis.filter((rfi) => rfi.status === 'open');
  const answeredRfis = arRfis.filter((rfi) => rfi.status === 'answered');
  const resolvedRfis = arRfis.filter((rfi) => rfi.status === 'resolved');

  const getCurrentFieldValue = (rfi: RfiCommentEntry): string => {
    if (!dataset) return '';
    const sheet = dataset.sheets.find((s) => s.name === rfi.sheetName);
    if (!sheet || !sheet.rows[rfi.rowIndex]) return '';
    return String(sheet.rows[rfi.rowIndex][rfi.fieldName] || '');
  };

  const handleAnswer = (rfi: RfiCommentEntry) => {
    setAnswerModalEntry(rfi);
  };

  const handleResolve = (rfi: RfiCommentEntry) => {
    onUpdateRfiEntry(rfi.id, { status: 'resolved' });
  };

  const handleAnswerSubmit = (response: string, applyFix: boolean, newValue: string) => {
    if (!answerModalEntry) return;

    const updates: Partial<RfiCommentEntry> = {
      status: 'answered',
      verifierResponse: response,
      answeredAt: new Date().toISOString(),
      answeredByRole: 'ar',
    };

    if (applyFix && newValue !== undefined) {
      const previousValue = getCurrentFieldValue(answerModalEntry);
      updates.appliedFix = {
        previousValue,
        newValue,
        appliedAt: new Date().toISOString(),
        appliedByRole: 'ar',
      };
      onFieldChange(
        answerModalEntry.sheetName,
        answerModalEntry.rowIndex,
        answerModalEntry.fieldName,
        newValue
      );
    }

    onUpdateRfiEntry(answerModalEntry.id, updates);
    setAnswerModalEntry(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-6 h-6 text-teal-600" />
        <h2 className="text-xl font-semibold text-gray-800">A&R (Contract SME) Dashboard</h2>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-gray-600">Open Questions</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">{openRfis.length}</span>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-600">Answered</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">{answeredRfis.length}</span>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-gray-600">Resolved</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">{resolvedRfis.length}</span>
        </div>
      </div>

      <div className="bg-white border rounded-lg">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-gray-800">Contract Questions (A&R)</h3>
        </div>
        <div className="p-4">
          {arRfis.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No contract questions routed to A&R</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3 font-medium text-gray-600">Location</th>
                    <th className="text-left p-3 font-medium text-gray-600">Field</th>
                    <th className="text-left p-3 font-medium text-gray-600">Question</th>
                    <th className="text-left p-3 font-medium text-gray-600">Type</th>
                    <th className="text-left p-3 font-medium text-gray-600">Status</th>
                    <th className="text-left p-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {arRfis.map((rfi) => {
                    const statusColors = getRfiStatusColor(rfi.status);
                    return (
                      <tr key={rfi.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="text-xs text-gray-500">{rfi.sheetName}</div>
                          <div className="text-sm">Row {rfi.rowIndex + 1}</div>
                        </td>
                        <td className="p-3 font-medium">{rfi.fieldName}</td>
                        <td className="p-3">
                          <div className="max-w-xs truncate" title={rfi.comment}>
                            {rfi.comment}
                          </div>
                          {rfi.verifierResponse && (
                            <div className="mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              Response: {rfi.verifierResponse}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {RFI_TYPE_LABELS[rfi.rfiType]}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                            {rfi.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onOpenRow(rfi.sheetName, rfi.rowIndex)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Open Row"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {rfi.status === 'open' && (
                              <button
                                onClick={() => handleAnswer(rfi)}
                                className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs font-medium hover:bg-teal-200 transition-colors"
                              >
                                Answer
                              </button>
                            )}
                            {rfi.status === 'answered' && (
                              <button
                                onClick={() => handleResolve(rfi)}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 transition-colors"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {answerModalEntry && (
        <AnswerRfiModal
          rfi={answerModalEntry}
          currentValue={getCurrentFieldValue(answerModalEntry)}
          onClose={() => setAnswerModalEntry(null)}
          onSubmit={handleAnswerSubmit}
        />
      )}
    </div>
  );
}
