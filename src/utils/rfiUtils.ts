import type {
  RfiCommentEntry,
  RfiComments,
  RfiRoutingTarget,
  RfiType,
  RfiStatus,
  RfiAppliedFix,
} from '../types';

export function generateRfiId(): string {
  return `rfi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function suggestRoutingForType(rfiType: RfiType): RfiRoutingTarget[] {
  switch (rfiType) {
    case 'extraction':
      return ['qa'];
    case 'data_format':
      return ['salesforce'];
    case 'contract_meaning':
      return ['ar'];
    case 'other':
    default:
      return ['salesforce'];
  }
}

export function createRfiEntry(params: {
  sheetName: string;
  rowIndex: number;
  fieldName: string;
  comment: string;
  rfiType: RfiType;
  routedTo: RfiRoutingTarget[];
}): RfiCommentEntry {
  return {
    id: generateRfiId(),
    sheetName: params.sheetName,
    rowIndex: params.rowIndex,
    fieldName: params.fieldName,
    comment: params.comment,
    rfiType: params.rfiType,
    routedTo: params.routedTo.length > 0 ? params.routedTo : ['salesforce'],
    routedAt: new Date().toISOString(),
    routedBy: 'analyst',
    status: 'open',
  };
}

export function migrateLegacyRfis(legacyRfis: RfiComments): RfiCommentEntry[] {
  const entries: RfiCommentEntry[] = [];

  for (const sheetName of Object.keys(legacyRfis)) {
    const sheetData = legacyRfis[sheetName];
    if (!sheetData) continue;

    for (const rowIndexStr of Object.keys(sheetData)) {
      const rowIndex = parseInt(rowIndexStr, 10);
      const rowData = sheetData[rowIndex];
      if (!rowData) continue;

      for (const fieldName of Object.keys(rowData)) {
        const comment = rowData[fieldName];
        if (comment) {
          entries.push({
            id: generateRfiId(),
            sheetName,
            rowIndex,
            fieldName,
            comment,
            rfiType: 'data_format',
            routedTo: ['salesforce'],
            routedAt: new Date().toISOString(),
            routedBy: 'system',
            status: 'open',
          });
        }
      }
    }
  }

  return entries;
}

export function getOpenRfisByTarget(
  entries: RfiCommentEntry[],
  target: RfiRoutingTarget
): RfiCommentEntry[] {
  return entries.filter(
    (entry) => entry.status === 'open' && entry.routedTo.includes(target)
  );
}

export function getAllRfisByTarget(
  entries: RfiCommentEntry[],
  target: RfiRoutingTarget
): RfiCommentEntry[] {
  return entries.filter((entry) => entry.routedTo.includes(target));
}

export function countOpenRfisByTarget(entries: RfiCommentEntry[]): Record<RfiRoutingTarget, number> {
  const counts: Record<RfiRoutingTarget, number> = {
    qa: 0,
    salesforce: 0,
    ar: 0,
  };

  for (const entry of entries) {
    if (entry.status === 'open') {
      for (const target of entry.routedTo) {
        counts[target]++;
      }
    }
  }

  return counts;
}

export function getTotalOpenRfis(entries: RfiCommentEntry[]): number {
  return entries.filter((entry) => entry.status === 'open').length;
}

export function getOpenRfisForRow(
  entries: RfiCommentEntry[],
  sheetName: string,
  rowIndex: number
): RfiCommentEntry[] {
  return entries.filter(
    (entry) =>
      entry.sheetName === sheetName &&
      entry.rowIndex === rowIndex &&
      entry.status === 'open'
  );
}

export function getRoutingTargetsForRow(
  entries: RfiCommentEntry[],
  sheetName: string,
  rowIndex: number
): RfiRoutingTarget[] {
  const openRfis = getOpenRfisForRow(entries, sheetName, rowIndex);
  const targets = new Set<RfiRoutingTarget>();

  for (const rfi of openRfis) {
    for (const target of rfi.routedTo) {
      targets.add(target);
    }
  }

  return Array.from(targets);
}

export function markRfiAnswered(
  entry: RfiCommentEntry,
  params: {
    verifierResponse: string;
    answeredByRole: RfiRoutingTarget | 'analyst';
    appliedFix?: RfiAppliedFix;
  }
): RfiCommentEntry {
  return {
    ...entry,
    status: 'answered',
    verifierResponse: params.verifierResponse,
    answeredAt: new Date().toISOString(),
    answeredByRole: params.answeredByRole,
    appliedFix: params.appliedFix,
  };
}

export function markRfiResolved(entry: RfiCommentEntry): RfiCommentEntry {
  return {
    ...entry,
    status: 'resolved',
  };
}

export function updateRfiEntry(
  entries: RfiCommentEntry[],
  entryId: string,
  updates: Partial<RfiCommentEntry>
): RfiCommentEntry[] {
  return entries.map((entry) =>
    entry.id === entryId ? { ...entry, ...updates } : entry
  );
}

export function deleteRfiEntry(
  entries: RfiCommentEntry[],
  entryId: string
): RfiCommentEntry[] {
  return entries.filter((entry) => entry.id !== entryId);
}

export function findRfiByFieldName(
  entries: RfiCommentEntry[],
  sheetName: string,
  rowIndex: number,
  fieldName: string
): RfiCommentEntry | undefined {
  return entries.find(
    (entry) =>
      entry.sheetName === sheetName &&
      entry.rowIndex === rowIndex &&
      entry.fieldName === fieldName &&
      entry.status === 'open'
  );
}

export function hasOpenRfiForField(
  entries: RfiCommentEntry[],
  sheetName: string,
  rowIndex: number,
  fieldName: string
): boolean {
  return !!findRfiByFieldName(entries, sheetName, rowIndex, fieldName);
}

export function getRfiStatusColor(status: RfiStatus): { bg: string; text: string } {
  switch (status) {
    case 'open':
      return { bg: 'bg-amber-100', text: 'text-amber-700' };
    case 'answered':
      return { bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'resolved':
      return { bg: 'bg-green-100', text: 'text-green-700' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700' };
  }
}
