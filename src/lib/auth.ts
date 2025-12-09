/**
 * Mielto Authentication for Chrome Extension
 * Sign into Supabase first, then use token with session endpoint
 */

import { supabase } from './supabase';
import { storage } from '@/utils/storage';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  user: SessionResponse;
}

export interface AuthStrategy {
  status: string;
  auth_id: string;
  provider: string;
  strategy: string;
}

export interface SessionResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  auth_strategy: AuthStrategy;
  status: string;
  last_login_at: string;
  hashed_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceBilling {
  plan: string;
  plan_id: string;
  has_active_wallet: boolean;
  stripe_customer_id: string;
  has_active_subscription: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tier_id: string;
  is_owner: boolean;
  role: string;
  permissions: Record<string, any>;
  workspace_user_id: string;
  settings?: Record<string, any>;
  billing?: WorkspaceBilling;
}

export interface WorkspaceUser {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  status: string;
  is_owner: boolean;
  permissions: Record<string, any>;
  settings: Record<string, any>;
  invited_at: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  workspace?: Workspace;
}

export interface CurrentSession {
  user: SessionResponse;
  workspace: Workspace;
  workspace_user: WorkspaceUser;
  auth_type: string;
  auth_provider: string;
}

class MieltoAuth {
  private baseUrl: string = import.meta.env.VITE_MIELTO_API_URL || 'https://api.mielto.com';
  private token: string | null = null;

  constructor() {
    this.loadTokensFromStorage();
  }

  private async loadTokensFromStorage() {
    const result = await chrome.storage.sync.get(['mielto_token', 'mielto_refresh_token']);
    this.token = result.mielto_token || null;
    return result
  }

  /**
   * Refresh the access token using the refresh token
   * This keeps users logged in for extended periods
   * Can be called proactively or when token expires
   */
  async refreshToken(): Promise<boolean> {
    try {
      const result = await chrome.storage.sync.get(['mielto_refresh_token']);
      const refreshToken = result.mielto_refresh_token;

      if (!refreshToken) {
        console.log('🔑 AUTH - No refresh token available');
        return false;
      }

      console.log('🔄 AUTH - Refreshing access token...');

      // First, set the session with the refresh token so Supabase knows about it
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: this.token || '',
        refresh_token: refreshToken,
      });

      if (setSessionError) {
        console.error('🔑 AUTH - Failed to set session for refresh:', setSessionError);
        await this.clearTokensFromStorage();
        return false;
      }

      // Now refresh the session
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        console.error('🔑 AUTH - Token refresh failed:', error);
        // If refresh fails, clear tokens (user needs to login again)
        await this.clearTokensFromStorage();
        return false;
      }

      const newAccessToken = data.session.access_token;
      const newRefreshToken = data.session.refresh_token || refreshToken;

      // Save the new tokens
      await this.saveTokensToStorage(newAccessToken, newRefreshToken);
      console.log('✅ AUTH - Token refreshed successfully');

      return true;
    } catch (error) {
      console.error('🔑 AUTH - Error refreshing token:', error);
      await this.clearTokensFromStorage();
      return false;
    }
  }

  /**
   * Private helper to refresh token and return the new token
   * Used internally by getCurrentSession
   */
  private async refreshTokenInternal(): Promise<string | null> {
    const result = await chrome.storage.sync.get(['mielto_refresh_token']);
    const refreshToken = result.mielto_refresh_token;

    if (!refreshToken) {
      return null;
    }

    // First set the session, then refresh it
    await supabase.auth.setSession({
      access_token: this.token || '',
      refresh_token: refreshToken,
    });

    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      await this.clearTokensFromStorage();
      return null;
    }

    const newAccessToken = data.session.access_token;
    const newRefreshToken = data.session.refresh_token || refreshToken;
    await this.saveTokensToStorage(newAccessToken, newRefreshToken);

    return newAccessToken;
  }

  private async saveTokensToStorage(token: string, refreshToken: string) {
    await chrome.storage.sync.set({
      mielto_token: token,
      mielto_refresh_token: refreshToken,
    });
    this.token = token;
  }

  private async clearTokensFromStorage() {
    await chrome.storage.sync.remove([
      'mielto_token', 
      'mielto_refresh_token', 
      'mielto_user', 
      'mielto_workspace', 
      'mielto_workspace_user',
      'mielto_session_cache_timestamp' // Also clear cache timestamp
    ]);
    this.token = null;
  }

  private async saveCurrentSession(user: SessionResponse) {
    await chrome.storage.sync.set({ 
      mielto_user: user,
      mielto_session_cache_timestamp: Date.now() // Store timestamp for cache invalidation
    });
  }

  private async setCurrentSessionWorkspace(workspace: any) {
    await chrome.storage.sync.set({ 
      mielto_workspace: workspace,
      mielto_session_cache_timestamp: Date.now() // Update timestamp
    });
  }

  /**
   * Check if cached session data is still valid
   * Cache is considered invalid if:
   * - Older than 5 minutes (force refresh periodically)
   * - Token might be expired
   */
  private async isCacheValid(): Promise<boolean> {
    try {
      const result = await chrome.storage.sync.get(['mielto_session_cache_timestamp']);
      const cacheTimestamp = result.mielto_session_cache_timestamp;
      
      if (!cacheTimestamp) {
        return false; // No cache timestamp means cache is invalid
      }

      const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
      const cacheAge = Date.now() - cacheTimestamp;
      
      if (cacheAge > CACHE_MAX_AGE) {
        console.log('🔑 AUTH - Cache expired (older than 5 minutes)');
        return false;
      }

      return true;
    } catch (error) {
      console.error('🔑 AUTH - Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Validate token by making a lightweight API call
   * Returns true if token is valid, false otherwise
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      // Use AbortController for timeout (more compatible than AbortSignal.timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.baseUrl}/api/v1/auth/session`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer supabase_${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error: any) {
      // Distinguish between network errors and auth failures
      if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.name === 'TypeError' || error.message?.includes('fetch')) {
        console.warn('🔑 AUTH - Network error during token validation (not treating as auth failure):', error.message);
        // Network error - don't treat as auth failure, return true to allow cached data
        return true;
      }
      
      console.error('🔑 AUTH - Token validation failed:', error);
      return false;
    }
  }



  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<LoginTokenResponse> {
    console.log('🔐 AUTH - Starting Google OAuth login process...');

    try {
      // Get the Chrome extension redirect URL
      const redirectURL = chrome.identity.getRedirectURL('oauth2');
      console.log('🔐 AUTH - Extension redirect URL:', redirectURL);

      // Step 1: Get Supabase OAuth URL
      console.log('🔐 AUTH - Step 1: Getting Google OAuth URL from Supabase...');
      const { data: supabaseAuth, error: supabaseError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectURL,
          skipBrowserRedirect: true,
        },
      });

      if (supabaseError) {
        console.error('🔐 AUTH - Supabase OAuth error:', supabaseError);
        throw new Error(supabaseError.message || 'Google authentication failed');
      }

      const authUrl = supabaseAuth.url;
      if (!authUrl) {
        throw new Error('No OAuth URL received from Supabase');
      }

      console.log('🔐 AUTH - OAuth URL received, launching web auth flow...');

      // Step 2: Launch OAuth flow using Chrome Identity API
      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });

      if (!redirectUrl) {
        throw new Error('OAuth flow was cancelled or failed');
      }

      console.log('🔐 AUTH - OAuth redirect received');

      // Step 3: Extract tokens from redirect URL
      // Tokens can be in hash (#) or query (?) parameters depending on Supabase config
      const url = new URL(redirectUrl);

      // Try hash params first (default for implicit flow)
      let supabaseToken = null;
      let refreshToken = null;

      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        supabaseToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }

      // Fallback to query params (PKCE flow)
      if (!supabaseToken && url.searchParams.has('code')) {
        const authCode = url.searchParams.get('code');
        console.log('🔐 AUTH - Exchanging auth code for tokens...');

        // Exchange code for tokens using Supabase
        const { data: tokenData, error: tokenError } = await supabase.auth.exchangeCodeForSession(authCode!);

        if (tokenError || !tokenData.session) {
          console.error('🔐 AUTH - Token exchange error:', tokenError);
          throw new Error(tokenError?.message || 'Failed to exchange code for session');
        }

        supabaseToken = tokenData.session.access_token;
        refreshToken = tokenData.session.refresh_token;
      }

      if (!supabaseToken) {
        console.error('🔐 AUTH - No tokens found in redirect URL:', redirectUrl);
        throw new Error('No access token received from Google OAuth');
      }

      console.log('🔐 AUTH - Google OAuth successful, got token');

      // Step 4: Complete Mielto session
      return await this.completeMieltoSession(supabaseToken, refreshToken || '');
    } catch (error: any) {
      console.error('🔐 AUTH - Google login error:', error);

      // Sign out from Supabase if something went wrong
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('🔐 AUTH - Failed to sign out from Supabase:', signOutError);
      }

      throw new Error(error.message || 'Google authentication failed');
    }
  }

  /**
   * Complete Mielto session after Supabase authentication
   * Shared logic between email/password and OAuth sign-in
   */
  private async completeMieltoSession(supabaseToken: string, refreshToken: string): Promise<LoginTokenResponse> {
    // Step 2: Get session data from Mielto backend using Supabase token
    console.log('🔐 AUTH - Getting session from Mielto backend...');
    const response = await fetch(`${this.baseUrl}/api/v1/auth/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer supabase_${supabaseToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('🔐 AUTH - Session endpoint response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('🔐 AUTH - Session endpoint error:', errorData);
      } catch (e) {
        console.error('🔐 AUTH - Failed to parse session error response');
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(errorData.message || errorData.detail || `Session validation failed (${response.status})`);
    }

    const sessionData = await response.json();
    console.log('🔐 AUTH - Session data keys:', Object.keys(sessionData));

    // Save Supabase token to storage
    await this.saveTokensToStorage(supabaseToken, refreshToken);
    console.log('🔐 AUTH - Supabase token saved');

    // Save user and workspace data
    if (sessionData.user) {
      await this.saveCurrentSession({
        id: sessionData.user.id,
        email: sessionData.user.email,
        first_name: sessionData.user.first_name || '',
        last_name: sessionData.user.last_name || '',
        avatar_url: sessionData.user.avatar_url || '',
        auth_strategy: sessionData.user.auth_strategy || {
          status: 'success',
          auth_id: '',
          provider: 'supabase',
          strategy: 'email_password',
        },
        status: sessionData.user.status || 'active',
        last_login_at: sessionData.user.last_login_at || new Date().toISOString(),
        hashed_password: sessionData.user.hashed_password || null,
        created_at: sessionData.user.created_at || new Date().toISOString(),
        updated_at: sessionData.user.updated_at || new Date().toISOString(),
      });
      console.log('🔐 AUTH - User session saved');
    }

    if (sessionData.workspace) {
      await this.setCurrentSessionWorkspace(sessionData.workspace);
      console.log('🔐 AUTH - Workspace saved');
    }

    // Return response in expected format
    const loginResponse: LoginTokenResponse = {
      access_token: supabaseToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
        first_name: sessionData.user.first_name || '',
        last_name: sessionData.user.last_name || '',
        avatar_url: sessionData.user.avatar_url || '',
        auth_strategy: sessionData.user.auth_strategy,
        status: sessionData.user.status || 'active',
        last_login_at: sessionData.user.last_login_at || new Date().toISOString(),
        hashed_password: sessionData.user.hashed_password || null,
        created_at: sessionData.user.created_at || new Date().toISOString(),
        updated_at: sessionData.user.updated_at || new Date().toISOString(),
      },
    };

    console.log('🔐 AUTH - Login successful');
    return loginResponse;
  }

  async signIn(email: string, password: string): Promise<LoginTokenResponse> {
    console.log('🔐 AUTH - Starting login process for:', email);

    try {
      // Step 1: Sign into Supabase
      console.log('🔐 AUTH - Step 1: Authenticating with Supabase...');
      const { data: supabaseAuth, error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (supabaseError) {
        console.error('🔐 AUTH - Supabase auth error:', supabaseError);

        // Provide specific error messages for common issues
        if (supabaseError.message?.includes('Invalid API key')) {
          throw new Error('Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY in .env file.');
        }

        if (supabaseError.message?.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials.');
        }

        throw new Error(supabaseError.message || 'Supabase authentication failed');
      }

      if (!supabaseAuth.session?.access_token) {
        console.error('🔐 AUTH - No Supabase access token received');
        throw new Error('Authentication failed: No access token received');
      }

      console.log('🔐 AUTH - Supabase auth successful, got token');
      const supabaseToken = supabaseAuth.session.access_token;
      const refreshToken = supabaseAuth.session.refresh_token || '';

      // Step 2: Complete Mielto session
      return await this.completeMieltoSession(supabaseToken, refreshToken);
    } catch (error: any) {
      console.error('🔐 AUTH - Login error:', error);

      // Sign out from Supabase if something went wrong
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('🔐 AUTH - Failed to sign out from Supabase:', signOutError);
      }

      // Provide more specific error messages
      if (error.message?.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      }

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to authentication server. Please check your internet connection.');
      }

      throw new Error(error.message || 'Authentication failed');
    }
  }

  async getCurrentSession(count: number = 2, accessToken?: string): Promise<CurrentSession | null> {
    let token = accessToken ? accessToken : this.token;
    let authHeader = '';

    if (!token) {
      const result = await this.loadTokensFromStorage();
      if (result.mielto_token) {
        token = result.mielto_token;
      }
    }

    // Check if we have an API key in settings first
    const settings = await storage.getSettings();
    const apiKey = settings.apiKey;

    if (token) {
      console.log('🔑 AUTH - Using Supabase token for authentication');
      authHeader = `Bearer supabase_${token}`;
    }
    else if (apiKey) {
      console.log('🔑 AUTH - Using API key for authentication');
      authHeader = `Bearer ${apiKey}`;
    } else {
      console.log('🔑 AUTH - No API key or token available');
      return null;
    }

    try {
      // FIX #1: Validate cached data before returning it (only for token auth)
      if (!apiKey && token) {
        const result = await chrome.storage.sync.get(['mielto_user', 'mielto_workspace', 'mielto_workspace_user']);

        if (result.mielto_user && result.mielto_workspace) {
          // Check if cache is still valid (not too old)
          const isCacheStillValid = await this.isCacheValid();
          
          if (isCacheStillValid) {
            // FIX #3: Validate token before returning cached data
            console.log('🔑 AUTH - Found cached session, validating token...');
            const isTokenValid = await this.validateToken(token);
            
            if (isTokenValid) {
              console.log('✅ AUTH - Token validated, returning cached session');
              return {
                user: result.mielto_user,
                workspace: result.mielto_workspace,
                workspace_user: result.mielto_workspace_user || null,
                auth_type: 'bearer_token',
                auth_provider: 'supabase',
              } as CurrentSession;
            } else {
              console.log('⚠️ AUTH - Cached session found but token validation failed, refreshing...');
              // Token validation failed, try to refresh
              const newToken = await this.refreshTokenInternal();
              if (newToken) {
                // Retry with new token
                return this.getCurrentSession(count - 1, newToken);
              }
              // If refresh fails, continue to API call which will handle it properly
            }
          } else {
            console.log('🔑 AUTH - Cache expired, fetching fresh session data');
          }
        }
      }

      // Get session data from backend
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      };

      // FIX #2: Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/v1/auth/session`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // FIX #2: Distinguish network errors from auth failures
        if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
          console.warn('🔑 AUTH - Request timeout (network issue), checking if we have cached data...');
          // On timeout, return cached data if available (better UX than showing login)
          if (!apiKey) {
            const cachedResult = await chrome.storage.sync.get(['mielto_user', 'mielto_workspace', 'mielto_workspace_user']);
            if (cachedResult.mielto_user && cachedResult.mielto_workspace) {
              console.log('⚠️ AUTH - Network timeout, returning cached session data');
              return {
                user: cachedResult.mielto_user,
                workspace: cachedResult.mielto_workspace,
                workspace_user: cachedResult.mielto_workspace_user || null,
                auth_type: 'bearer_token',
                auth_provider: 'supabase',
              } as CurrentSession;
            }
          }
          throw new Error('Network timeout - unable to verify authentication');
        }
        
        if (fetchError.name === 'TypeError' && fetchError.message?.includes('fetch')) {
          console.warn('🔑 AUTH - Network error (fetch failed), checking if we have cached data...');
          // Network error - return cached data if available
          if (!apiKey) {
            const cachedResult = await chrome.storage.sync.get(['mielto_user', 'mielto_workspace', 'mielto_workspace_user']);
            if (cachedResult.mielto_user && cachedResult.mielto_workspace) {
              console.log('⚠️ AUTH - Network error, returning cached session data');
              return {
                user: cachedResult.mielto_user,
                workspace: cachedResult.mielto_workspace,
                workspace_user: cachedResult.mielto_workspace_user || null,
                auth_type: 'bearer_token',
                auth_provider: 'supabase',
              } as CurrentSession;
            }
          }
          throw new Error('Network error - unable to connect to authentication server');
        }
        
        throw fetchError;
      }

      if (!response.ok) {
        if (response.status === 401 && count > 0 && !apiKey) {
          // Token might be expired, try to refresh (only for token auth)
          console.log('🔄 AUTH - Token expired (401), attempting refresh...');
          const newToken = await this.refreshTokenInternal();

          if (newToken) {
            // Retry with the new token
            return this.getCurrentSession(count - 1, newToken);
          } else {
            // Refresh failed, clear cache and return null
            console.error('🔑 AUTH - Token refresh failed, clearing cache and requiring login');
            await this.clearTokensFromStorage();
            return null;
          }
        }
        
        // FIX #2: Don't treat server errors (5xx) as auth failures
        if (response.status >= 500) {
          console.warn(`🔑 AUTH - Server error (${response.status}), checking if we have cached data...`);
          // Server error - return cached data if available
          if (!apiKey) {
            const cachedResult = await chrome.storage.sync.get(['mielto_user', 'mielto_workspace', 'mielto_workspace_user']);
            if (cachedResult.mielto_user && cachedResult.mielto_workspace) {
              console.log('⚠️ AUTH - Server error, returning cached session data');
              return {
                user: cachedResult.mielto_user,
                workspace: cachedResult.mielto_workspace,
                workspace_user: cachedResult.mielto_workspace_user || null,
                auth_type: 'bearer_token',
                auth_provider: 'supabase',
              } as CurrentSession;
            }
          }
          throw new Error(`Server error (${response.status}) - please try again later`);
        }
        
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      console.log('🔍 AUTH HANDLER - Got current session data:', {
        hasUser: !!data.user,
        hasWorkspace: !!data.workspace,
        workspaceId: data.workspace?.id,
        authMethod: apiKey ? 'API_KEY' : 'TOKEN'
      });

      // Only cache session data for token auth, not API key auth
      if (!apiKey) {
        await this.saveCurrentSession(data.user);
        await this.setCurrentSessionWorkspace(data.workspace);
        // Also save workspace_user if available
        if (data.workspace_user) {
          await chrome.storage.sync.set({ mielto_workspace_user: data.workspace_user });
        }
      }

      return {
        user: data.user,
        workspace: data.workspace,
        workspace_user: data.workspace_user,
        auth_type: data.auth_type || 'bearer_token',
        auth_provider: data.auth_provider || 'supabase',
      };
    } catch (error: any) {
      // FIX #2: Better error logging to distinguish error types
      if (error.message?.includes('Network') || error.message?.includes('timeout')) {
        console.warn('🔑 AUTH - Network error during session fetch (not treating as auth failure):', error.message);
        // For network errors, try to return cached data if available
        if (!apiKey) {
          const cachedResult = await chrome.storage.sync.get(['mielto_user', 'mielto_workspace', 'mielto_workspace_user']);
          if (cachedResult.mielto_user && cachedResult.mielto_workspace) {
            console.log('⚠️ AUTH - Returning cached session due to network error');
            return {
              user: cachedResult.mielto_user,
              workspace: cachedResult.mielto_workspace,
              workspace_user: cachedResult.mielto_workspace_user || null,
              auth_type: 'bearer_token',
              auth_provider: 'supabase',
            } as CurrentSession;
          }
        }
      }
      
      console.error('🔑 AUTH - Get session error:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    console.log('🔐 AUTH - Starting sign out process');

    try {
      // Sign out from Supabase
      console.log('🔐 AUTH - Signing out from Supabase...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('🔐 AUTH - Supabase sign out error:', error);
      } else {
        console.log('🔐 AUTH - Supabase sign out successful');
      }

      // Notify Mielto backend about logout
      if (this.token) {
        try {
          console.log('🔐 AUTH - Notifying Mielto backend about logout...');
          await fetch(`${this.baseUrl}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer supabase_${this.token}`,
            },
          });
          console.log('🔐 AUTH - Mielto logout notification sent');
        } catch (error) {
          console.error('🔐 AUTH - Mielto logout notification failed:', error);
          // Continue with cleanup even if backend notification fails
        }
      }
    } catch (error) {
      console.error('🔐 AUTH - Sign out error:', error);
      // Continue with local cleanup even if remote signout fails
    }

    // Clear local storage
    await this.clearTokensFromStorage();
    console.log('🔐 AUTH - Local storage cleared, sign out complete');
  }

  async isAuthenticated(): Promise<boolean> {
    // Check for API key first
    const settings = await storage.getSettings();
    const apiKey = settings.apiKey;

    if (apiKey) {
      console.log('🔑 AUTH - API key found, checking session...');
      const session = await this.getCurrentSession();
      return session !== null;
    }

    // Fall back to token auth
    if (!this.token) {
      await this.loadTokensFromStorage();
    }

    if (!this.token) {
      console.log('🔑 AUTH - No API key or token available');
      return false;
    }

    console.log('🔑 AUTH - Token found, checking session...');
    const session = await this.getCurrentSession();
    return session !== null;
  }

  getToken(): string | null {
    return this.token;
  }

  async getAuthHeader(): Promise<string | null> {
    // Check for API key first
    const settings = await storage.getSettings();
    const apiKey = settings.apiKey;

    if (apiKey) {
      return `Bearer ${apiKey}`;
    }

    // Fall back to token auth
    if (!this.token) {
      await this.loadTokensFromStorage();
    }

    if (this.token) {
      return `Bearer supabase_${this.token}`;
    }

    return null;
  }

  async getAuthMethod(): Promise<'API_KEY' | 'TOKEN' | 'NONE'> {
    const settings = await storage.getSettings();
    const apiKey = settings.apiKey;

    if (apiKey) {
      return 'API_KEY';
    }

    if (!this.token) {
      await this.loadTokensFromStorage();
    }

    if (this.token) {
      return 'TOKEN';
    }

    return 'NONE';
  }
}

export const mieltoAuth = new MieltoAuth();