/**
 * Tool Registry - Centralized tool management and execution system
 * 
 * Features:
 * - Register and manage tool providers
 * - Register and manage individual tools
 * - List available tools and providers
 * - Execute tools with validation
 * - Integration with AI SDK for function calling
 */

import type {
  Tool,
  ToolProvider,
  ToolExecutionResult,
  ToolCall,
  ToolMessage,
  ToolRegistrationOptions,
  ProviderRegistrationOptions,
} from '@/types/tools';

export class ToolRegistry {
  private providers: Map<string, ToolProvider> = new Map();
  private tools: Map<string, Tool> = new Map();
  private executionHistory: Array<{
    toolId: string;
    args: Record<string, any>;
    result: ToolExecutionResult;
    timestamp: number;
  }> = [];
  private maxHistorySize = 100;

  /**
   * Register a tool provider
   */
  async registerProvider(
    provider: ToolProvider,
    options: ProviderRegistrationOptions = {}
  ): Promise<void> {
    const { enabled = true, autoRegisterTools = true } = options;

    // Initialize provider if it has an initialize method
    if (provider.initialize) {
      await provider.initialize();
    }

    // Update provider enabled state
    provider.enabled = enabled;

    // Register provider
    this.providers.set(provider.id, provider);

    // Auto-register tools if enabled
    if (autoRegisterTools) {
      const toolDefinitions = provider.getToolDefinitions();
      for (const tool of toolDefinitions) {
        await this.registerTool(tool, { enabled: tool.enabled });
      }
    }

    console.log(`✅ Registered tool provider: ${provider.name} (${provider.id})`);
  }

  /**
   * Unregister a tool provider and all its tools
   */
  unregisterProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Unregister all tools from this provider
    const toolsToRemove: string[] = [];
    for (const [toolId, tool] of this.tools.entries()) {
      if (tool.providerId === providerId) {
        toolsToRemove.push(toolId);
      }
    }

    for (const toolId of toolsToRemove) {
      this.tools.delete(toolId);
    }

    // Remove provider
    this.providers.delete(providerId);
    console.log(`🗑️ Unregistered tool provider: ${providerId}`);
  }

  /**
   * Register a tool
   */
  async registerTool(
    tool: Tool,
    options: ToolRegistrationOptions = {}
  ): Promise<void> {
    const { enabled = true, metadata = {} } = options;

    // Validate tool structure
    this.validateTool(tool);

    // Create tool instance
    const toolInstance: Tool = {
      ...tool,
      enabled: enabled !== undefined ? enabled : tool.enabled,
      metadata: { ...tool.metadata, ...metadata },
    };

    // Check if provider exists
    const provider = this.providers.get(tool.providerId);
    if (!provider) {
      throw new Error(`Provider ${tool.providerId} not found. Register provider first.`);
    }

    // Register tool
    this.tools.set(tool.id, toolInstance);
    
    // Also add to provider's tool map
    provider.tools.set(tool.id, toolInstance);

    console.log(`✅ Registered tool: ${tool.name} (${tool.id}) from provider ${tool.providerId}`);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Remove from registry
    this.tools.delete(toolId);

    // Remove from provider's tool map
    const provider = this.providers.get(tool.providerId);
    if (provider) {
      provider.tools.delete(toolId);
    }

    console.log(`🗑️ Unregistered tool: ${toolId}`);
  }

  /**
   * Get a tool by ID
   */
  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get a tool by name (for OpenAI function calling)
   */
  getToolByName(name: string): Tool | undefined {
    for (const tool of this.tools.values()) {
      if (tool.name === name && tool.enabled) {
        return tool;
      }
    }
    return undefined;
  }

  /**
   * Get all tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get enabled tools only
   */
  getEnabledTools(): Tool[] {
    return Array.from(this.tools.values()).filter(tool => tool.enabled);
  }

  /**
   * Get tools by provider
   */
  getToolsByProvider(providerId: string): Tool[] {
    return Array.from(this.tools.values()).filter(
      tool => tool.providerId === providerId
    );
  }

  /**
   * Get all providers
   */
  getAllProviders(): ToolProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get enabled providers only
   */
  getEnabledProviders(): ToolProvider[] {
    return Array.from(this.providers.values()).filter(provider => provider.enabled);
  }

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): ToolProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Enable/disable a tool
   */
  setToolEnabled(toolId: string, enabled: boolean): void {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    tool.enabled = enabled;

    // Update in provider's tool map
    const provider = this.providers.get(tool.providerId);
    if (provider) {
      const providerTool = provider.tools.get(toolId);
      if (providerTool) {
        providerTool.enabled = enabled;
      }
    }

    console.log(`🔧 Tool ${toolId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable a provider (and all its tools)
   */
  setProviderEnabled(providerId: string, enabled: boolean): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    provider.enabled = enabled;

    // Disable/enable all tools from this provider
    for (const tool of this.tools.values()) {
      if (tool.providerId === providerId) {
        tool.enabled = enabled;
      }
    }

    console.log(`🔧 Provider ${providerId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
    toolCallId?: string
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Find the tool
    const tool = this.getToolByName(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
        toolCallId,
      };
    }

    if (!tool.enabled) {
      return {
        success: false,
        error: `Tool "${toolName}" is disabled`,
        toolCallId,
      };
    }

    // Get provider
    const provider = this.providers.get(tool.providerId);
    if (!provider) {
      return {
        success: false,
        error: `Provider "${tool.providerId}" not found`,
        toolCallId,
      };
    }

    if (!provider.enabled) {
      return {
        success: false,
        error: `Provider "${tool.providerId}" is disabled`,
        toolCallId,
      };
    }

    // Validate arguments
    const validationError = this.validateToolArguments(tool, args);
    if (validationError) {
      return {
        success: false,
        error: validationError,
        toolCallId,
      };
    }

    try {
      // Execute tool via provider
      const result = await provider.executeTool(toolName, args);
      const executionTime = Date.now() - startTime;

      // Add to history
      this.addToHistory(tool.id, args, { ...result, executionTime }, startTime);

      return {
        ...result,
        toolCallId,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult: ToolExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        toolCallId,
        executionTime,
      };

      // Add to history
      this.addToHistory(tool.id, args, errorResult, startTime);

      return errorResult;
    }
  }

  /**
   * Execute multiple tool calls (from AI model)
   */
  async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolMessage[]> {
    const results: ToolMessage[] = [];

    for (const toolCall of toolCalls) {
      try {
        // Parse arguments
        const args = JSON.parse(toolCall.function.arguments);

        // Execute tool
        const result = await this.executeTool(
          toolCall.function.name,
          args,
          toolCall.id
        );

        // Create tool message for AI SDK
        const toolMessage: ToolMessage = {
          role: 'tool',
          content: result.success
            ? JSON.stringify(result.result)
            : JSON.stringify({ error: result.error }),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        };

        results.push(toolMessage);
      } catch (error) {
        // Error parsing or executing tool call
        const errorMessage: ToolMessage = {
          role: 'tool',
          content: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        };
        results.push(errorMessage);
      }
    }

    return results;
  }

  /**
   * Get Zod schemas for AI SDK
   */
  getZodSchemasForAI(): Map<string, { description: string; schema: any; outputSchema?: any }> {
    const allSchemas = new Map<string, { description: string; schema: any; outputSchema?: any }>();
    
    for (const provider of this.providers.values()) {
      if (provider.enabled && provider.getZodSchemas) {
        const providerSchemas = provider.getZodSchemas();
        for (const [toolName, schemaDef] of providerSchemas.entries()) {
          allSchemas.set(toolName, schemaDef);
        }
      }
    }
    
    return allSchemas;
  }
  
  /**
   * Get tool definitions in OpenAI format (for AI SDK) - DEPRECATED, use getZodSchemasForAI instead
   */
  getToolDefinitionsForAI(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Tool['parameters'];
    };
  }> {
    return this.getEnabledTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): Array<{
    toolId: string;
    args: Record<string, any>;
    result: ToolExecutionResult;
    timestamp: number;
  }> {
    const history = [...this.executionHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Validate tool structure
   */
  private validateTool(tool: Tool): void {
    if (!tool.id) {
      throw new Error('Tool must have an id');
    }
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }
    if (!tool.description) {
      throw new Error('Tool must have a description');
    }
    if (!tool.parameters || tool.parameters.type !== 'object') {
      throw new Error('Tool must have parameters with type "object"');
    }
    if (!tool.providerId) {
      throw new Error('Tool must have a providerId');
    }
  }

  /**
   * Validate tool arguments against tool parameters
   */
  private validateToolArguments(
    tool: Tool,
    args: Record<string, any>
  ): string | null {
    const { properties, required = [] } = tool.parameters;

    // Check required parameters
    for (const paramName of required) {
      if (!(paramName in args)) {
        return `Missing required parameter: ${paramName}`;
      }
    }

    // Check parameter types (basic validation)
    for (const [paramName, paramValue] of Object.entries(args)) {
      const paramDef = properties[paramName];
      if (!paramDef) {
        // Allow extra parameters (flexible)
        continue;
      }

      // Type validation
      const paramType = paramDef.type;
      if (paramType === 'string' && typeof paramValue !== 'string') {
        return `Parameter ${paramName} must be a string`;
      }
      if (paramType === 'number' && typeof paramValue !== 'number') {
        return `Parameter ${paramName} must be a number`;
      }
      if (paramType === 'boolean' && typeof paramValue !== 'boolean') {
        return `Parameter ${paramName} must be a boolean`;
      }
      if (paramType === 'array' && !Array.isArray(paramValue)) {
        return `Parameter ${paramName} must be an array`;
      }
      if (paramType === 'object' && typeof paramValue !== 'object' || Array.isArray(paramValue)) {
        return `Parameter ${paramName} must be an object`;
      }

      // Enum validation
      if (paramDef.enum && !paramDef.enum.includes(paramValue)) {
        return `Parameter ${paramName} must be one of: ${paramDef.enum.join(', ')}`;
      }
    }

    return null;
  }

  /**
   * Add execution to history
   */
  private addToHistory(
    toolId: string,
    args: Record<string, any>,
    result: ToolExecutionResult,
    timestamp: number
  ): void {
    this.executionHistory.push({ toolId, args, result, timestamp });

    // Trim history if too long
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();

