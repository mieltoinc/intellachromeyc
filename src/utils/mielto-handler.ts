/**
 * Mielto Handler - Dedicated handler for Mielto memory operations (not LLM calls)
 */

import { storage } from './storage';
import { mieltoAuth } from '@/lib/auth';
import { Memory } from '@/types/memory';

export interface MieltoConfig {
  baseUrl?: string;
  apiKey?: string;
  workspace_id?: string;
}

export interface MieltoMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MieltoResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
        baseUrl: settings.apiUrl || 'http://localhost:8000',
        apiKey: settings.apiKey || '',
        workspace_id: settings.workspace_id || '',
      };
      
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
   * Chat with Mielto API (with memory context)
   */
  async chat(messages: MieltoMessage[], options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableMemories?: boolean;
  } = {}): Promise<MieltoResponse> {
    await this.initialize();

    try {
      const headers = await this.getMemoryHeaders();
      
      const requestBody = {
        model: options.model || 'gpt-4o',
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2048,
        stream: false,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      };

      const response = await fetch(`${this.config.baseUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mielto API error: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';

      return {
        content,
        usage: result.usage ? {
          prompt_tokens: result.usage.prompt_tokens || 0,
          completion_tokens: result.usage.completion_tokens || 0,
          total_tokens: result.usage.total_tokens || 0,
        } : undefined,
      };
    } catch (error) {
      console.error('Mielto chat error:', error);
      throw new Error(`Mielto chat failed: ${error}`);
    }
  }

  /**
   * Stream chat with Mielto API
   */
  async streamChat(messages: MieltoMessage[], options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableMemories?: boolean;
  } = {}): Promise<AsyncIterable<string>> {
    await this.initialize();

    try {
      const headers = await this.getMemoryHeaders();
      
      const requestBody = {
        model: options.model || 'gpt-4o',
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2048,
        stream: true,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      };

      const response = await fetch(`${this.config.baseUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mielto streaming API error: ${response.statusText} - ${errorText}`);
      }

      return this.parseStreamingResponse(response);
    } catch (error) {
      console.error('Mielto streaming error:', error);
      // Fallback to regular chat and simulate streaming
      const result = await this.chat(messages, options);
      return this.simulateStream(result.content);
    }
  }

  /**
   * Parse streaming response from Mielto API
   */
  private async* parseStreamingResponse(response: Response): AsyncIterable<string> {
    if (!response.body) {
      yield 'No response body';
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
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
    const headers = await this.getMemoryHeaders();
    const response = await fetch(`${this.config.baseUrl}/api/v1/memories`, {
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

    const headers = await this.getMemoryHeaders();
    
    const response = await fetch(
      `${this.config.baseUrl}/api/v1/contents?search=${encodeURIComponent(query)}`,
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