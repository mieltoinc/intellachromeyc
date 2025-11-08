/**
 * Mielto Handler - Dedicated handler for Mielto memory operations and LLM calls via AI SDK
 */

import { storage } from './storage';
import { mieltoAuth } from '@/lib/auth';
import { Memory } from '@/types/memory';
import { aiSDKClient, type AIMessage } from './ai-sdk-client';

export interface MieltoConfig {
  baseUrl?: string;
  apiKey?: string;
  workspace_id?: string;
}

export interface MieltoMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Array<{ 
    type: 'text' | 'image_url'; 
    text?: string; 
    image_url?: { 
      url: string; 
      detail?: 'low' | 'high' | 'auto' 
    } 
  }>;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ToolExecution {
  toolName: string;
  args: Record<string, any>;
  success: boolean;
  executionTime?: number;
  error?: string;
}

export interface MieltoResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  toolExecutions?: ToolExecution[];
}

export interface MieltoMemoryData {
  user_id: string;
  memory: string;
  memory_type: 'user';
  topics: string[];
  metadata: Record<string, any>;
}

export class MieltoHandler {
  private config: MieltoConfig = {};
  private isInitialized = false;

  /**
   * Initialize the Mielto handler with settings from storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const settings = await storage.getSettings();
      this.config = {
        baseUrl: settings.apiUrl || 'https://api.mielto.com',
        apiKey: settings.apiKey || '',
        workspace_id: settings.workspace_id || '',
      };
      
      // AI SDK will read baseUrl from settings and append /api/v1 during its initialization
      
      this.isInitialized = true;
      console.log('✅ Mielto Handler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Mielto Handler:', error);
      throw error;
    }
  }


  /**
   * Get headers for memory operations (create, search, etc.)
   */
  private async getMemoryHeaders(): Promise<Record<string, string>> {
    await this.initialize();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Get session data to extract user ID and workspace
    const session = await mieltoAuth.getCurrentSession();
    
    if (session?.user?.id) {
      headers['x-user-id'] = session.user.id.toString();
    }

    if (session?.workspace?.id) {
      headers['X-Workspace-Id'] = session.workspace.id;
    } else if (this.config.workspace_id) {
      headers['X-Workspace-Id'] = this.config.workspace_id;
    }

    // Handle authentication - prefer API key, fallback to token
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else {
      const authHeader = await mieltoAuth.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    return headers;
  }

  /**
   * Chat with Mielto API (with memory context) - Uses AI SDK
   */
  async chat(messages: MieltoMessage[], options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableMemories?: boolean;
  } = {}): Promise<MieltoResponse> {
    await this.initialize();

    try {
      // Convert MieltoMessage to AIMessage format
      const aiMessages: AIMessage[] = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
      }));

      // Use AI SDK client for generation with tools enabled
      const result = await aiSDKClient.generate(aiMessages, {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        enableTools: true, // Enable tool calling
      });

      return {
        content: result.content,
        usage: result.usage,
        toolExecutions: result.toolExecutions,
      };
    } catch (error) {
      console.error('Mielto chat error:', error);
      throw new Error(`Mielto chat failed: ${error}`);
    }
  }

  /**
   * Stream chat with Mielto API - Uses AI SDK
   */
  async streamChat(messages: MieltoMessage[], options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableMemories?: boolean;
  } = {}): Promise<AsyncIterable<string>> {
    await this.initialize();

    try {
      // Convert MieltoMessage to AIMessage format
      const aiMessages: AIMessage[] = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
      }));

      // Use AI SDK client for streaming
      return await aiSDKClient.stream(aiMessages, {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
    } catch (error) {
      console.error('Mielto streaming error:', error);
      // Fallback to regular chat and simulate streaming
      const result = await this.chat(messages, options);
      return this.simulateStream(result.content);
    }
  }


  /**
   * Simulate streaming for fallback scenarios
   */
  private async* simulateStream(content: string): AsyncIterable<string> {
    const words = content.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Chat with Mielto API - Uses AI SDK (tools removed)
   */
  async chatWithTools(messages: MieltoMessage[], options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableMemories?: boolean;
  } = {}): Promise<MieltoResponse> {
    await this.initialize();

    // Use regular chat (tools removed)
    return this.chat(messages, options);
  }

  /**
   * Create memory in Mielto backend
   */
  async createMemory(memory: Memory): Promise<void> {
    await this.initialize();

    // Get session data for user_id
    const session = await mieltoAuth.getCurrentSession();
    if (!session?.user?.id) {
      throw new Error('User session required to create memory');
    }

    // Prepare memory content
    const entities = memory.entities || { people: [], organizations: [], topics: [] };
    const memoryContent = `${memory.summary}

Source: ${memory.url}
Title: ${memory.title}
Captured: ${new Date(memory.timestamp).toLocaleString()}
${memory.keywords && memory.keywords.length > 0 ? `\nKeywords: ${memory.keywords.join(', ')}` : ''}
${entities.people && entities.people.length > 0 ? `\nPeople: ${entities.people.join(', ')}` : ''}
${entities.organizations && entities.organizations.length > 0 ? `\nOrganizations: ${entities.organizations.join(', ')}` : ''}
${entities.topics && entities.topics.length > 0 ? `\nTopics: ${entities.topics.join(', ')}` : ''}`;

    // Create memory using the MemoryCreate schema
    const memoryData: MieltoMemoryData = {
      user_id: session.user.id,
      memory: memoryContent,
      memory_type: "user",
      topics: [
        ...(memory.keywords || []),
        ...(entities.topics || []),
        'web-content',
        'intella-extension'
      ].filter(Boolean).slice(0, 10),
      metadata: {
        url: memory.url,
        title: memory.title,
        original_summary: memory.summary,
        timestamp: memory.timestamp,
        source: 'intella-extension-mielto',
        capture_type: memory.meta_data?.captureType,
        element_type: memory.meta_data?.elementType,
        entities: entities,
        ...memory.meta_data,
      }
    };

    // Make API call to create memory
    // Note: Memory creation still uses fetch as it's not an LLM call
    const headers = await this.getMemoryHeaders();
    const baseUrl = (this.config.baseUrl || 'https://api.mielto.com').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/v1/memories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(memoryData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create memory: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Memory created in Mielto backend:', result.memory_id);
  }

  /**
   * Search memories in Mielto backend
   */
  async searchMemories(query: string): Promise<any[]> {
    await this.initialize();

    // Note: Memory search still uses fetch as it's not an LLM call
    const headers = await this.getMemoryHeaders();
    const baseUrl = (this.config.baseUrl || 'https://api.mielto.com').replace(/\/$/, '');
    const response = await fetch(
      `${baseUrl}/api/v1/contents?search=${encodeURIComponent(query)}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to search memories: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MieltoConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isInitialized = false; // Force re-initialization
  }

  /**
   * Get current configuration
   */
  getConfig(): MieltoConfig {
    return { ...this.config };
  }

  /**
   * Check if handler is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}