/**
 * Mastra Client for Intella - Handles both LLM calls and Mielto API calls through Mastra
 */

import { storage } from './storage';
import { mieltoAuth } from '@/lib/auth';
import { Memory } from '@/types/memory';

export interface MastraClientConfig {
  baseUrl?: string;
  apiKey?: string;
  workspace_id?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MastraResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class MastraClient {
  private config: MastraClientConfig = {};

  async initialize() {
    const settings = await storage.getSettings();
    this.config = {
      baseUrl: settings.apiUrl || 'http://localhost:8000',
      apiKey: settings.apiKey || '',
      workspace_id: settings.workspace_id || '',
    };
  }

  private async getMieltoHeaders(): Promise<Record<string, string>> {
    await this.initialize();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-memories-enabled': 'true', // Enable memory context in Mielto
    };

    // Get session data for user and workspace context
    const session = await mieltoAuth.getCurrentSession();
    
    if (session?.user?.id) {
      headers['x-user-id'] = session.user.id.toString();
    }

    if (session?.workspace?.id) {
      headers['X-Workspace-Id'] = session.workspace.id;
    } else if (this.config.workspace_id) {
      headers['X-Workspace-Id'] = this.config.workspace_id;
    }

    // Add collection IDs for memory context
    try {
      const collectionId = await storage.getCollectionId();
      if (collectionId) {
        headers['x-collection-ids'] = JSON.stringify([collectionId]);
      }
    } catch (error) {
      console.warn('Could not get collection ID for Mastra client:', error);
    }

    return headers;
  }

  /**
   * Chat with Mielto through custom API call (with memory context)
   * For now, we'll call Mielto directly until we figure out the proper Mastra API
   */
  async chatWithMemories(messages: ChatMessage[]): Promise<MastraResponse> {
    await this.initialize();

    try {
      const headers = await this.getMieltoHeaders();
      
      const requestBody = {
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      };

      const response = await fetch(`${this.config.baseUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.statusText} - ${errorText}`);
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
      console.error('Mastra chat error:', error);
      throw new Error(`Mastra chat failed: ${error}`);
    }
  }

  /**
   * Stream chat with Mielto (placeholder for future implementation)
   */
  async streamChatWithMemories(messages: ChatMessage[]): Promise<AsyncIterable<string>> {
    // For now, fallback to regular chat and simulate streaming
    const response = await this.chatWithMemories(messages);
    return this.simulateStream(response.content);
  }

  private async* simulateStream(content: string): AsyncIterable<string> {
    // Simple word-by-word streaming simulation
    const words = content.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between words
    }
  }

  /**
   * Ask Intella a question using Mastra (with automatic memory context)
   */
  async askIntella(question: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are Intella, a helpful AI assistant with access to the user\'s browsing memories. When relevant memories are available, reference them naturally in your responses.',
      },
      {
        role: 'user',
        content: question,
      }
    ];

    const response = await this.chatWithMemories(messages);
    return response.content;
  }

  /**
   * Create memory summary using Mastra
   */
  async createMemorySummary(content: string, url: string, title: string): Promise<{
    title: string;
    summary: string;
    keywords: string[];
    entities: { people: string[]; organizations: string[]; topics: string[] };
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an AI assistant that analyzes web content and creates structured memory summaries. 

Return a JSON object with the following structure:
{
  "title": "A concise, descriptive title for this content",
  "summary": "A 2-3 sentence summary capturing the key points",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "entities": {
    "people": ["Person Name"],
    "organizations": ["Company Name"],
    "topics": ["Topic1", "Topic2"]
  }
}

Focus on extracting the most important information that would be useful for future reference and search.`,
      },
      {
        role: 'user',
        content: `Please analyze this webpage and create a structured memory summary:\n\nTitle: ${title}\nURL: ${url}\n\nContent:\n${content.slice(0, 4000)}`,
      },
    ];

    try {
      // Use direct API call for summarization
      const headers = {
        'Content-Type': 'application/json',
        'x-memories-enabled': 'false', // Disable memories for summarization
        'X-Workspace-Id': this.config.workspace_id || '',
        'X-API-Key': this.config.apiKey || '',
      };

      const requestBody = {
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 400,
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
        throw new Error(`API error: ${response.statusText} - ${errorText}`);
      }

      const summaryResult = await response.json();
      let content_result = summaryResult.choices?.[0]?.message?.content || '{}';
      
      // Strip markdown code blocks if present
      content_result = content_result.trim();
      if (content_result.startsWith('```')) {
        content_result = content_result.replace(/^```(?:json)?\s*\n?/, '');
        content_result = content_result.replace(/\n?```\s*$/, '');
      }
      
      const summaryData = JSON.parse(content_result.trim());
      
      // Validate and provide defaults
      return {
        title: summaryData.title || title || 'Untitled',
        summary: summaryData.summary || 'Unable to generate summary',
        keywords: Array.isArray(summaryData.keywords) ? summaryData.keywords.slice(0, 5) : [],
        entities: {
          people: Array.isArray(summaryData.entities?.people) ? summaryData.entities.people : [],
          organizations: Array.isArray(summaryData.entities?.organizations) ? summaryData.entities.organizations : [],
          topics: Array.isArray(summaryData.entities?.topics) ? summaryData.entities.topics : [],
        }
      };
    } catch (error) {
      console.error('Error creating memory summary with Mastra:', error);
      // Fallback to basic summary
      return {
        title: title || 'Untitled',
        summary: content.length > 200 ? content.substring(0, 200) + '...' : content,
        keywords: [],
        entities: { people: [], organizations: [], topics: [] }
      };
    }
  }

  /**
   * Improve/rewrite text using Mastra
   */
  async improveText(text: string, instruction: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful writing assistant. Follow the user\'s instructions to improve or modify the provided text.',
      },
      {
        role: 'user',
        content: `${instruction}\n\nOriginal text:\n${text}`,
      },
    ];

    try {
      const response = await this.chatWithMemories(messages);
      return response.content || text;
    } catch (error) {
      console.error('Error improving text with Mastra:', error);
      return text;
    }
  }

  /**
   * Use Mastra interface to call LLMs through Mielto
   * For now, routes through Mielto backend - future versions can support multiple providers
   */
  async callLLM(
    messages: ChatMessage[],
    _options: {
      provider?: 'openai' | 'anthropic' | 'google' | 'azure';
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<MastraResponse> {
    // For now, all providers route through Mielto
    return await this.chatWithMemories(messages);
  }

  /**
   * Get current configuration
   */
  getConfig(): MastraClientConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<MastraClientConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    // Reinitialize agent with new config
    await this.initialize();
  }

  /**
   * Create memory in Mielto backend using Mastra for AI processing
   */
  async createMemoryInBackend(memory: Memory): Promise<void> {
    // Get session data for user_id
    const session = await mieltoAuth.getCurrentSession();
    if (!session?.user?.id) {
      throw new Error('User session required to create memory');
    }

    // Use Mastra to enhance the memory content before storing
    const enhancedSummary = await this.createMemorySummary(
      memory.content || memory.summary,
      memory.url,
      memory.title
    );

    // Prepare memory content
    const entities = enhancedSummary.entities;
    const memoryContent = `${enhancedSummary.summary}

Source: ${memory.url}
Title: ${enhancedSummary.title}
Captured: ${new Date(memory.timestamp).toLocaleString()}
${enhancedSummary.keywords.length > 0 ? `\nKeywords: ${enhancedSummary.keywords.join(', ')}` : ''}
${entities.people && entities.people.length > 0 ? `\nPeople: ${entities.people.join(', ')}` : ''}
${entities.organizations && entities.organizations.length > 0 ? `\nOrganizations: ${entities.organizations.join(', ')}` : ''}
${entities.topics && entities.topics.length > 0 ? `\nTopics: ${entities.topics.join(', ')}` : ''}`;

    // Create memory using the MemoryCreate schema
    const memoryData = {
      user_id: session.user.id,
      memory: memoryContent,
      memory_type: "user",
      topics: [
        ...enhancedSummary.keywords,
        ...(entities.topics || []),
        'web-content',
        'intella-extension'
      ].filter(Boolean).slice(0, 10),
      metadata: {
        url: memory.url,
        title: enhancedSummary.title,
        original_summary: memory.summary,
        enhanced_summary: enhancedSummary.summary,
        timestamp: memory.timestamp,
        source: 'intella-extension-mastra',
        capture_type: memory.meta_data?.captureType,
        element_type: memory.meta_data?.elementType,
        ai_generated: true, // Since we used Mastra for enhancement
        entities: entities,
        ...memory.meta_data,
      }
    };

    // Make direct API call to Mielto (bypass Mastra for data operations)
    const headers = await this.getMieltoAPIHeaders();
    const response = await fetch(`${this.config.baseUrl}/api/v1/memories`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(memoryData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create memory: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Memory created in backend via Mastra:', result.memory_id);
  }

  private async getMieltoAPIHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

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
   * Search memories in Mielto backend
   */
  async searchMemoriesInBackend(query: string): Promise<any[]> {
    const headers = await this.getMieltoAPIHeaders();
    
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
   * Ingest memory via Mastra chat (for AI-powered indexing)
   */
  async ingestMemoryViaChat(memory: Memory): Promise<void> {
    console.log('🧠 Ingesting memory via Mastra chat...');
    
    const ingestPrompt = `Please analyze and store this webpage content for future reference:

Title: ${memory.title}
URL: ${memory.url}
Content: ${memory.content || memory.summary}

This content should be indexed and made searchable for future queries. Please acknowledge that you've processed and stored this information.`;

    try {
      const response = await this.chatWithMemories([
        {
          role: 'system',
          content: 'You are a content indexing assistant. When users provide webpage content, analyze and acknowledge that you will store it for future reference. Keep your response brief.',
        },
        {
          role: 'user',
          content: ingestPrompt,
        }
      ]);

      console.log('✅ Memory ingested via Mastra chat:', response.content);
    } catch (error) {
      console.error('❌ Failed to ingest memory via Mastra chat:', error);
      throw error;
    }
  }
}

export const mastraClient = new MastraClient();