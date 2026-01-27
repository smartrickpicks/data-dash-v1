import { useMemo } from 'react';
import {
  AlertTriangle,
  FileWarning,
  FileX,
  Eye,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Flag,
  Info,
  Star,
} from 'lucide-react';
import {
  Dataset,
  AnomalyMap,
  RfiComments,
  FieldStatus,
  HingesConfig,
  ManualReviewRow,
  FlagMap,
  FlagRecord,
  FLAG_CATEGORY_LABELS,
  isFlagRoutedToQA,
  RfiCommentEntry,
} from '../types';
import {
  getAnomalyCounts,
  getRowsNeedingManualReview,
  AnomalyCounts,
} from '../utils/reviewerHelpers';
import {
  getHingeFieldsForSheet,
  getParentChildSeedsForSheet,
  getOpenKnowledgeKeepers,
} from '../config/hingesConfig';
import { buildHingeGroupsForSheet } from '../utils/hingeGroups';
import { getGroupColorClasses } from '../config/defaultHingeGroups';

interface QAReviewerDashboardProps {
  dataset: Dataset | null;
  anomalyMap: AnomalyMap;
  rfiComments: RfiComments;
  rfiEntriesV2: RfiCommentEntry[];
  fieldStatuses: FieldStatus;
  hingesConfig: HingesConfig;
  flagMap: FlagMap;
  activeSheetName: string;
  onOpenRow: (sheetName: string, rowIndex: number) => void;
  onUpdateRfiEntry: (entryId: string, updates: Partial<RfiCommentEntry>) => void;
  onFieldChange: (sheetName: string, rowIndex: number, fieldName: string, value: string) => void;
}

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  contract_load_error: 'PDF Load Error',
  contract_text_unreadable: 'Unreadable PDF',
  contract_extraction_suspect: 'Suspect Data',
  contract_not_applicable: 'Not Applicable',
  blacklist_hit: 'Blacklist Hit',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 opacity-80" />
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-sm opacity-80">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ManualReviewTable({
  rows,
  onOpenRow,
}: {
  rows: ManualReviewRow[];
  onOpenRow: (sheetName: string, rowIndex: number) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No rows require manual review</p>
        <p className="text-sm">All contracts have been processed successfully</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3 font-medium text-gray-700">Sheet</th>
            <th className="text-left p-3 font-medium text-gray-700">Row</th>
            <th className="text-left p-3 font-medium text-gray-700">Contract</th>
            <th className="text-left p-3 font-medium text-gray-700">Issues</th>
            <th className="text-left p-3 font-medium text-gray-700">Priority</th>
            <th className="text-right p-3 font-medium text-gray-700">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.sheetName}-${row.rowIndex}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="p-3 font-medium">{row.sheetName}</td>
              <td className="p-3">{row.rowIndex + 1}</td>
              <td className="p-3 max-w-xs truncate" title={row.contractFileName || row.contractUrl}>
                {row.contractFileName || row.contractUrl || '-'}
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1">
                  {row.reasons.map((reason, j) => (
                    <span
                      key={j}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        reason.type === 'contract_load_error' || reason.type === 'contract_text_unreadable'
                          ? 'bg-red-100 text-red-700'
                          : reason.type === 'contract_extraction_suspect'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                      title={reason.message}
                    >
                      {ANOMALY_TYPE_LABELS[reason.type] || reason.type}
                    </span>
                  ))}
                </div>
              </td>
              <td className="p-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${PRIORITY_COLORS[row.priority]}`}>
                  {row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
                </span>
              </td>
              <td className="p-3 text-right">
                <button
                  onClick={() => onOpenRow(row.sheetName, row.rowIndex)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Open Row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlagsTable({
  flags,
  onOpenRow,
}: {
  flags: FlagRecord[];
  onOpenRow: (sheetName: string, rowIndex: number) => void;
}) {
  if (flags.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Flag className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No QA flags</p>
        <p className="text-sm">Flags for extraction, data management, and other issues appear here</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3 font-medium text-gray-700">Sheet</th>
            <th className="text-left p-3 font-medium text-gray-700">Row</th>
            <th className="text-left p-3 font-medium text-gray-700">Category</th>
            <th className="text-left p-3 font-medium text-gray-700">Reason</th>
            <th className="text-left p-3 font-medium text-gray-700">Severity</th>
            <th className="text-left p-3 font-medium text-gray-700">Comment</th>
            <th className="text-right p-3 font-medium text-gray-700">Action</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag, i) => (
            <tr key={flag.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="p-3 font-medium">{flag.sheetName}</td>
              <td className="p-3">{flag.rowIndex + 1}</td>
              <td className="p-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  flag.category === 'extraction' ? 'bg-blue-100 text-blue-700' :
                  flag.category === 'data_mgmt' ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {FLAG_CATEGORY_LABELS[flag.category]}
                </span>
              </td>
              <td className="p-3 text-gray-600 text-xs max-w-xs truncate" title={flag.reason || ''}>
                {flag.reason || '-'}
              </td>
              <td className="p-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  flag.severity === 'blocking' ? 'bg-red-100 text-red-700' :
                  flag.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {flag.severity === 'blocking' && <AlertCircle className="w-3 h-3" />}
                  {flag.severity === 'warning' && <AlertTriangle className="w-3 h-3" />}
                  {flag.severity === 'info' && <Info className="w-3 h-3" />}
                  {flag.severity.charAt(0).toUpperCase() + flag.severity.slice(1)}
                </span>
              </td>
              <td className="p-3 text-gray-600 text-xs max-w-xs truncate" title={flag.comment || ''}>
                {flag.comment || '-'}
              </td>
              <td className="p-3 text-right">
                <button
                  onClick={() => onOpenRow(flag.sheetName, flag.rowIndex)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Open Row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HingePatternLegend() {
  const groupCategories = [
    { id: 'terms', label: 'Contract Terms', description: 'Agreement types, record types, subtypes' },
    { id: 'parties', label: 'Parties & Entities', description: 'Labels, artists, signatories' },
    { id: 'payment', label: 'Payment & Royalties', description: 'Rates, advances, financial terms' },
    { id: 'territory', label: 'Territory & Scope', description: 'Geographic regions, exclusivity' },
    { id: 'duration', label: 'Duration & Dates', description: 'Term periods, renewals, expiration' },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" />
        Field Dependencies Legend
      </h4>

      <div className="space-y-2 mb-4">
        <p className="text-xs text-slate-500 mb-2">Field Levels:</p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">
            PRIMARY
          </span>
          <span className="text-xs text-slate-600">Drives required/expected fields. Critical for record completeness.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
            SECONDARY
          </span>
          <span className="text-xs text-slate-600">Conditional or dependent fields. Triggered by primary field values.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            TERTIARY
          </span>
          <span className="text-xs text-slate-600">Informational rules. Low impact on data validation.</span>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
          <span className="inline-flex items-center text-red-600 text-xs font-bold">*</span>
          <span className="text-xs text-slate-600">Required - Missing value should trigger attention and review.</span>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3 mt-3">
        <p className="text-xs text-slate-500 mb-2">Concept Groups:</p>
        <div className="grid grid-cols-1 gap-1.5">
          {groupCategories.map((cat) => {
            const colors = getGroupColorClasses(cat.id);
            return (
              <div key={cat.id} className={`flex items-center gap-2 px-2 py-1 rounded ${colors.bg} ${colors.border} border`}>
                <span className={`text-xs font-semibold ${colors.text}`}>{cat.label}</span>
                <span className="text-[10px] text-slate-500 truncate">{cat.description}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HingesInsightPanel({
  hingesConfig,
  activeSheetName,
}: {
  hingesConfig: HingesConfig;
  activeSheetName: string;
}) {
  const hingeFields = useMemo(
    () => getHingeFieldsForSheet(hingesConfig, activeSheetName),
    [hingesConfig, activeSheetName]
  );

  const hingeGroups = useMemo(
    () => buildHingeGroupsForSheet(hingesConfig, activeSheetName),
    [hingesConfig, activeSheetName]
  );

  const parentChildSeeds = useMemo(
    () => getParentChildSeedsForSheet(hingesConfig, activeSheetName),
    [hingesConfig, activeSheetName]
  );

  const openKnowledgeKeepers = useMemo(
    () => getOpenKnowledgeKeepers(hingesConfig),
    [hingesConfig]
  );

  const hasNoData = hingeFields.length === 0 && parentChildSeeds.length === 0 && openKnowledgeKeepers.length === 0;

  if (hingesConfig.error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Field Dependencies unavailable</span>
        </div>
        <p className="text-sm text-amber-700 mt-1">{hingesConfig.error}</p>
      </div>
    );
  }

  if (hasNoData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
        <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No field dependency rules configured for this sheet</p>
        <p className="text-xs mt-1">Upload a Field Dependencies configuration file to see rule insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hingeGroups.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Field Groups ({activeSheetName})
          </h4>
          <div className="space-y-3">
            {hingeGroups.map((group) => {
              const colorClasses = getGroupColorClasses(group.group_id);
              const totalFields = group.primary_fields.length + group.secondary_fields.length + group.tertiary_fields.length;
              return (
                <div key={group.group_id} className={`border rounded-lg overflow-hidden ${colorClasses.border}`}>
                  <div className={`px-3 py-2 ${colorClasses.headerBg} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Lightbulb className={`w-4 h-4 ${colorClasses.text}`} />
                      <span className={`font-semibold text-sm ${colorClasses.text}`}>{group.group_label}</span>
                    </div>
                    <span className="text-xs text-slate-500">{totalFields} field{totalFields !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={`px-3 py-2 ${colorClasses.bg}`}>
                    <p className="text-xs text-slate-600 mb-2">{group.group_description}</p>
                    <div className="space-y-1">
                      {group.primary_fields.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 flex-shrink-0">
                            PRIMARY
                          </span>
                          <span className="text-xs text-slate-700">{group.primary_fields.join(', ')}</span>
                        </div>
                      )}
                      {group.secondary_fields.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                            SECONDARY
                          </span>
                          <span className="text-xs text-slate-600">{group.secondary_fields.join(', ')}</span>
                        </div>
                      )}
                      {group.tertiary_fields.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 flex-shrink-0">
                            TERTIARY
                          </span>
                          <span className="text-xs text-slate-500">{group.tertiary_fields.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hingeGroups.length === 0 && hingeFields.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Field Dependencies ({activeSheetName})
          </h4>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-2 font-medium text-gray-600">Field</th>
                  <th className="text-left p-2 font-medium text-gray-600">Level</th>
                  <th className="text-left p-2 font-medium text-gray-600">Dependency Reason</th>
                </tr>
              </thead>
              <tbody>
                {hingeFields.map((field, i) => {
                  const level = field.hingeLevel || 'tertiary';
                  const isRequired = level === 'primary';
                  return (
                    <tr key={field.primaryField} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="p-2 font-medium">
                        {field.primaryField}
                        {isRequired && <span className="text-red-600 ml-1">*</span>}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          level === 'primary' ? 'bg-red-100 text-red-700 font-bold' :
                          level === 'secondary' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {level.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-gray-600 text-xs">{field.description || field.whyItHinges}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {parentChildSeeds.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-blue-500" />
            Parent/Child Rules
          </h4>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-2 font-medium text-gray-600">Parent</th>
                  <th className="text-left p-2 font-medium text-gray-600">Trigger</th>
                  <th className="text-left p-2 font-medium text-gray-600">Child</th>
                  <th className="text-left p-2 font-medium text-gray-600">Required</th>
                </tr>
              </thead>
              <tbody>
                {parentChildSeeds.map((seed, i) => (
                  <tr key={`${seed.parent}-${seed.child}-${i}`} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="p-2">{seed.parent}</td>
                    <td className="p-2 text-gray-600 text-xs">{seed.trigger || '-'}</td>
                    <td className="p-2">{seed.child}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        seed.requiredness === 'required' ? 'bg-red-100 text-red-700' :
                        seed.requiredness === 'conditional' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {seed.requiredness}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openKnowledgeKeepers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            Rules Missing / Needs Decision ({openKnowledgeKeepers.length})
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            These items highlight undefined logic or pending decisions. They are informational only and do not block exports.
          </p>
          <div className="space-y-2">
            {openKnowledgeKeepers.map((keeper) => (
              <div key={keeper.blockerId} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{keeper.question}</p>
                    {keeper.sheetsFields && (
                      <p className="text-xs text-slate-500 mt-1">Affects: {keeper.sheetsFields}</p>
                    )}
                    {keeper.owner && (
                      <p className="text-xs text-slate-500">Owner: {keeper.owner}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function QAReviewerDashboard({
  dataset,
  anomalyMap,
  rfiComments,
  rfiEntriesV2,
  fieldStatuses,
  hingesConfig,
  flagMap,
  activeSheetName,
  onOpenRow,
  onUpdateRfiEntry,
  onFieldChange,
}: QAReviewerDashboardProps) {
  const counts: AnomalyCounts = useMemo(
    () => getAnomalyCounts(dataset, anomalyMap, rfiComments, fieldStatuses),
    [dataset, anomalyMap, rfiComments, fieldStatuses]
  );

  const manualReviewRows: ManualReviewRow[] = useMemo(
    () => getRowsNeedingManualReview(dataset, anomalyMap),
    [dataset, anomalyMap]
  );

  const qaFlags: FlagRecord[] = useMemo(() => {
    const flags: FlagRecord[] = [];
    for (const sheetName of Object.keys(flagMap)) {
      for (const rowIdx of Object.keys(flagMap[sheetName])) {
        const rowFlags = flagMap[sheetName][Number(rowIdx)];
        for (const flag of rowFlags) {
          if (isFlagRoutedToQA(flag.category)) {
            flags.push(flag);
          }
        }
      }
    }
    return flags.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [flagMap]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Anomaly Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <StatCard
            icon={FileX}
            label="PDF Load Errors"
            value={counts.contractLoadError}
            color="bg-red-50 border-red-200 text-red-800"
          />
          <StatCard
            icon={FileWarning}
            label="Unreadable PDFs"
            value={counts.contractTextUnreadable}
            color="bg-orange-50 border-orange-200 text-orange-800"
          />
          <StatCard
            icon={AlertTriangle}
            label="Suspect Extraction"
            value={counts.contractExtractionSuspect}
            color="bg-amber-50 border-amber-200 text-amber-800"
          />
          <StatCard
            icon={AlertCircle}
            label="Not Applicable"
            value={counts.contractNotApplicable}
            color="bg-blue-50 border-blue-200 text-blue-800"
          />
          <StatCard
            icon={AlertCircle}
            label="Blacklist Hits"
            value={counts.blacklistHit}
            color="bg-purple-50 border-purple-200 text-purple-800"
          />
          <StatCard
            icon={Flag}
            label="QA Flags"
            value={qaFlags.length}
            color="bg-teal-50 border-teal-200 text-teal-800"
          />
          <StatCard
            icon={HelpCircle}
            label="Total RFIs"
            value={counts.totalRfis}
            color="bg-cyan-50 border-cyan-200 text-cyan-800"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border rounded-lg">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Manual Review Queue</h3>
              <span className="text-sm text-gray-500">
                {manualReviewRows.length} row{manualReviewRows.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ManualReviewTable rows={manualReviewRows} onOpenRow={onOpenRow} />
          </div>

          <div className="bg-white border rounded-lg">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Flag className="w-4 h-4 text-teal-600" />
                Flags (QA)
              </h3>
              <span className="text-sm text-gray-500">
                {qaFlags.length} flag{qaFlags.length !== 1 ? 's' : ''}
              </span>
            </div>
            <FlagsTable flags={qaFlags} onOpenRow={onOpenRow} />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <HingePatternLegend />

          <div className="bg-white border rounded-lg">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold text-gray-800">Rules & Field Dependencies</h3>
            </div>
            <div className="p-4">
              <HingesInsightPanel hingesConfig={hingesConfig} activeSheetName={activeSheetName} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
