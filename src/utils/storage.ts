/**
 * IndexedDB Storage Manager for Intella
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Memory, UserSettings, SiteVisibility, DEFAULT_SETTINGS } from '@/types/memory';

interface IntellaDB extends DBSchema {
  memories: {
    key: string;
    value: Memory;
    indexes: {
      'by-timestamp': string;
      'by-url': string;
      'by-keywords': string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  siteVisibility: {
    key: string;
    value: SiteVisibility;
  };
}

class StorageManager {
  private dbPromise: Promise<IDBPDatabase<IntellaDB>> | null = null;
  private readonly DB_NAME = 'intella-db';
  private readonly DB_VERSION = 1;

  private async getDB(): Promise<IDBPDatabase<IntellaDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<IntellaDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Memories store
          if (!db.objectStoreNames.contains('memories')) {
            const memoriesStore = db.createObjectStore('memories', { keyPath: 'id' });
            memoriesStore.createIndex('by-timestamp', 'timestamp');
            memoriesStore.createIndex('by-url', 'url');
            memoriesStore.createIndex('by-keywords', 'keywords', { multiEntry: true });
          }

          // Settings store
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }

          // Site visibility store
          if (!db.objectStoreNames.contains('siteVisibility')) {
            db.createObjectStore('siteVisibility', { keyPath: 'domain' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  // Memory operations
  async saveMemory(memory: Memory): Promise<Memory> {
    const db = await this.getDB();
    
    // Check if a memory with the same URL already exists
    const existingMemories = await this.getMemoriesByUrl(memory.url);
    
    if (existingMemories.length > 0) {
      // Memory with this URL already exists - update it instead of creating duplicate
      const existingMemory = existingMemories[0]; // Use the first one (most recent or oldest)
      
      console.log(`🔄 Memory with URL already exists (${existingMemory.id}), updating instead of creating duplicate`);
      
      // Merge the new memory data with existing memory, keeping the existing ID
      const updatedMemory: Memory = {
        ...existingMemory,
        ...memory,
        id: existingMemory.id, // Keep the original ID
        url: memory.url, // Ensure URL stays the same
        timestamp: existingMemory.timestamp, // Keep original timestamp (or use new one? user might want this configurable)
        // Update summary, title, keywords if they've changed
        summary: memory.summary || existingMemory.summary,
        title: memory.title || existingMemory.title,
        keywords: memory.keywords?.length ? memory.keywords : existingMemory.keywords,
        entities: memory.entities || existingMemory.entities,
        // Preserve existing metadata
        meta_data: {
          ...existingMemory.meta_data,
          ...memory.meta_data,
        },
        // Update last accessed if provided
        lastAccessed: memory.lastAccessed || existingMemory.lastAccessed,
        accessCount: (existingMemory.accessCount || 0) + (memory.accessCount || 0),
      };
      
      await db.put('memories', updatedMemory);
      console.log(`✅ Updated existing memory: ${updatedMemory.id}`);
      return updatedMemory;
    }
    
    // No existing memory with this URL - create new one
    await db.put('memories', memory);
    console.log(`✅ Created new memory: ${memory.id} for URL: ${memory.url}`);
    return memory;
  }

  async getMemory(id: string): Promise<Memory | undefined> {
    const db = await this.getDB();
    return db.get('memories', id);
  }

  async getAllMemories(): Promise<Memory[]> {
    const db = await this.getDB();
    return db.getAll('memories');
  }

  async searchMemories(query: string, limit: number = 10): Promise<Memory[]> {
    const db = await this.getDB();
    const allMemories = await db.getAll('memories');
    
    const lowerQuery = query.toLowerCase();
    return allMemories.filter(memory => 
      memory.title.toLowerCase().includes(lowerQuery) ||
      memory.summary.toLowerCase().includes(lowerQuery) ||
      memory.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ||
      memory.url.toLowerCase().includes(lowerQuery)
    ).slice(0, limit);
  }

  async deleteMemory(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('memories', id);
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<void> {
    const db = await this.getDB();
    const memory = await db.get('memories', id);
    if (memory) {
      await db.put('memories', { ...memory, ...updates });
    }
  }

  async clearAllMemories(): Promise<void> {
    const db = await this.getDB();
    await db.clear('memories');
  }

  async getMemoriesByUrl(url: string): Promise<Memory[]> {
    const db = await this.getDB();
    return db.getAllFromIndex('memories', 'by-url', url);
  }

  async getRecentMemories(limit: number = 10): Promise<Memory[]> {
    const db = await this.getDB();
    const allMemories = await db.getAll('memories');
    return allMemories
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Settings operations
  async getSettings(): Promise<UserSettings> {
    const db = await this.getDB();
    const settings = await db.get('settings', 'user-settings');
    return settings || DEFAULT_SETTINGS;
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<void> {
    const db = await this.getDB();
    const currentSettings = await this.getSettings();
    await db.put('settings', { ...currentSettings, ...settings }, 'user-settings');
  }

  // Collection ID storage
  async getCollectionId(): Promise<string | null> {
    const db = await this.getDB();
    const collectionId = await db.get('settings', 'collection-id');
    return collectionId || null;
  }

  async setCollectionId(collectionId: string): Promise<void> {
    const db = await this.getDB();
    await db.put('settings', collectionId, 'collection-id');
  }

  // Site visibility operations
  async getSiteVisibility(domain: string): Promise<boolean> {
    const db = await this.getDB();
    const visibility = await db.get('siteVisibility', domain);
    return visibility?.isVisible ?? true; // Default to visible
  }

  async setSiteVisibility(domain: string, isVisible: boolean): Promise<void> {
    const db = await this.getDB();
    await db.put('siteVisibility', {
      domain,
      isVisible,
      timestamp: new Date().toISOString(),
    });
  }

  async getAllSiteVisibility(): Promise<SiteVisibility[]> {
    const db = await this.getDB();
    return db.getAll('siteVisibility');
  }

  // Feature 4: Blocked Domains Management
  async addBlockedDomain(domain: string): Promise<void> {
    // Simple normalization without importing client-side utilities
    const normalizedDomain = domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '') // Remove protocol
      .replace(/\/.*$/, '') // Remove path
      .replace(/:\d+$/, ''); // Remove port
    
    // Basic validation
    if (!normalizedDomain) {
      throw new Error('Domain cannot be empty');
    }
    
    // Check for valid domain format (basic validation)
    const domainPart = normalizedDomain.startsWith('*.') ? normalizedDomain.slice(2) : normalizedDomain;
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
    
    if (!domainRegex.test(domainPart)) {
      throw new Error('Invalid domain format');
    }
    
    const settings = await this.getSettings();
    if (!settings.privacy.blockedDomains.includes(normalizedDomain)) {
      settings.privacy.blockedDomains.push(normalizedDomain);
      await this.updateSettings(settings);
      console.log('✅ Added normalized domain to blocked list:', normalizedDomain);
    } else {
      console.log('ℹ️ Domain already in blocked list:', normalizedDomain);
    }
  }

  async removeBlockedDomain(domain: string): Promise<void> {
    // Simple normalization without importing client-side utilities
    const normalizedDomain = domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '') // Remove protocol
      .replace(/\/.*$/, '') // Remove path
      .replace(/:\d+$/, ''); // Remove port
    
    const settings = await this.getSettings();
    settings.privacy.blockedDomains = settings.privacy.blockedDomains.filter(d => d !== normalizedDomain);
    await this.updateSettings(settings);
    console.log('✅ Removed domain from blocked list:', normalizedDomain);
  }

  async getBlockedDomains(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.privacy.blockedDomains || [];
  }

  async setBlockedDomains(domains: string[]): Promise<void> {
    const settings = await this.getSettings();
    settings.privacy.blockedDomains = domains;
    await this.updateSettings(settings);
  }

  // Chrome storage sync (for cross-device sync)
  async syncToChromeStorage(): Promise<void> {
    const settings = await this.getSettings();
    await chrome.storage.sync.set({ settings });
  }

  async syncFromChromeStorage(): Promise<void> {
    const result = await chrome.storage.sync.get('settings');
    if (result.settings) {
      await this.updateSettings(result.settings);
    }
  }

  // Clear all user data (for logout)
  async clearAllUserData(): Promise<void> {
    console.log('🧹 Clearing all user data...');
    const db = await this.getDB();
    
    // Clear all memories
    await db.clear('memories');
    console.log('✅ Cleared memories');
    
    // Clear settings (reset to defaults)
    await db.clear('settings');
    console.log('✅ Cleared settings');
    
    // Clear site visibility
    await db.clear('siteVisibility');
    console.log('✅ Cleared site visibility');
    
    // Clear Chrome sync storage
    await chrome.storage.sync.clear();
    console.log('✅ Cleared Chrome sync storage');
    
    console.log('🎉 All user data cleared successfully');
  }

}

export const storage = new StorageManager();

