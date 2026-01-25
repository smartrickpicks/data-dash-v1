import {
  ContractFailureCategory,
  ContractLoadFailureMeta,
  FailureConfidence,
} from '../types';
import { PROXY_CONFIG } from '../config/proxyConfig';

export interface ClassifyFailureInput {
  url?: string;
  errorCode?: string;
  httpStatus?: number;
  contentType?: string;
  sizeBytes?: number;
  thrownMessage?: string;
  usedProxy?: boolean;
  pdfSignatureValid?: boolean;
}

const HIDDEN_CHAR_PATTERN = /[\u200B-\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u206A-\u206F\u0000-\u001F\u007F-\u009F]/;

const CATEGORY_GUIDANCE: Record<ContractFailureCategory, string> = {
  cors_blocked: 'Browser security blocked direct access. Try "Open in New Tab" to verify the link works.',
  http_unauthorized: 'Authentication required (401). Request credentials or an updated link from the source.',
  http_forbidden: 'Access denied (403). The signed link may be expired or restricted. Request a new link.',
  http_not_found: 'File not found (404). The contract may have been moved or deleted. Verify with source.',
  http_rate_limited: 'Too many requests (429). Wait a few minutes and retry, or open in new tab.',
  http_server_error: 'Remote server error (5xx). The hosting service may be experiencing issues. Retry later.',
  http_other: 'Unexpected HTTP response. Try "Open in New Tab" to diagnose.',
  not_pdf: 'The URL does not point to a valid PDF file. Verify the link is correct.',
  file_too_large: `File exceeds ${PROXY_CONFIG.maxContractBytes / 1024 / 1024}MB limit. Use "Open in New Tab" to download locally.`,
  timeout: 'Request timed out. The server may be slow or the file very large. Retry or open in new tab.',
  network_error: 'Network connection failed. Check your internet connection and retry.',
  invalid_url: 'The contract URL is malformed or invalid. Re-copy the link carefully.',
  hidden_chars: 'Hidden/invisible characters detected in URL. Re-copy the link as plain text.',
  parse_error: 'PDF file could not be parsed. The file may be corrupted or password-protected.',
  unknown: 'An unexpected error occurred. Try "Open in New Tab" to verify the link.',
};

const CATEGORY_ORDER: ContractFailureCategory[] = [
  'http_not_found',
  'http_forbidden',
  'cors_blocked',
  'file_too_large',
  'timeout',
  'network_error',
  'http_server_error',
  'http_unauthorized',
  'http_rate_limited',
  'not_pdf',
  'invalid_url',
  'hidden_chars',
  'parse_error',
  'http_other',
  'unknown',
];

export function getCategoryOrder(): ContractFailureCategory[] {
  return [...CATEGORY_ORDER];
}

export function getGuidanceForCategory(category: ContractFailureCategory): string {
  return CATEGORY_GUIDANCE[category] || CATEGORY_GUIDANCE.unknown;
}

export function detectHiddenCharacters(url: string): boolean {
  return HIDDEN_CHAR_PATTERN.test(url);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateContractUrl(url: string): {
  valid: boolean;
  category?: ContractFailureCategory;
  confidence?: FailureConfidence;
  message?: string;
} {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      category: 'invalid_url',
      confidence: 'high',
      message: 'URL is empty or not a string',
    };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return {
      valid: false,
      category: 'invalid_url',
      confidence: 'high',
      message: 'URL is empty',
    };
  }

  if (detectHiddenCharacters(trimmed)) {
    return {
      valid: false,
      category: 'hidden_chars',
      confidence: 'high',
      message: 'URL contains hidden or control characters',
    };
  }

  if (!isValidUrl(trimmed)) {
    return {
      valid: false,
      category: 'invalid_url',
      confidence: 'high',
      message: 'URL format is invalid',
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        valid: false,
        category: 'invalid_url',
        confidence: 'high',
        message: `Unsupported protocol: ${parsed.protocol}`,
      };
    }
  } catch {
    return {
      valid: false,
      category: 'invalid_url',
      confidence: 'high',
      message: 'URL parse failed',
    };
  }

  return { valid: true };
}

function classifyByHttpStatus(status: number): {
  category: ContractFailureCategory;
  confidence: FailureConfidence;
} | null {
  if (status === 401) {
    return { category: 'http_unauthorized', confidence: 'high' };
  }
  if (status === 403) {
    return { category: 'http_forbidden', confidence: 'high' };
  }
  if (status === 404) {
    return { category: 'http_not_found', confidence: 'high' };
  }
  if (status === 429) {
    return { category: 'http_rate_limited', confidence: 'high' };
  }
  if (status >= 500 && status < 600) {
    return { category: 'http_server_error', confidence: 'high' };
  }
  if (status >= 400 && status < 500) {
    return { category: 'http_other', confidence: 'medium' };
  }
  return null;
}

function classifyByErrorCode(errorCode: string): {
  category: ContractFailureCategory;
  confidence: FailureConfidence;
} | null {
  const code = errorCode.toLowerCase();

  if (code === 'timeout') {
    return { category: 'timeout', confidence: 'high' };
  }
  if (code === 'cors_blocked') {
    return { category: 'cors_blocked', confidence: 'medium' };
  }
  if (code === 'network_error') {
    return { category: 'network_error', confidence: 'medium' };
  }
  if (code === 'not_pdf' || code === 'not_supported_type') {
    return { category: 'not_pdf', confidence: 'medium' };
  }
  if (code === 'pdf_parse_error') {
    return { category: 'parse_error', confidence: 'high' };
  }
  if (code === 'invalid_url') {
    return { category: 'invalid_url', confidence: 'high' };
  }
  if (code === 'file_too_large') {
    return { category: 'file_too_large', confidence: 'high' };
  }
  if (code === 'host_not_allowed' || code === 'blocked_private_network') {
    return { category: 'cors_blocked', confidence: 'medium' };
  }
  if (code === 'proxy_failed') {
    return { category: 'network_error', confidence: 'medium' };
  }

  return null;
}

function classifyByThrownMessage(message: string): {
  category: ContractFailureCategory;
  confidence: FailureConfidence;
} | null {
  const lower = message.toLowerCase();

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { category: 'timeout', confidence: 'medium' };
  }
  if (lower.includes('cors') || lower.includes('cross-origin')) {
    return { category: 'cors_blocked', confidence: 'medium' };
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('load failed')) {
    return { category: 'network_error', confidence: 'medium' };
  }
  if (lower.includes('parse') || lower.includes('invalid pdf') || lower.includes('corrupted')) {
    return { category: 'parse_error', confidence: 'medium' };
  }

  return null;
}

function isPdfContentType(contentType: string | undefined): boolean {
  if (!contentType) return true;
  const lower = contentType.toLowerCase();
  return (
    lower.includes('application/pdf') ||
    lower.includes('application/octet-stream') ||
    lower.includes('binary/octet-stream')
  );
}

export function classifyContractFailure(input: ClassifyFailureInput): ContractLoadFailureMeta {
  const { url, errorCode, httpStatus, contentType, sizeBytes, thrownMessage, pdfSignatureValid } = input;

  let category: ContractFailureCategory = 'unknown';
  let confidence: FailureConfidence = 'low';
  let message = 'An unexpected error occurred';

  if (url) {
    const urlValidation = validateContractUrl(url);
    if (!urlValidation.valid && urlValidation.category) {
      category = urlValidation.category;
      confidence = urlValidation.confidence || 'high';
      message = urlValidation.message || getGuidanceForCategory(category);

      return buildMeta(category, confidence, message, input);
    }
  }

  if (httpStatus !== undefined && httpStatus !== 0) {
    const httpClassification = classifyByHttpStatus(httpStatus);
    if (httpClassification) {
      category = httpClassification.category;
      confidence = httpClassification.confidence;
      message = `HTTP ${httpStatus}: ${getGuidanceForCategory(category)}`;

      return buildMeta(category, confidence, message, input);
    }
  }

  if (sizeBytes !== undefined && sizeBytes > PROXY_CONFIG.maxContractBytes) {
    category = 'file_too_large';
    confidence = 'high';
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
    message = `File size (${sizeMB}MB) exceeds limit. ${getGuidanceForCategory(category)}`;

    return buildMeta(category, confidence, message, input);
  }

  if (contentType && !isPdfContentType(contentType)) {
    category = 'not_pdf';
    confidence = 'medium';
    message = `Content-Type "${contentType}" is not PDF. ${getGuidanceForCategory(category)}`;

    return buildMeta(category, confidence, message, input);
  }

  if (pdfSignatureValid === false) {
    category = 'not_pdf';
    confidence = 'high';
    message = `File does not have valid PDF signature. ${getGuidanceForCategory(category)}`;

    return buildMeta(category, confidence, message, input);
  }

  if (errorCode) {
    const codeClassification = classifyByErrorCode(errorCode);
    if (codeClassification) {
      category = codeClassification.category;
      confidence = codeClassification.confidence;
      message = getGuidanceForCategory(category);

      return buildMeta(category, confidence, message, input);
    }
  }

  if (thrownMessage) {
    const msgClassification = classifyByThrownMessage(thrownMessage);
    if (msgClassification) {
      category = msgClassification.category;
      confidence = msgClassification.confidence;
      message = getGuidanceForCategory(category);

      return buildMeta(category, confidence, message, input);
    }
  }

  message = getGuidanceForCategory(category);
  return buildMeta(category, confidence, message, input);
}

function buildMeta(
  category: ContractFailureCategory,
  confidence: FailureConfidence,
  message: string,
  input: ClassifyFailureInput
): ContractLoadFailureMeta {
  return {
    category,
    confidence,
    message,
    httpStatus: input.httpStatus,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    url: input.url,
    detectedAt: new Date().toISOString(),
  };
}

export function buildRfiComment(meta: ContractLoadFailureMeta): string {
  const lines: string[] = [
    '[AUTO] Contract failed to load',
    `Reason: ${meta.category} (${meta.confidence} confidence)`,
  ];

  if (meta.httpStatus) {
    lines.push(`HTTP Status: ${meta.httpStatus}`);
  }

  if (meta.sizeBytes) {
    const sizeMB = (meta.sizeBytes / 1024 / 1024).toFixed(1);
    lines.push(`Size: ${sizeMB} MB`);
  }

  lines.push(`Suggestion: ${getGuidanceForCategory(meta.category)}`);

  return lines.join('\n');
}

export function getCategoryLabel(category: ContractFailureCategory): string {
  const labels: Record<ContractFailureCategory, string> = {
    cors_blocked: 'CORS Blocked',
    http_unauthorized: 'Unauthorized (401)',
    http_forbidden: 'Forbidden (403)',
    http_not_found: 'Not Found (404)',
    http_rate_limited: 'Rate Limited (429)',
    http_server_error: 'Server Error (5xx)',
    http_other: 'HTTP Error (Other)',
    not_pdf: 'Not a PDF',
    file_too_large: 'File Too Large',
    timeout: 'Timeout',
    network_error: 'Network Error',
    invalid_url: 'Invalid URL',
    hidden_chars: 'Hidden Characters',
    parse_error: 'Parse Error',
    unknown: 'Unknown',
  };

  return labels[category] || 'Unknown';
}

export function getConfidenceColor(confidence: FailureConfidence): {
  bg: string;
  text: string;
  border: string;
} {
  switch (confidence) {
    case 'high':
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
    case 'medium':
      return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' };
    case 'low':
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
  }
}

export interface UrlPreflightResult {
  url: string;
  rowIndex: number;
  sheetName: string;
  fieldName: string;
  valid: boolean;
  category?: ContractFailureCategory;
  confidence?: FailureConfidence;
  message?: string;
}

export function preflightContractUrls(
  sheets: Array<{ name: string; headers: string[]; rows: Array<Record<string, unknown>> }>
): UrlPreflightResult[] {
  const results: UrlPreflightResult[] = [];

  sheets.forEach((sheet) => {
    const contractHeader = sheet.headers[1];
    if (!contractHeader) return;

    sheet.rows.forEach((row, rowIndex) => {
      const contractValue = row[contractHeader];
      if (!contractValue || typeof contractValue !== 'string') return;

      const url = String(contractValue).trim();
      if (!url) return;

      try {
        new URL(url);
      } catch {
        return;
      }

      const validation = validateContractUrl(url);

      if (!validation.valid) {
        results.push({
          url,
          rowIndex,
          sheetName: sheet.name,
          fieldName: contractHeader,
          valid: false,
          category: validation.category,
          confidence: validation.confidence,
          message: validation.message,
        });
      }
    });
  });

  return results;
}
