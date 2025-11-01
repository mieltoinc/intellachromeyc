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
  useOpenAICompatible?: boolean;
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

    if (this.config.useOpenAICompatible) {
      return this.generateViaOpenAI(messages);
    }

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
   * Generate response using OpenAI endpoint
   */
  private async generateViaOpenAI(messages: MastraMessage[]): Promise<MastraResponse> {
    if (!this.config.baseUrl) {
      throw new Error('Base URL is required for OpenAI-compatible mode');
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers,
      };

      const response = await fetch(`${this.config.baseUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.7,
          max_tokens: 2048,
          stream: false,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI-compatible API error: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      return {
        content: result.choices?.[0]?.message?.content || '',
        usage: result.usage ? {
          prompt_tokens: result.usage.prompt_tokens || 0,
          completion_tokens: result.usage.completion_tokens || 0,
          total_tokens: result.usage.total_tokens || 0,
        } : undefined,
      };
    } catch (error) {
      console.error('OpenAI-compatible API error:', error);
      throw error;
    }
  }

  /**
   * Stream response using Mastra Client
   */
  async stream(messages: MastraMessage[]): Promise<AsyncIterable<string>> {
    await this.initialize();

    if (this.config.useOpenAICompatible) {
      return this.streamViaOpenAI(messages);
    }

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
   * Stream response using OpenAI-compatible endpoint
   */
  private async streamViaOpenAI(messages: MastraMessage[]): Promise<AsyncIterable<string>> {
    if (!this.config.baseUrl) {
      throw new Error('Base URL is required for OpenAI-compatible streaming mode');
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers,
      };

      const response = await fetch(`${this.config.baseUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.7,
          max_tokens: 2048,
          stream: true,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI-compatible streaming API error: ${response.statusText} - ${errorText}`);
      }

      return this.parseOpenAIStreamingResponse(response);
    } catch (error) {
      console.error('OpenAI-compatible streaming API error:', error);
      // Fallback to regular generation and simulate streaming
      const result = await this.generateViaOpenAI(messages);
      return this.simulateStreamFromContent(result.content);
    }
  }

  /**
   * Parse streaming response from OpenAI-compatible endpoint
   */
  private async* parseOpenAIStreamingResponse(response: Response): AsyncIterable<string> {
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
  private async* simulateStreamFromContent(content: string): AsyncIterable<string> {
    const words = content.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 50));
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