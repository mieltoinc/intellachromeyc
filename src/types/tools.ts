/**
 * Tool Registry Types and Interfaces
 */

/**
 * Tool parameter definition following OpenAI tool format
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: (string | number)[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: boolean;
}

/**
 * Tool definition following OpenAI function calling format
 */
export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  enabled: boolean;
  providerId: string;
  metadata?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  toolCallId?: string;
  executionTime?: number;
}

/**
 * Tool provider interface
 * Providers are responsible for executing tools they register
 */
export interface ToolProvider {
  id: string;
  name: string;
  description?: string;
  version?: string;
  enabled: boolean;
  tools: Map<string, Tool>;
  
  /**
   * Execute a tool by name
   */
  executeTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult>;
  
  /**
   * Initialize the provider (e.g., setup API clients)
   */
  initialize?(): Promise<void>;
  
  /**
   * Get tool definitions in OpenAI format
   */
  getToolDefinitions(): Tool[];
  
  /**
   * Get Zod schemas for AI SDK - returns tool name to Zod schema mapping
   */
  getZodSchemas?(): Map<string, { description: string; schema: any; outputSchema?: any }>;
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  enabled?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Tool provider registration options
 */
export interface ProviderRegistrationOptions {
  enabled?: boolean;
  autoRegisterTools?: boolean;
}

/**
 * Tool call from AI model (OpenAI format)
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Tool message for AI SDK (after execution)
 */
export interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
  name?: string;
}

