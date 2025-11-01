/**
 * Mastra Handler - Uses Mastra Client SDK to call agents via Mielto/Mastra server
 */

import { MastraClient } from '@mastra/client-js';
import { z } from 'zod';

export interface MastraMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MastraConfig {
  baseUrl?: string; // Mastra/Mielto server URL
  agentName?: string; // Name of the agent to use
  headers?: Record<string, string>; // Additional headers
  retries?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
}

export interface MastraResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MastraHandler {
  private client: MastraClient | null = null;
  private isInitialized = false;

  constructor(private config: MastraConfig = {}) {}

  /**
   * Initialize the Mastra Client to connect to Mastra/Mielto server
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.client) {
      return;
    }

    if (!this.config.baseUrl) {
      throw new Error('Base URL is required for Mastra Client initialization');
    }

    try {
      // Initialize Mastra Client SDK
      this.client = new MastraClient({
        baseUrl: this.config.baseUrl,
        headers: this.config.headers || {},
        retries: this.config.retries || 3,
        backoffMs: this.config.backoffMs || 300,
        maxBackoffMs: this.config.maxBackoffMs || 5000,
      });
      
      this.isInitialized = true;
      console.log('✅ Mastra Client initialized with server:', this.config.baseUrl);
    } catch (error) {
      console.error('❌ Failed to initialize Mastra Client:', error);
      this.client = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Check if the client is initialized
   */
  isAgentReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Generate response using Mastra Client
   */
  async generate(messages: MastraMessage[]): Promise<MastraResponse> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Mastra Client not initialized');
    }

    try {
      // Get agent and generate response
      const agent = this.client.getAgent(this.config.agentName || 'intella-assistant');
      const result = await agent.generate({
        messages: messages as any,
      });

      return {
        content: result.text || '',
        usage: {
          prompt_tokens: 0, // Usage info may not be exposed by client SDK
          completion_tokens: 0,
          total_tokens: 0,
        },
      };
    } catch (error) {
      console.error('Mastra Client generation error:', error);
      throw error;
    }
  }

  /**
   * Stream response using Mastra Client
   */
  async stream(messages: MastraMessage[]): Promise<AsyncIterable<string>> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Mastra Client not initialized');
    }

    try {
      // Get agent and stream response
      const agent = this.client.getAgent(this.config.agentName || 'intella-assistant');
      const streamResult = await agent.stream({
        messages: messages as any,
      });

      return this.convertStreamToStringIterable(streamResult);
    } catch (error) {
      console.error('Mastra Client streaming error:', error);
      throw error;
    }
  }

  /**
   * Convert Mastra Client stream result to AsyncIterable<string>
   */
  private async* convertStreamToStringIterable(streamResult: any): AsyncIterable<string> {
    try {
      // Process stream using Mastra Client SDK method
      if (streamResult && streamResult.processDataStream) {
        let chunks: string[] = [];
        
        // Use processDataStream method from the SDK
        await streamResult.processDataStream({
          onTextPart: (text: string) => {
            chunks.push(text);
          },
        });
        
        // Yield all collected chunks
        for (const chunk of chunks) {
          yield chunk;
        }
      } else if (streamResult && streamResult.text) {
        // If it's already a complete response
        yield streamResult.text;
      } else {
        // Fallback to empty response
        yield '';
      }
    } catch (error) {
      console.error('Error converting Mastra Client stream:', error);
      yield 'Error processing response';
    }
  }

  /**
   * Generate object with structured output using Mastra Client
   * Note: Structured output may not be directly supported by client SDK
   */
  async generateObject<T>(
    messages: MastraMessage[],
    schema: z.ZodSchema<T>
  ): Promise<T> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Mastra Client not initialized');
    }

    try {
      // Add schema instructions to the messages
      const systemMessage: MastraMessage = {
        role: 'system',
        content: `Please respond with valid JSON that matches the expected structure. Only return the JSON object, no additional text.`,
      };
      
      const messagesWithSchema = [systemMessage, ...messages];
      
      // Get agent and generate response
      const agent = this.client.getAgent(this.config.agentName || 'intella-assistant');
      const result = await agent.generate({
        messages: messagesWithSchema as any,
      });

      // Parse the JSON response
      const jsonText = result.text?.trim() || '{}';
      const parsed = JSON.parse(jsonText);
      
      // Validate against schema
      return schema.parse(parsed);
    } catch (error) {
      console.error('Mastra Client object generation error:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MastraConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Reset initialization to pick up new config
    this.isInitialized = false;
    this.client = null;
  }

  /**
   * Get current configuration
   */
  getConfig(): MastraConfig {
    return { ...this.config };
  }

  /**
   * Cleanup and destroy the client
   */
  destroy(): void {
    this.client = null;
    this.isInitialized = false;
  }
}