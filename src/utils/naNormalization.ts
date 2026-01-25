const NA_VARIANTS = new Set([
  'n/a',
  'na',
  'not applicable',
  'not app',
  'not needed',
  'n.a.',
  'none',
  'null',
]);

export const CANONICAL_NA = 'N/A';

export function isNAValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return NA_VARIANTS.has(normalized);
}

export function normalizeNAForDisplay(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');
  if (isNAValue(value)) return CANONICAL_NA;
  return value;
}

export function isCanonicalNA(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.trim() === CANONICAL_NA || isNAValue(value);
}
