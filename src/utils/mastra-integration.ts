/**
 * Integration layer showing how to use Mastra client alongside existing Mielto API
 * This file demonstrates different usage patterns and migration strategies
 */

import { mastraClient, ChatMessage } from './mastra-client';
import { mieltoAPI } from './api';
import { Memory } from '@/types/memory';

/**
 * Enhanced API wrapper that can use either traditional API or Mastra
 */
export class EnhancedMieltoAPI {
  private useMastra: boolean = false;

  constructor(useMastra: boolean = false) {
    this.useMastra = useMastra;
  }

  /**
   * Toggle between Mastra and traditional API
   */
  setUseMastra(enabled: boolean): void {
    this.useMastra = enabled;
  }

  /**
   * Ask Intella - with fallback between Mastra and traditional API
   */
  async askIntella(question: string, context?: string): Promise<string> {
    if (this.useMastra) {
      try {
        return await mastraClient.askIntella(question);
      } catch (error) {
        console.warn('Mastra askIntella failed, falling back to traditional API:', error);
        return await mieltoAPI.askIntella(question, context);
      }
    } else {
      return await mieltoAPI.askIntella(question, context);
    }
  }

  /**
   * Create memory summary - enhanced with Mastra
   */
  async createMemorySummary(content: string, url: string, title: string): Promise<{
    title: string;
    summary: string;
    keywords: string[];
    entities: { people: string[]; organizations: string[]; topics: string[] };
  }> {
    if (this.useMastra) {
      try {
        return await mastraClient.createMemorySummary(content, url, title);
      } catch (error) {
        console.warn('Mastra createMemorySummary failed, falling back to traditional API:', error);
        return await mieltoAPI.createMemorySummary({ content, url, title });
      }
    } else {
      return await mieltoAPI.createMemorySummary({ content, url, title });
    }
  }

  /**
   * Create memory in backend - with Mastra enhancement option
   */
  async createMemoryInBackend(memory: Memory, enhanceWithMastra: boolean = false): Promise<void> {
    if (enhanceWithMastra) {
      try {
        return await mastraClient.createMemoryInBackend(memory);
      } catch (error) {
        console.warn('Mastra createMemoryInBackend failed, falling back to traditional API:', error);
        return await mieltoAPI.createMemoryInBackend(memory);
      }
    } else {
      return await mieltoAPI.createMemoryInBackend(memory);
    }
  }

  /**
   * Improve text - with Mastra option
   */
  async improveText(text: string, instruction: string): Promise<string> {
    if (this.useMastra) {
      try {
        return await mastraClient.improveText(text, instruction);
      } catch (error) {
        console.warn('Mastra improveText failed, falling back to traditional API:', error);
        return await mieltoAPI.improveText(text, instruction);
      }
    } else {
      return await mieltoAPI.improveText(text, instruction);
    }
  }

  /**
   * Stream chat - Mastra specific feature
   */
  async streamChat(messages: ChatMessage[]): Promise<AsyncIterable<string>> {
    if (!this.useMastra) {
      throw new Error('Streaming is only available with Mastra enabled');
    }
    return await mastraClient.streamChatWithMemories(messages);
  }

  /**
   * Call different LLM providers through Mastra
   */
  async callLLM(
    messages: ChatMessage[],
    provider: 'openai' | 'anthropic' | 'google' = 'openai',
    model: string = 'gpt-4o'
  ): Promise<string> {
    if (!this.useMastra) {
      throw new Error('Multi-LLM support is only available with Mastra enabled');
    }

    const response = await mastraClient.callLLM(messages, {
      provider,
      model,
    });

    return response.content;
  }
}

/**
 * Usage Examples
 */
export class MastraUsageExamples {
  private enhancedAPI = new EnhancedMieltoAPI(true); // Enable Mastra by default

  /**
   * Example: Enhanced memory creation with Mastra AI processing
   */
  async exampleEnhancedMemoryCreation(memory: Memory): Promise<void> {
    console.log('🚀 Creating enhanced memory with Mastra...');
    
    // This will use Mastra to enhance the summary and entities before storing
    await this.enhancedAPI.createMemoryInBackend(memory, true);
  }

  /**
   * Example: Streaming chat conversation
   */
  async exampleStreamingChat(userQuestion: string): Promise<void> {
    console.log('💬 Starting streaming chat...');
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are Intella, a helpful assistant with access to user memories.',
      },
      {
        role: 'user',
        content: userQuestion,
      }
    ];

    const stream = await this.enhancedAPI.streamChat(messages);
    
    for await (const chunk of stream) {
      console.log('Stream chunk:', chunk);
      // In real usage, you'd update the UI with each chunk
    }
  }

  /**
   * Example: Using different LLM providers
   */
  async exampleMultiLLMUsage(question: string): Promise<void> {
    console.log('🤖 Comparing responses from different LLMs...');
    
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: question,
      }
    ];

    // Get response from OpenAI GPT-4
    const openaiResponse = await this.enhancedAPI.callLLM(messages, 'openai', 'gpt-4o');
    console.log('OpenAI Response:', openaiResponse);

    // Get response from Anthropic Claude (if configured)
    try {
      const anthropicResponse = await this.enhancedAPI.callLLM(messages, 'anthropic', 'claude-3-sonnet');
      console.log('Anthropic Response:', anthropicResponse);
    } catch (error) {
      console.log('Anthropic not configured, skipping...');
    }
  }

  /**
   * Example: Fallback strategy demonstration
   */
  async exampleFallbackStrategy(question: string): Promise<string> {
    console.log('🔄 Demonstrating fallback strategy...');
    
    // Try with Mastra first, fall back to traditional API if needed
    try {
      return await this.enhancedAPI.askIntella(question);
    } catch (error) {
      console.log('All methods failed:', error);
      return 'Sorry, I could not process your request at this time.';
    }
  }

  /**
   * Example: A/B testing between APIs
   */
  async exampleABTesting(question: string): Promise<{
    mastraResponse: string;
    traditionalResponse: string;
    comparison: string;
  }> {
    console.log('⚖️ A/B testing Mastra vs Traditional API...');
    
    // Get response from Mastra
    this.enhancedAPI.setUseMastra(true);
    const mastraResponse = await this.enhancedAPI.askIntella(question);
    
    // Get response from traditional API
    this.enhancedAPI.setUseMastra(false);
    const traditionalResponse = await this.enhancedAPI.askIntella(question);
    
    // Compare using Mastra
    this.enhancedAPI.setUseMastra(true);
    const comparisonMessages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Compare these two AI responses and provide a brief analysis of their differences.',
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nResponse A: ${mastraResponse}\n\nResponse B: ${traditionalResponse}`,
      }
    ];
    
    const comparison = await this.enhancedAPI.callLLM(comparisonMessages);
    
    return {
      mastraResponse,
      traditionalResponse,
      comparison,
    };
  }
}

// Export singleton instances
export const enhancedMieltoAPI = new EnhancedMieltoAPI();
export const mastraExamples = new MastraUsageExamples();