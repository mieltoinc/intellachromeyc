/**
 * Moss SDK Client for Intella
 * Handles embedding and semantic search of summarized web page content
 */

import { MossClient as InferedgeMossClient, DocumentInfo, AddDocumentsOptions, IndexInfo, SearchResult } from "@inferedge/moss";
import { Memory } from '@/types/memory';

/**
 * Wrapper around Inferedge MossClient for better type safety and cleaner API
 */
class MossClient {
  public client: InferedgeMossClient;
  
  constructor(projectId: string, projectKey: string) {
    this.client = new InferedgeMossClient(projectId, projectKey);
  }

  public getIndex(indexName: string): Promise<IndexInfo> {
    return this.client.getIndex(indexName);
  }

  public createIndex(indexName: string, documents: DocumentInfo[], model: string): Promise<boolean> {
    return this.client.createIndex(indexName, documents, model);
  }

  public loadIndex(indexName: string): Promise<string> {
    return this.client.loadIndex(indexName);
  }

  public addDocuments(indexName: string, documents: DocumentInfo[], options: AddDocumentsOptions): Promise<{ added: number; updated: number }> {
    return this.client.addDocs(indexName, documents, options);
  }

  public query(indexName: string, query: string, limit: number): Promise<SearchResult> {
    return this.client.query(indexName, query, limit);
  }

  public deleteDocuments(indexName: string, documentIds: string[]): Promise<{ deleted: number }> {
    return this.client.deleteDocs(indexName, documentIds);
  }

  public getDocuments(indexName: string, options?: { docIds?: string[] }): Promise<DocumentInfo[]> {
    return this.client.getDocs(indexName, options);
  }
}

/**
 * Manager for Moss client lifecycle and index state
 */
class MossClientManager {
  private client: MossClient | null = null;
  private indexName: string = 'intella-memories';
  private initialized: boolean = false;
  private indexLoaded: boolean = false;
  private staleIndex: boolean = false;

  /**
   * Get credentials from environment variables
   */
  private async getCredentials(): Promise<{ projectId: string; projectKey: string } | null> {
    const envProjectId = import.meta.env.VITE_MOSS_PROJECT_ID;
    const envProjectKey = import.meta.env.VITE_MOSS_PROJECT_KEY;
    
    if (!envProjectId || !envProjectKey) {
      return null;
    }

    return { projectId: envProjectId, projectKey: envProjectKey };
  }

  /**
   * Create a new Moss client instance
   */
  private async createClient(): Promise<MossClient> {
    const credentials = await this.getCredentials();
    
    if (!credentials) {
      throw new Error('Moss credentials not configured. Set VITE_MOSS_PROJECT_ID and VITE_MOSS_PROJECT_KEY');
    }

    return new MossClient(credentials.projectId, credentials.projectKey);
  }

  /**
   * Ensure index exists, create if it doesn't
   */
  private async ensureIndex(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.getIndex(this.indexName);
      console.log(`✅ Moss index '${this.indexName}' exists`);
    } catch (error: any) {
      console.log('🔄 Error checking index:', error.message);
      // Index doesn't exist, create it
      if (error.message?.includes('not found') || error.message?.includes('404') || error.status === 404) {
        console.log(`📝 Creating Moss index '${this.indexName}'...`);
        await this.client.createIndex(this.indexName, [], 'moss-minilm');
        this.staleIndex = true; // Mark as stale so it gets loaded on next query
        console.log(`✅ Moss index '${this.indexName}' created`);
      } else {
        console.warn('⚠️ Error checking/creating index:', error.message);
      }
    }
  }

  /**
   * Initialize Moss client - called on browser load or when reinitializing
   */
  async initialize(): Promise<void> {
    // If already initialized and not stale, skip
    if (this.initialized && this.client && !this.staleIndex) {
      return;
    }

    const credentials = await this.getCredentials();
    
    if (!credentials) {
      console.log('ℹ️ Moss not configured - skipping initialization');
      this.initialized = false;
      this.client = null;
      return;
    }

    try {
      // If stale or not initialized, create new client
      if (this.staleIndex || !this.client) {
        if (this.client) {
          console.log('🔄 Recreating Moss client due to stale index');
        }
        this.client = await this.createClient();
        this.indexLoaded = false; // Reset index loaded state
      }

      // Ensure index exists
      await this.ensureIndex();
      
      this.initialized = true;
      this.staleIndex = false; // Clear stale flag after recreating client
      console.log('✅ Moss client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Moss client:', error);
      this.initialized = false;
      this.client = null;
      throw error;
    }
  }

  /**
   * Ensure index is loaded before querying
   */
  private async ensureIndexLoaded(): Promise<void> {
    // If index is stale, we need to reload
    if (this.staleIndex) {
      console.log('🔄 Index is stale, reloading...');
      
      // Reinitialize client (will recreate if stale)
      await this.initialize();
      
      // Load the index
      if (this.client) {
        try {
          await this.client.loadIndex(this.indexName);
          this.indexLoaded = true;
          this.staleIndex = false;
          console.log('✅ Index reloaded successfully');
        } catch (error: any) {
          console.warn('⚠️ Index load failed:', error.message);
          // Mark as loaded anyway - API might still work
          this.indexLoaded = true;
          this.staleIndex = false;
        }
      }
    } else if (!this.indexLoaded && this.client) {
      // Index not loaded but not stale - load it now
      try {
        await this.client.loadIndex(this.indexName);
        this.indexLoaded = true;
        console.log('✅ Index loaded successfully');
      } catch (error: any) {
        console.warn('⚠️ Index load failed (non-critical):', error.message);
        this.indexLoaded = true; // Mark as loaded anyway
      }
    }
  }

  /**
   * Check if a memory is already embedded in Moss
   */
  private async isMemoryEmbedded(memoryId: string): Promise<boolean> {
    if (!this.client || !this.initialized) {
      return false;
    }

    try {
      // Try to get the document by ID to check if it exists
      const docs = await this.client.getDocuments(this.indexName, { docIds: [memoryId] });
      return docs && docs.length > 0;
    } catch (error) {
      // If we can't check, assume not embedded (might not exist yet)
      return false;
    }
  }

  /**
   * Embed a memory into Moss index (only if not already embedded)
   */
  async embedMemory(memory: Memory): Promise<string | null> {
    try {
      // Initialize if not already initialized
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.client || !this.initialized) {
        console.warn('⚠️ Moss client not available, skipping embedding');
        return null;
      }

      // Check if already embedded (using upsert will handle updates, but we check to avoid unnecessary API calls)
      const isEmbedded = await this.isMemoryEmbedded(memory.id);
      
      if (isEmbedded) {
        console.log(`ℹ️ Memory ${memory.id} already embedded in Moss, updating instead`);
      }

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

      // Use upsert to update if exists, create if not
      await this.client.addDocuments(this.indexName, [document], { upsert: true });

      // Mark index as stale after adding documents
      this.staleIndex = true;
      this.indexLoaded = false;
      
      if (isEmbedded) {
        console.log('✅ Memory updated in Moss:', memory.id);
      } else {
        console.log('✅ Memory embedded in Moss:', memory.id);
      }
      console.log('🔄 Index marked as stale - will reload on next query');
      
      return memory.id;
    } catch (error: any) {
      console.error('❌ Failed to embed memory in Moss:', error);
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
      // Initialize if not already initialized
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.client || !this.initialized) {
        console.warn('⚠️ Moss client not available, returning empty results');
        return [];
      }

      // Ensure index is loaded before querying
      await this.ensureIndexLoaded();

      // Perform semantic search
      const results = await this.client.query(this.indexName, query, limit);
      
      console.log(`✅ Moss search completed, found ${results.docs.length} results`);

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
      // Initialize if not already initialized
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.client || !this.initialized) {
        return false;
      }

      await this.client.deleteDocuments(this.indexName, [memoryId]);
      
      // Mark index as stale after deleting
      this.staleIndex = true;
      this.indexLoaded = false;
      console.log('✅ Memory deleted from Moss:', memoryId);
      console.log('🔄 Index marked as stale - will reload on next query');
      
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
    const credentials = await this.getCredentials();
    return credentials !== null;
  }
}

export const mossClient = new MossClientManager();
