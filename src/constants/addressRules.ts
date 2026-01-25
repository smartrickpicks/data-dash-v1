export interface AddressComponent {
  line: number;
  type: string;
  notes?: string;
}

export interface AddressExample {
  label: string;
  lines: string[];
  components: AddressComponent[];
}

export interface CountryAddressRules {
  country: string;
  format_examples: AddressExample[];
  format_rules?: string[];
  abbreviations?: any;
  address_elements?: any[];
}

export const COUNTRY_ADDRESS_RULES: CountryAddressRules[] = [
  {
    country: "Argentina",
    format_examples: [
      {
        label: "Street address",
        lines: ["Juana Aguirre", "Piedras No 623", "Piso 2 Dto. 4", "C1070AAM Capital Federal", "ARGENTINA"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "building_details_optional" },
          { line: 4, type: "postal_code_and_locality" },
          { line: 5, type: "country" }
        ]
      }
    ],
    format_rules: ["Print postal code (CPA) in capital letters.", "Address lines should be flush left."]
  },
  {
    country: "Australia",
    format_examples: [
      {
        label: "Simple address",
        lines: ["Mr S Tan", "200 Broadway Av", "WEST BEACH SA 5024", "AUSTRALIA"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "locality_state_postcode" },
          { line: 4, type: "country" }
        ]
      }
    ],
    format_rules: ["Include AUSTRALIA as the last line when mailing internationally."]
  },
  {
    country: "Austria",
    format_examples: [
      {
        label: "Standard",
        lines: ["R. Fellner", "Pazmaniteng 24-9", "A-1020 Vienna", "AUSTRIA"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "countrycode_postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Belgium",
    format_examples: [
      {
        label: "Standard",
        lines: ["M. André Dupont", "Rue du Cornet 6", "B-4800 VERVIERS", "BELGIUM"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "countrycode_postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Canada",
    format_examples: [
      {
        label: "Standard",
        lines: ["JOHN JONES", "MARKETING DEPARTMENT", "10-123 1/2 MAIN STREET NW", "MONTREAL QC H3Z 2Y7", "CANADA"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "department_optional" },
          { line: 3, type: "street_address" },
          { line: 4, type: "city_province_postalcode" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Czech Republic",
    format_examples: [
      {
        label: "Standard",
        lines: ["Pan Martin Parma", "Prujezdna 320/62", "100 00 PRAHA 10", "CZECH REP."],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city_postoffice_id" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Denmark",
    format_examples: [
      {
        label: "Standard",
        lines: ["Hr. Niels Henriksen", "Kastanievej 15", "DK-8660 SKANDERBORG", "DENMARK"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "countrycode_postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Finland",
    format_examples: [
      {
        label: "Standard",
        lines: ["Ms. Aulikki Laasko", "Vesakkotic 1399", "FI-00630 HELSINKI", "FINLAND"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "countrycode_postcode_postal_district" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "France",
    format_examples: [
      {
        label: "Standard",
        lines: ["Madame Duval", "27 RUE PASTEUR", "14390 CABOURG", "FRANCE"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Germany",
    format_examples: [
      {
        label: "Standard",
        lines: ["Herrn", "Eberhard Wellhausen", "Wittekindshof", "Schulstrasse 4", "32547 Bad Oyenhausen", "GERMANY"],
        components: [
          { line: 1, type: "honorific_optional" },
          { line: 2, type: "recipient" },
          { line: 3, type: "organization_or_institution_optional" },
          { line: 4, type: "street_address" },
          { line: 5, type: "postcode_city" },
          { line: 6, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Hong Kong",
    format_examples: [
      {
        label: "Standard",
        lines: ["Mr. CHAN Kwok-kwong", "Flat 25, 12/F, Acacia Building", "150 Kennedy Road", "WAN CHAI", "HONG KONG"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "flat_floor_building" },
          { line: 3, type: "street_address" },
          { line: 4, type: "district" },
          { line: 5, type: "destination_country_or_region" }
        ]
      }
    ],
    format_rules: ["Hong Kong has no postcodes.", "District/town should be in CAPITAL LETTERS."]
  },
  {
    country: "Iceland",
    format_examples: [
      {
        label: "Standard",
        lines: ["Gudmundur Jonasson Travel", "Borgartun 34", "105 REYKJAVÍK", "ICELAND"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "India",
    format_examples: [
      {
        label: "Standard",
        lines: ["Mr. I. K. Taneja", "Flat No. 100", "Triveni Apartments", "Pitam Pura", "NEW DELHI 110034", "INDIA"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "flat_number" },
          { line: 3, type: "building_name" },
          { line: 4, type: "locality" },
          { line: 5, type: "city_and_postal_code" },
          { line: 6, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Indonesia",
    format_examples: [
      {
        label: "Standard",
        lines: ["Firda Beka", "Jl. Perhubungan IV/25", "Pondok Betung", "Tangerang 15224", "Indonesia"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "locality" },
          { line: 4, type: "city_postcode" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Ireland",
    format_examples: [
      {
        label: "Standard",
        lines: ["An Post Business Desk", "GPO", "O'Connell Street Lower", "Dublin 1", "D01 F5P2", "IRELAND"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "organization" },
          { line: 3, type: "street_address" },
          { line: 4, type: "city_zone" },
          { line: 5, type: "eircode_optional" },
          { line: 6, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Israel",
    format_examples: [
      {
        label: "Standard",
        lines: ["M. Ploni Almoni", "16, Rue Yafo", "94142 JERUSALEM", "ISRAEL"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Italy",
    format_examples: [
      {
        label: "Standard",
        lines: ["SIG MARIO ROSSI", "VIALE EUROPA 22", "00144 ROMA RM", "ITALY"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_name_plus_house_number" },
          { line: 3, type: "cap_city_province_code" },
          { line: 4, type: "country" }
        ]
      }
    ],
    format_rules: [
      "House/building number comes after the street name.",
      "CAP (postal code) is required.",
      "Province abbreviation is two letters and appears after the locality.",
      "ALL CAPS recommended, minimal punctuation."
    ]
  },
  {
    country: "Luxembourg",
    format_examples: [
      {
        label: "Standard",
        lines: ["M. Andrée TROMMER", "BP 5019", "L-1050 Luxembourg", "LUXEMBOURG"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "po_box" },
          { line: 3, type: "countrycode_postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Malaysia",
    format_examples: [
      {
        label: "Standard",
        lines: ["Ahmad Bin Ghazali", "75 Kg Sg Ramal Luar", "43000 Kajang", "Selangor", "Malaysia"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "state" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Mexico",
    format_examples: [
      {
        label: "Standard",
        lines: ["Sra. Otilia Ramos Perez", "Urión 30", "Col. Atlatilco", "02860 MEXICO, D.F.", "MEXICO"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "neighborhood" },
          { line: 4, type: "postcode_city_state" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Netherlands",
    format_examples: [
      {
        label: "Standard",
        lines: ["Koninklijke TNT Post BV", "Prinses Beatrixlaan 23", "2595 AK 'S-Gravenhage", "NETHERLANDS"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "New Zealand",
    format_examples: [
      {
        label: "Standard",
        lines: ["Mrs Brown", "Flat 2", "173 Park Road", "Johnsonville", "Wellington 6004", "NEW ZEALAND"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "unit_optional" },
          { line: 3, type: "street_address" },
          { line: 4, type: "suburb" },
          { line: 5, type: "city_postcode" },
          { line: 6, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Oman",
    format_examples: [
      {
        label: "Standard",
        lines: ["Mr Ahmed Al-Ballushi", "BP 15", "133", "AL-KHOER", "OMAN"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "po_box" },
          { line: 3, type: "postcode" },
          { line: 4, type: "city" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Pakistan",
    format_examples: [
      {
        label: "Standard",
        lines: ["Mr. Nasratullah Khan", "House No 17-B", "Street No 30", "Sector F-7/1", "ISLAMABAD-44000", "PAKISTAN"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "house_number" },
          { line: 3, type: "street_number" },
          { line: 4, type: "sector" },
          { line: 5, type: "city_postcode" },
          { line: 6, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Poland",
    format_examples: [
      {
        label: "Standard",
        lines: ["Mme Anna Kowalska", "Ul. Bosmanska 1", "81-116 GDYNIA", "POLAND"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Portugal",
    format_examples: [
      {
        label: "Standard",
        lines: ["Sr. Antonio Costa", "Rua do Farol 2", "AZOIA", "2740-029 COLARES", "PORTUGAL"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "locality_optional" },
          { line: 4, type: "postcode_city" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Russia",
    format_examples: [
      {
        label: "Standard",
        lines: ["Ivanov Alexander Ivanovitch", "ul. Lesnaya d. 5, kv. 176", "g. MOSKVA", "123456", "RUSSIAN FEDERATION"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "city" },
          { line: 4, type: "postcode" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Singapore",
    format_examples: [
      {
        label: "Standard",
        lines: ["Singapore Post Pte Ltd", "10 Eunos Road 8", "#05-33 Singapore Post Centre", "Singapore 408600", "REPUBLIC OF SINGAPORE"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "unit_building" },
          { line: 4, type: "city_postcode" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "South Africa",
    format_examples: [
      {
        label: "Standard",
        lines: ["Customer Services", "497 Jacob Mare Street", "Pretoria", "0001", "South Africa"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "city" },
          { line: 4, type: "postcode" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "South Korea",
    format_examples: [
      {
        label: "Standard",
        lines: ["Ministry of Information", "116 Shinmullo 1-ga", "Chongno-gu", "SEOUL 110-700", "REP OF KOREA"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "district" },
          { line: 4, type: "city_postcode" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Spain",
    format_examples: [
      {
        label: "Standard",
        lines: ["Sr. D. Alvaro Blanco Ruiz", "Luna, 10 - 3o", "28300 ARANJUEZ (MADRID)", "SPAIN"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address_floor" },
          { line: 3, type: "postcode_city_province" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Sweden",
    format_examples: [
      {
        label: "Standard",
        lines: ["Martin Rebas", "Gyllenkrooksgatan 1", "412 84 GÖTEBORG", "SWEDEN"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Switzerland",
    format_examples: [
      {
        label: "Standard",
        lines: ["Herr", "Hans Katze", "Tastentanzenstrasse 5/16", "1234 Zuerich", "SWITZERLAND"],
        components: [
          { line: 1, type: "honorific_optional" },
          { line: 2, type: "recipient" },
          { line: 3, type: "street_address" },
          { line: 4, type: "postcode_city" },
          { line: 5, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Taiwan",
    format_examples: [
      {
        label: "Standard",
        lines: ["The Philatelic Department", "55 Chin Shan South Road Sec. 2", "Taipei, Taiwan 10603", "TAIWAN, R. O. C."],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "city_postcode" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "Ukraine",
    format_examples: [
      {
        label: "Standard",
        lines: ["Ivan Kottovich Kuluchovskiy", "ul. Astronomicheskaya 22, kv. 33", "Kharkov 12345", "UKRAINE"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "city_postcode" },
          { line: 4, type: "country" }
        ]
      }
    ]
  },
  {
    country: "United Kingdom",
    format_examples: [
      {
        label: "Standard",
        lines: ["Mr. Walter C. Brown", "49 Featherstone Street", "LONDON", "EC1Y 8SY", "UNITED KINGDOM"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "post_town" },
          { line: 4, type: "postcode" },
          { line: 5, type: "country" }
        ]
      }
    ],
    format_rules: ["Post Town is typically in CAPITALS.", "County is generally not required if Post Town and Postcode are present."]
  },
  {
    country: "United States",
    format_examples: [
      {
        label: "Standard",
        lines: ["JOHN DOE", "COMPANY NAME", "123 MAIN STREET", "CITY STATE 12345", "USA"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "organization_optional" },
          { line: 3, type: "street_address" },
          { line: 4, type: "city_state_zip" },
          { line: 5, type: "country" }
        ]
      }
    ],
    format_rules: ["USPS generally prefers all caps and minimal punctuation for machine readability."]
  },
  {
    country: "Uruguay",
    format_examples: [
      {
        label: "Standard",
        lines: ["FELIX GATO", "AV DE LOS SUSTANTIVOS 22", "12345 MONTEVIDEO", "URUGUAY"],
        components: [
          { line: 1, type: "recipient" },
          { line: 2, type: "street_address" },
          { line: 3, type: "postcode_city" },
          { line: 4, type: "country" }
        ]
      }
    ]
  }
];

export const COUNTRY_NAME_VARIANTS: { [key: string]: string } = {
  'usa': 'United States',
  'us': 'United States',
  'united states': 'United States',
  'united states of america': 'United States',
  'uk': 'United Kingdom',
  'gb': 'United Kingdom',
  'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  'scotland': 'United Kingdom',
  'wales': 'United Kingdom',
  'czech rep.': 'Czech Republic',
  'czech': 'Czech Republic',
  'rep of korea': 'South Korea',
  'korea': 'South Korea',
  'republic of singapore': 'Singapore',
  'russian federation': 'Russia',
  'taiwan, r. o. c.': 'Taiwan',
  'italia': 'Italy',
  'italy': 'Italy',
  'it': 'Italy',
};
