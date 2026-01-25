import { useState, useEffect, useCallback, useRef } from 'react';
import { contractCache } from '../utils/contractCache';
import { ContractErrorCode, ContractLoadFailureMeta } from '../types';
import { PROXY_CONFIG, isProxyEnabledForHost, buildProxyUrl } from '../config/proxyConfig';
import { classifyContractFailure } from '../utils/contractFailureClassifier';

const FETCH_TIMEOUT_MS = 30000;

export interface PdfFetchError {
  code: ContractErrorCode;
  message: string;
  fileSize?: number;
  httpStatus?: number;
  usedProxy?: boolean;
  contentType?: string;
  failureMeta?: ContractLoadFailureMeta;
}

export interface PdfFetchState {
  pdfUrl: string | null;
  isLoading: boolean;
  error: PdfFetchError | null;
  isCached: boolean;
  fileSize: number | null;
  contentType: string | null;
  fetchStatus: 'idle' | 'fetching' | 'proxy_retry' | 'success' | 'error';
}

export interface UsePdfFetchResult extends PdfFetchState {
  refetch: () => void;
  clearCacheForRow: () => Promise<void>;
}

function isPdfContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return lower.includes('application/pdf') || lower.includes('application/octet-stream');
}

export function isPdfUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    if (pathname.endsWith('.pdf')) return true;
    const search = urlObj.search.toLowerCase();
    if (pathname.includes('.pdf') || search.includes('.pdf')) return true;
    const responseContentType = urlObj.searchParams.get('response-content-type');
    if (responseContentType && isPdfContentType(responseContentType)) return true;
    return false;
  } catch {
    return false;
  }
}

function isCorsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('cors') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

function getErrorMessage(code: ContractErrorCode, fileSize?: number, httpStatus?: number): string {
  const sizeStr = fileSize ? ` (${formatSize(fileSize)})` : '';
  const statusStr = httpStatus ? ` [HTTP ${httpStatus}]` : '';

  switch (code) {
    case 'cors_blocked':
      return `Unable to load PDF${sizeStr} due to browser security restrictions (CORS). Try "Open in New Tab".`;
    case 'network_error':
      return `Network error while fetching PDF${sizeStr}. Check your connection.`;
    case 'not_pdf':
      return `The URL does not point to a valid PDF file${sizeStr}.`;
    case 'invalid_response':
      return `Server returned an invalid response${statusStr}.`;
    case 'pdf_parse_error':
      return `Failed to parse the PDF file${sizeStr}. It may be corrupted.`;
    case 'timeout':
      return `Request timed out${sizeStr}. The file may be too large or the server is slow.`;
    case 'http_error':
      return `Remote server error${statusStr}${sizeStr}. The file may be unavailable or access denied.`;
    case 'file_too_large':
      return `File${sizeStr} exceeds the ${PROXY_CONFIG.maxContractBytes / 1024 / 1024}MB limit. Use "Open in New Tab" to view.`;
    case 'host_not_allowed':
      return `This file host is not in the approved list. Use "Open in New Tab" to view.`;
    case 'blocked_private_network':
      return `Access to private network addresses is blocked for security.`;
    case 'invalid_url':
      return `The contract URL is invalid or malformed.`;
    case 'not_supported_type':
      return `This file type is not supported for in-app viewing${sizeStr}.`;
    case 'proxy_failed':
      return `Both direct fetch and proxy fallback failed${sizeStr}. Try "Open in New Tab".`;
    default:
      return `An unknown error occurred while loading the PDF${sizeStr}.`;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createPdfFetchError(
  code: ContractErrorCode,
  url: string,
  options: {
    httpStatus?: number;
    fileSize?: number;
    contentType?: string;
    usedProxy?: boolean;
    thrownMessage?: string;
  } = {}
): PdfFetchError {
  const { httpStatus, fileSize, contentType, usedProxy, thrownMessage } = options;

  const failureMeta = classifyContractFailure({
    url,
    errorCode: code,
    httpStatus,
    contentType,
    sizeBytes: fileSize,
    thrownMessage,
    usedProxy,
  });

  return {
    code,
    message: failureMeta.message,
    fileSize,
    httpStatus,
    usedProxy,
    contentType,
    failureMeta,
  };
}

async function fetchFileSize(url: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        return parseInt(contentLength, 10);
      }
    }
  } catch {
    // HEAD request failed (likely CORS), ignore
  }
  return null;
}

interface ProxyErrorResponse {
  error: true;
  code: ContractErrorCode;
  message: string;
  httpStatus?: number;
  fileSize?: number;
}

async function fetchViaProxy(
  url: string,
  signal: AbortSignal
): Promise<{ blob: Blob; contentType: string | null; fileSize: number }> {
  const proxyUrl = buildProxyUrl(url);

  const response = await fetch(proxyUrl, {
    signal,
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const errorBody = (await response.json()) as ProxyErrorResponse;
      const error = new Error(errorBody.message) as Error & {
        code: ContractErrorCode;
        httpStatus?: number;
        fileSize?: number;
      };
      error.code = errorBody.code;
      error.httpStatus = errorBody.httpStatus;
      error.fileSize = errorBody.fileSize;
      throw error;
    }
    const error = new Error(`Proxy returned ${response.status}`) as Error & { code: ContractErrorCode };
    error.code = 'proxy_failed';
    throw error;
  }

  const blob = await response.blob();
  const contentType = response.headers.get('content-type');
  const fileSizeHeader = response.headers.get('x-proxy-file-size');
  const fileSize = fileSizeHeader ? parseInt(fileSizeHeader, 10) : blob.size;

  return { blob, contentType, fileSize };
}

export function usePdfFetch(
  source: string,
  sheetName: string,
  rowIndex: number
): UsePdfFetchResult {
  const [state, setState] = useState<PdfFetchState>({
    pdfUrl: null,
    isLoading: false,
    error: null,
    isCached: false,
    fileSize: null,
    contentType: null,
    fetchStatus: 'idle',
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanupObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const fetchPdf = useCallback(async () => {
    cleanupObjectUrl();

    if (!source || !isPdfUrl(source)) {
      setState({
        pdfUrl: null,
        isLoading: false,
        error: null,
        isCached: false,
        fileSize: null,
        contentType: null,
        fetchStatus: 'idle',
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null, fetchStatus: 'fetching' }));

    try {
      const cached = await contractCache.getCachedContract(sheetName, rowIndex, source);
      if (cached) {
        const url = URL.createObjectURL(cached.blob);
        objectUrlRef.current = url;
        setState({
          pdfUrl: url,
          isLoading: false,
          error: null,
          isCached: true,
          fileSize: cached.size,
          contentType: cached.contentType,
          fetchStatus: 'success',
        });
        return;
      }
    } catch {
      // Cache lookup failed, proceed with fetch
    }

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, FETCH_TIMEOUT_MS);

    let directFetchFailed = false;
    let corsError = false;
    let knownFileSize: number | null = null;

    try {
      const response = await fetch(source, {
        signal: abortControllerRef.current.signal,
        mode: 'cors',
        credentials: 'omit',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        directFetchFailed = true;
        const errorCode: ContractErrorCode = response.status === 0 ? 'cors_blocked' : 'http_error';

        if (errorCode === 'cors_blocked') {
          corsError = true;
        } else {
          setState({
            pdfUrl: null,
            isLoading: false,
            error: createPdfFetchError(errorCode, source, { httpStatus: response.status }),
            isCached: false,
            fileSize: null,
            contentType: null,
            fetchStatus: 'error',
          });
          return;
        }
      }

      if (!directFetchFailed) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        const fileSize = contentLength ? parseInt(contentLength, 10) : null;

        if (!isPdfContentType(contentType) && !isPdfUrl(source)) {
          setState({
            pdfUrl: null,
            isLoading: false,
            error: createPdfFetchError('not_pdf', source, {
              fileSize: fileSize || undefined,
              contentType: contentType || undefined,
            }),
            isCached: false,
            fileSize,
            contentType,
            fetchStatus: 'error',
          });
          return;
        }

        const blob = await response.blob();
        const actualSize = blob.size;

        try {
          await contractCache.cacheContract(sheetName, rowIndex, source, blob, contentType || 'application/pdf');
        } catch {
          // Caching failed, but we can still display the PDF
        }

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        setState({
          pdfUrl: url,
          isLoading: false,
          error: null,
          isCached: false,
          fileSize: actualSize,
          contentType: contentType || 'application/pdf',
          fetchStatus: 'success',
        });
        return;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      directFetchFailed = true;

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setState({
            pdfUrl: null,
            isLoading: false,
            error: createPdfFetchError('timeout', source, { thrownMessage: err.message }),
            isCached: false,
            fileSize: null,
            contentType: null,
            fetchStatus: 'error',
          });
          return;
        }
        if (isCorsError(err)) {
          corsError = true;
        }
      }

      if (!corsError) {
        const thrownMessage = err instanceof Error ? err.message : undefined;
        setState({
          pdfUrl: null,
          isLoading: false,
          error: createPdfFetchError('network_error', source, { thrownMessage }),
          isCached: false,
          fileSize: null,
          contentType: null,
          fetchStatus: 'error',
        });
        return;
      }
    }

    if (corsError && PROXY_CONFIG.enabled) {
      let targetHostname: string;
      try {
        targetHostname = new URL(source).hostname;
      } catch {
        setState({
          pdfUrl: null,
          isLoading: false,
          error: createPdfFetchError('invalid_url', source),
          isCached: false,
          fileSize: null,
          contentType: null,
          fetchStatus: 'error',
        });
        return;
      }

      if (!isProxyEnabledForHost(targetHostname)) {
        knownFileSize = await fetchFileSize(source);
        setState({
          pdfUrl: null,
          isLoading: false,
          error: createPdfFetchError('cors_blocked', source, {
            fileSize: knownFileSize || undefined,
          }),
          isCached: false,
          fileSize: knownFileSize,
          contentType: null,
          fetchStatus: 'error',
        });
        return;
      }

      setState((prev) => ({ ...prev, fetchStatus: 'proxy_retry' }));

      abortControllerRef.current = new AbortController();
      const proxyTimeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, FETCH_TIMEOUT_MS);

      try {
        const { blob, contentType, fileSize } = await fetchViaProxy(
          source,
          abortControllerRef.current.signal
        );

        clearTimeout(proxyTimeoutId);

        try {
          await contractCache.cacheContract(sheetName, rowIndex, source, blob, contentType || 'application/pdf');
        } catch {
          // Caching failed, but we can still display the PDF
        }

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        setState({
          pdfUrl: url,
          isLoading: false,
          error: null,
          isCached: false,
          fileSize,
          contentType: contentType || 'application/pdf',
          fetchStatus: 'success',
        });
        return;
      } catch (proxyErr) {
        clearTimeout(proxyTimeoutId);

        let errorCode: ContractErrorCode = 'proxy_failed';
        let errorFileSize: number | undefined;
        let httpStatus: number | undefined;
        let thrownMessage: string | undefined;

        if (proxyErr instanceof Error) {
          thrownMessage = proxyErr.message;
          const typedErr = proxyErr as Error & {
            code?: ContractErrorCode;
            httpStatus?: number;
            fileSize?: number;
          };
          if (typedErr.code) {
            errorCode = typedErr.code;
          }
          errorFileSize = typedErr.fileSize;
          httpStatus = typedErr.httpStatus;

          if (proxyErr.name === 'AbortError') {
            errorCode = 'timeout';
          }
        }

        setState({
          pdfUrl: null,
          isLoading: false,
          error: createPdfFetchError(errorCode, source, {
            fileSize: errorFileSize,
            httpStatus,
            usedProxy: true,
            thrownMessage,
          }),
          isCached: false,
          fileSize: errorFileSize || null,
          contentType: null,
          fetchStatus: 'error',
        });
        return;
      }
    }

    knownFileSize = await fetchFileSize(source);
    setState({
      pdfUrl: null,
      isLoading: false,
      error: createPdfFetchError('cors_blocked', source, {
        fileSize: knownFileSize || undefined,
      }),
      isCached: false,
      fileSize: knownFileSize,
      contentType: null,
      fetchStatus: 'error',
    });
  }, [source, sheetName, rowIndex, cleanupObjectUrl]);

  const clearCacheForRow = useCallback(async () => {
    cleanupObjectUrl();
    try {
      await contractCache.clearContractCache(sheetName, rowIndex, source);
    } catch {
      // Ignore cache clear errors
    }
    setState({
      pdfUrl: null,
      isLoading: false,
      error: null,
      isCached: false,
      fileSize: null,
      contentType: null,
      fetchStatus: 'idle',
    });
  }, [sheetName, rowIndex, source, cleanupObjectUrl]);

  useEffect(() => {
    fetchPdf();

    return () => {
      cleanupObjectUrl();
      abortControllerRef.current?.abort();
    };
  }, [fetchPdf, cleanupObjectUrl]);

  return {
    ...state,
    refetch: fetchPdf,
    clearCacheForRow,
  };
}
