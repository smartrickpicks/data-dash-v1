import { Dataset, ChangeMap, RowData } from '../types';

function normalizeValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function compareValues(
  original: string | number | boolean | null | undefined,
  current: string | number | boolean | null | undefined
): boolean {
  return normalizeValue(original) !== normalizeValue(current);
}

export function generateChangeMap(
  originalDataset: Dataset | null,
  currentDataset: Dataset | null
): ChangeMap {
  const changeMap: ChangeMap = {};

  if (!originalDataset || !currentDataset) {
    return changeMap;
  }

  currentDataset.sheets.forEach((currentSheet) => {
    const originalSheet = originalDataset.sheets.find(
      (s) => s.name === currentSheet.name
    );

    if (!originalSheet) return;

    changeMap[currentSheet.name] = {};

    currentSheet.rows.forEach((currentRow, rowIndex) => {
      const originalRow = originalSheet.rows[rowIndex];

      if (!originalRow) return;

      changeMap[currentSheet.name][rowIndex] = {};

      currentSheet.headers.forEach((fieldName) => {
        const originalValue = originalRow[fieldName];
        const currentValue = currentRow[fieldName];

        const hasChanged = compareValues(originalValue, currentValue);
        changeMap[currentSheet.name][rowIndex][fieldName] = hasChanged;
      });
    });
  });

  return changeMap;
}
