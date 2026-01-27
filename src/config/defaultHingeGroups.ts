import type { HingeGroup, HingeGroupId } from '../types';

export const DEFAULT_HINGE_GROUP_DEFINITIONS: Record<HingeGroupId, Omit<HingeGroup, 'primary_fields' | 'secondary_fields' | 'tertiary_fields'>> = {
  terms: {
    group_id: 'terms',
    group_label: 'Contract Terms',
    group_description: 'Core contract terms including agreement type, record type, and subtypes that define the nature of the deal.',
    severity_default: 'warning',
    impact_scope: ['agreement_sheet', 'opportunity'],
  },
  parties: {
    group_id: 'parties',
    group_label: 'Parties & Entities',
    group_description: 'Labels, artists, entities, counterparties, and signatories involved in the agreement.',
    severity_default: 'warning',
    impact_scope: ['accounts', 'contacts', 'agreement_sheet'],
  },
  payment: {
    group_id: 'payment',
    group_label: 'Payment & Royalties',
    group_description: 'Rates, royalties, advances, payment terms, currency, and financial obligations.',
    severity_default: 'blocking',
    impact_scope: ['financials', 'agreement_sheet'],
  },
  territory: {
    group_id: 'territory',
    group_label: 'Territory & Scope',
    group_description: 'Geographic scope, markets, regions, and exclusivity of the agreement.',
    severity_default: 'info',
    impact_scope: ['agreement_sheet', 'schedule'],
  },
  duration: {
    group_id: 'duration',
    group_label: 'Duration & Dates',
    group_description: 'Effective dates, term periods, renewal options, termination clauses, and time-based conditions.',
    severity_default: 'warning',
    impact_scope: ['agreement_sheet', 'schedule'],
  },
  other: {
    group_id: 'other',
    group_label: 'Other Fields',
    group_description: 'Fields that do not fit into the primary concept categories.',
    severity_default: 'info',
    impact_scope: [],
  },
};

export const FIELD_NAME_PATTERNS: Record<HingeGroupId, RegExp[]> = {
  terms: [
    /record[\s_-]?type/i,
    /subtype/i,
    /agreement[\s_-]?type/i,
    /contract[\s_-]?type/i,
    /deal[\s_-]?type/i,
    /license[\s_-]?type/i,
    /service[\s_-]?type/i,
    /rights?[\s_-]?type/i,
    /^type$/i,
  ],
  parties: [
    /label[\s_-]?name/i,
    /artist[\s_-]?name/i,
    /entity/i,
    /counterpart/i,
    /signator/i,
    /licensee/i,
    /licensor/i,
    /vendor/i,
    /distributor/i,
    /publisher/i,
    /account[\s_-]?name/i,
    /partner/i,
    /party/i,
    /client/i,
    /contact/i,
  ],
  payment: [
    /rate/i,
    /royalt/i,
    /advance/i,
    /payment/i,
    /currency/i,
    /amount/i,
    /price/i,
    /fee/i,
    /cost/i,
    /commission/i,
    /percent/i,
    /split/i,
    /share/i,
    /financial/i,
  ],
  territory: [
    /territor/i,
    /region/i,
    /country/i,
    /market/i,
    /exclusiv/i,
    /geographic/i,
    /scope/i,
    /area/i,
    /zone/i,
    /worldwide/i,
    /domestic/i,
    /international/i,
  ],
  duration: [
    /date/i,
    /term[\s_-]?(length|period|duration)?/i,
    /period/i,
    /duration/i,
    /effective/i,
    /expir/i,
    /start/i,
    /end/i,
    /renew/i,
    /terminat/i,
    /year/i,
    /month/i,
    /auto[\s_-]?renew/i,
    /notice[\s_-]?period/i,
  ],
  other: [],
};

export function inferGroupIdFromFieldName(fieldName: string): HingeGroupId {
  const normalizedName = fieldName.toLowerCase();

  for (const groupId of Object.keys(FIELD_NAME_PATTERNS) as HingeGroupId[]) {
    if (groupId === 'other') continue;
    const patterns = FIELD_NAME_PATTERNS[groupId];
    for (const pattern of patterns) {
      if (pattern.test(normalizedName)) {
        return groupId;
      }
    }
  }

  return 'other';
}

export function createEmptyHingeGroup(groupId: HingeGroupId, sheet?: string): HingeGroup {
  const definition = DEFAULT_HINGE_GROUP_DEFINITIONS[groupId];
  return {
    ...definition,
    sheet,
    primary_fields: [],
    secondary_fields: [],
    tertiary_fields: [],
  };
}

export function getGroupLabel(groupId: HingeGroupId | string): string {
  const definition = DEFAULT_HINGE_GROUP_DEFINITIONS[groupId as HingeGroupId];
  return definition?.group_label || groupId;
}

export function getGroupDescription(groupId: HingeGroupId | string): string {
  const definition = DEFAULT_HINGE_GROUP_DEFINITIONS[groupId as HingeGroupId];
  return definition?.group_description || '';
}

export function getGroupColorClasses(groupId: HingeGroupId | string): { bg: string; border: string; text: string; headerBg: string } {
  switch (groupId) {
    case 'terms':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        text: 'text-blue-800',
        headerBg: 'bg-blue-100',
      };
    case 'parties':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        text: 'text-emerald-800',
        headerBg: 'bg-emerald-100',
      };
    case 'payment':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-800',
        headerBg: 'bg-amber-100',
      };
    case 'territory':
      return {
        bg: 'bg-cyan-50',
        border: 'border-cyan-300',
        text: 'text-cyan-800',
        headerBg: 'bg-cyan-100',
      };
    case 'duration':
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-300',
        text: 'text-rose-800',
        headerBg: 'bg-rose-100',
      };
    default:
      return {
        bg: 'bg-slate-50',
        border: 'border-slate-300',
        text: 'text-slate-700',
        headerBg: 'bg-slate-100',
      };
  }
}
