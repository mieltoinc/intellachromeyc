/**
 * Composio Client for Intella - Handles tool calling to Perplexity and Shopify
 */

import { Composio } from '@composio/core';
import { storage } from './storage';
import { mieltoAuth } from '@/lib/auth';

export interface ComposioConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface ComposioTool {
  id: string;
  name: string;
  description: string;
  parameters: any;
  toolkit: string;
}

export interface ComposioConnection {
  id: string;
  toolkit: string;
  status: 'active' | 'pending' | 'disconnected';
  connectedAt?: string;
  metadata?: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionId?: string;
}

export interface AuthorizationFlow {
  id: string;
  redirectUrl: string;
  status: 'pending' | 'completed' | 'failed';
  toolkit: string;
}

export class ComposioClient {
  private composio: Composio | null = null;
  private config: ComposioConfig = {};
  private isInitialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.isInitialized && this.composio) {
      return;
    }

    try {
      const settings = await storage.getSettings();
      this.config = {
        apiKey: settings.composio?.apiKey || process.env.COMPOSIO_API_KEY,
        baseUrl: settings.composio?.baseUrl,
      };

      if (!this.config.apiKey) {
        throw new Error('Composio API key is required');
      }

      this.composio = new Composio({
        apiKey: this.config.apiKey,
        ...(this.config.baseUrl && { baseUrl: this.config.baseUrl }),
      });

      this.isInitialized = true;
      console.log('✅ Composio client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Composio client:', error);
      this.composio = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Get current user ID from session
   */
  private async getUserId(): Promise<string> {
    const session = await mieltoAuth.getCurrentSession();
    if (!session?.user?.id) {
      throw new Error('User session required for Composio operations');
    }
    return session.user.id.toString();
  }

  /**
   * Start authorization flow for a toolkit (Shopify or Perplexity)
   */
  async authorizeToolkit(toolkit: 'shopify' | 'perplexityai'): Promise<AuthorizationFlow> {
    await this.initialize();
    
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      const userId = await this.getUserId();
      const authResult = await this.composio.toolkits.authorize(userId, toolkit) as any;

      const authFlow: AuthorizationFlow = {
        id: authResult.id,
        redirectUrl: authResult.redirectUrl,
        status: 'pending',
        toolkit,
      };

      // Store auth flow for tracking
      await this.storeAuthFlow(authFlow);

      console.log(`🔐 Authorization flow started for ${toolkit}:`, authFlow.redirectUrl);
      return authFlow;
    } catch (error) {
      console.error(`❌ Failed to start authorization for ${toolkit}:`, error);
      throw error;
    }
  }

  /**
   * Wait for connection completion after authorization
   */
  async waitForConnection(authFlowId: string): Promise<ComposioConnection> {
    await this.initialize();
    
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      const account = await this.composio.connectedAccounts.waitForConnection(authFlowId);
      
      const connection: ComposioConnection = {
        id: account.id,
        toolkit: (account as any).toolkit?.slug || (account as any).toolkitName || 'unknown',
        status: account.status === 'ACTIVE' ? 'active' : 'disconnected',
        connectedAt: account.createdAt,
        metadata: (account as any).metadata || {},
      };

      // Store connection
      await this.storeConnection(connection);

      console.log(`✅ Connection established for ${connection.toolkit}:`, connection.id);
      return connection;
    } catch (error) {
      console.error('❌ Failed to wait for connection:', error);
      throw error;
    }
  }

  /**
   * Get available tools for connected toolkits
   */
  async getAvailableTools(toolkits?: string[]): Promise<ComposioTool[]> {
    await this.initialize();
    
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      const userId = await this.getUserId();
      const defaultToolkits = toolkits || ['shopify', 'perplexityai'];
      
      const tools = await this.composio.tools.get(userId, { 
        toolkits: defaultToolkits 
      });

      const composioTools: ComposioTool[] = tools.map((tool: any) => ({
        id: tool.id || tool.slug || tool.name,
        name: tool.name || tool.slug,
        description: tool.description || '',
        parameters: tool.inputParameters || tool.parameters || {},
        toolkit: tool.toolkit?.slug || tool.toolkit || 'unknown',
      }));

      console.log(`📋 Retrieved ${composioTools.length} tools for toolkits:`, defaultToolkits);
      return composioTools;
    } catch (error) {
      console.error('❌ Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * Execute a tool with given arguments
   */
  async executeTool(
    toolName: string, 
    args: Record<string, any>
  ): Promise<ToolExecutionResult> {
    await this.initialize();
    
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      const userId = await this.getUserId();
      
      const result = await this.composio.tools.execute(toolName, {
        userId,
        arguments: args,
      });

      const executionResult: ToolExecutionResult = {
        success: (result as any).successful !== false,
        data: (result as any).data || result,
        executionId: (result as any).logId || (result as any).executionId,
      };

      if (!executionResult.success) {
        executionResult.error = (result as any).error || 'Tool execution failed';
      }

      console.log(`🔧 Tool ${toolName} executed:`, executionResult.success ? 'success' : 'failed');
      return executionResult;
    } catch (error) {
      console.error(`❌ Failed to execute tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get tools formatted for OpenAI function calling
   */
  async getOpenAITools(toolkits?: string[]): Promise<any[]> {
    const tools = await this.getAvailableTools(toolkits);
    
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Get connected accounts/connections
   */
  async getConnections(): Promise<ComposioConnection[]> {
    await this.initialize();
    
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      const userId = await this.getUserId();
      const accounts = await this.composio.connectedAccounts.get(userId);

      const connections: ComposioConnection[] = (accounts as unknown as any[]).map((account: any) => ({
        id: account.id,
        toolkit: account.toolkit?.slug || account.toolkitName || 'unknown',
        status: account.status === 'ACTIVE' ? 'active' : 'disconnected',
        connectedAt: account.createdAt,
        metadata: account.metadata || {},
      }));

      return connections;
    } catch (error) {
      console.error('❌ Failed to get connections:', error);
      return [];
    }
  }

  /**
   * Disconnect a toolkit
   */
  async disconnectToolkit(connectionId: string): Promise<boolean> {
    await this.initialize();
    
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      await this.composio.connectedAccounts.delete(connectionId);
      await this.removeConnection(connectionId);
      
      console.log(`✅ Disconnected toolkit: ${connectionId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to disconnect toolkit ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.composio !== null;
  }

  /**
   * Get current configuration
   */
  getConfig(): ComposioConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<ComposioConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.isInitialized = false;
    this.composio = null;
    await this.initialize();
  }

  // Storage helpers
  private async storeAuthFlow(authFlow: AuthorizationFlow): Promise<void> {
    try {
      const authFlows = await this.getStoredAuthFlows();
      authFlows[authFlow.id] = authFlow;
      await chrome.storage.local.set({ 'composio-auth-flows': authFlows });
    } catch (error) {
      console.warn('Failed to store auth flow:', error);
    }
  }

  private async getStoredAuthFlows(): Promise<Record<string, AuthorizationFlow>> {
    try {
      const result = await chrome.storage.local.get('composio-auth-flows');
      return result['composio-auth-flows'] || {};
    } catch (error) {
      console.warn('Failed to get stored auth flows:', error);
      return {};
    }
  }

  private async storeConnection(connection: ComposioConnection): Promise<void> {
    try {
      const connections = await this.getStoredConnections();
      connections[connection.id] = connection;
      await chrome.storage.local.set({ 'composio-connections': connections });
    } catch (error) {
      console.warn('Failed to store connection:', error);
    }
  }

  private async getStoredConnections(): Promise<Record<string, ComposioConnection>> {
    try {
      const result = await chrome.storage.local.get('composio-connections');
      return result['composio-connections'] || {};
    } catch (error) {
      console.warn('Failed to get stored connections:', error);
      return {};
    }
  }

  private async removeConnection(connectionId: string): Promise<void> {
    try {
      const connections = await this.getStoredConnections();
      delete connections[connectionId];
      await chrome.storage.local.set({ 'composio-connections': connections });
    } catch (error) {
      console.warn('Failed to remove connection:', error);
    }
  }

  /**
   * Get stored connections
   */
  async getStoredConnectionsList(): Promise<ComposioConnection[]> {
    const connections = await this.getStoredConnections();
    return Object.values(connections);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.composio = null;
    this.isInitialized = false;
  }
}

export const composioClient = new ComposioClient();