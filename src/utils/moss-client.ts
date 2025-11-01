/**
 * Moss SDK Client for Intella
 * Handles embedding and semantic search of summarized web page content
 */

import { MossClient, DocumentInfo, AddDocumentsOptions } from "@inferedge/moss";
import { storage } from './storage';
import { Memory } from '@/types/memory';

class MossClientManager {
  private client: MossClient | null = null;
  private indexName: string = 'intella-memories';
  private initialized: boolean = false;

  /**
   * Initialize Moss client with credentials from settings or environment variables
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.client) {
      return;
    }

    const settings = await storage.getSettings();
    
    // Check if Moss is enabled (default to true if env vars are set)
    const envProjectId = import.meta.env.VITE_MOSS_PROJECT_ID;
    const envProjectKey = import.meta.env.VITE_MOSS_PROJECT_KEY;
    const hasEnvCredentials = !!(envProjectId && envProjectKey);

    console.log('🔍 Environment variables:', { envProjectId, envProjectKey, hasEnvCredentials });
    
    const mossEnabled = settings.moss?.enabled ?? hasEnvCredentials;
    if (!mossEnabled) {
      console.log('ℹ️ Moss embedding is disabled in settings');
      this.initialized = false;
      return;
    }
    
    // Get credentials from settings first, fallback to environment variables
    const projectId = settings.moss?.projectId || envProjectId;
    const projectKey = settings.moss?.projectKey || envProjectKey;

    if (!projectId || !projectKey) {
      console.warn('⚠️ Moss credentials not configured. Skipping Moss embedding.');
      console.warn('   Set VITE_MOSS_PROJECT_ID and VITE_MOSS_PROJECT_KEY in .env or configure in settings');
      this.initialized = false;
      return;
    }

    // Log which source is being used (for debugging)
    if (envProjectId && envProjectId === projectId) {
      console.log('🔧 Using Moss credentials from environment variables');
    } else if (settings.moss?.projectId) {
      console.log('🔧 Using Moss credentials from user settings');
    }

    try {
      this.client = new MossClient(projectId, projectKey);
      
      // Ensure index exists or create it
      await this.ensureIndex();
      
      this.initialized = true;
      console.log('✅ Moss client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Moss client:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Ensure the index exists, create if it doesn't
   */
  private async ensureIndex(): Promise<void> {
    if (!this.client) return;

    try {
      // Try to get the index
      await this.client.getIndex(this.indexName);
      console.log(`✅ Moss index '${this.indexName}' exists`);
    } catch (error: any) {
      // If index doesn't exist, create it with an empty document array
      if (error.message?.includes('not found') || error.status === 404) {
        console.log(`📝 Creating Moss index '${this.indexName}'...`);
        await this.client.createIndex(this.indexName, [], 'moss-minilm');
        console.log(`✅ Moss index '${this.indexName}' created`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Embed a summarized memory into Moss
   */
  async embedMemory(memory: Memory): Promise<string | null> {
    try {
      await this.initialize();

      if (!this.client || !this.initialized) {
        console.warn('⚠️ Moss client not available, skipping embedding');
        return null;
      }

      // Prepare document for embedding
      // Use the summary as the main text, with metadata for context
      const document: DocumentInfo = {
        id: memory.id,
        text: memory.summary,
        metadata: {
          url: memory.url,
          title: memory.title,
          timestamp: memory.timestamp,
          keywords: memory.keywords?.join(',') || '',
          ...(memory.entities && {
            people: memory.entities.people?.join(',') || '',
            organizations: memory.entities.organizations?.join(',') || '',
            topics: memory.entities.topics?.join(',') || '',
          }),
        },
      };

      // Ensure index is loaded
      try {
        await this.client.loadIndex(this.indexName);
      } catch (error) {
        // Index might already be loaded, continue
        console.log('📚 Index load check:', error);
      }

      // Add document to index with upsert option
      const addResult = await this.client.addDocs(
        this.indexName,
        [document],
        { upsert: true } as AddDocumentsOptions
      );

      console.log('🔍 Add result:', addResult);

      console.log('✅ Memory embedded in Moss:', memory.id);
      return memory.id; // Return the document ID
    } catch (error: any) {
      console.error('❌ Failed to embed memory in Moss:', error);
      // Don't throw - allow memory saving to continue even if Moss embedding fails
      return null;
    }
  }

  /**
   * Search memories semantically using Moss
   */
  async searchMemories(query: string, limit: number = 10): Promise<Array<{
    memoryId: string;
    score: number;
    text: string;
    metadata?: Record<string, any>;
  }>> {
    try {
      await this.initialize();

      if (!this.client || !this.initialized) {
        console.warn('⚠️ Moss client not available, returning empty results');
        return [];
      }

      // Ensure index is loaded
      await this.client.loadIndex(this.indexName);

      // Perform semantic search
      const results = await this.client.query(this.indexName, query, limit);

      return results.docs.map(doc => ({
        memoryId: doc.id,
        score: doc.score,
        text: doc.text,
        metadata: doc.metadata,
      }));
    } catch (error: any) {
      console.error('❌ Failed to search memories in Moss:', error);
      return [];
    }
  }

  /**
   * Delete a memory from Moss index
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      await this.initialize();

      if (!this.client || !this.initialized) {
        return false;
      }

      await this.client.deleteDocs(this.indexName, [memoryId]);
      console.log('✅ Memory deleted from Moss:', memoryId);
      return true;
    } catch (error: any) {
      console.error('❌ Failed to delete memory from Moss:', error);
      return false;
    }
  }

  /**
   * Check if Moss is configured and available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const settings = await storage.getSettings();
      return !!(settings.moss?.projectId && settings.moss?.projectKey);
    } catch {
      return false;
    }
  }
}

export const mossClient = new MossClientManager();

