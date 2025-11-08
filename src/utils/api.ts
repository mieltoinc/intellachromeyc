/**
 * Mielto API Client for Intella - Uses AI SDK for LLM calls
 */

import { storage } from './storage';
import { Memory } from '@/types/memory';
import { mieltoAuth } from '@/lib/auth';
import { aiSDKClient, type AIMessage } from './ai-sdk-client';
import { MieltoHandler } from './mielto-handler';

const handler = new MieltoHandler();

export interface MieltoContext {
  workspace_id: string;
  user_id?: string;
  collection_id?: string;
}

export interface MieltoMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionRequest {
  messages: MieltoMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface SummarizeRequest {
  content: string;
  url: string;
  title: string;
}

export interface ExtractEntitiesRequest {
  content: string;
}

export interface UploadResult {
  file_id?: string;
  label: string;
  description?: string;
  uri: string;
  checksum: string;
  mimetype: string;
  size: number;
  ext: string;
  url?: string;
  content?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface UploadResponse {
  // New response format
  status?: string;
  contents?: Array<{
    id: string | null;
    name: string;
    description: string | null;
    content: string | null;
    content_type: string;
    type: string;
    size: number;
    url: string | null;
    metadata: Record<string, any>;
    error?: string;
  }>;
  
  // Legacy response format (for backward compatibility)
  collection_id?: string;
  content_type?: string;
  uploads?: UploadResult[];
  errors?: UploadResult[];
  total_uploads?: number;
  successful_uploads?: number;
  failed_uploads?: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  workspace_id?: string;
  user_id?: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
}

class MieltoAPI {
  private baseUrl: string = '';
  private apiKey: string = '';
  private workspace_id: string = '';
  // private currentConversationId: string | null = null; // Disabled for now

  /**
   * Format model ID with provider prefix if needed
   * OpenAI models: pass as-is
   * Anthropic models: prefix with "anthropic/"
   * Gemini models: prefix with "google/"
   */
  private formatModelId(modelId: string): string {
    // Check if already prefixed
    if (modelId.startsWith('anthropic/') || modelId.startsWith('google/')) {
      return modelId;
    }

    // Anthropic models
    if (modelId.startsWith('claude-')) {
      return `anthropic/${modelId}`;
    }

    // Gemini models
    if (modelId.startsWith('gemini-')) {
      return `google/${modelId}`;
    }

    // OpenAI models (gpt-*) - pass as-is
    return modelId;
  }

  async initialize() {
    const settings = await storage.getSettings();
    this.baseUrl = settings.apiUrl || 'https://api.mielto.com';
    this.apiKey = settings.apiKey || '';
    this.workspace_id = settings.workspace_id || '';
    
    // AI SDK will get baseUrl from settings and append /api/v1 internally
    // No need to update it here as it will read from settings during initialization
  }

  async getBaseUrl(): Promise<string> {
    await this.initialize();
    return this.baseUrl;
  }

  async getHeaders(): Promise<HeadersInit> {
    await this.initialize();
    
    // Try to get auth header from auth service first (supports both API key and token)
    const authHeader = await mieltoAuth.getAuthHeader();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else if (this.apiKey) {
      // Fallback to API key from settings if auth service doesn't have one
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // Add workspace ID header
    if (this.workspace_id) {
      headers['X-Workspace-Id'] = this.workspace_id;
    }

    return headers;
  }


  private async getUploadHeaders(): Promise<HeadersInit> {
    await this.initialize();
    
    const headers: HeadersInit = {};

    // Get session data to extract user ID and workspace
    const session = await mieltoAuth.getCurrentSession();
    
    if (session?.user?.id) {
      headers['x-user-id'] = session.user.id.toString();
    }

    if (session?.workspace?.id) {
      headers['X-Workspace-Id'] = session.workspace.id;
    } else if (this.workspace_id) {
      headers['X-Workspace-Id'] = this.workspace_id;
    }

    // Handle authentication - prefer API key, fallback to token (same as getChatHeaders)
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    } else {
      const authHeader = await mieltoAuth.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    // Note: Don't set Content-Type for FormData - browser will set it with boundary
    return headers;
  }

  /**
   * Generate or get existing conversation ID for memory context (disabled for now)
   */
  // private async getConversationId(): Promise<string> {
  //   if (!this.currentConversationId) {
  //     // Generate a new conversation ID
  //     this.currentConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  //     console.log('🗨️ Generated new conversation ID:', this.currentConversationId);
  //   }
  //   return this.currentConversationId;
  // }

  /**
   * Reset conversation (for new chat sessions) (disabled for now)
   */
  async resetConversation(): Promise<void> {
    // this.currentConversationId = null;
    console.log('🗨️ Conversation reset (no-op for now)');
  }

  /**
   * Chat completion - Uses AI SDK
   */
  async chat(request: ChatCompletionRequest): Promise<any> {
    await this.initialize();

    try {
      // Convert ChatCompletionRequest to AIMessage format
      const aiMessages: AIMessage[] = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Use AI SDK client for generation
      const result = await aiSDKClient.generate(aiMessages, {
        model: request.model || 'gpt-4o',
        temperature: request.temperature,
        maxTokens: request.max_tokens,
      });

      // Return in OpenAI-compatible format
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: result.content,
          },
        }],
        usage: result.usage ? {
          prompt_tokens: result.usage.prompt_tokens,
          completion_tokens: result.usage.completion_tokens,
          total_tokens: result.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      console.error('🤖 Mielto API: Chat error:', error);
      throw new Error(`API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create comprehensive memory summary via completions endpoint
   * This generates a summary that will be used to create the memory
   */
  async createMemorySummary(request: SummarizeRequest): Promise<{
    title: string;
    summary: string;
    keywords: string[];
    entities: { people: string[]; organizations: string[]; topics: string[] };
  }> {
    const chatRequest: ChatCompletionRequest = {
      messages: [
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
          content: `Please analyze this webpage and create a structured memory summary:\n\nTitle: ${request.title}\nURL: ${request.url}\n\nContent:\n${request.content.slice(0, 4000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
    };

    try {
      const response = await this.chat(chatRequest);
      let content = response.choices[0]?.message?.content || '{}';
      
      // Strip markdown code blocks if present
      content = content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*\n?/, '');
        content = content.replace(/\n?```\s*$/, '');
      }
      
      const result = JSON.parse(content.trim());
      
      // Validate and provide defaults
      return {
        title: result.title || request.title || 'Untitled',
        summary: result.summary || 'Unable to generate summary',
        keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 5) : [],
        entities: {
          people: Array.isArray(result.entities?.people) ? result.entities.people : [],
          organizations: Array.isArray(result.entities?.organizations) ? result.entities.organizations : [],
          topics: Array.isArray(result.entities?.topics) ? result.entities.topics : [],
        }
      };
    } catch (error) {
      console.error('Error creating memory summary:', error);
      // Fallback to basic summary
      return {
        title: request.title || 'Untitled',
        summary: request.content.length > 200 ? request.content.substring(0, 200) + '...' : request.content,
        keywords: [],
        entities: { people: [], organizations: [], topics: [] }
      };
    }
  }

  /**
   * Legacy method - kept for backwards compatibility
   */
  async summarizePage(request: SummarizeRequest): Promise<string> {
    const result = await this.createMemorySummary(request);
    return result.summary;
  }

  /**
   * Extract entities from content
   */
  async extractEntities(request: ExtractEntitiesRequest): Promise<{
    people: string[];
    organizations: string[];
    topics: string[];
  }> {
    const chatRequest: ChatCompletionRequest = {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts key entities from text. Return ONLY a JSON object (no markdown formatting) with three arrays: people, organizations, and topics. Only include clear, relevant entities. Example: {"people": ["John Doe"], "organizations": ["Acme Corp"], "topics": ["AI", "Technology"]}',
        },
        {
          role: 'user',
          content: `Extract key entities from this text:\n\n${request.content.slice(0, 4000)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    };

    try {
      const response = await this.chat(chatRequest);
      let content = response.choices[0]?.message?.content || '{}';
      
      // Strip markdown code blocks if present
      content = content.trim();
      if (content.startsWith('```')) {
        // Remove ```json or ``` at start
        content = content.replace(/^```(?:json)?\s*\n?/, '');
        // Remove ``` at end
        content = content.replace(/\n?```\s*$/, '');
      }
      
      // Try to parse JSON response
      const entities = JSON.parse(content.trim());
      return {
        people: entities.people || [],
        organizations: entities.organizations || [],
        topics: entities.topics || [],
      };
    } catch (error) {
      console.error('Error extracting entities:', error);
      return { people: [], organizations: [], topics: [] };
    }
  }

  /**
   * Get or create the default collection for uploads
   */
  async getOrCreateCollection(): Promise<string> {
    await this.initialize();
    
    const headers = await this.getUploadHeaders();
    
    // Get workspace ID
    let workspaceId = this.workspace_id;
    if (!workspaceId) {
      const session = await mieltoAuth.getCurrentSession();
      workspaceId = session?.workspace?.id;
    }
    
    // Build search URL with workspace_id parameter
    const searchParams = new URLSearchParams({
      search: 'Default',
      limit: '1'
    });
    
    if (workspaceId) {
      searchParams.append('workspace_id', workspaceId);
    }
    
    // Try to get existing default collection
    const listResponse = await fetch(`${this.baseUrl}/api/v1/collections?${searchParams.toString()}`, {
      headers,
    });

    if (listResponse.ok) {
      const result = await listResponse.json();
      if (result.data && result.data.length > 0) {
        // Found existing default collection
        return result.data[0].id;
      }
    }

    // Create new default collection
    const collectionData: any = {
      name: 'Default',
      description: 'Default collection for uploads',
      store_type: 'pgvector',
    };
    
    if (workspaceId) {
      collectionData.workspace_id = workspaceId;
    }
    
    const createResponse = await fetch(`${this.baseUrl}/api/v1/collections`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(collectionData),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create default collection: ${createResponse.statusText} - ${errorText}`);
    }

    const newCollection = await createResponse.json();
    return newCollection.id;
  }

  /**
   * Create memory using the /memories endpoint
   */
  async createMemoryInBackend(memory: Memory): Promise<void> {
    const headers = await this.getHeaders();
    
    // Get session data for user_id
    const session = await mieltoAuth.getCurrentSession();
    if (!session?.user?.id) {
      throw new Error('User session required to create memory');
    }

    // Prepare memory content - combine summary and key details
    const entities = memory.entities || { people: [], organizations: [], topics: [] };
    const memoryContent = `${memory.summary}

Source: ${memory.url}
Title: ${memory.title}
Captured: ${new Date(memory.timestamp).toLocaleString()}
${memory.keywords.length > 0 ? `\nKeywords: ${memory.keywords.join(', ')}` : ''}
${entities.people && entities.people.length > 0 ? `\nPeople: ${entities.people.join(', ')}` : ''}
${entities.organizations && entities.organizations.length > 0 ? `\nOrganizations: ${entities.organizations.join(', ')}` : ''}
${entities.topics && entities.topics.length > 0 ? `\nTopics: ${entities.topics.join(', ')}` : ''}`;

    // Create memory using the MemoryCreate schema
    const memoryData = {
      user_id: session.user.id,
      memory: memoryContent,
      memory_type: "user",
      topics: [
        ...memory.keywords,
        ...(entities.topics || []),
        'web-content', // Tag all web content
        'intella-extension' // Source identifier
      ].filter(Boolean).slice(0, 10), // Limit topics
      metadata: {
        url: memory.url,
        title: memory.title,
        original_summary: memory.summary,
        timestamp: memory.timestamp,
        source: 'intella-extension',
        capture_type: memory.meta_data?.captureType,
        element_type: memory.meta_data?.elementType,
        ai_generated: memory.meta_data?.aiGenerated,
        entities: entities,
        ...memory.meta_data,
      }
    };

    const response = await fetch(`${this.baseUrl}/api/v1/memories`, {
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
    console.log('✅ Memory created in backend successfully:', result.memory_id);
  }

  /**
   * Legacy upload method - kept for backwards compatibility
   */
  async saveMemoryToBackend(memory: Memory, _collectionId: string, _conversationId?: string): Promise<void> {
    // Use the new memories endpoint instead
    await this.createMemoryInBackend(memory);
  }

  /**
   * Alternative: Ingest memory using completions endpoint with memories enabled
   * This method processes the memory through the AI pipeline for better understanding
   */
  async ingestMemoryViaCompletions(memory: Memory): Promise<void> {
    console.log('🧠 Ingesting memory via completions endpoint...');
    
    const ingestPrompt = `Please analyze and store this webpage content for future reference:

Title: ${memory.title}
URL: ${memory.url}
Content: ${memory.content || memory.summary}

This content should be indexed and made searchable for future queries. Please acknowledge that you've processed and stored this information.`;

    try {
      const response = await this.chat({
        messages: [
          {
            role: 'system',
            content: 'You are a content indexing assistant. When users provide webpage content, analyze and acknowledge that you will store it for future reference. Keep your response brief.',
          },
          {
            role: 'user',
            content: ingestPrompt,
          }
        ],
        temperature: 0.1,
        max_tokens: 100,
      });

      console.log('✅ Memory ingested via completions:', response.choices[0]?.message?.content);
    } catch (error) {
      console.error('❌ Failed to ingest memory via completions:', error);
      throw error;
    }
  }

  /**
   * Get memories from backend with pagination support
   */
  async getMemoriesFromBackend(options: {
    cursor?: string;
    limit?: number;
    user_id?: string;
  } = {}): Promise<{
    memories: Memory[];
    nextCursor?: string;
    hasMore: boolean;
    totalCount: number;
  }> {
    const headers = await this.getHeaders();
    const { cursor, limit = 50, user_id } = options;
    
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (cursor) queryParams.append('cursor', cursor);
      if (limit) queryParams.append('limit', limit.toString());
      if (user_id) queryParams.append('user_id', user_id);

      const response = await fetch(`${this.baseUrl}/api/v1/memories?${queryParams.toString()}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.statusText}`);
      }

      const result = await response.json();
      const backendMemories = result.memories || [];
      
      // Transform backend memories to our Memory interface
      const transformedMemories = backendMemories.map((memory: any) => ({
        id: memory.memory_id || memory.id,
        url: memory.metadata?.url || '',
        title: memory.metadata?.title || 'Untitled',
        summary: memory.metadata?.original_summary || memory.memory || '',
        content: memory.memory || '',
        keywords: memory.topics || [],
        entities: memory.metadata?.entities || { people: [], organizations: [], topics: [] },
        timestamp: memory.created_at || memory.metadata?.timestamp || new Date().toISOString(),
        lastAccessed: memory.updated_at,
        accessCount: 1,
        archived: false,
        meta_data: memory.metadata
      }));

      return {
        memories: transformedMemories,
        nextCursor: result.next_cursor,
        hasMore: result.has_more || false,
        totalCount: result.total_count || transformedMemories.length
      };
    } catch (error) {
      console.error('Failed to fetch memories from backend:', error);
      return {
        memories: [],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 0
      };
    }
  }

  /**
   * Get all memories from backend (for backward compatibility)
   * This method will fetch all memories by paginating through all pages
   */
  async getAllMemoriesFromBackend(): Promise<Memory[]> {
    const allMemories: Memory[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getMemoriesFromBackend({ cursor, limit: 100 });
      allMemories.push(...result.memories);
      cursor = result.nextCursor;
      hasMore = result.hasMore;
      
      // Safety break to avoid infinite loops
      if (allMemories.length > 10000) {
        console.warn('Reached maximum memory limit (10000), stopping pagination');
        break;
      }
    }

    return allMemories;
  }

  /**
   * Search memories in backend
   */
  async searchMemoriesInBackend(query: string): Promise<any[]> {
    const headers = await this.getHeaders();
    
    const response = await fetch(
      `${this.baseUrl}/api/v1/contents?search=${encodeURIComponent(query)}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to search memories: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Ask Intella a question (memories will be automatically included by the API)
   */
  async askIntella(
    question: string, 
    context?: string, 
    model?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    content: string;
    toolExecutions?: Array<{
      toolName: string;
      args: Record<string, any>;
      success: boolean;
      executionTime?: number;
      error?: string;
    }>;
  }> {
    await this.initialize();
    
    // Use mieltoHandler for chat
    await handler.initialize();
    
    const messages = [
      {
        role: 'system' as const,
        content: 'You are Intella, a helpful AI assistant with access to the user\'s browsing memories. When relevant memories are available, reference them naturally.',
      },
      ...(context ? [{
        role: 'system' as const,
        content: `Additional context from local browsing history search: ${context}`,
      }] : []),
      // Include conversation history if provided
      ...(conversationHistory || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: question,
      },
    ];

    const formattedModel = this.formatModelId(model || 'gpt-4o');
    const result = await handler.chat(messages, {
      model: formattedModel,
    });
    
    return {
      content: result.content || 'I apologize, but I could not generate a response.',
      toolExecutions: result.toolExecutions,
    };
  }

  /**
   * Ask Intella with screenshot (multimodal)
   */
  async askIntellaWithScreenshot(
    question: string, 
    context?: string, 
    screenshot?: string, 
    model?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    content: string;
    toolExecutions?: Array<{
      toolName: string;
      args: Record<string, any>;
      success: boolean;
      executionTime?: number;
      error?: string;
    }>;
  }> {
    await this.initialize();
    
    // Use mieltoHandler for chat
    await handler.initialize();
    
    const messages = [
      {
        role: 'system' as const,
        content: 'You are Intella, a helpful AI assistant with access to the user\'s browsing memories. When relevant memories are available, reference them naturally. You can analyze screenshots to help users understand what they see.',
      },
      ...(context ? [{
        role: 'system' as const,
        content: `Additional context from local browsing history search: ${context}`,
      }] : []),
      // Include conversation history if provided
      ...(conversationHistory || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: screenshot 
          ? [
              ...(question ? [{ type: 'text' as const, text: question }] : []),
              { 
                type: 'image_url' as const, 
                image_url: { 
                  url: screenshot,
                  detail: 'auto' as const
                } 
              }
            ]
          : question,
      },
    ];

    // Log the message format for debugging
    if (screenshot) {
      const userMsg = messages[messages.length - 1];
      console.log('📸 Screenshot message format:', {
        role: userMsg.role,
        contentType: Array.isArray(userMsg.content) ? 'array' : typeof userMsg.content,
        contentLength: Array.isArray(userMsg.content) ? userMsg.content.length : 'N/A',
        contentPreview: Array.isArray(userMsg.content) 
          ? userMsg.content.map((part: any) => ({
              type: part.type,
              hasImageUrl: !!part.image_url,
              imageUrlType: part.image_url ? typeof part.image_url.url : 'N/A',
              imageUrlPreview: part.image_url?.url?.substring(0, 50) + '...'
            }))
          : 'N/A'
      });
    }

    const formattedModel = this.formatModelId(model || 'gpt-4o');
    const result = await handler.chat(messages, {
      model: formattedModel,
    });
    
    return {
      content: result.content || 'I apologize, but I could not generate a response.',
      toolExecutions: result.toolExecutions,
    };
  }

  /**
   * Improve/rewrite text
   */
  async improveText(text: string, instruction: string): Promise<string> {
    const chatRequest: ChatCompletionRequest = {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful writing assistant. Follow the user\'s instructions to improve or modify the provided text.',
        },
        {
          role: 'user',
          content: `${instruction}\n\nOriginal text:\n${text}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    };

    const response = await this.chat(chatRequest);
    return response.choices[0]?.message?.content || text;
  }

  /**
   * Upload files to a collection
   */
  async uploadToCollection(
    collectionId: string,
    files: File[],
    options?: {
      label?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<UploadResponse> {
    const formData = new FormData();
    
    // Add collection_id - this is required
    formData.append('collection_id', collectionId);
    
    // Add files - use 'file' for single uploads, 'files' for multiple
    if (files.length === 1) {
      formData.append('file', files[0]);
    } else {
      files.forEach(file => {
        formData.append('files', file);
      });
    }
    
    // Add optional fields
    if (options?.label) {
      formData.append('label', options.label);
    }
    
    if (options?.description) {
      formData.append('description', options.description);
    }
    
    // Set content_type to 'file' for file uploads
    formData.append('content_type', 'file');
    
    // Skip metadata for now to avoid FormData parsing issues
    // TODO: Fix metadata handling - FastAPI expects Dict but FormData sends string
    // if (options?.metadata) {
    //   formData.append('metadata', JSON.stringify(options.metadata));
    // }
    
    // Debug: Log FormData contents
    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
      console.log(key, ':', value);
    }
    
    const headers = await this.getUploadHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }

  /**
   * Upload text content to a collection
   */
  async uploadTextToCollection(
    collectionId: string,
    content: string,
    options?: {
      label?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<UploadResponse> {
    const formData = new FormData();
    
    formData.append('collection_id', collectionId);
    formData.append('content_type', 'text');
    formData.append('content', content);
    
    if (options?.label) {
      formData.append('label', options.label);
    }
    
    if (options?.description) {
      formData.append('description', options.description);
    }
    
    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }
    
    const headers = await this.getUploadHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }

  /**
   * Upload URLs to a collection
   */
  async uploadUrlsToCollection(
    collectionId: string,
    urls: string[],
    options?: {
      reader?: 'website' | 'firecrawl' | 'native' | 'markitdown';
      crawl?: boolean;
      ingest?: boolean;
      label?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<UploadResponse> {
    const formData = new FormData();
    
    // Required fields
    formData.append('collection_id', collectionId);
    formData.append('content_type', 'url');
    
    // Add URLs
    urls.forEach(url => {
      formData.append('urls', url);
    });
    
    // Processing method - default to 'website' for advanced crawling
    formData.append('reader', options?.reader || 'website');
    
    // Whether to crawl linked pages - default to false
    if (options?.crawl !== undefined) {
      formData.append('crawl', options.crawl.toString());
    } else {
      formData.append('crawl', 'false');
    }
    
    // Whether to process into vector database - default to true
    if (options?.ingest !== undefined) {
      formData.append('ingest', options.ingest.toString());
    } else {
      formData.append('ingest', 'true');
    }
    
    // Optional fields
    if (options?.label) {
      formData.append('label', options.label);
    }
    
    if (options?.description) {
      formData.append('description', options.description);
    }
    
    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }
    
    // Debug: Log FormData contents for troubleshooting
    console.log('Website import FormData contents:');
    for (const [key, value] of formData.entries()) {
      console.log(key, ':', value);
    }
    
    const headers = await this.getUploadHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }

  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<Conversation[]> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/conversations`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get conversations: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Create a new conversation
   */
  async createConversation(title?: string): Promise<Conversation> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: title || `New Chat ${new Date().toLocaleString()}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create conversation: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/conversations/${conversationId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete conversation: ${response.statusText} - ${errorText}`);
    }
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/conversations/${conversationId}/messages`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get conversation messages: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Send a message to a conversation
   */
  async sendMessageToConversation(conversationId: string, content: string): Promise<ConversationMessage> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        role: 'user',
        content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send message: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId: string, title: string): Promise<Conversation> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/v1/conversations/${conversationId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        title,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update conversation: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }
}

export const mieltoAPI = new MieltoAPI();

