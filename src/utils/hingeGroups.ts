import type { HingesConfig, HingeField, HingeGroup, BuiltHingeGroup, HingeGroupId, HingeLevel } from '../types';
import { HINGE_GROUP_IDS } from '../types';
import {
  inferGroupIdFromFieldName,
  createEmptyHingeGroup,
  DEFAULT_HINGE_GROUP_DEFINITIONS,
} from '../config/defaultHingeGroups';
import { getHingeFieldsForSheet } from '../config/hingesConfig';

function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[_\s-]/g, '');
}

function fieldMatchesAny(fieldName: string, fieldList: string[]): boolean {
  const normalized = normalizeForComparison(fieldName);
  return fieldList.some(f => normalizeForComparison(f) === normalized);
}

function getHingeFieldByName(hingeFields: HingeField[], fieldName: string): HingeField | undefined {
  const normalized = normalizeForComparison(fieldName);
  return hingeFields.find(h => normalizeForComparison(h.primaryField) === normalized);
}

export function buildHingeGroupsForSheet(
  config: HingesConfig,
  sheetName: string,
  allFieldHeaders?: string[]
): BuiltHingeGroup[] {
  const hingeFields = getHingeFieldsForSheet(config, sheetName);

  if (hingeFields.length === 0) {
    return [];
  }

  if (config.hingeGroups && config.hingeGroups.length > 0) {
    return buildFromExplicitGroups(config.hingeGroups, hingeFields, sheetName, allFieldHeaders);
  }

  return deriveGroupsFromHingeFields(hingeFields, sheetName, allFieldHeaders);
}

function buildFromExplicitGroups(
  hingeGroups: HingeGroup[],
  hingeFields: HingeField[],
  sheetName: string,
  allFieldHeaders?: string[]
): BuiltHingeGroup[] {
  const sheetGroups = hingeGroups.filter(g => !g.sheet || normalizeForComparison(g.sheet) === normalizeForComparison(sheetName));

  const builtGroups: BuiltHingeGroup[] = [];
  const assignedFieldNames = new Set<string>();

  for (const group of sheetGroups) {
    const primaryHingeFields: HingeField[] = [];
    const secondaryHingeFields: HingeField[] = [];
    const tertiaryHingeFields: HingeField[] = [];
    const allFieldNames: string[] = [];

    for (const fieldName of group.primary_fields) {
      const hf = getHingeFieldByName(hingeFields, fieldName);
      if (hf) {
        primaryHingeFields.push(hf);
      }
      allFieldNames.push(fieldName);
      assignedFieldNames.add(normalizeForComparison(fieldName));
    }

    for (const fieldName of group.secondary_fields) {
      const hf = getHingeFieldByName(hingeFields, fieldName);
      if (hf) {
        secondaryHingeFields.push(hf);
      }
      allFieldNames.push(fieldName);
      assignedFieldNames.add(normalizeForComparison(fieldName));
    }

    for (const fieldName of group.tertiary_fields) {
      const hf = getHingeFieldByName(hingeFields, fieldName);
      if (hf) {
        tertiaryHingeFields.push(hf);
      }
      allFieldNames.push(fieldName);
      assignedFieldNames.add(normalizeForComparison(fieldName));
    }

    if (allFieldNames.length > 0) {
      builtGroups.push({
        ...group,
        primaryHingeFields,
        secondaryHingeFields,
        tertiaryHingeFields,
        allFieldNames,
      });
    }
  }

  const ungroupedHingeFields = hingeFields.filter(
    hf => !assignedFieldNames.has(normalizeForComparison(hf.primaryField))
  );

  if (ungroupedHingeFields.length > 0) {
    const otherGroup = createOtherGroup(ungroupedHingeFields, sheetName);
    builtGroups.push(otherGroup);
  }

  return builtGroups;
}

function deriveGroupsFromHingeFields(
  hingeFields: HingeField[],
  sheetName: string,
  _allFieldHeaders?: string[]
): BuiltHingeGroup[] {
  const groupedFields: Record<HingeGroupId, { primary: HingeField[]; secondary: HingeField[]; tertiary: HingeField[] }> = {
    terms: { primary: [], secondary: [], tertiary: [] },
    parties: { primary: [], secondary: [], tertiary: [] },
    payment: { primary: [], secondary: [], tertiary: [] },
    territory: { primary: [], secondary: [], tertiary: [] },
    duration: { primary: [], secondary: [], tertiary: [] },
    other: { primary: [], secondary: [], tertiary: [] },
  };

  for (const hf of hingeFields) {
    const groupId = inferGroupIdFromFieldName(hf.primaryField);
    const level: HingeLevel = hf.hingeLevel || 'tertiary';

    if (level === 'primary') {
      groupedFields[groupId].primary.push(hf);
    } else if (level === 'secondary') {
      groupedFields[groupId].secondary.push(hf);
    } else {
      groupedFields[groupId].tertiary.push(hf);
    }
  }

  const builtGroups: BuiltHingeGroup[] = [];

  for (const groupId of HINGE_GROUP_IDS) {
    const group = groupedFields[groupId];
    const totalFields = group.primary.length + group.secondary.length + group.tertiary.length;

    if (totalFields === 0) continue;

    const definition = DEFAULT_HINGE_GROUP_DEFINITIONS[groupId];
    const allFieldNames = [
      ...group.primary.map(h => h.primaryField),
      ...group.secondary.map(h => h.primaryField),
      ...group.tertiary.map(h => h.primaryField),
    ];

    builtGroups.push({
      group_id: groupId,
      group_label: definition.group_label,
      group_description: definition.group_description,
      sheet: sheetName,
      primary_fields: group.primary.map(h => h.primaryField),
      secondary_fields: group.secondary.map(h => h.primaryField),
      tertiary_fields: group.tertiary.map(h => h.primaryField),
      impact_scope: definition.impact_scope,
      severity_default: definition.severity_default,
      primaryHingeFields: group.primary,
      secondaryHingeFields: group.secondary,
      tertiaryHingeFields: group.tertiary,
      allFieldNames,
    });
  }

  return builtGroups;
}

function createOtherGroup(hingeFields: HingeField[], sheetName: string): BuiltHingeGroup {
  const primary = hingeFields.filter(h => h.hingeLevel === 'primary');
  const secondary = hingeFields.filter(h => h.hingeLevel === 'secondary');
  const tertiary = hingeFields.filter(h => !h.hingeLevel || h.hingeLevel === 'tertiary');

  const definition = DEFAULT_HINGE_GROUP_DEFINITIONS.other;

  return {
    group_id: 'other',
    group_label: definition.group_label,
    group_description: definition.group_description,
    sheet: sheetName,
    primary_fields: primary.map(h => h.primaryField),
    secondary_fields: secondary.map(h => h.primaryField),
    tertiary_fields: tertiary.map(h => h.primaryField),
    impact_scope: [],
    severity_default: 'info',
    primaryHingeFields: primary,
    secondaryHingeFields: secondary,
    tertiaryHingeFields: tertiary,
    allFieldNames: hingeFields.map(h => h.primaryField),
  };
}

export function getGroupForField(
  groups: BuiltHingeGroup[],
  fieldName: string
): BuiltHingeGroup | null {
  const normalized = normalizeForComparison(fieldName);
  for (const group of groups) {
    if (group.allFieldNames.some(f => normalizeForComparison(f) === normalized)) {
      return group;
    }
  }
  return null;
}

export function sortFieldsByGroup(
  fields: string[],
  groups: BuiltHingeGroup[]
): { grouped: Map<string, string[]>; ungrouped: string[] } {
  const grouped = new Map<string, string[]>();
  const ungrouped: string[] = [];

  for (const group of groups) {
    grouped.set(group.group_id, []);
  }

  for (const field of fields) {
    const group = getGroupForField(groups, field);
    if (group) {
      const arr = grouped.get(group.group_id) || [];
      arr.push(field);
      grouped.set(group.group_id, arr);
    } else {
      ungrouped.push(field);
    }
  }

  return { grouped, ungrouped };
}

export function getUngroupedFields(
  allFields: string[],
  groups: BuiltHingeGroup[]
): string[] {
  const allGroupedFields = new Set<string>();
  for (const group of groups) {
    for (const fieldName of group.allFieldNames) {
      allGroupedFields.add(normalizeForComparison(fieldName));
    }
  }

  return allFields.filter(f => !allGroupedFields.has(normalizeForComparison(f)));
}

export function isFieldInGroup(
  fieldName: string,
  group: BuiltHingeGroup
): boolean {
  const normalized = normalizeForComparison(fieldName);
  return group.allFieldNames.some(f => normalizeForComparison(f) === normalized);
}

export function getFieldLevelInGroup(
  fieldName: string,
  group: BuiltHingeGroup
): HingeLevel | null {
  const normalized = normalizeForComparison(fieldName);

  if (group.primary_fields.some(f => normalizeForComparison(f) === normalized)) {
    return 'primary';
  }
  if (group.secondary_fields.some(f => normalizeForComparison(f) === normalized)) {
    return 'secondary';
  }
  if (group.tertiary_fields.some(f => normalizeForComparison(f) === normalized)) {
    return 'tertiary';
  }
  return null;
}

export function getHingeFieldInGroup(
  fieldName: string,
  group: BuiltHingeGroup
): HingeField | null {
  const normalized = normalizeForComparison(fieldName);

  const primaryMatch = group.primaryHingeFields.find(
    h => normalizeForComparison(h.primaryField) === normalized
  );
  if (primaryMatch) return primaryMatch;

  const secondaryMatch = group.secondaryHingeFields.find(
    h => normalizeForComparison(h.primaryField) === normalized
  );
  if (secondaryMatch) return secondaryMatch;

  const tertiaryMatch = group.tertiaryHingeFields.find(
    h => normalizeForComparison(h.primaryField) === normalized
  );
  if (tertiaryMatch) return tertiaryMatch;

  return null;
}

export function getAllFieldsFromGroups(groups: BuiltHingeGroup[]): Set<string> {
  const allFields = new Set<string>();
  for (const group of groups) {
    for (const fieldName of group.allFieldNames) {
      allFields.add(normalizeForComparison(fieldName));
    }
  }
  return allFields;
}

export function getGroupsWithField(
  fieldName: string,
  groups: BuiltHingeGroup[]
): BuiltHingeGroup[] {
  const normalized = normalizeForComparison(fieldName);
  return groups.filter(group =>
    group.allFieldNames.some(f => normalizeForComparison(f) === normalized)
  );
}
