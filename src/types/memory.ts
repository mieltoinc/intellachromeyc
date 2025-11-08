/**
 * Memory Types and Interfaces for Intella
 */

export interface Memory {
  id: string;
  url: string;
  title: string;
  summary: string;
  content?: string;
  keywords: string[];
  entities?: {
    people?: string[];
    organizations?: string[];
    topics?: string[];
  };
  timestamp: string;
  lastAccessed?: string;
  accessCount?: number;
  archived?: boolean;
  collection_id?: string;
  meta_data?: Record<string, any>;
}

export interface MemoryFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
  keywords?: string[];
  archived?: boolean;
}

export interface SiteVisibility {
  domain: string;
  isVisible: boolean;
  timestamp: string;
}

export interface UserSettings {
  defaultAction: 'popup' | 'sidepanel';
  apiUrl: string;
  apiKey?: string;
  workspace_id?: string;
  enableAutoCapture: boolean;
  enableSidebar: boolean;
  enableInlineAssistant: boolean;
  sidebarShortcut: string;
  privacyMode: 'all' | 'whitelist' | 'blacklist';
  siteVisibility: Record<string, boolean>;
  ingestionMethod: 'completions' | 'upload' | 'both';
  isAnalysisActive: boolean;
  selectedModel?: string;
  enableStreaming?: boolean;
  
  // Feature 4: Privacy & Blocked Sites
  privacy: {
    blockedDomains: string[];
  };
  
  // Feature 1: Floating Search Bar
  ui: {
    theme?: 'light' | 'dark' | 'system';
    floatingSearchEnabled: boolean;
    floatingSearchPosition: 'bottom-right' | 'bottom-left';
    halloweenThemeEnabled?: boolean;
  };
  
  
  // Moss Integration Settings
  moss: {
    projectId?: string;
    projectKey?: string;
    enabled?: boolean;
  };
  
  // Feature 2: Upgrade to Pro
  account: {
    plan: 'free' | 'pro';
  };
  
  // Feature 2: Billing & Plan Management
  billing: {
    lastCheckedAt: number;
  };
}

export interface ContentAnalysis {
  url: string;
  title: string;
  description?: string;
  content: string;
  headings: string[];
  links: string[];
  images: string[];
  metadata: Record<string, string>;
}

export const DEFAULT_SETTINGS: UserSettings = {
  apiUrl: 'https://api.mielto.com',
  enableAutoCapture: true,
  enableSidebar: true,
  enableInlineAssistant: true,
  sidebarShortcut: 'Ctrl+Shift+I',
  privacyMode: 'all',
  siteVisibility: {},
  defaultAction: 'popup',
  ingestionMethod: 'both',
  isAnalysisActive: true,
  selectedModel: 'gpt-4o',
  enableStreaming: true,
  
  // Feature 4: Privacy & Blocked Sites
  privacy: {
    blockedDomains: [],
  },
  
  // Feature 1: Floating Search Bar
  ui: {
    theme: 'system',
    floatingSearchEnabled: true, // Temporarily enabled for testing
    floatingSearchPosition: 'bottom-right',
    halloweenThemeEnabled: false,
  },
  
  // Moss Integration Settings
  moss: {
    projectId: undefined,
    projectKey: undefined,
    // Will auto-enable if env vars (VITE_MOSS_PROJECT_ID, VITE_MOSS_PROJECT_KEY) are set
    enabled: true,
  },
  
  // Feature 2: Upgrade to Pro
  account: {
    plan: 'free',
  },
  
  // Feature 2: Billing & Plan Management
  billing: {
    lastCheckedAt: 0,
  },
};

