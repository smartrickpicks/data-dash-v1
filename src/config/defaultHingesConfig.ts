import type { HingesConfig, HingeField, ParentChildSeed, KnowledgeKeeper, BuildOrderEntry, SheetAlias } from '../types';

export const DEFAULT_HINGE_FIELDS: HingeField[] = [];

export const DEFAULT_PARENT_CHILD_SEEDS: ParentChildSeed[] = [];

export const DEFAULT_KNOWLEDGE_KEEPERS: KnowledgeKeeper[] = [];

export const DEFAULT_BUILD_ORDER: BuildOrderEntry[] = [];

export const DEFAULT_SHEET_ALIASES: SheetAlias[] = [];

export function createEmptyHingesConfig(): HingesConfig {
  return {
    buildOrder: DEFAULT_BUILD_ORDER,
    sheetAliases: DEFAULT_SHEET_ALIASES,
    hingeFields: DEFAULT_HINGE_FIELDS,
    parentChildSeeds: DEFAULT_PARENT_CHILD_SEEDS,
    knowledgeKeepers: DEFAULT_KNOWLEDGE_KEEPERS,
    loadedAt: '',
  };
}

export function isHingesConfigEmpty(config: HingesConfig | null): boolean {
  if (!config) return true;
  return (
    config.buildOrder.length === 0 &&
    config.sheetAliases.length === 0 &&
    config.hingeFields.length === 0 &&
    config.parentChildSeeds.length === 0 &&
    config.knowledgeKeepers.length === 0
  );
}

export function isHingesConfigLoaded(config: HingesConfig | null): boolean {
  if (!config) return false;
  return Boolean(config.loadedAt) && !isHingesConfigEmpty(config);
}
