const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia'
];

const US_STATE_ABBREVIATIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV',
  'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
  'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

const BUSINESS_ENTITY_TYPES = [
  'Partnership',
  'Limited Partnership',
  'Limited Liability Partnership',
  'LLP',
  'Corporation',
  'C Corporation',
  'C Corp',
  'S Corporation',
  'S Corp',
  'Limited Liability Company',
  'LLC',
  'Limited Company',
  'Ltd',
  'Sole Proprietorship',
  'Sole Proprietor',
  'General Partnership',
  'Joint Venture',
  'Trust',
  'Estate',
  'Non-Profit',
  'Nonprofit',
  'Not-for-Profit',
  'Professional Corporation',
  'PC',
  'Professional Limited Liability Company',
  'PLLC',
  'Limited Liability Limited Partnership',
  'LLLP',
  'Cooperative',
  'Co-op',
  'Association',
  'Government',
  'Government Entity',
  'Municipal',
  'Individual',
  'Not Legally Formed',
  'Unincorporated'
];

const COMMON_YES_NO = ['Yes', 'No', 'Y', 'N', 'True', 'False'];

const COMMON_STATUS_VALUES = [
  'Active', 'Inactive', 'Pending', 'Approved', 'Rejected', 'Cancelled', 'Canceled',
  'Complete', 'Completed', 'In Progress', 'Draft', 'Submitted', 'Under Review',
  'On Hold', 'Expired', 'Terminated', 'Suspended', 'Open', 'Closed'
];

const COMMON_PRIORITY_VALUES = [
  'High', 'Medium', 'Low', 'Critical', 'Urgent', 'Normal', 'None'
];

const PAYMENT_TERMS = [
  'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90',
  'Due on Receipt', 'Due Upon Receipt', 'COD', 'Cash on Delivery',
  'Prepaid', 'Advance Payment', '50% Upfront', '2/10 Net 30',
  'End of Month', 'EOM', '15th of Month', '1st of Month'
];

const CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'MXN', 'BRL'
];

const CONTRACT_TYPES = [
  'Fixed Price', 'Fixed-Price', 'Time and Materials', 'T&M', 'Cost Plus',
  'Cost-Plus', 'Firm Fixed Price', 'FFP', 'Cost Reimbursement', 'Unit Price',
  'Indefinite Delivery', 'IDIQ', 'Master Service Agreement', 'MSA',
  'Statement of Work', 'SOW', 'Purchase Order', 'PO', 'Blanket Purchase Agreement',
  'BPA', 'Framework Agreement', 'Retainer', 'Subscription', 'License Agreement'
];

const INDUSTRY_TYPES = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education',
  'Construction', 'Real Estate', 'Transportation', 'Energy', 'Agriculture',
  'Hospitality', 'Media', 'Entertainment', 'Telecommunications', 'Pharmaceuticals',
  'Insurance', 'Legal Services', 'Consulting', 'Government', 'Non-Profit'
];

interface PatternSet {
  name: string;
  values: string[];
  caseSensitive?: boolean;
}

const ALL_PATTERN_SETS: PatternSet[] = [
  { name: 'US States', values: US_STATES, caseSensitive: false },
  { name: 'US State Abbreviations', values: US_STATE_ABBREVIATIONS, caseSensitive: true },
  { name: 'Business Entity Types', values: BUSINESS_ENTITY_TYPES, caseSensitive: false },
  { name: 'Yes/No', values: COMMON_YES_NO, caseSensitive: false },
  { name: 'Status Values', values: COMMON_STATUS_VALUES, caseSensitive: false },
  { name: 'Priority Values', values: COMMON_PRIORITY_VALUES, caseSensitive: false },
  { name: 'Payment Terms', values: PAYMENT_TERMS, caseSensitive: false },
  { name: 'Currency Codes', values: CURRENCY_CODES, caseSensitive: true },
  { name: 'Contract Types', values: CONTRACT_TYPES, caseSensitive: false },
  { name: 'Industry Types', values: INDUSTRY_TYPES, caseSensitive: false },
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findPatternMatches(text: string, patternSet: PatternSet): string[] {
  const found: string[] = [];
  const sortedValues = [...patternSet.values].sort((a, b) => b.length - a.length);
  let remaining = text;

  for (const value of sortedValues) {
    const flags = patternSet.caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`\\b${escapeRegex(value)}\\b`, flags);

    if (regex.test(remaining)) {
      found.push(value);
      remaining = remaining.replace(regex, ' ');
    }
  }

  return found;
}

function tryExtractAllPatterns(text: string): { matches: string[]; coverage: number } | null {
  let bestResult: { matches: string[]; coverage: number } | null = null;

  for (const patternSet of ALL_PATTERN_SETS) {
    const matches = findPatternMatches(text, patternSet);

    if (matches.length > 1) {
      const totalMatchLength = matches.reduce((sum, m) => sum + m.length, 0);
      const cleanedText = text.replace(/\s+/g, '');
      const coverage = totalMatchLength / cleanedText.length;

      if (coverage > 0.7) {
        if (!bestResult || matches.length > bestResult.matches.length) {
          bestResult = { matches, coverage };
        }
      }
    }
  }

  return bestResult;
}

function tryCombinedPatternExtraction(text: string): string[] | null {
  const allMatches: string[] = [];
  let remaining = text;

  const sortedPatternSets = [...ALL_PATTERN_SETS].sort((a, b) => {
    const aMaxLen = Math.max(...a.values.map(v => v.length));
    const bMaxLen = Math.max(...b.values.map(v => v.length));
    return bMaxLen - aMaxLen;
  });

  for (const patternSet of sortedPatternSets) {
    const matches = findPatternMatches(remaining, patternSet);
    for (const match of matches) {
      if (!allMatches.some(m => m.toLowerCase() === match.toLowerCase())) {
        allMatches.push(match);
        const flags = patternSet.caseSensitive ? 'g' : 'gi';
        remaining = remaining.replace(new RegExp(`\\b${escapeRegex(match)}\\b`, flags), ' ');
      }
    }
  }

  if (allMatches.length > 1) {
    const totalMatchLength = allMatches.reduce((sum, m) => sum + m.length, 0);
    const cleanedText = text.replace(/\s+/g, '');
    const coverage = totalMatchLength / cleanedText.length;

    if (coverage > 0.6) {
      return allMatches;
    }
  }

  return null;
}

export function smartParseValues(rawValue: string): string[] | null {
  if (!rawValue || typeof rawValue !== 'string') return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const singlePatternResult = tryExtractAllPatterns(trimmed);
  if (singlePatternResult && singlePatternResult.matches.length > 1) {
    return singlePatternResult.matches;
  }

  const combinedResult = tryCombinedPatternExtraction(trimmed);
  if (combinedResult) {
    return combinedResult;
  }

  return null;
}

export function hasDelimiter(value: string): boolean {
  return /[,;|\n]/.test(value);
}
