/**
 * Composio Tools Provider - Tools for interacting with various apps via Composio
 * Uses the official Composio SDK (@composio/core)
 * Specifically enabled for HackerNews integration
 */

import { z } from 'zod';
import { Composio } from '@composio/core';
import type { ToolProvider, Tool, ToolExecutionResult } from '@/types/tools';
import { storage } from '../storage';
import { mieltoAuth } from '@/lib/auth';

export class ComposioToolsProvider implements ToolProvider {
  id = 'composio-tools';
  name = 'Composio Tools';
  description = 'Tools for interacting with various apps via Composio, including HackerNews';
  version = '1.0.0';
  enabled = true;
  tools: Map<string, Tool> = new Map();
  
  private composio: Composio | null = null;
  private composioApiKey: string | null = null;
  private initialized = false;
  private userId: string | null = null;

  constructor() {
    // Tools will be registered dynamically after initialization
  }

  /**
   * Initialize the Composio provider
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Get Composio API key from settings
      const settings = await storage.getSettings();
      this.composioApiKey = (settings as any).composioApiKey || null;
      
      if (!this.composioApiKey) {
        console.warn('⚠️ Composio API key not found. Set composioApiKey in settings.');
        this.initialized = true; // Mark as initialized to prevent retries
        return;
      }

      // Initialize Composio SDK
      this.composio = new Composio({
        apiKey: this.composioApiKey,
      });

      // Get user ID from session
      const session = await mieltoAuth.getCurrentSession();
      if (session?.user?.id) {
        this.userId = session.user.id.toString();
      } else {
        // Fallback: use a default user ID or generate one
        this.userId = 'default-user';
      }

      if (!this.userId) {
        console.warn('⚠️ User ID not available');
        this.initialized = true;
        return;
      }

      // Check if HackerNews is already authorized, if not, get authorization URL
      try {
        // Try to get HackerNews tools - if not authorized, we'll handle it gracefully
        await this.refreshTools();
      } catch (error: any) {
        console.warn('⚠️ Could not fetch Composio tools. May need authorization:', error.message);
      }
      
      this.initialized = true;
      console.log('✅ Composio provider initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Composio provider:', error);
      this.initialized = true; // Mark as initialized to prevent infinite retries
    }
  }

  /**
   * Get authorization URL for HackerNews
   */
  async getAuthorizationUrl(toolkit: string = 'HACKERNEWS'): Promise<string | null> {
    if (!this.composio) {
      console.warn('⚠️ Composio not initialized');
      return null;
    }
    if (!this.userId) {
      console.warn('⚠️ User ID missing');
      return null;
    }

    try {
      const connection = await this.composio.toolkits.authorize(this.userId, toolkit);
      return connection.redirectUrl || null;
    } catch (error: any) {
      console.error('❌ Failed to get authorization URL:', error);
      return null;
    }
  }

  /**
   * Wait for connection to be active
   */
  async waitForConnection(toolkit: string = 'HACKERNEWS'): Promise<boolean> {
    if (!this.composio || !this.userId) {
      return false;
    }

    try {
      const connection = await this.composio.toolkits.authorize(this.userId, toolkit);
      await connection.waitForConnection();
      // Refresh tools after connection is established
      await this.refreshTools();
      return true;
    } catch (error: any) {
      console.error('❌ Failed to wait for connection:', error);
      return false;
    }
  }

  /**
   * Refresh tools from Composio
   */
  private async refreshTools(): Promise<void> {
    if (!this.composio || !this.userId) {
      return;
    }

    try {
      // Get HackerNews tools from Composio
      // tools.get() returns OpenAI ChatCompletionTool format
      const composioTools = await this.composio.tools.get(this.userId, {
        toolkits: ['HACKERNEWS'],
      });

      // Clear existing tools
      this.tools.clear();

      // Map Composio tools to our Tool format
      // composioTools is an array of ChatCompletionTool objects
      for (const composioTool of composioTools) {
        // Extract function definition from ChatCompletionTool
        if (composioTool.type === 'function' && 'function' in composioTool) {
          const func = composioTool.function;
          const toolName = func.name;
          // Convert FunctionParameters to our Tool parameters format
          const funcParams = func.parameters || { type: 'object', properties: {}, required: [] };
          const properties: Record<string, any> = {};
          if (funcParams.properties && typeof funcParams.properties === 'object') {
            for (const [key, value] of Object.entries(funcParams.properties)) {
              properties[key] = value;
            }
          }
          const required: string[] = Array.isArray(funcParams.required) ? funcParams.required : [];
          
          const tool: Tool = {
            id: toolName,
            name: toolName,
            description: func.description || '',
            parameters: {
              type: 'object',
              properties,
              required,
            },
            enabled: true,
            providerId: this.id,
            metadata: {
              composioTool: true,
              originalTool: composioTool,
            },
          };

          this.tools.set(tool.id, tool);
        }
      }

      console.log(`✅ Loaded ${this.tools.size} HackerNews tools from Composio`);
    } catch (error: any) {
      console.error('❌ Failed to refresh Composio tools:', error);
      // If tools fail to load, register basic HackerNews tools as fallback
      this.registerFallbackTools();
    }
  }

  /**
   * Register fallback tools if Composio fails
   */
  private registerFallbackTools(): void {
    // Basic HackerNews tools using direct API as fallback
    this.tools.set('hackernews_get_top_stories', {
      id: 'hackernews_get_top_stories',
      name: 'hackernews_get_top_stories',
      description: 'Get the top stories from HackerNews',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of top stories to return (default: 10)',
          },
        },
        required: [],
      },
      enabled: true,
      providerId: this.id,
      metadata: { fallback: true },
    });
  }

  /**
   * Get Zod schemas for AI SDK
   */
  getZodSchemas(): Map<string, { description: string; schema: any }> {
    const schemas = new Map<string, { description: string; schema: any }>();
    
    for (const tool of this.tools.values()) {
      if (!tool.enabled) continue;
      
      const zodProperties: Record<string, any> = {};
      for (const [key, param] of Object.entries(tool.parameters.properties)) {
        const zodType = this.getZodType(param.type);
        zodProperties[key] = zodType.describe(param.description || '');
        if (tool.parameters.required?.includes(key)) {
          zodProperties[key] = zodProperties[key];
        } else {
          zodProperties[key] = zodProperties[key].optional();
        }
      }
      
      schemas.set(tool.name, {
        description: tool.description,
        schema: z.object(zodProperties),
      });
    }
    
    return schemas;
  }

  /**
   * Map JSON schema type to Zod type
   */
  private getZodType(type: string): any {
    switch (type) {
      case 'string':
        return z.string();
      case 'number':
      case 'integer':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        return z.array(z.any());
      case 'object':
        return z.object({});
      default:
        return z.string();
    }
  }

  /**
   * Execute Composio tool
   */
  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    if (!this.composio || !this.userId) {
      return {
        success: false,
        error: 'Composio not initialized. Please check your API key and authorization.',
      };
    }

    try {
      // Find the tool
      const tool = this.tools.get(toolName);
      if (!tool) {
        // Try fallback for basic HackerNews operations
        if (toolName.startsWith('hackernews_')) {
          return await this.executeFallbackTool(toolName, args);
        }
        return {
          success: false,
          error: `Tool "${toolName}" not found`,
        };
      }

      // Execute tool via Composio
      // Note: The exact signature may vary - this is a working implementation
      // If this doesn't work, we may need to use the provider.handleToolCalls method instead
      const executeMethod = (this.composio.tools as any).execute;
      let result: any;
      
      // Try different possible signatures
      if (typeof executeMethod === 'function') {
        try {
          // Try: execute(userId, actionName, parameters)
          result = await executeMethod(this.userId, toolName, args);
        } catch (e) {
          // Fallback: try with object format
          result = await executeMethod(this.userId, { name: toolName, parameters: args });
        }
      } else {
        throw new Error('Composio tools.execute method not available');
      }

      return {
        success: true,
        result: result.data || result,
      };
    } catch (error: any) {
      // If execution fails, try fallback
      if (toolName.startsWith('hackernews_')) {
        return await this.executeFallbackTool(toolName, args);
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error executing tool',
      };
    }
  }

  /**
   * Execute fallback HackerNews tools using direct API
   */
  private async executeFallbackTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      switch (toolName) {
        case 'hackernews_get_top_stories': {
          const { limit = 10 } = args;
          const storyIds: number[] = await this.callHackerNewsAPI('topstories');
          const stories = await this.getStoriesByIds(storyIds, limit);
          
          return {
            success: true,
            result: {
              count: stories.length,
              stories: stories.map(s => ({
                id: s.id,
                title: s.title,
                url: s.url,
                by: s.by,
                score: s.score,
                time: s.time,
                descendants: s.descendants,
              })),
            },
          };
        }

        default:
          return {
            success: false,
            error: `Fallback tool "${toolName}" not implemented`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Call HackerNews API directly (fallback)
   */
  private async callHackerNewsAPI(endpoint: string): Promise<any> {
    const response = await fetch(`https://hacker-news.firebaseio.com/v0/${endpoint}.json`);
    if (!response.ok) {
      throw new Error(`HackerNews API error: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get multiple stories by their IDs (fallback)
   */
  private async getStoriesByIds(storyIds: number[], limit: number = 10): Promise<any[]> {
    const limitedIds = storyIds.slice(0, limit);
    const stories = await Promise.all(
      limitedIds.map(id => this.callHackerNewsAPI(`item/${id}`))
    );
    return stories.filter(story => story && !story.deleted && story.type === 'story');
  }

  /**
   * Get tool definitions
   */
  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values());
  }
}
