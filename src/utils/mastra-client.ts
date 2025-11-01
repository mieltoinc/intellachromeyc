/**
 * Mastra Client for Intella - Orchestrates Mastra AI Agent and Mielto API operations
 */

import { MastraHandler, type MastraMessage } from './mastra-handler';
import { MieltoHandler } from './mielto-handler';
import { Memory } from '@/types/memory';
import { storage } from './storage';
import { mieltoAuth } from '@/lib/auth';

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
  private mastraHandler: MastraHandler;
  private mieltoHandler: MieltoHandler;

  constructor() {
    this.mastraHandler = new MastraHandler();
    this.mieltoHandler = new MieltoHandler();
  }

  async initialize() {
    const settings = await storage.getSettings();
    this.config = {
      baseUrl: settings.apiUrl || 'http://localhost:8000',
      apiKey: settings.apiKey || '',
      workspace_id: settings.workspace_id || '',
    };
    
    // Initialize both handlers
    await Promise.all([
      this.initializeMastraHandler(),
      this.initializeMieltoHandler()
    ]);
  }

  private async initializeMastraHandler() {
    try {
      // Configure Mastra handler to use OpenAI-compatible endpoint instead of agent endpoint
      this.mastraHandler.updateConfig({
        baseUrl: this.config.baseUrl, // This should point to your Mielto/Mastra server
        agentName: 'intella-assistant', // Name of the agent on the server
        useOpenAICompatible: true, // Use /api/v1/chat/completions instead of /api/agents/{agentName}/generate
        headers: {
          'X-Workspace-Id': this.config.workspace_id || '',
          'X-API-Key': this.config.apiKey || '',
          'x-memories-enabled': 'true',
        },
        retries: 3,
        backoffMs: 300,
        maxBackoffMs: 5000,
      });
      
      await this.mastraHandler.initialize();
      console.log('✅ Mastra Handler initialized with Mielto server');
    } catch (error) {
      console.error('❌ Failed to initialize Mastra Handler:', error);
    }
  }

  private async initializeMieltoHandler() {
    try {
      this.mieltoHandler.updateConfig({
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        workspace_id: this.config.workspace_id,
      });
      
      await this.mieltoHandler.initialize();
      console.log('✅ Mielto Handler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Mielto Handler:', error);
    }
  }


  /**
   * Chat with memories - Uses Mastra Agent which calls Mielto completions endpoint
   */
  async chatWithMemories(messages: ChatMessage[]): Promise<MastraResponse> {
    await this.initialize();

    if (!this.mastraHandler.isAgentReady()) {
      throw new Error('Mastra Agent not ready. Check Mielto endpoint configuration.');
    }

    try {
      const mastraMessages: MastraMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      return await this.mastraHandler.generate(mastraMessages);
    } catch (error) {
      console.error('Mastra Agent (via Mielto) failed:', error);
      throw new Error(`Chat failed: ${error}`);
    }
  }

  /**
   * Stream chat with memories - Uses Mastra Agent which streams from Mielto endpoint
   */
  async streamChatWithMemories(messages: ChatMessage[]): Promise<AsyncIterable<string>> {
    await this.initialize();

    if (!this.mastraHandler.isAgentReady()) {
      throw new Error('Mastra Agent not ready. Check Mielto endpoint configuration.');
    }

    try {
      const mastraMessages: MastraMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      return await this.mastraHandler.stream(mastraMessages);
    } catch (error) {
      console.error('Mastra Agent streaming (via Mielto) failed:', error);
      // Fallback to regular chat and simulate streaming
      const response = await this.chatWithMemories(messages);
      return this.simulateStream(response.content);
    }
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
   * Check if Mastra Agent is properly initialized
   */
  isAgentInitialized(): boolean {
    return this.mastraHandler.isAgentReady();
  }

  /**
   * Check if Mielto handler is ready for memory operations
   */
  isMieltoReady(): boolean {
    return this.mieltoHandler.isReady();
  }

  /**
   * Get status of both handlers
   */
  getHandlerStatus(): { mastra: boolean; mielto: boolean } {
    return {
      mastra: this.mastraHandler.isAgentReady(),
      mielto: this.mieltoHandler.isReady(),
    };
  }

  /**
   * Use Mastra Agent to call LLMs (via Mielto endpoint) with provider options
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
    await this.initialize();
    
    if (!this.mastraHandler.isAgentReady()) {
      throw new Error('Mastra Agent not ready. Check Mielto endpoint configuration.');
    }

    try {
      // Note: Client SDK doesn't expose temperature/maxTokens configuration
      // These would be configured on the server-side agent

      const mastraMessages: MastraMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      return await this.mastraHandler.generate(mastraMessages);
    } catch (error) {
      console.error('Mastra Agent LLM call error:', error);
      throw new Error(`LLM call failed: ${error}`);
    }
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
    // Reinitialize both handlers with new config
    await Promise.all([
      this.initialize(),
      this.initializeMastraHandler(),
      this.initializeMieltoHandler()
    ]);
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
    await this.initialize();
    return await this.mieltoHandler.searchMemories(query);
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