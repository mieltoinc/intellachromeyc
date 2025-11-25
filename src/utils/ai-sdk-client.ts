/**
 * AI SDK Client - Unified client for AI interactions using Vercel AI SDK
 * Uses api.mielto.com (appends /api/v1 automatically) as the base URL
 */

import { streamText, generateText, tool, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { storage } from './storage';
import { mieltoAuth } from '@/lib/auth';
import { toolRegistry } from './tool-registry';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    image?: string;
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

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  toolExecutions?: ToolExecution[];
}

export interface AIConfig {
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AISDKClient {
  private config: AIConfig = {};
  private isInitialized = false;
  private defaultBaseUrl = 'https://api.mielto.com';

  /**
   * Initialize the AI SDK client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const settings = await storage.getSettings();
      const apiUrl = settings.apiUrl || this.defaultBaseUrl;
      
      // For AI SDK, append /api/v1/ to the base URL
      const baseUrlWithoutTrailingSlash = apiUrl.replace(/\/$/, '');
      const aiSdkBaseUrl = baseUrlWithoutTrailingSlash.endsWith('/api/v1')
        ? baseUrlWithoutTrailingSlash
        : `${baseUrlWithoutTrailingSlash}/api/v1`;

      this.config = {
        baseUrl: aiSdkBaseUrl,
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
      };

      this.isInitialized = true;
      console.log('✅ AI SDK Client initialized with baseUrl:', this.config.baseUrl);
    } catch (error) {
      console.error('❌ Failed to initialize AI SDK Client:', error);
      throw error;
    }
  }

  /**
   * Get headers for AI SDK requests
   */
  private async getHeaders(): Promise<Record<string, string>> {
    await this.initialize();

    const headers: Record<string, string> = {
      'x-memories-enabled': 'false',
    };

    // Get session data to extract user ID and workspace
    const session = await mieltoAuth.getCurrentSession();
    
    if (session?.user?.id) {
      headers['x-user-id'] = session.user.id.toString();
    }

    if (session?.workspace?.id) {
      headers['X-Workspace-Id'] = session.workspace.id;
    }

    // Add collection IDs header
    try {
      const collectionId = await storage.getCollectionId();
      if (collectionId) {
        headers['x-collection-ids'] = JSON.stringify([collectionId]);
      }
    } catch (error) {
      console.warn('Could not get collection ID for memories:', error);
    }

    // Handle authentication - prefer API key, fallback to token
    const settings = await storage.getSettings();
    if (settings.apiKey) {
      headers['X-API-Key'] = settings.apiKey;
    } else {
      const authHeader = await mieltoAuth.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    return headers;
  }

  /**
   * Get API key for OpenAI provider
   */
  private async getApiKey(): Promise<string> {
    await this.initialize();
    const headers = await this.getHeaders();
    return headers['X-API-Key'] || headers['Authorization']?.replace(/^Bearer\s+/i, '') || 'dummy-key';
  }

  /**
   * Generate text with optional tool support
   */
  async generate(
    messages: AIMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      enableTools?: boolean;
    } = {}
  ): Promise<AIResponse> {
    await this.initialize();

    const {
      model = this.config.model || 'gpt-4o',
      temperature = this.config.temperature || 0.7,
      // maxTokens = this.config.maxTokens || 2048,
      enableTools = true,
    } = options;

    try {
      const apiKey = await this.getApiKey();
      
      // Always read fresh from settings to ensure latest baseURL is used
      const settings = await storage.getSettings();
      const apiUrl = settings.apiUrl || this.defaultBaseUrl;
      
      // For AI SDK, append /api/v1/ to the base URL
      const baseUrlWithoutTrailingSlash = apiUrl.replace(/\/$/, '');
      const baseUrl = baseUrlWithoutTrailingSlash.endsWith('/api/v1')
        ? baseUrlWithoutTrailingSlash
        : `${baseUrlWithoutTrailingSlash}/api/v1`;
      
      console.log('🌐 Using baseURL:', baseUrl);

      // Create OpenAI provider with custom base URL using createOpenAI
      // This creates a callable provider function that accepts model names
      const openaiProvider = createOpenAI({
        apiKey, // 
        baseURL: baseUrl,
      });

      // Call the provider function with the model name to get the language model
      const languageModel = openaiProvider.chat(model || 'gpt-4o');

      // Prepare messages for AI SDK
      const conversationMessages = messages.map(msg => {
        if (msg.role === 'tool' && msg.tool_call_id) {
          // Check if tool result contains a screenshot and convert to image content
          try {
            const toolContent = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            
            // Check if this is a screenshot result from capture_screenshot tool
            if (toolContent && typeof toolContent === 'object' && toolContent.screenshot) {
              const screenshotUrl = toolContent.screenshot;
              console.log('📸 Converting screenshot tool result to image_url format');
              // Convert to image_url content format
              return {
                role: 'tool' as const,
                content: [
                  {
                    type: 'image' as const,
                    image_url: {
                      url: screenshotUrl,
                      detail: 'auto' as const
                    }
                  }
                ],
                toolCallId: msg.tool_call_id,
              };
            }
          } catch (e) {
            // If parsing fails, use original content
          }
          
          return {
            role: 'tool' as const,
            content: msg.content,
            toolCallId: msg.tool_call_id,
          };
        }
        
        // Log multimodal content for debugging
        if (Array.isArray(msg.content)) {
          console.log('🖼️ Multimodal message detected:', JSON.stringify(msg.content, null, 2));
        }
        
        return {
          role: msg.role,
          content: msg.content,
        };
      });

      // Generate response with tools
      let finalResponse = '';
      let finalUsage: any = undefined;
      const toolExecutions: ToolExecution[] = [];
      const tools: Record<string, any> = {};

      if (enableTools) {
        // Get Zod schemas directly from providers
        const zodSchemas = toolRegistry.getZodSchemasForAI();
        console.log(`🔧 Tools enabled: ${enableTools}, Found ${zodSchemas.size} tools`);

        // Create tools using Zod schemas directly
        for (const [toolName, { description, schema, outputSchema }] of zodSchemas.entries()) {
          const toolConfig: any = {
            description,
            inputSchema: schema,
            execute: async (args: Record<string, any>) => {
              const startTime = Date.now();
              try {
                const result = await toolRegistry.executeTool(toolName, args);
                const executionTime = Date.now() - startTime;
                
                toolExecutions.push({
                  toolName,
                  args,
                  success: result.success,
                  executionTime,
                  error: result.error,
                });
                
                return result.success ? result.result : { error: result.error };
              } catch (error: any) {
                const executionTime = Date.now() - startTime;
                toolExecutions.push({
                  toolName,
                  args,
                  success: false,
                  executionTime,
                  error: error.message || 'Unknown error',
                });
                return { error: error.message || 'Unknown error' };
              }
            },
          };
          
          // Add outputSchema if provided
          if (outputSchema) {
            toolConfig.outputSchema = outputSchema;
          }
          
          tools[toolName] = tool(toolConfig);
        }
      }

      // Check if streaming is enabled (read from settings we already have)
      const useStreaming = true

      if (useStreaming) {
        // Use streamText for streaming responses
        console.log('📡 Using streaming mode');
        let streamResult: any;
        if (Object.keys(tools).length > 0) {
          streamResult = streamText({
            model: languageModel,
            messages: conversationMessages as any,
            tools,
            temperature,
            stopWhen: stepCountIs(5),
          } as any);
        } else {
          // No tools - simple generation
          streamResult = streamText({
            model: languageModel,
            messages: conversationMessages as any,
            temperature,
          });
        }

        // Collect streamed text chunks
        for await (const textChunk of streamResult.textStream) {
          finalResponse += textChunk;
        }

        // Get final text and usage from stream result (these are Promises)
        try {
          // Try to get the full text if available (some SDK versions provide this)
          const fullText = await streamResult.text;
          if (fullText && fullText.trim()) {
            finalResponse = fullText;
          }
        } catch (e) {
          // text property might not exist, use accumulated response
          console.log('streamResult.text not available, using accumulated text');
        }

        // Get usage stats
        try {
          finalUsage = await streamResult.usage;
        } catch (e) {
          console.log('Could not get usage stats from stream result');
        }
      } else {
        // Use generateText for non-streaming responses (better for tool calling)
        console.log('📝 Using non-streaming mode');
        let generateResult: any;
        if (Object.keys(tools).length > 0) {
          generateResult = await generateText({
            model: languageModel,
            messages: conversationMessages as any,
            tools,
            temperature,
            maxSteps: 5,
          } as any);
        } else {
          // No tools - simple generation
          generateResult = await generateText({
            model: languageModel,
            messages: conversationMessages as any,
            temperature,
          });
        }

        // Get final text and usage from result
        finalResponse = generateResult.text || '';
        finalUsage = generateResult.usage;
      }

      // Fallback if no response was generated
      if (!finalResponse || finalResponse.trim() === '') {
        finalResponse = toolExecutions.length > 0
          ? `I executed ${toolExecutions.length} tool(s) but did not receive a final response.`
          : 'I apologize, but I could not generate a response.';
      }

      return {
        content: finalResponse,
        usage: finalUsage ? {
          prompt_tokens: (finalUsage as any).promptTokens || 0,
          completion_tokens: (finalUsage as any).completionTokens || 0,
          total_tokens: ((finalUsage as any).promptTokens || 0) + ((finalUsage as any).completionTokens || 0),
        } : undefined,
        toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
      };
    } catch (error) {
      console.error('AI SDK generation error:', error);
      throw error;
    }
  }

  /**
   * Stream text
   */
  async stream(
    messages: AIMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<AsyncIterable<string>> {
    await this.initialize();

    const {
      model = this.config.model || 'gpt-4o',
      temperature = this.config.temperature || 0.7,
      maxTokens = this.config.maxTokens || 2048,
    } = options;

    try {
      const apiKey = await this.getApiKey();
      
      // Always read fresh from settings to ensure latest baseURL is used
      const settings = await storage.getSettings();
      const apiUrl = settings.apiUrl || this.defaultBaseUrl;
      
      // Check if streaming is enabled
      const useStreaming = settings.enableStreaming || false;
      
      if (!useStreaming) {
        // Streaming disabled - use generate and simulate streaming
        console.log('⚠️ Streaming disabled - using non-streaming generation with simulated streaming');
        const result = await this.generate(messages, options);
        return this.simulateStream(result.content);
      }
      
      // For AI SDK, append /api/v1/ to the base URL
      const baseUrlWithoutTrailingSlash = apiUrl.replace(/\/$/, '');
      const baseUrl = baseUrlWithoutTrailingSlash.endsWith('/api/v1')
        ? baseUrlWithoutTrailingSlash
        : `${baseUrlWithoutTrailingSlash}/api/v1`;
      
      console.log('🌐 Using baseURL (stream):', baseUrl);

      // Create OpenAI provider with custom base URL using createOpenAI
      // This creates a callable provider function that accepts model names
      const openaiProvider = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      });

      // Call the provider function with the model name to get the language model
      const languageModel = openaiProvider.chat(model || 'gpt-4o');

      // Use AI SDK streamText
      const result = await streamText({
        model: languageModel,
        messages: messages
          .filter(msg => msg.role !== 'tool') // Filter out tool messages for AI SDK
          .map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
        temperature,
        maxTokens,
      } as any);

      // Convert stream to AsyncIterable<string>
      return this.convertStreamToStringIterable(result);
    } catch (error) {
      console.error('AI SDK streaming error:', error);
      // Fallback to regular generation and simulate streaming
      const result = await this.generate(messages, options);
      return this.simulateStream(result.content);
    }
  }

  /**
   * Convert AI SDK stream result to AsyncIterable<string>
   */
  private async* convertStreamToStringIterable(streamResult: any): AsyncIterable<string> {
    try {
      for await (const chunk of streamResult.textStream) {
        yield chunk;
      }
    } catch (error) {
      console.error('Error converting AI SDK stream:', error);
      yield 'Error processing response';
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
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AIConfig>): Promise<void> {
    // If baseUrl is provided, ensure it gets /api/v1 appended
    if (newConfig.baseUrl !== undefined) {
      const baseUrlWithoutTrailingSlash = newConfig.baseUrl.replace(/\/$/, '');
      if (!baseUrlWithoutTrailingSlash.endsWith('/api/v1')) {
        newConfig.baseUrl = `${baseUrlWithoutTrailingSlash}/api/v1`;
      }
    }
    
    this.config = { ...this.config, ...newConfig };
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

export const aiSDKClient = new AISDKClient();
