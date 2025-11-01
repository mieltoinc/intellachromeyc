/**
 * Composio Tools Integration - Handles tool calling within chat completions
 */

import { composioClient, type ComposioTool, type ToolExecutionResult } from './composio-client';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallResponse {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

export interface ChatCompletionWithTools {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
  }>;
  tools?: any[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
}

export class ComposioToolsHandler {
  private availableTools: ComposioTool[] = [];
  private toolsLastUpdated: number = 0;
  private readonly TOOLS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {}

  /**
   * Get tools for use in chat completions
   */
  async getToolsForChat(toolkits?: string[]): Promise<any[]> {
    await this.ensureToolsLoaded(toolkits);
    return composioClient.getOpenAITools(toolkits);
  }

  /**
   * Ensure tools are loaded and cached
   */
  private async ensureToolsLoaded(toolkits?: string[]): Promise<void> {
    const now = Date.now();
    if (this.availableTools.length === 0 || (now - this.toolsLastUpdated) > this.TOOLS_CACHE_DURATION) {
      try {
        this.availableTools = await composioClient.getAvailableTools(toolkits);
        this.toolsLastUpdated = now;
        console.log(`🔧 Loaded ${this.availableTools.length} Composio tools`);
      } catch (error) {
        console.warn('⚠️ Failed to load Composio tools:', error);
        this.availableTools = [];
      }
    }
  }

  /**
   * Execute tool calls from chat completion response
   */
  async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolCallResponse[]> {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return [];
    }

    const responses: ToolCallResponse[] = [];

    for (const toolCall of toolCalls) {
      try {
        const { function: func } = toolCall;
        const args = JSON.parse(func.arguments);

        console.log(`🔧 Executing tool: ${func.name} with args:`, args);

        const result = await composioClient.executeTool(func.name, args);
        
        const response: ToolCallResponse = {
          tool_call_id: toolCall.id,
          role: 'tool',
          content: this.formatToolResult(result),
        };

        responses.push(response);

        if (result.success) {
          console.log(`✅ Tool ${func.name} executed successfully`);
        } else {
          console.error(`❌ Tool ${func.name} failed:`, result.error);
        }
      } catch (error) {
        console.error(`❌ Error executing tool ${toolCall.function.name}:`, error);
        
        const errorResponse: ToolCallResponse = {
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false,
          }),
        };

        responses.push(errorResponse);
      }
    }

    return responses;
  }

  /**
   * Format tool execution result for chat completion
   */
  private formatToolResult(result: ToolExecutionResult): string {
    if (result.success) {
      return JSON.stringify({
        success: true,
        data: result.data,
        ...(result.executionId && { executionId: result.executionId }),
      });
    } else {
      return JSON.stringify({
        success: false,
        error: result.error,
      });
    }
  }

  /**
   * Enhanced chat completion with automatic tool execution
   */
  async chatCompletionWithTools(
    request: ChatCompletionWithTools,
    executeTools = true,
    maxToolIterations = 3
  ): Promise<any> {
    // Get available tools if not provided
    if (!request.tools || request.tools.length === 0) {
      request.tools = await this.getToolsForChat();
    }

    let messages = [...request.messages];
    let iterations = 0;

    while (iterations < maxToolIterations) {
      // Make chat completion request
      const response = await this.makeChatRequest({
        ...request,
        messages,
      });

      const choice = response.choices?.[0];
      if (!choice?.message) {
        return response;
      }

      // Add assistant message to conversation
      messages.push(choice.message);

      // Check if there are tool calls
      const toolCalls = choice.message.tool_calls;
      if (!toolCalls || !executeTools) {
        return response;
      }

      console.log(`🔧 Processing ${toolCalls.length} tool calls (iteration ${iterations + 1})`);

      // Execute tool calls
      const toolResponses = await this.executeToolCalls(toolCalls);
      
      // Add tool responses to conversation
      messages.push(...toolResponses);

      iterations++;
    }

    console.warn(`⚠️ Reached maximum tool iterations (${maxToolIterations})`);
    
    // Make final request without tools to get summary
    return this.makeChatRequest({
      ...request,
      messages,
      tools: undefined,
      tool_choice: 'none',
    });
  }

  /**
   * Make the actual chat request (integrate with your existing API)
   */
  private async makeChatRequest(request: ChatCompletionWithTools): Promise<any> {
    // This should integrate with your existing Mielto/Mastra API
    // For now, using a placeholder - replace with your actual implementation
    
    const { mieltoAPI } = await import('./api');
    
    const chatRequest = {
      messages: request.messages.map(msg => ({
        role: msg.role === 'tool' ? 'system' : msg.role,
        content: msg.role === 'tool' 
          ? `Tool result: ${msg.content}` 
          : msg.content,
      })),
      model: request.model,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    };

    return mieltoAPI.chat(chatRequest);
  }

  /**
   * Execute a single tool by name
   */
  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    return await composioClient.executeTool(toolName, args);
  }

  /**
   * Get available tools information
   */
  async getAvailableToolsInfo(): Promise<ComposioTool[]> {
    await this.ensureToolsLoaded();
    return [...this.availableTools];
  }

  /**
   * Check if specific toolkits are connected
   */
  async checkToolkitConnections(): Promise<{
    shopify: boolean;
    perplexity: boolean;
    connections: any[];
  }> {
    try {
      const connections = await composioClient.getConnections();
      
      return {
        shopify: connections.some(conn => 
          conn.toolkit.toLowerCase().includes('shopify') && conn.status === 'active'
        ),
        perplexity: connections.some(conn => 
          conn.toolkit.toLowerCase().includes('perplexity') && conn.status === 'active'
        ),
        connections,
      };
    } catch (error) {
      console.error('❌ Failed to check toolkit connections:', error);
      return {
        shopify: false,
        perplexity: false,
        connections: [],
      };
    }
  }

  /**
   * Initialize specific toolkits
   */
  async initializeToolkits(): Promise<{
    success: boolean;
    shopifyAuth?: any;
    perplexityAuth?: any;
    errors?: string[];
  }> {
    const result: any = { success: true, errors: [] };

    try {
      // Check current connections
      const connectionStatus = await this.checkToolkitConnections();

      // Initialize Shopify if not connected
      if (!connectionStatus.shopify) {
        try {
          result.shopifyAuth = await composioClient.authorizeToolkit('shopify');
          console.log('🛍️ Shopify authorization started');
        } catch (error) {
          const errorMsg = `Failed to initialize Shopify: ${error}`;
          result.errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      // Initialize Perplexity if not connected
      if (!connectionStatus.perplexity) {
        try {
          result.perplexityAuth = await composioClient.authorizeToolkit('perplexityai');
          console.log('🧠 Perplexity authorization started');
        } catch (error) {
          const errorMsg = `Failed to initialize Perplexity: ${error}`;
          result.errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to initialize toolkits:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Clear tools cache
   */
  clearCache(): void {
    this.availableTools = [];
    this.toolsLastUpdated = 0;
  }
}

export const composioToolsHandler = new ComposioToolsHandler();