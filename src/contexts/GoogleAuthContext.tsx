import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

interface GoogleAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GoogleUser | null;
  accessToken: string | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
  checkTokenValid: () => boolean;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | null>(null);

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (error: { type: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

interface GoogleAuthProviderProps {
  children: ReactNode;
}

export function GoogleAuthProvider({ children }: GoogleAuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<{ requestAccessToken: (options?: { prompt?: string }) => void } | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('google_access_token');
    const storedExpiry = sessionStorage.getItem('google_token_expiry');
    const storedUser = sessionStorage.getItem('google_user');

    if (storedToken && storedExpiry && storedUser) {
      const expiry = parseInt(storedExpiry, 10);
      if (Date.now() < expiry) {
        setAccessToken(storedToken);
        setTokenExpiry(expiry);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } else {
        sessionStorage.removeItem('google_access_token');
        sessionStorage.removeItem('google_token_expiry');
        sessionStorage.removeItem('google_user');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setIsLoading(false);
      return;
    }

    const initializeGoogleAuth = () => {
      if (!window.google?.accounts?.oauth2) {
        setTimeout(initializeGoogleAuth, 100);
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            setError(response.error);
            setIsLoading(false);
            return;
          }

          if (response.access_token) {
            const expiresIn = 3600 * 1000;
            const expiry = Date.now() + expiresIn;

            setAccessToken(response.access_token);
            setTokenExpiry(expiry);
            sessionStorage.setItem('google_access_token', response.access_token);
            sessionStorage.setItem('google_token_expiry', expiry.toString());

            try {
              const userInfo = await fetchUserInfo(response.access_token);
              setUser(userInfo);
              sessionStorage.setItem('google_user', JSON.stringify(userInfo));
              setIsAuthenticated(true);
            } catch (err) {
              console.error('Failed to fetch user info:', err);
              setError('Failed to get user information');
            }
          }
          setIsLoading(false);
        },
        error_callback: (err) => {
          console.error('Google auth error:', err);
          setError(err.type);
          setIsLoading(false);
        },
      });

      setTokenClient(client);
      setIsLoading(false);
    };

    initializeGoogleAuth();
  }, []);

  const fetchUserInfo = async (token: string): Promise<GoogleUser> => {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  };

  const signIn = useCallback(async () => {
    if (!tokenClient) {
      setError('Google authentication not initialized. Please check your configuration.');
      return;
    }

    setIsLoading(true);
    setError(null);
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient]);

  const signOut = useCallback(() => {
    if (accessToken) {
      window.google?.accounts?.oauth2?.revoke(accessToken, () => {
        console.log('Token revoked');
      });
    }

    setAccessToken(null);
    setTokenExpiry(null);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);

    sessionStorage.removeItem('google_access_token');
    sessionStorage.removeItem('google_token_expiry');
    sessionStorage.removeItem('google_user');
  }, [accessToken]);

  const checkTokenValid = useCallback(() => {
    if (!tokenExpiry) return false;
    return Date.now() < tokenExpiry;
  }, [tokenExpiry]);

  return (
    <GoogleAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        accessToken,
        error,
        signIn,
        signOut,
        checkTokenValid,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
