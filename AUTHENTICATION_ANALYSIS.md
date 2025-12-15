# Authentication Flow Analysis

## Overview
This document analyzes how the application determines if a user is logged in and identifies potential issues causing random sign-in prompts.

## Authentication Flow

### 1. Entry Points
Three components check authentication on mount:
- `src/popup/popup.tsx` (line 28-29)
- `src/sidepanel/sidepanel.tsx` (line 927-928)
- `src/options/options.tsx` (line 71-72)

All call: `mieltoAuth.isAuthenticated()`

### 2. `isAuthenticated()` Method (`src/lib/auth.ts:610-634`)

```typescript
async isAuthenticated(): Promise<boolean> {
  // 1. Check for API key first
  const settings = await storage.getSettings();
  const apiKey = settings.apiKey;

  if (apiKey) {
    const session = await this.getCurrentSession();
    return session !== null;
  }

  // 2. Fall back to token auth
  if (!this.token) {
    await this.loadTokensFromStorage();
  }

  if (!this.token) {
    return false;
  }

  // 3. Check session with token
  const session = await this.getCurrentSession();
  return session !== null;
}
```

**Flow:**
1. Checks for API key in IndexedDB settings
2. If no API key, checks for token in `chrome.storage.sync`
3. Calls `getCurrentSession()` to validate
4. Returns `true` if session exists, `false` otherwise

### 3. `getCurrentSession()` Method (`src/lib/auth.ts:463-568`)

This is where the **main issue** occurs:

```typescript
async getCurrentSession(count: number = 2, accessToken?: string): Promise<CurrentSession | null> {
  // ... token loading logic ...
  
  // Check if we have an API key in settings first
  const settings = await storage.getSettings();
  const apiKey = settings.apiKey;

  if (token) {
    authHeader = `Bearer supabase_${token}`;
  } else if (apiKey) {
    authHeader = `Bearer ${apiKey}`;
  } else {
    return null;
  }

  try {
    // ⚠️ ISSUE #1: Returns cached data WITHOUT validating token
    if (!apiKey) {
      const result = await chrome.storage.sync.get(['mielto_user', 'mielto_workspace', 'mielto_workspace_user']);

      if (result.mielto_user && result.mielto_workspace) {
        return {
          user: result.mielto_user,
          workspace: result.mielto_workspace,
          workspace_user: result.mielto_workspace_user || null,
          auth_type: 'bearer_token',
          auth_provider: 'supabase',
        } as CurrentSession;
      }
    }

    // Only makes API call if cache doesn't exist
    const response = await fetch(`${this.baseUrl}/api/v1/auth/session`, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
    });

    if (!response.ok) {
      if (response.status === 401 && count > 0 && !apiKey) {
        // Try to refresh token
        const newToken = await this.refreshTokenInternal();
        if (newToken) {
          return this.getCurrentSession(count - 1, newToken);
        } else {
          return null; // Refresh failed
        }
      }
      throw new Error(`HTTP ${response.status}`);
    }

    // ... save and return session data ...
  } catch (error: any) {
    console.error('Get session error:', error);
    return null; // ⚠️ ISSUE #2: Any error returns null
  }
}
```

## Identified Issues

### Issue #1: Cached Data Returned Without Token Validation ⚠️ **CRITICAL**

**Location:** `src/lib/auth.ts:493-504`

**Problem:**
- When using token auth (not API key), `getCurrentSession()` checks `chrome.storage.sync` for cached `mielto_user` and `mielto_workspace`
- If both exist, it returns them **immediately** without validating the token
- This means:
  - If token expires, cached data is still returned
  - `isAuthenticated()` returns `true` based on stale cache
  - User sees authenticated UI
  - Later API calls fail with 401, causing confusion

**Scenario:**
1. User logs in → tokens + session data saved to `chrome.storage.sync`
2. Token expires (after 1 hour, network issue, etc.)
3. User opens extension → `isAuthenticated()` called
4. `getCurrentSession()` finds cached data → returns immediately
5. `isAuthenticated()` returns `true`
6. User sees authenticated UI
7. User tries to use feature → API call made with expired token → fails
8. User randomly sees login screen

### Issue #2: Network Errors Treated as "Not Authenticated"

**Location:** `src/lib/auth.ts:564-567`

**Problem:**
- If the API call fails for any reason (network error, 500, timeout), it catches the error and returns `null`
- This makes `isAuthenticated()` return `false` even if the user is actually logged in
- User sees login screen even though they have valid tokens

**Scenario:**
1. User has valid tokens
2. Network is temporarily down or API returns 500
3. `getCurrentSession()` makes API call → fails
4. Returns `null` → `isAuthenticated()` returns `false`
5. User sees login screen unnecessarily

### Issue #3: Token Refresh Only Happens on 401

**Location:** `src/lib/auth.ts:519-531`

**Problem:**
- Token refresh only attempts when API returns 401
- But if cached data exists, API call is never made
- So expired tokens are never refreshed proactively
- Token refresh should happen before returning cached data

### Issue #4: No Distinction Between "No Auth" and "Auth Failed"

**Problem:**
- Both "no tokens" and "token validation failed" return `null`
- Makes debugging difficult
- Should differentiate between:
  - No tokens exist (user never logged in)
  - Tokens exist but invalid (need refresh or re-login)

## Data Storage Locations

### Chrome Storage Sync (`chrome.storage.sync`)
- `mielto_token` - Supabase access token
- `mielto_refresh_token` - Supabase refresh token
- `mielto_user` - Cached user data
- `mielto_workspace` - Cached workspace data
- `mielto_workspace_user` - Cached workspace user data

### IndexedDB (`intella-db`)
- `settings` store → `user-settings` key contains:
  - `apiKey` - API key for authentication
  - `workspace_id` - Current workspace ID
  - Other user settings

## Why You See Workspace Data But Still Get Login Screen

**Root Cause:**
1. Workspace data exists in `chrome.storage.sync` (from previous login)
2. Token might be expired or missing
3. `getCurrentSession()` returns cached workspace data
4. `isAuthenticated()` returns `true` initially
5. But when actual API calls are made, token fails
6. Some error handling might clear tokens or show login screen

## Recommendations (For Future Fix)

1. **Always Validate Token Before Returning Cached Data**
   - Make a lightweight API call to validate token
   - Or check token expiration locally before returning cache
   - Only return cached data if token is still valid

2. **Proactive Token Refresh**
   - Check token expiration before using it
   - Refresh token proactively if close to expiration
   - Don't wait for 401 errors

3. **Better Error Handling**
   - Distinguish between network errors and auth failures
   - Don't clear tokens on network errors
   - Retry logic for transient failures

4. **Cache Invalidation Strategy**
   - Add timestamp to cached session data
   - Invalidate cache after certain time period
   - Force API call periodically to refresh cache

5. **Add Logging**
   - Log when cached data is returned vs API call made
   - Log token expiration status
   - Log why authentication check failed

## Current Behavior Summary

| Scenario | Token Status | Cache Status | `getCurrentSession()` Result | `isAuthenticated()` Result |
|----------|-------------|--------------|------------------------------|----------------------------|
| Fresh login | Valid | Exists | Returns cache immediately | ✅ `true` |
| Token expired, cache exists | Expired | Exists | Returns cache (no validation) | ✅ `true` (WRONG!) |
| Token expired, no cache | Expired | None | API call → 401 → refresh attempt → fails → `null` | ❌ `false` |
| Network error, cache exists | Valid | Exists | Returns cache | ✅ `true` |
| Network error, no cache | Valid | None | API call fails → `null` | ❌ `false` (WRONG!) |
| No tokens | None | None | Returns `null` immediately | ❌ `false` |

## Root Cause Summary

**The main issue causing random login prompts:**

1. **Cached session data is returned without token validation** (`src/lib/auth.ts:493-504`)
   - When `mielto_user` and `mielto_workspace` exist in `chrome.storage.sync`, `getCurrentSession()` returns them immediately
   - No API call is made to validate the token
   - This means expired tokens are not detected until an actual API call is made later

2. **Token expiration is not checked proactively**
   - Tokens can expire (typically after 1 hour for Supabase)
   - The app doesn't check expiration before using cached data
   - Token refresh only happens when API returns 401, but if cache exists, API call is never made

3. **Network errors are treated as authentication failures**
   - If API call fails for any reason (network, 500, timeout), `getCurrentSession()` returns `null`
   - This makes `isAuthenticated()` return `false` even with valid tokens
   - User sees login screen unnecessarily

**Why you see workspace data but still get login screen:**

- Workspace data exists in `chrome.storage.sync` from previous login
- Token might be expired or missing
- `getCurrentSession()` might return cached workspace initially
- But when actual features are used, API calls fail with expired token
- Some error handling or retry logic might then show login screen

**The inconsistency:**

- Sometimes cache exists → `isAuthenticated()` returns `true` → user sees UI
- Sometimes cache doesn't exist or API call is made → token fails → `isAuthenticated()` returns `false` → login screen
- This creates the "random" behavior you're experiencing

## Files Involved

- `src/lib/auth.ts` - Main authentication logic
- `src/popup/popup.tsx` - Popup UI authentication check
- `src/sidepanel/sidepanel.tsx` - Side panel authentication check
- `src/options/options.tsx` - Options page authentication check
- `src/utils/storage.ts` - IndexedDB storage manager
