import { BlacklistEntry, Anomaly } from '../types';

export function normalizeForMatch(value: string): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function matchesBlacklistEntry(
  cellValue: string,
  entry: BlacklistEntry,
  fieldName: string
): boolean {
  if (!entry.enabled) return false;
  if (!cellValue || cellValue.trim() === '') return false;

  if (entry.scope === 'field_specific' && entry.fields.length > 0) {
    const normalizedField = fieldName.toLowerCase();
    const matchesField = entry.fields.some(
      (f) => f.toLowerCase() === normalizedField
    );
    if (!matchesField) return false;
  }

  const normalizedCell = normalizeForMatch(cellValue);
  const normalizedEntry = normalizeForMatch(entry.value);

  if (!normalizedEntry) return false;

  if (entry.matchMode === 'exact') {
    return normalizedCell === normalizedEntry;
  }

  return normalizedCell.includes(normalizedEntry);
}

export function detectBlacklistHits(
  value: string,
  fieldName: string,
  entries: BlacklistEntry[]
): BlacklistEntry[] {
  if (!value || !entries || entries.length === 0) return [];

  return entries.filter((entry) => matchesBlacklistEntry(value, entry, fieldName));
}

export function createBlacklistAnomaly(entry: BlacklistEntry, cellValue: string): Anomaly {
  const scopeLabel = entry.scope === 'field_specific'
    ? `fields: ${entry.fields.join(', ')}`
    : 'all fields';
  const matchLabel = entry.matchMode === 'exact' ? 'exact match' : 'contains';

  return {
    type: 'blacklist_hit',
    severity: 'warn',
    message: `Blacklist match: "${entry.value}" (${matchLabel}, ${scopeLabel})`,
    blacklistEntryId: entry.id,
    blacklistValue: entry.value,
    blacklistMatchMode: entry.matchMode,
    blacklistScope: entry.scope,
  };
}

export function detectBlacklistAnomalies(
  value: string,
  fieldName: string,
  entries: BlacklistEntry[]
): Anomaly[] {
  const hits = detectBlacklistHits(value, fieldName, entries);
  return hits.map((entry) => createBlacklistAnomaly(entry, value));
}
