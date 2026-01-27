import { useMemo, useState } from 'react';
import {
  MessageSquare,
  Flag,
  Eye,
  CheckCircle2,
  Search,
  SortAsc,
  SortDesc,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  Dataset,
  AnomalyMap,
  RfiComments,
  FieldStatus,
  RfiCommentRow,
  FlagMap,
  FlagRecord,
  FLAG_CATEGORY_LABELS,
  isFlagRoutedToSalesforce,
} from '../types';
import {
  getRfiAndCommentRows,
} from '../utils/reviewerHelpers';

interface SalesforceVerifierDashboardProps {
  dataset: Dataset | null;
  anomalyMap: AnomalyMap;
  rfiComments: RfiComments;
  fieldStatuses: FieldStatus;
  flagMap: FlagMap;
  onOpenRow: (sheetName: string, rowIndex: number) => void;
}

type SortField = 'sheet' | 'row' | 'field';
type SortDirection = 'asc' | 'desc';

function RfiCommentsTable({
  rows,
  onOpenRow,
}: {
  rows: RfiCommentRow[];
  onOpenRow: (sheetName: string, rowIndex: number) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('sheet');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        r =>
          r.sheetName.toLowerCase().includes(term) ||
          r.fieldName.toLowerCase().includes(term) ||
          r.comment.toLowerCase().includes(term)
      );
    }

    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'sheet':
          comparison = a.sheetName.localeCompare(b.sheetName);
          if (comparison === 0) comparison = a.rowIndex - b.rowIndex;
          break;
        case 'row':
          comparison = a.rowIndex - b.rowIndex;
          if (comparison === 0) comparison = a.sheetName.localeCompare(b.sheetName);
          break;
        case 'field':
          comparison = a.fieldName.localeCompare(b.fieldName);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [rows, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = sortDirection === 'asc' ? SortAsc : SortDesc;

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No RFIs or comments</p>
        <p className="text-sm">All fields have been reviewed without issues</p>
      </div>
    );
  }

  return (
    <div>
      <div className="p-3 border-b bg-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search RFIs and comments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th
                className="text-left p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('sheet')}
              >
                <div className="flex items-center gap-1">
                  Sheet
                  {sortField === 'sheet' && <SortIcon className="w-3.5 h-3.5" />}
                </div>
              </th>
              <th
                className="text-left p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('row')}
              >
                <div className="flex items-center gap-1">
                  Row
                  {sortField === 'row' && <SortIcon className="w-3.5 h-3.5" />}
                </div>
              </th>
              <th
                className="text-left p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('field')}
              >
                <div className="flex items-center gap-1">
                  Field
                  {sortField === 'field' && <SortIcon className="w-3.5 h-3.5" />}
                </div>
              </th>
              <th className="text-left p-3 font-medium text-gray-700">Comment</th>
              <th className="text-left p-3 font-medium text-gray-700">Type</th>
              <th className="text-right p-3 font-medium text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr
                key={`${row.sheetName}-${row.rowIndex}-${row.fieldName}`}
                className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="p-3 font-medium">{row.sheetName}</td>
                <td className="p-3">{row.rowIndex + 1}</td>
                <td className="p-3">{row.fieldName}</td>
                <td className="p-3 max-w-md">
                  <p className="text-gray-700 line-clamp-2" title={row.comment}>
                    {row.comment}
                  </p>
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      row.severity === 'rfi'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {row.severity === 'rfi' ? 'RFI' : 'Comment'}
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

      {filteredRows.length === 0 && searchTerm && (
        <div className="text-center py-6 text-gray-500">
          <p>No results matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}

function SalesforceFlagsTable({
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
        <p className="font-medium">No Salesforce flags</p>
        <p className="text-sm">Flags for business logic and Salesforce issues appear here</p>
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
            <th className="text-left p-3 font-medium text-gray-700">Reason</th>
            <th className="text-left p-3 font-medium text-gray-700">Severity</th>
            <th className="text-left p-3 font-medium text-gray-700">Comment</th>
            <th className="text-left p-3 font-medium text-gray-700">Created</th>
            <th className="text-right p-3 font-medium text-gray-700">Action</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag, i) => (
            <tr
              key={flag.id}
              className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              <td className="p-3 font-medium">{flag.sheetName}</td>
              <td className="p-3">{flag.rowIndex + 1}</td>
              <td className="p-3 max-w-xs">
                <p className="text-gray-700 text-xs" title={flag.reason || ''}>
                  {flag.reason || '-'}
                </p>
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
              <td className="p-3 max-w-xs">
                <p className="text-gray-600 text-xs line-clamp-2" title={flag.comment || ''}>
                  {flag.comment || '-'}
                </p>
              </td>
              <td className="p-3 text-xs text-gray-500">
                {new Date(flag.createdAt).toLocaleDateString()}
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

export function SalesforceVerifierDashboard({
  dataset,
  anomalyMap,
  rfiComments,
  fieldStatuses,
  flagMap,
  onOpenRow,
}: SalesforceVerifierDashboardProps) {
  const rfiRows: RfiCommentRow[] = useMemo(
    () => getRfiAndCommentRows(dataset, rfiComments, fieldStatuses),
    [dataset, rfiComments, fieldStatuses]
  );

  const salesforceFlags: FlagRecord[] = useMemo(() => {
    const flags: FlagRecord[] = [];
    for (const sheetName of Object.keys(flagMap)) {
      for (const rowIdx of Object.keys(flagMap[sheetName])) {
        const rowFlags = flagMap[sheetName][Number(rowIdx)];
        for (const flag of rowFlags) {
          if (isFlagRoutedToSalesforce(flag.category)) {
            flags.push(flag);
          }
        }
      }
    }
    return flags.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [flagMap]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-2xl font-semibold text-amber-800">{rfiRows.length}</div>
              <div className="text-sm text-amber-700">RFIs & Comments</div>
            </div>
          </div>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Flag className="w-5 h-5 text-teal-600" />
            <div>
              <div className="text-2xl font-semibold text-teal-800">{salesforceFlags.length}</div>
              <div className="text-sm text-teal-700">Salesforce Flags</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            RFIs & Comments
          </h3>
          <span className="text-sm text-gray-500">
            {rfiRows.length} item{rfiRows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <RfiCommentsTable rows={rfiRows} onOpenRow={onOpenRow} />
      </div>

      <div className="bg-white border rounded-lg">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Flag className="w-4 h-4 text-teal-500" />
            Flags (Salesforce)
          </h3>
          <span className="text-sm text-gray-500">
            {salesforceFlags.length} flag{salesforceFlags.length !== 1 ? 's' : ''}
          </span>
        </div>
        <SalesforceFlagsTable flags={salesforceFlags} onOpenRow={onOpenRow} />
      </div>
    </div>
  );
}
