import { COUNTRY_ADDRESS_RULES, COUNTRY_NAME_VARIANTS, CountryAddressRules } from '../constants/addressRules';
import { RowData, ModificationHistory, ModificationMetadata } from '../types';
import { extractAddressComponents, reconstructAddress } from './addressComponentParser';

const ADDRESS_FIELD_KEYWORDS = [
  'address', 'street', 'city', 'state', 'province', 'postal', 'zip', 'postcode',
  'country', 'region', 'district', 'locality', 'town', 'village', 'building',
  'flat', 'floor', 'unit', 'suite', 'apt', 'apartment', 'house'
];

const COUNTRY_FIELD_KEYWORDS = ['country', 'nation', 'nationality', 'country_code', 'countrycode'];

export interface AddressFields {
  countryField?: string;
  addressFields: string[];
  fullAddressField?: string;
  streetField?: string;
  cityField?: string;
  stateField?: string;
  postalCodeField?: string;
}

export function detectAddressFields(headers: string[]): AddressFields {
  const result: AddressFields = {
    addressFields: [],
  };

  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, '');

    for (const keyword of COUNTRY_FIELD_KEYWORDS) {
      const normalizedKeyword = keyword.replace(/[_\s-]/g, '');
      if (normalizedHeader.includes(normalizedKeyword)) {
        result.countryField = header;
        break;
      }
    }

    for (const keyword of ADDRESS_FIELD_KEYWORDS) {
      const normalizedKeyword = keyword.replace(/[_\s-]/g, '');
      if (normalizedHeader.includes(normalizedKeyword)) {
        if (!result.addressFields.includes(header)) {
          result.addressFields.push(header);
        }

        if (normalizedHeader.includes('address') && !normalizedHeader.includes('email')) {
          result.fullAddressField = header;
        }
        if (normalizedHeader.includes('street') || normalizedHeader.includes('road')) {
          result.streetField = header;
        }
        if (normalizedHeader.includes('city') || normalizedHeader.includes('town')) {
          result.cityField = header;
        }
        if (normalizedHeader.includes('state') || normalizedHeader.includes('province') || normalizedHeader.includes('region')) {
          result.stateField = header;
        }
        if (normalizedHeader.includes('postal') || normalizedHeader.includes('zip') || normalizedHeader.includes('postcode')) {
          result.postalCodeField = header;
        }
        break;
      }
    }
  });

  return result;
}

export function detectCountry(row: RowData, countryField?: string): string | null {
  let countryValue = '';

  if (countryField && row[countryField]) {
    countryValue = String(row[countryField]).trim();
  } else {
    for (const key in row) {
      const normalizedKey = key.toLowerCase().replace(/[_\s-]/g, '');
      if (normalizedKey.includes('country')) {
        countryValue = String(row[key]).trim();
        break;
      }
    }
  }

  if (!countryValue) return null;

  const normalizedCountry = countryValue.toLowerCase().trim();

  if (COUNTRY_NAME_VARIANTS[normalizedCountry]) {
    return COUNTRY_NAME_VARIANTS[normalizedCountry];
  }

  for (const rule of COUNTRY_ADDRESS_RULES) {
    if (rule.country.toLowerCase() === normalizedCountry) {
      return rule.country;
    }
  }

  return null;
}

export function getCountryRules(country: string): CountryAddressRules | null {
  return COUNTRY_ADDRESS_RULES.find(rule => rule.country === country) || null;
}

export function capitalizeAddress(address: string): string {
  if (!address) return address;

  const words = address.split(/\s+/);
  return words.map(word => {
    if (!word) return word;

    if (/^\d/.test(word)) {
      return word;
    }

    if (word.length <= 3 && /^[A-Z]+$/.test(word)) {
      return word.toUpperCase();
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export interface NormalizeAddressFieldResult {
  value: string;
  wasReconstructed: boolean;
  incompleteReason?: string;
  missingComponents?: string[];
}

export function normalizeAddressField(
  value: string | number | boolean | null,
  country: string,
  fieldType: 'street' | 'city' | 'state' | 'postal' | 'full' | 'other'
): NormalizeAddressFieldResult {
  if (value === null || value === undefined || value === '') {
    return { value: '', wasReconstructed: false };
  }

  let stringValue = String(value).trim();
  if (!stringValue) {
    return { value: '', wasReconstructed: false };
  }

  const rules = getCountryRules(country);

  if (fieldType === 'full' && (country === 'Italy' || country === 'United States')) {
    const extraction = extractAddressComponents(stringValue, country);
    const reconstructed = reconstructAddress(extraction, country);

    if (extraction.complete) {
      if (reconstructed && reconstructed !== stringValue.toUpperCase()) {
        return {
          value: reconstructed,
          wasReconstructed: true
        };
      } else {
        return {
          value: stringValue.toUpperCase(),
          wasReconstructed: false
        };
      }
    } else {
      const reason = `Missing required components: ${extraction.missingRequired.join(', ')}`;
      if (reconstructed && reconstructed !== stringValue.toUpperCase()) {
        return {
          value: reconstructed,
          wasReconstructed: true,
          incompleteReason: reason,
          missingComponents: extraction.missingRequired,
        };
      }
      return {
        value: stringValue.toUpperCase(),
        wasReconstructed: false,
        incompleteReason: reason,
        missingComponents: extraction.missingRequired,
      };
    }
  }

  if (!rules) {
    return { value: capitalizeAddress(stringValue), wasReconstructed: false };
  }

  let normalizedValue: string;
  switch (fieldType) {
    case 'city':
    case 'state':
      normalizedValue = stringValue.toUpperCase();
      break;

    case 'postal':
      normalizedValue = stringValue.toUpperCase().replace(/\s+/g, ' ');
      break;

    case 'street':
      if (country === 'Italy') {
        normalizedValue = stringValue.toUpperCase();
      } else {
        normalizedValue = capitalizeAddress(stringValue);
      }
      break;

    case 'full':
      if (country === 'Italy' || country === 'United States') {
        normalizedValue = stringValue.toUpperCase();
      } else {
        normalizedValue = capitalizeAddress(stringValue);
      }
      break;

    default:
      normalizedValue = capitalizeAddress(stringValue);
  }

  return { value: normalizedValue, wasReconstructed: false };
}

export interface NormalizationResult {
  normalizedRow: RowData;
  modifications: { [fieldName: string]: ModificationMetadata };
}

export function normalizeRowAddresses(
  row: RowData,
  addressFields: AddressFields,
  sheetName: string
): NormalizationResult {
  const normalizedRow = { ...row };
  const modifications: { [fieldName: string]: ModificationMetadata } = {};

  const country = detectCountry(row, addressFields.countryField);

  if (!country) {
    return { normalizedRow, modifications };
  }

  const rules = getCountryRules(country);
  if (!rules && country !== 'United States') {
    return { normalizedRow, modifications };
  }

  addressFields.addressFields.forEach(fieldName => {
    const originalValue = row[fieldName];
    if (!originalValue || String(originalValue).trim() === '') return;

    let fieldType: 'street' | 'city' | 'state' | 'postal' | 'full' | 'other' = 'other';

    if (fieldName === addressFields.fullAddressField) {
      fieldType = 'full';
    } else if (fieldName === addressFields.streetField) {
      fieldType = 'street';
    } else if (fieldName === addressFields.cityField) {
      fieldType = 'city';
    } else if (fieldName === addressFields.stateField) {
      fieldType = 'state';
    } else if (fieldName === addressFields.postalCodeField) {
      fieldType = 'postal';
    }

    const result = normalizeAddressField(originalValue, country, fieldType);

    if (result.incompleteReason && result.missingComponents) {
      modifications[fieldName] = {
        originalValue,
        newValue: result.value,
        timestamp: new Date().toISOString(),
        modificationType: 'incomplete_address',
        reason: result.incompleteReason,
      };
      normalizedRow[fieldName] = result.value;
    } else if (result.wasReconstructed) {
      normalizedRow[fieldName] = result.value;
      modifications[fieldName] = {
        originalValue,
        newValue: result.value,
        timestamp: new Date().toISOString(),
        modificationType: 'address_standardized',
        reason: `Address components rearranged to match ${country} postal format`,
      };
    } else if (result.value !== String(originalValue).trim()) {
      normalizedRow[fieldName] = result.value;
      modifications[fieldName] = {
        originalValue,
        newValue: result.value,
        timestamp: new Date().toISOString(),
        modificationType: 'address_standardized',
        reason: `Address capitalization corrected for ${country} postal standards`,
      };
    }
  });

  return { normalizedRow, modifications };
}

export function normalizeDatasetAddresses(
  sheets: { name: string; headers: string[]; rows: RowData[] }[]
): {
  normalizedSheets: { name: string; headers: string[]; rows: RowData[] }[];
  modificationHistory: ModificationHistory;
} {
  const normalizedSheets = sheets.map(sheet => ({
    ...sheet,
    rows: [...sheet.rows],
  }));

  const modificationHistory: ModificationHistory = {};

  normalizedSheets.forEach((sheet, sheetIndex) => {
    const addressFields = detectAddressFields(sheet.headers);

    if (addressFields.addressFields.length === 0) {
      return;
    }

    sheet.rows.forEach((row, rowIndex) => {
      const { normalizedRow, modifications } = normalizeRowAddresses(
        row,
        addressFields,
        sheet.name
      );

      if (Object.keys(modifications).length > 0) {
        if (!modificationHistory[sheet.name]) {
          modificationHistory[sheet.name] = {};
        }
        if (!modificationHistory[sheet.name][rowIndex]) {
          modificationHistory[sheet.name][rowIndex] = {};
        }

        Object.keys(modifications).forEach(fieldName => {
          modificationHistory[sheet.name][rowIndex][fieldName] = modifications[fieldName];
        });

        normalizedSheets[sheetIndex].rows[rowIndex] = normalizedRow;
      }
    });
  });

  return { normalizedSheets, modificationHistory };
}
