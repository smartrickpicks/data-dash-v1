export const PROXY_CONFIG = {
  enabled: true,
  endpoint: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-proxy`,
  allowedHosts: [
    'app-myautobots-public-dev.s3.amazonaws.com',
  ],
  maxContractBytes: 10 * 1024 * 1024,
  fetchTimeoutMs: 30000,
} as const;

export function isProxyEnabledForHost(hostname: string): boolean {
  if (!PROXY_CONFIG.enabled) return false;
  return PROXY_CONFIG.allowedHosts.some((allowed) => {
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1);
      return hostname.endsWith(suffix) || hostname === allowed.slice(2);
    }
    return hostname === allowed;
  });
}

export function buildProxyUrl(targetUrl: string): string {
  const encodedUrl = encodeURIComponent(targetUrl);
  return `${PROXY_CONFIG.endpoint}?url=${encodedUrl}`;
}
