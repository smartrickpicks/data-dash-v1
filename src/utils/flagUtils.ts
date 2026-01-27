import {
  FlagMap,
  FlagRecord,
  FlagCategory,
  FlagSeverity,
  AnomalyMap,
  isFlagRoutedToQA,
  isFlagRoutedToSalesforce,
} from '../types';

export function createFlag(
  sheetName: string,
  rowIndex: number,
  category: FlagCategory,
  reason: string | null,
  comment: string | null,
  severity: FlagSeverity = 'info',
  fileUrl?: string
): FlagRecord {
  return {
    id: crypto.randomUUID(),
    sheetName,
    rowIndex,
    fileUrl,
    category,
    reason,
    comment,
    severity,
    createdAt: new Date().toISOString(),
    createdBy: 'analyst',
  };
}

export function addFlag(
  flagMap: FlagMap,
  flag: FlagRecord
): FlagMap {
  const updated = { ...flagMap };
  if (!updated[flag.sheetName]) {
    updated[flag.sheetName] = {};
  }
  if (!updated[flag.sheetName][flag.rowIndex]) {
    updated[flag.sheetName][flag.rowIndex] = [];
  }
  updated[flag.sheetName][flag.rowIndex] = [
    ...updated[flag.sheetName][flag.rowIndex],
    flag,
  ];
  return updated;
}

export function removeFlag(
  flagMap: FlagMap,
  sheetName: string,
  rowIndex: number,
  flagId: string
): FlagMap {
  const updated = { ...flagMap };
  if (updated[sheetName]?.[rowIndex]) {
    updated[sheetName][rowIndex] = updated[sheetName][rowIndex].filter(
      (f) => f.id !== flagId
    );
    if (updated[sheetName][rowIndex].length === 0) {
      delete updated[sheetName][rowIndex];
    }
    if (Object.keys(updated[sheetName]).length === 0) {
      delete updated[sheetName];
    }
  }
  return updated;
}

export function clearFlagsForRow(
  flagMap: FlagMap,
  sheetName: string,
  rowIndex: number
): FlagMap {
  const updated = { ...flagMap };
  if (updated[sheetName]) {
    delete updated[sheetName][rowIndex];
    if (Object.keys(updated[sheetName]).length === 0) {
      delete updated[sheetName];
    }
  }
  return updated;
}

export function getFlagsForRow(
  flagMap: FlagMap,
  sheetName: string,
  rowIndex: number
): FlagRecord[] {
  return flagMap[sheetName]?.[rowIndex] || [];
}

export function getQAFlags(flagMap: FlagMap): FlagRecord[] {
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
  return flags.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getSalesforceFlags(flagMap: FlagMap): FlagRecord[] {
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
  return flags.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getAllFlags(flagMap: FlagMap): FlagRecord[] {
  const flags: FlagRecord[] = [];
  for (const sheetName of Object.keys(flagMap)) {
    for (const rowIdx of Object.keys(flagMap[sheetName])) {
      flags.push(...flagMap[sheetName][Number(rowIdx)]);
    }
  }
  return flags.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function hasBlockingFlag(
  flagMap: FlagMap,
  sheetName: string,
  rowIndex: number
): boolean {
  const flags = getFlagsForRow(flagMap, sheetName, rowIndex);
  return flags.some((f) => f.severity === 'blocking');
}

export function countFlagsByCategory(flagMap: FlagMap): Record<FlagCategory, number> {
  const counts: Record<FlagCategory, number> = {
    extraction: 0,
    salesforce: 0,
    data_mgmt: 0,
    other: 0,
  };

  for (const sheetName of Object.keys(flagMap)) {
    for (const rowIdx of Object.keys(flagMap[sheetName])) {
      for (const flag of flagMap[sheetName][Number(rowIdx)]) {
        counts[flag.category]++;
      }
    }
  }

  return counts;
}

export function migrateContractNotApplicableToFlags(
  anomalyMap: AnomalyMap
): FlagMap {
  const flagMap: FlagMap = {};

  for (const sheetName of Object.keys(anomalyMap)) {
    for (const rowIdx of Object.keys(anomalyMap[sheetName])) {
      const rowIndex = Number(rowIdx);
      for (const fieldName of Object.keys(anomalyMap[sheetName][rowIndex])) {
        const anomalies = anomalyMap[sheetName][rowIndex][fieldName];
        for (const anomaly of anomalies) {
          if (anomaly.type === 'contract_not_applicable' && anomaly.notApplicableMeta) {
            const meta = anomaly.notApplicableMeta;

            let reason = 'Other data mgmt issue';
            if (meta.reasonKey === 'wrong_doc_type') {
              reason = 'Wrong document type in this dataset';
            } else if (meta.reasonKey === 'duplicate') {
              reason = 'Duplicate document';
            } else if (meta.reasonKey === 'not_in_scope') {
              reason = 'Not in scope';
            } else if (meta.reasonKey === 'termination_notice') {
              reason = 'Wrong document type in this dataset';
            }

            const flag = createFlag(
              sheetName,
              rowIndex,
              'data_mgmt',
              reason,
              meta.freeText || null,
              'warning'
            );
            flag.createdAt = meta.timestampISO;

            if (!flagMap[sheetName]) {
              flagMap[sheetName] = {};
            }
            if (!flagMap[sheetName][rowIndex]) {
              flagMap[sheetName][rowIndex] = [];
            }
            flagMap[sheetName][rowIndex].push(flag);
          }
        }
      }
    }
  }

  return flagMap;
}
