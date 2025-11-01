/**
 * Mielto Authentication for Chrome Extension
 * Sign into Supabase first, then use token with session endpoint
 */

import { supabase } from './supabase';

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

export interface SessionResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  status: string;
  workspaces: any[];
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
  }

  private async saveTokensToStorage(token: string, refreshToken: string) {
    await chrome.storage.sync.set({
      mielto_token: token,
      mielto_refresh_token: refreshToken,
    });
    this.token = token;
  }

  private async clearTokensFromStorage() {
    await chrome.storage.sync.remove(['mielto_token', 'mielto_refresh_token', 'mielto_user', 'mielto_workspace']);
    this.token = null;
  }

  private async saveCurrentSession(user: SessionResponse) {
    await chrome.storage.sync.set({ mielto_user: user });
  }

  private async setCurrentSessionWorkspace(workspace: any) {
    await chrome.storage.sync.set({ mielto_workspace: workspace });
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

      // Step 2: Get session data from Mielto backend using Supabase token
      console.log('🔐 AUTH - Step 2: Getting session from Mielto backend...');
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
      await this.saveTokensToStorage(supabaseToken, supabaseAuth.session.refresh_token || '');
      console.log('🔐 AUTH - Supabase token saved');

      // Save user and workspace data
      if (sessionData.user) {
        await this.saveCurrentSession({
          id: sessionData.user.id,
          email: sessionData.user.email,
          first_name: sessionData.user.first_name || '',
          last_name: sessionData.user.last_name || '',
          avatar_url: sessionData.user.avatar_url || '',
          status: 'active',
          workspaces: sessionData.workspace ? [sessionData.workspace] : [],
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
        refresh_token: supabaseAuth.session.refresh_token || '',
        token_type: 'Bearer',
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email,
          first_name: sessionData.user.first_name || '',
          last_name: sessionData.user.last_name || '',
          avatar_url: sessionData.user.avatar_url || '',
          status: 'active',
          workspaces: sessionData.workspace ? [sessionData.workspace] : [],
        },
      };

      console.log('🔐 AUTH - Login successful');
      return loginResponse;
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

  async getCurrentSession(count: number = 2, accessToken?: string): Promise<{user: SessionResponse, workspace: any} | null> {
    let token = accessToken ? accessToken : this.token;
    let authHeader = '';

    // Check if we have an API key in settings first
    const settings = await chrome.storage.sync.get(['mielto_settings']);
    const apiKey = settings.mielto_settings?.apiKey;

    if (apiKey) {
      console.log('🔑 AUTH - Using API key for authentication');
      authHeader = `Bearer ${apiKey}`;
    } else if (token) {
      console.log('🔑 AUTH - Using Supabase token for authentication');
      authHeader = `Bearer supabase_${token}`;
    } else {
      console.log('🔑 AUTH - No API key or token available');
      return null;
    }

    try {
      // Get saved user data from storage first (faster) - but only if using token auth
      if (!apiKey) {
        const result = await chrome.storage.sync.get(['mielto_user', 'mielto_workspace']);
        
        if (result.mielto_user) {
          return {
            user: result.mielto_user,
            workspace: result.mielto_workspace || null,
          };
        }
      }

      // Get session data from backend
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      };

      const response = await fetch(`${this.baseUrl}/api/v1/auth/session`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 && count > 0 && !apiKey) {
          // Token might be expired, try to refresh (only for token auth)
          return this.getCurrentSession(count - 1);
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
      }
      
      return {user: data.user, workspace: data.workspace};
    } catch (error: any) { 
      console.error('Get session error:', error);
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
    const settings = await chrome.storage.sync.get(['mielto_settings']);
    const apiKey = settings.mielto_settings?.apiKey;
    
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
    const settings = await chrome.storage.sync.get(['mielto_settings']);
    const apiKey = settings.mielto_settings?.apiKey;
    
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
    const settings = await chrome.storage.sync.get(['mielto_settings']);
    const apiKey = settings.mielto_settings?.apiKey;
    
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