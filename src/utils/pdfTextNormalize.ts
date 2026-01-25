export function normalizeForMatch(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

export function normalizeAddressForMatch(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[,.\-#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeGibberishRatio(text: string): number {
  if (!text || text.length === 0) return 0;

  const replacementChar = '\uFFFD';
  const nonPrintablePattern = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

  let count = 0;
  for (const char of text) {
    if (char === replacementChar) {
      count++;
    }
  }
  count += (text.match(nonPrintablePattern) || []).length;

  return count / Math.max(1, text.length);
}

export function isMatchableValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const normalized = normalizeForMatch(value);
  return normalized.length >= 4;
}

export function textContainsValue(extractedText: string, value: string): boolean {
  if (!extractedText || !value) return false;

  const normalizedText = normalizeForMatch(extractedText);
  const normalizedValue = normalizeForMatch(value);

  if (normalizedValue.length < 4) return false;

  return normalizedText.includes(normalizedValue);
}

export function textContainsAddress(extractedText: string, address: string): boolean {
  if (!extractedText || !address) return false;

  const normalizedText = normalizeAddressForMatch(extractedText);
  const normalizedAddress = normalizeAddressForMatch(address);

  if (normalizedAddress.length < 4) return false;

  return normalizedText.includes(normalizedAddress);
}
