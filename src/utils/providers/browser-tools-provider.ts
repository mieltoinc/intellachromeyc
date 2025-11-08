/**
 * Browser Tools Provider - Tools for web browsing using Chrome APIs
 * Works in background service worker context
 */

import { z } from 'zod';
import type { ToolProvider, Tool, ToolExecutionResult } from '@/types/tools';

export class BrowserToolsProvider implements ToolProvider {
  id = 'browser-tools';
  name = 'Browser Tools';
  description = 'Tools for web browsing and page interaction using Chrome APIs';
  version = '1.0.0';
  enabled = true;
  tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerTools();
  }

  private registerTools() {
    // Get current page URL
    this.tools.set('get_current_url', {
      id: 'get_current_url',
      name: 'get_current_url',
      description: 'Get the URL of the current active tab',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });

    // Get page title
    this.tools.set('get_page_title', {
      id: 'get_page_title',
      name: 'get_page_title',
      description: 'Get the title of the current active tab',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });

    // Scroll to element (requires content script proxy)
    this.tools.set('scroll_to_element', {
      id: 'scroll_to_element',
      name: 'scroll_to_element',
      description: 'Scroll to a specific element on the page using a CSS selector',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to scroll to',
          },
        },
        required: ['selector'],
      },
      enabled: true,
      providerId: this.id,
    });

    // Click element (requires content script proxy)
    this.tools.set('click_element', {
      id: 'click_element',
      name: 'click_element',
      description: 'Click an element on the page using a CSS selector',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click',
          },
        },
        required: ['selector'],
      },
      enabled: true,
      providerId: this.id,
    });

    // Extract text from element (requires content script proxy)
    this.tools.set('extract_text', {
      id: 'extract_text',
      name: 'extract_text',
      description: 'Extract text content from an element using a CSS selector',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to extract text from',
          },
        },
        required: ['selector'],
      },
      enabled: true,
      providerId: this.id,
    });

    // Search for elements using various methods (requires content script proxy)
    this.tools.set('search_element', {
      id: 'search_element',
      name: 'search_element',
      description: 'Search for elements on the page using various methods: CSS selector, XPath, text content, attributes, tag name, or ARIA role. Use this tool to find elements on the page that match your search query. Should be used in conjunction with tools like click_element or extract_text or scroll_to_element to interact with the elements. Can be used as a fallback when other tools fail to find the element. Supports multiple search criteria - all criteria must match (AND logic).',
      parameters: {
        type: 'object',
        properties: {
          criteria: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                method: {
                  type: 'string',
                  enum: ['css', 'xpath', 'text', 'id', 'class', 'name', 'tag', 'role', 'attribute'],
                  description: 'Search method to use: css (CSS selector), xpath (XPath expression), text (text content search), id (element ID), class (CSS class name), name (name attribute), tag (HTML tag name), role (ARIA role), or attribute (custom attribute search)',
                  required: true,
                },
                query: {
                  type: 'string',
                  description: 'The search query/value based on the selected method. For text search, can be partial match. For attribute search, use format "attrName=attrValue"',
                  required: true,
                },
              },
            },
            description: 'Array of search criteria. All criteria must match (AND logic). If provided, this takes precedence over single method/query parameters.',
          },
          method: {
            type: 'string',
            enum: ['css', 'xpath', 'text', 'id', 'class', 'name', 'tag', 'role', 'attribute'],
            description: 'Single search method (for backward compatibility). Use criteria array for multiple search methods.',
          },
          query: {
            type: 'string',
            description: 'Single search query (for backward compatibility). Use criteria array for multiple search methods.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of elements to return (default: 10)',
          },
        },
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });

    // Capture screenshot of current page
    this.tools.set('capture_screenshot', {
      id: 'capture_screenshot',
      name: 'capture_screenshot',
      description: 'Capture a screenshot of the current visible tab',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });
  }

  getZodSchemas(): Map<string, { description: string; schema: any; outputSchema?: any }> {
    const schemas = new Map<string, { description: string; schema: any; outputSchema?: any }>();
    
    schemas.set('get_current_url', {
      description: 'Get the URL of the current active tab',
      schema: z.object({}),
    });
    
    schemas.set('get_page_title', {
      description: 'Get the title of the current active tab',
      schema: z.object({}),
    });
    
    schemas.set('scroll_to_element', {
      description: 'Scroll to a specific element on the page using a CSS selector',
      schema: z.object({
        selector: z.string().describe('CSS selector for the element to scroll to'),
      }),
    });
    
    schemas.set('click_element', {
      description: 'Click an element on the page using a CSS selector',
      schema: z.object({
        selector: z.string().describe('CSS selector for the element to click'),
      }),
    });
    
    schemas.set('extract_text', {
      description: 'Extract text content from an element using a CSS selector',
      schema: z.object({
        selector: z.string().describe('CSS selector for the element to extract text from'),
      }),
    });
    
    schemas.set('search_element', {
      description: 'Search for elements on the page using various methods: CSS selector, XPath, text content, attributes, tag name, or ARIA role. Supports multiple search criteria - all criteria must match (AND logic).',
      schema: z.object({
        criteria: z.array(z.object({
          method: z.enum(['css', 'xpath', 'text', 'id', 'class', 'name', 'tag', 'role', 'attribute']).describe('Search method to use: css (CSS selector), xpath (XPath expression), text (text content search), id (element ID), class (CSS class name), name (name attribute), tag (HTML tag name), role (ARIA role), or attribute (custom attribute search)'),
          query: z.string().describe('The search query/value based on the selected method. For text search, can be partial match. For attribute search, use format "attrName=attrValue"'),
        })).optional().describe('Array of search criteria. All criteria must match (AND logic). If provided, this takes precedence over single method/query parameters.'),
        method: z.enum(['css', 'xpath', 'text', 'id', 'class', 'name', 'tag', 'role', 'attribute']).optional().describe('Single search method (for backward compatibility). Use criteria array for multiple search methods.'),
        query: z.string().optional().describe('Single search query (for backward compatibility). Use criteria array for multiple search methods.'),
        limit: z.number().optional().describe('Maximum number of elements to return (default: 10)'),
      }),
    });
    
    schemas.set('capture_screenshot', {
      description: 'Capture a screenshot of the current visible tab',
      schema: z.object({}),
      outputSchema: z.object({
        screenshot: z.string().describe('Data URL of the captured screenshot in format: data:image/png;base64,<base64-encoded-image-data>'),
      }),
    });
    
    return schemas;
  }

  /**
   * Execute a tool via content script proxy if needed
   */
  private async executeInContentScript(
    tabId: number,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: 'EXECUTE_TOOL',
          payload: {
            toolName,
            args,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Content script might not be loaded - provide helpful error
            const error = chrome.runtime.lastError.message;
            if (error?.includes('Could not establish connection') || error?.includes('Receiving end does not exist')) {
              reject(new Error(`Content script not available. This tool requires the page to have the Intella content script loaded.`));
            } else {
              reject(new Error(error));
            }
          } else if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Tool execution failed'));
          }
        }
      );
    });
  }

  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      // Get active tab for all browser operations
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        return {
          success: false,
          error: 'No active tab found',
        };
      }
      const tabId = tabs[0].id;
      const tab = tabs[0];

      switch (toolName) {
        case 'get_current_url': {
          if (!tab.url) {
            return {
              success: false,
              error: 'Unable to get URL from active tab',
            };
          }
          return {
            success: true,
            result: { url: tab.url },
          };
        }

        case 'get_page_title': {
          if (!tab.title) {
            return {
              success: false,
              error: 'Unable to get title from active tab',
            };
          }
          return {
            success: true,
            result: { title: tab.title },
          };
        }

        case 'scroll_to_element': {
          try {
            const result = await this.executeInContentScript(tabId, toolName, args);
            return {
              success: true,
              result,
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to scroll to element',
            };
          }
        }

        case 'click_element': {
          try {
            const result = await this.executeInContentScript(tabId, toolName, args);
            return {
              success: true,
              result,
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to click element',
            };
          }
        }

        case 'extract_text': {
          try {
            const result = await this.executeInContentScript(tabId, toolName, args);
            return {
              success: true,
              result,
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to extract text',
            };
          }
        }

        case 'search_element': {
          try {
            const result = await this.executeInContentScript(tabId, toolName, args);
            return {
              success: true,
              result,
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to search for elements',
            };
          }
        }

        case 'capture_screenshot': {
          try {
            // Capture screenshot using Chrome API
            const dataUrl = await chrome.tabs.captureVisibleTab({
              format: 'png',
              quality: 90
            });
            return {
              success: true,
              result: { screenshot: dataUrl },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to capture screenshot',
            };
          }
        }

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values());
  }
}

