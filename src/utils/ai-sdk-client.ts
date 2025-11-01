/**
 * AI SDK Client - Unified client for AI interactions using Vercel AI SDK
 * Uses api.mielto.com (appends /api/v1 automatically) as the base URL
 */

import { generateText, streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { storage } from './storage';
import { mieltoAuth } from '@/lib/auth';
import { composioToolsHandler, type ToolCall } from './composio-tools';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIConfig {
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableTools?: boolean;
  maxToolIterations?: number;
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
        model: 'anthropic/claude-3-7-sonnet-latest',
        temperature: 0.7,
        maxTokens: 2048,
        enableTools: true,
        maxToolIterations: 3,
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
   * Convert Composio tools to AI SDK tool format
   */
  private async getAISDKTools() {
    try {
      const composioTools = await composioToolsHandler.getAvailableToolsInfo();
      const aiSdkTools: Record<string, any> = {};

      for (const composioTool of composioTools) {
        if (composioTool.parameters?.properties) {
          // Create Zod schema from Composio tool parameters
          const schemaProps: Record<string, any> = {};

          for (const [propName, propDef] of Object.entries(composioTool.parameters.properties)) {
            const def = propDef as any;
            switch (def.type) {
              case 'string':
                schemaProps[propName] = z.string().describe(def.description || '');
                break;
              case 'number':
                schemaProps[propName] = z.number().describe(def.description || '');
                break;
              case 'boolean':
                schemaProps[propName] = z.boolean().describe(def.description || '');
                break;
              case 'array':
                schemaProps[propName] = z.array(z.any()).describe(def.description || '');
                break;
              default:
                schemaProps[propName] = z.any().describe(def.description || '');
            }

            // Handle required fields
            if (!composioTool.parameters.required?.includes(propName)) {
              schemaProps[propName] = schemaProps[propName].optional();
            }
          }

          const toolSchema = z.object(schemaProps);

          aiSdkTools[composioTool.name] = tool({
            description: composioTool.description || `Execute ${composioTool.name}`,
            parameters: toolSchema,
            execute: async (args: any) => {
              console.log(`🔧 Executing Composio tool: ${composioTool.name}`, args);

              try {
                const result = await composioToolsHandler.executeTool(composioTool.name, args);
                return JSON.stringify({
                  success: result.success,
                  data: result.data,
                  error: result.error,
                });
              } catch (error) {
                console.error(`❌ Tool execution error for ${composioTool.name}:`, error);
                return JSON.stringify({
                  success: false,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            },
          } as any);
        }
      }

      return aiSdkTools;
    } catch (error) {
      console.warn('⚠️ Failed to load Composio tools for AI SDK:', error);
      return {};
    }
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
      maxToolIterations?: number;
    } = {}
  ): Promise<AIResponse> {
    await this.initialize();

    const {
      model = this.config.model || 'gpt-4o',
      temperature = this.config.temperature || 0.7,
      maxTokens = this.config.maxTokens || 2048,
      enableTools = this.config.enableTools ?? true,
      maxToolIterations = this.config.maxToolIterations || 3,
    } = options;

    try {
      const apiKey = await this.getApiKey();
      const baseUrl = this.config.baseUrl || this.defaultBaseUrl;
      
      // Get tools if enabled
      let aiSdkTools: Record<string, any> = {};
      if (enableTools) {
        aiSdkTools = await this.getAISDKTools();
        console.log(`🔧 Using ${Object.keys(aiSdkTools).length} tools for AI SDK generation`);
      }

      // Create OpenAI provider with custom base URL using createOpenAI
      // This creates a callable provider function that accepts model names
      const openaiProvider = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      });

      // Call the provider function with the model name to get the language model
      const languageModel = openaiProvider.chat(model || 'gpt-4o');

      // Use AI SDK generateText with tools
      const result = await generateText({
        model: languageModel,
        messages: messages
          .filter(msg => msg.role !== 'tool') // Filter out tool messages for AI SDK
          .map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
        tools: Object.keys(aiSdkTools).length > 0 ? aiSdkTools : undefined,
        maxToolRoundtrips: enableTools ? maxToolIterations : undefined,
        temperature,
        maxTokens,
      } as any);

      console.log('🎯 AI SDK result:', {
        text: result.text.slice(0, 100) + '...',
        usage: result.usage,
        toolCalls: result.toolCalls?.length || 0,
        toolResults: result.toolResults?.length || 0,
      });

      return {
        content: result.text,
        usage: result.usage ? {
          prompt_tokens: (result.usage as any).promptTokens || 0,
          completion_tokens: (result.usage as any).completionTokens || 0,
          total_tokens: ((result.usage as any).promptTokens || 0) + ((result.usage as any).completionTokens || 0),
        } : undefined,
      };
    } catch (error) {
      console.error('AI SDK generation error:', error);
      throw error;
    }
  }

  /**
   * Stream text with optional tool support
   */
  async stream(
    messages: AIMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      enableTools?: boolean;
      maxToolIterations?: number;
    } = {}
  ): Promise<AsyncIterable<string>> {
    await this.initialize();

    const {
      model = this.config.model || 'gpt-4o',
      temperature = this.config.temperature || 0.7,
      maxTokens = this.config.maxTokens || 2048,
      enableTools = this.config.enableTools ?? true,
      maxToolIterations = this.config.maxToolIterations || 3,
    } = options;

    try {
      const apiKey = await this.getApiKey();
      const baseUrl = this.config.baseUrl || this.defaultBaseUrl;
      
      // Get tools if enabled
      let aiSdkTools: Record<string, any> = {};
      if (enableTools) {
        aiSdkTools = await this.getAISDKTools();
        console.log(`🔧 Using ${Object.keys(aiSdkTools).length} tools for AI SDK streaming`);
      }

      // Create OpenAI provider with custom base URL using createOpenAI
      // This creates a callable provider function that accepts model names
      const openaiProvider = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      });

      // Call the provider function with the model name to get the language model
      const languageModel = openaiProvider.chat(model || 'gpt-4o');

      // Use AI SDK streamText with tools
      const result = await streamText({
        model: languageModel,
        messages: messages
          .filter(msg => msg.role !== 'tool') // Filter out tool messages for AI SDK
          .map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
        tools: Object.keys(aiSdkTools).length > 0 ? aiSdkTools : undefined,
        maxToolRoundtrips: enableTools ? maxToolIterations : undefined,
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
