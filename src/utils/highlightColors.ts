const HIGHLIGHT_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.3)', border: '#3b82f6', text: '#1e40af', name: 'Blue' },
  { bg: 'rgba(16, 185, 129, 0.3)', border: '#10b981', text: '#065f46', name: 'Green' },
  { bg: 'rgba(245, 158, 11, 0.3)', border: '#f59e0b', text: '#92400e', name: 'Amber' },
  { bg: 'rgba(239, 68, 68, 0.3)', border: '#ef4444', text: '#991b1b', name: 'Red' },
  { bg: 'rgba(168, 85, 247, 0.3)', border: '#a855f7', text: '#6b21a8', name: 'Purple' },
  { bg: 'rgba(236, 72, 153, 0.3)', border: '#ec4899', text: '#9d174d', name: 'Pink' },
  { bg: 'rgba(20, 184, 166, 0.3)', border: '#14b8a6', text: '#115e59', name: 'Teal' },
  { bg: 'rgba(99, 102, 241, 0.3)', border: '#6366f1', text: '#3730a3', name: 'Indigo' },
  { bg: 'rgba(234, 179, 8, 0.3)', border: '#eab308', text: '#854d0e', name: 'Yellow' },
  { bg: 'rgba(6, 182, 212, 0.3)', border: '#06b6d4', text: '#155e75', name: 'Cyan' },
  { bg: 'rgba(249, 115, 22, 0.3)', border: '#f97316', text: '#9a3412', name: 'Orange' },
  { bg: 'rgba(132, 204, 22, 0.3)', border: '#84cc16', text: '#3f6212', name: 'Lime' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getColorForField(fieldName: string, index?: number): typeof HIGHLIGHT_COLORS[0] {
  const idx = index !== undefined ? index : hashString(fieldName);
  return HIGHLIGHT_COLORS[idx % HIGHLIGHT_COLORS.length];
}

export function getAllColors(): typeof HIGHLIGHT_COLORS {
  return HIGHLIGHT_COLORS;
}

export interface FieldHighlight {
  fieldName: string;
  value: string;
  color: typeof HIGHLIGHT_COLORS[0];
  occurrences: number;
}

export function prepareFieldHighlights(
  headers: string[],
  rowData: Record<string, unknown>,
  skipFirstN: number = 2
): FieldHighlight[] {
  const editableHeaders = headers.slice(skipFirstN);
  const highlights: FieldHighlight[] = [];

  editableHeaders.forEach((header, index) => {
    const value = rowData[header];
    if (value !== null && value !== undefined && String(value).trim().length > 0) {
      const stringValue = String(value).trim();
      if (stringValue.length >= 2) {
        highlights.push({
          fieldName: header,
          value: stringValue,
          color: getColorForField(header, index),
          occurrences: 0,
        });
      }
    }
  });

  return highlights;
}
