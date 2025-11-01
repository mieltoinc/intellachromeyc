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

  getZodSchemas(): Map<string, { description: string; schema: any }> {
    const schemas = new Map<string, { description: string; schema: any }>();
    
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
    
    schemas.set('capture_screenshot', {
      description: 'Capture a screenshot of the current visible tab',
      schema: z.object({}),
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

