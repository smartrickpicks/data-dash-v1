import { CountryAddressRules } from '../constants/addressRules';

export interface AddressComponents {
  streetName?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  state?: string;
  district?: string;
  unit?: string;
  raw: string;
}

export interface ComponentExtractionResult {
  components: AddressComponents;
  confidence: 'high' | 'medium' | 'low';
  missingRequired: string[];
  complete: boolean;
}

const ITALIAN_STREET_PREFIXES = [
  'via', 'viale', 'corso', 'piazza', 'piazzale', 'largo', 'vicolo',
  'strada', 'contrada', 'traversa', 'salita', 'discesa', 'vico'
];

const ITALIAN_PROVINCES = [
  'AG', 'AL', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AT', 'AV', 'BA', 'BG', 'BI', 'BL', 'BN', 'BO', 'BR', 'BS', 'BT', 'BZ',
  'CA', 'CB', 'CE', 'CH', 'CI', 'CL', 'CN', 'CO', 'CR', 'CS', 'CT', 'CZ',
  'EN', 'FC', 'FE', 'FG', 'FI', 'FM', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'KR',
  'LC', 'LE', 'LI', 'LO', 'LT', 'LU', 'MB', 'MC', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT',
  'NA', 'NO', 'NU', 'OG', 'OR', 'OT', 'PA', 'PC', 'PD', 'PE', 'PG', 'PI', 'PN', 'PO', 'PR', 'PT', 'PU', 'PV', 'PZ',
  'RA', 'RC', 'RE', 'RG', 'RI', 'RM', 'RN', 'RO', 'SA', 'SI', 'SO', 'SP', 'SR', 'SS', 'SU', 'SV',
  'TA', 'TE', 'TN', 'TO', 'TP', 'TR', 'TS', 'TV', 'UD', 'VA', 'VB', 'VC', 'VE', 'VI', 'VR', 'VT', 'VV'
];

const ITALIAN_PROVINCE_NAMES: { [key: string]: string } = {
  'agrigento': 'AG', 'alessandria': 'AL', 'ancona': 'AN', 'aosta': 'AO', 'ascoli piceno': 'AP',
  'aquila': 'AQ', "l'aquila": 'AQ', 'arezzo': 'AR', 'asti': 'AT', 'avellino': 'AV',
  'bari': 'BA', 'bergamo': 'BG', 'biella': 'BI', 'belluno': 'BL', 'benevento': 'BN',
  'bologna': 'BO', 'brindisi': 'BR', 'brescia': 'BS', 'barletta-andria-trani': 'BT', 'bolzano': 'BZ',
  'cagliari': 'CA', 'campobasso': 'CB', 'caserta': 'CE', 'chieti': 'CH', 'carbonia-iglesias': 'CI',
  'caltanissetta': 'CL', 'cuneo': 'CN', 'como': 'CO', 'cremona': 'CR', 'cosenza': 'CS',
  'catania': 'CT', 'catanzaro': 'CZ', 'enna': 'EN', 'forli-cesena': 'FC', 'ferrara': 'FE',
  'foggia': 'FG', 'firenze': 'FI', 'florence': 'FI', 'fermo': 'FM', 'frosinone': 'FR',
  'genova': 'GE', 'genoa': 'GE', 'gorizia': 'GO', 'grosseto': 'GR', 'imperia': 'IM',
  'isernia': 'IS', 'crotone': 'KR', 'lecco': 'LC', 'lecce': 'LE', 'livorno': 'LI',
  'lodi': 'LO', 'latina': 'LT', 'lucca': 'LU', 'monza': 'MB', 'monza e brianza': 'MB',
  'macerata': 'MC', 'messina': 'ME', 'milano': 'MI', 'milan': 'MI', 'mantova': 'MN',
  'modena': 'MO', 'massa-carrara': 'MS', 'matera': 'MT', 'napoli': 'NA', 'naples': 'NA',
  'novara': 'NO', 'nuoro': 'NU', 'ogliastra': 'OG', 'oristano': 'OR', 'olbia-tempio': 'OT',
  'palermo': 'PA', 'piacenza': 'PC', 'padova': 'PD', 'padua': 'PD', 'pescara': 'PE',
  'perugia': 'PG', 'pisa': 'PI', 'pordenone': 'PN', 'prato': 'PO', 'parma': 'PR',
  'pistoia': 'PT', 'pesaro e urbino': 'PU', 'pesaro': 'PU', 'pavia': 'PV', 'potenza': 'PZ',
  'ravenna': 'RA', 'reggio calabria': 'RC', 'reggio emilia': 'RE', 'ragusa': 'RG',
  'rieti': 'RI', 'roma': 'RM', 'rome': 'RM', 'rimini': 'RN', 'rovigo': 'RO',
  'salerno': 'SA', 'siena': 'SI', 'sondrio': 'SO', 'la spezia': 'SP', 'spezia': 'SP',
  'siracusa': 'SR', 'sassari': 'SS', 'sud sardegna': 'SU', 'savona': 'SV',
  'taranto': 'TA', 'teramo': 'TE', 'trento': 'TN', 'torino': 'TO', 'turin': 'TO',
  'trapani': 'TP', 'terni': 'TR', 'trieste': 'TS', 'treviso': 'TV',
  'udine': 'UD', 'varese': 'VA', 'verbano-cusio-ossola': 'VB', 'vercelli': 'VC',
  'venezia': 'VE', 'venice': 'VE', 'vicenza': 'VI', 'verona': 'VR', 'viterbo': 'VT', 'vibo valentia': 'VV'
};

const ITALIAN_COUNTRY_NAMES = ['italy', 'italia', 'it'];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

export function extractItalianAddressComponents(address: string): ComponentExtractionResult {
  const raw = address.trim();
  const components: AddressComponents = { raw };

  const segments = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);

  let postalCode: string | undefined;
  let province: string | undefined;
  let city: string | undefined;
  let streetName: string | undefined;
  let houseNumber: string | undefined;

  const lastSegment = segments[segments.length - 1]?.toLowerCase();
  const hasCountrySuffix = lastSegment && ITALIAN_COUNTRY_NAMES.includes(lastSegment);
  const addressSegments = hasCountrySuffix ? segments.slice(0, -1) : segments;

  for (let i = addressSegments.length - 1; i >= 0; i--) {
    const segment = addressSegments[i];
    const upperSegment = segment.toUpperCase();
    const lowerSegment = segment.toLowerCase();

    if (ITALIAN_PROVINCE_NAMES[lowerSegment]) {
      province = ITALIAN_PROVINCE_NAMES[lowerSegment];
      continue;
    }

    if (ITALIAN_PROVINCES.includes(upperSegment) && upperSegment.length === 2) {
      province = upperSegment;
      continue;
    }
  }

  for (const segment of addressSegments) {
    const tokens = segment.split(/\s+/);
    for (const token of tokens) {
      if (/^\d{5}$/.test(token)) {
        postalCode = token;
        break;
      }
    }
    if (postalCode) break;
  }

  for (let i = 0; i < addressSegments.length; i++) {
    const segment = addressSegments[i];
    const lowerSegment = segment.toLowerCase();
    const tokens = segment.split(/\s+/);

    const hasStreetPrefix = tokens.some(t => ITALIAN_STREET_PREFIXES.includes(t.toLowerCase()));

    if (hasStreetPrefix) {
      const streetTokens: string[] = [];
      let foundNumber = false;

      for (const token of tokens) {
        if (/^\d+[A-Za-z]?$/.test(token) && !foundNumber) {
          if (/^\d{5}$/.test(token)) {
            continue;
          }
          houseNumber = token.toUpperCase();
          foundNumber = true;
          continue;
        }
        if (/^\d{5}$/.test(token)) {
          continue;
        }
        streetTokens.push(token);
      }

      streetName = streetTokens.join(' ');
      continue;
    }

    if (/^\d+[A-Za-z]?$/.test(segment) && !houseNumber && !/^\d{5}$/.test(segment)) {
      houseNumber = segment.toUpperCase();
      continue;
    }
  }

  for (let i = 0; i < addressSegments.length; i++) {
    const segment = addressSegments[i];
    const lowerSegment = segment.toLowerCase();
    const tokens = segment.split(/\s+/);

    const hasStreetPrefix = tokens.some(t => ITALIAN_STREET_PREFIXES.includes(t.toLowerCase()));
    const isProvinceName = ITALIAN_PROVINCE_NAMES[lowerSegment] ||
                          (ITALIAN_PROVINCES.includes(segment.toUpperCase()) && segment.length === 2);
    const isJustNumber = /^\d+[A-Za-z]?$/.test(segment);

    if (!hasStreetPrefix && !isProvinceName && !isJustNumber) {
      const cityTokens: string[] = [];
      let foundPostal = false;

      for (const token of tokens) {
        if (/^\d{5}$/.test(token)) {
          foundPostal = true;
          continue;
        }
        if (ITALIAN_PROVINCES.includes(token.toUpperCase()) && token.length === 2) {
          province = token.toUpperCase();
          continue;
        }
        cityTokens.push(token);
      }

      if (cityTokens.length > 0 && !city) {
        const potentialCity = cityTokens.join(' ');
        if (!ITALIAN_PROVINCE_NAMES[potentialCity.toLowerCase()]) {
          city = potentialCity;
        }
      }
    }
  }

  components.streetName = streetName;
  components.houseNumber = houseNumber;
  components.postalCode = postalCode;
  components.city = city;
  components.province = province;

  const missingRequired: string[] = [];
  if (!streetName) missingRequired.push('Street name');
  if (!postalCode) missingRequired.push('Postal code (CAP)');
  if (!city) missingRequired.push('City');
  if (!province) missingRequired.push('Province code');

  const complete = missingRequired.length === 0;
  const confidence = complete ? 'high' : (missingRequired.length <= 2 ? 'medium' : 'low');

  return {
    components,
    confidence,
    missingRequired,
    complete,
  };
}

export function extractUSAddressComponents(address: string): ComponentExtractionResult {
  const raw = address.trim();
  const components: AddressComponents = { raw };
  const tokens = raw.split(/[,\s]+/).filter(t => t.length > 0);
  const upperTokens = tokens.map(t => t.toUpperCase());

  let postalCode: string | undefined;
  let state: string | undefined;
  let city: string | undefined;
  let streetName: string | undefined;
  let houseNumber: string | undefined;

  for (let i = 0; i < upperTokens.length; i++) {
    const token = upperTokens[i];

    if (/^\d{5}(-\d{4})?$/.test(token)) {
      postalCode = token;
      if (i > 0 && US_STATES.includes(upperTokens[i - 1])) {
        state = upperTokens[i - 1];
      }
      continue;
    }

    if (US_STATES.includes(token) && token.length === 2) {
      state = token;
      continue;
    }

    if (i === 0 && /^\d+[A-Z]?$/.test(token)) {
      houseNumber = token;
      continue;
    }
  }

  if (houseNumber && tokens.length > 1) {
    const streetTokens: string[] = [];
    for (let i = 1; i < tokens.length; i++) {
      const upperToken = upperTokens[i];

      if (/^\d{5}(-\d{4})?$/.test(upperToken)) break;
      if (US_STATES.includes(upperToken)) break;

      streetTokens.push(tokens[i]);
    }
    streetName = streetTokens.join(' ');
  }

  if (state && postalCode) {
    const cityTokens: string[] = [];
    let collectCity = false;

    for (let i = 0; i < tokens.length; i++) {
      const upperToken = upperTokens[i];

      if (streetName && tokens.slice(0, i + 1).join(' ').toLowerCase().includes(streetName.toLowerCase())) {
        collectCity = true;
        continue;
      }

      if (collectCity && upperToken !== state && !postalCode?.includes(upperToken)) {
        if (!US_STATES.includes(upperToken)) {
          cityTokens.push(tokens[i]);
        }
      }

      if (upperToken === state) break;
    }

    if (cityTokens.length > 0) {
      city = cityTokens.join(' ');
    }
  }

  components.streetName = streetName;
  components.houseNumber = houseNumber;
  components.postalCode = postalCode;
  components.city = city;
  components.state = state;

  const missingRequired: string[] = [];
  if (!streetName) missingRequired.push('Street name');
  if (!city) missingRequired.push('City');
  if (!state) missingRequired.push('State');
  if (!postalCode) missingRequired.push('ZIP code');

  const complete = missingRequired.length === 0;
  const confidence = complete ? 'high' : (missingRequired.length <= 2 ? 'medium' : 'low');

  return {
    components,
    confidence,
    missingRequired,
    complete,
  };
}

export function reconstructItalianAddress(extraction: ComponentExtractionResult): string | null {
  const { streetName, houseNumber, postalCode, city, province } = extraction.components;

  const parts: string[] = [];

  if (streetName && houseNumber) {
    parts.push(`${streetName.toUpperCase()} ${houseNumber}`);
  } else if (streetName) {
    parts.push(streetName.toUpperCase());
  }

  if (postalCode && city && province) {
    parts.push(`${postalCode} ${city.toUpperCase()} ${province}`);
  } else if (city && province) {
    parts.push(`${city.toUpperCase()} ${province}`);
  } else if (postalCode && city) {
    parts.push(`${postalCode} ${city.toUpperCase()}`);
  } else if (city) {
    parts.push(city.toUpperCase());
  }

  if (parts.length > 0) {
    parts.push('ITALY');
    return parts.join(', ');
  }

  return null;
}

export function reconstructUSAddress(extraction: ComponentExtractionResult): string | null {
  if (!extraction.complete) {
    return null;
  }

  const { houseNumber, streetName, city, state, postalCode } = extraction.components;

  const parts: string[] = [];

  if (houseNumber && streetName) {
    parts.push(`${houseNumber} ${streetName.toUpperCase()}`);
  } else if (streetName) {
    parts.push(streetName.toUpperCase());
  }

  if (city && state && postalCode) {
    parts.push(`${city.toUpperCase()} ${state} ${postalCode}`);
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

export function extractAddressComponents(
  address: string,
  country: string
): ComponentExtractionResult {
  switch (country) {
    case 'Italy':
      return extractItalianAddressComponents(address);
    case 'United States':
      return extractUSAddressComponents(address);
    default:
      return {
        components: { raw: address },
        confidence: 'low',
        missingRequired: [],
        complete: false,
      };
  }
}

export function reconstructAddress(
  extraction: ComponentExtractionResult,
  country: string
): string | null {
  switch (country) {
    case 'Italy':
      return reconstructItalianAddress(extraction);
    case 'United States':
      return reconstructUSAddress(extraction);
    default:
      return null;
  }
}
