const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

const optionalEnvVars = [
  'VITE_GOOGLE_CLIENT_ID',
] as const;

function validateEnv() {
  const missing: string[] = [];

  for (const key of requiredEnvVars) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nPlease check your .env file or Replit Secrets.`;
    console.error(message);
    throw new Error(message);
  }

  if (import.meta.env.DEV) {
    console.log('[env] Environment validated successfully');
    for (const key of optionalEnvVars) {
      if (!import.meta.env[key]) {
        console.warn(`[env] Optional var ${key} is not set`);
      }
    }
  }
}

validateEnv();

export const env = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
} as const;
