/**
 * Message types for communication between extension components
 */

export enum MessageType {
  // Memory operations
  SAVE_MEMORY = 'SAVE_MEMORY',
  GET_MEMORIES = 'GET_MEMORIES',
  GET_BACKEND_MEMORIES = 'GET_BACKEND_MEMORIES',
  GET_BACKEND_MEMORIES_PAGINATED = 'GET_BACKEND_MEMORIES_PAGINATED',
  SYNC_MEMORIES = 'SYNC_MEMORIES',
  DELETE_MEMORY = 'DELETE_MEMORY',
  UPDATE_MEMORY = 'UPDATE_MEMORY',
  SEARCH_MEMORIES = 'SEARCH_MEMORIES',
  
  // Settings operations
  GET_SETTINGS = 'GET_SETTINGS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  
  // Visibility toggle
  TOGGLE_SITE_VISIBILITY = 'TOGGLE_SITE_VISIBILITY',
  GET_SITE_VISIBILITY = 'GET_SITE_VISIBILITY',
  
  // Sidebar operations
  TOGGLE_SIDEBAR = 'TOGGLE_SIDEBAR',
  CLOSE_SIDEBAR = 'CLOSE_SIDEBAR',
  
  // Content analysis
  ANALYZE_PAGE = 'ANALYZE_PAGE',
  SUMMARIZE_PAGE = 'SUMMARIZE_PAGE',
  EXTRACT_ENTITIES = 'EXTRACT_ENTITIES',
  GET_PAGE_CONTENT = 'GET_PAGE_CONTENT',
  
  // AI operations
  ASK_INTELLA = 'ASK_INTELLA',
  IMPROVE_TEXT = 'IMPROVE_TEXT',
  REWRITE_TEXT = 'REWRITE_TEXT',
  TRANSLATE_TEXT = 'TRANSLATE_TEXT',
  
  // Content capture
  CAPTURE_SELECTION = 'CAPTURE_SELECTION',
  CAPTURE_AND_SAVE = 'CAPTURE_AND_SAVE',
  
  // Conversation management
  RESET_CONVERSATION = 'RESET_CONVERSATION',
  
  // Authentication
  LOGOUT = 'LOGOUT',
  CLEAR_ALL_USER_DATA = 'CLEAR_ALL_USER_DATA',
  
  // Feature 1: Floating Search Bar
  FLOAT_QUERY = 'FLOAT_QUERY',
  QUERY_MEMORIES = 'QUERY_MEMORIES',
  OPEN_SIDEPANEL = 'OPEN_SIDEPANEL',
  CLOSE_SIDEPANEL = 'CLOSE_SIDEPANEL',
  GET_SIDEPANEL_STATE = 'GET_SIDEPANEL_STATE',
  
  // Feature 2: Upgrade to Pro
  UPDATE_PLAN = 'UPDATE_PLAN',
  GET_PLAN = 'GET_PLAN',
  REFRESH_PLAN = 'REFRESH_PLAN',
  
  // Feature 3: API Key Management
  SIGNED_API_CALL = 'SIGNED_API_CALL',
  REFRESH_API_KEY = 'REFRESH_API_KEY',
  GET_API_KEY_STATUS = 'GET_API_KEY_STATUS',
  
  // Feature 4: Blocked Sites
  ADD_BLOCKED_DOMAIN = 'ADD_BLOCKED_DOMAIN',
  REMOVE_BLOCKED_DOMAIN = 'REMOVE_BLOCKED_DOMAIN',
  CHECK_DOMAIN_BLOCKED = 'CHECK_DOMAIN_BLOCKED',
  BLOCKED_DOMAINS_UPDATED = 'BLOCKED_DOMAINS_UPDATED',
  
  // Feature 5: Attach Tab enhancements
  GET_OPEN_TABS = 'GET_OPEN_TABS',
  GET_TAB_CONTENT = 'GET_TAB_CONTENT',

  // Feature 6: Screen Region Capture
  SHOW_SCREEN_CAPTURE_OVERLAY = 'SHOW_SCREEN_CAPTURE_OVERLAY',
  CAPTURE_SCREEN_REGION = 'CAPTURE_SCREEN_REGION',
  CAPTURE_SCREEN_CANCELLED = 'CAPTURE_SCREEN_CANCELLED',
}

export interface Message<T = any> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

export interface ToolExecution {
  toolName: string;
  args: Record<string, any>;
  success: boolean;
  executionTime?: number;
  error?: string;
}

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  toolExecutions?: ToolExecution[];
  requestId?: string;
}

// Feature-specific payload interfaces

// Feature 1: Floating Search Bar
export interface FloatQueryPayload {
  query: string;
  source?: 'floating' | 'popup' | 'sidepanel';
}

export interface QueryMemoriesPayload {
  query: string;
  source?: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    keywords?: string[];
  };
}

// Feature 2: Upgrade to Pro
export interface PlanStatus {
  plan: 'free' | 'pro';
  lastCheckedAt: number;
}

// Feature 3: API Key Management
export interface SignedApiCallPayload {
  url: string;
  init?: RequestInit;
}

export interface ApiKeyStatus {
  hasKey: boolean;
  keyName?: string;
  createdAt?: string;
}

// Feature 4: Blocked Sites
export interface BlockedDomainPayload {
  domain: string;
}

export interface DomainBlockedResponse {
  isBlocked: boolean;
  matchedRule?: string;
}

// Feature 5: Attach Tab enhancements
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active?: boolean;
}

export interface GetTabContentPayload {
  tabId: number;
}

