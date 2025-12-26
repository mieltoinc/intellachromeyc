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

    // Tab Groups Management Tools
    this.tools.set('create_tab_group', {
      id: 'create_tab_group',
      name: 'create_tab_group',
      description: 'Create a new tab group and optionally add tabs to it',
      parameters: {
        type: 'object',
        properties: {
          tabIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of tab IDs to add to the group. If not provided, creates an empty group.',
          },
          title: {
            type: 'string',
            description: 'Title for the tab group (optional)',
          },
          color: {
            type: 'string',
            enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'],
            description: 'Color for the tab group (optional, defaults to grey)',
          },
        },
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });

    this.tools.set('add_tabs_to_group', {
      id: 'add_tabs_to_group',
      name: 'add_tabs_to_group',
      description: 'Add tabs to an existing tab group',
      parameters: {
        type: 'object',
        properties: {
          groupId: {
            type: 'number',
            description: 'ID of the tab group to add tabs to',
          },
          tabIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of tab IDs to add to the group',
          },
        },
        required: ['groupId', 'tabIds'],
      },
      enabled: true,
      providerId: this.id,
    });

    this.tools.set('remove_tabs_from_group', {
      id: 'remove_tabs_from_group',
      name: 'remove_tabs_from_group',
      description: 'Remove tabs from their current group (ungroup them)',
      parameters: {
        type: 'object',
        properties: {
          tabIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of tab IDs to remove from their groups',
          },
        },
        required: ['tabIds'],
      },
      enabled: true,
      providerId: this.id,
    });

    this.tools.set('update_tab_group', {
      id: 'update_tab_group',
      name: 'update_tab_group',
      description: 'Update tab group properties like title, color, or collapsed state',
      parameters: {
        type: 'object',
        properties: {
          groupId: {
            type: 'number',
            description: 'ID of the tab group to update',
          },
          title: {
            type: 'string',
            description: 'New title for the tab group (optional)',
          },
          color: {
            type: 'string',
            enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'],
            description: 'New color for the tab group (optional)',
          },
          collapsed: {
            type: 'boolean',
            description: 'Whether to collapse or expand the tab group (optional)',
          },
        },
        required: ['groupId'],
      },
      enabled: true,
      providerId: this.id,
    });

    this.tools.set('get_tab_groups', {
      id: 'get_tab_groups',
      name: 'get_tab_groups',
      description: 'Get information about all tab groups in the current window',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });

    this.tools.set('get_tabs_in_window', {
      id: 'get_tabs_in_window',
      name: 'get_tabs_in_window',
      description: 'Get information about all tabs in the current window, including their group status',
      parameters: {
        type: 'object',
        properties: {
          includeGroupInfo: {
            type: 'boolean',
            description: 'Whether to include group information for each tab (default: true)',
          },
        },
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });

    this.tools.set('organize_tabs_by_domain', {
      id: 'organize_tabs_by_domain',
      name: 'organize_tabs_by_domain',
      description: 'Automatically organize tabs into groups by their domain/website',
      parameters: {
        type: 'object',
        properties: {
          minTabsPerGroup: {
            type: 'number',
            description: 'Minimum number of tabs required to create a group for a domain (default: 2)',
          },
        },
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

    // Tab Groups Management Schemas
    schemas.set('create_tab_group', {
      description: 'Create a new tab group and optionally add tabs to it',
      schema: z.object({
        tabIds: z.array(z.number()).optional().describe('Array of tab IDs to add to the group. If not provided, creates an empty group.'),
        title: z.string().optional().describe('Title for the tab group (optional)'),
        color: z.enum(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan']).optional().describe('Color for the tab group (optional, defaults to grey)'),
      }),
    });

    schemas.set('add_tabs_to_group', {
      description: 'Add tabs to an existing tab group',
      schema: z.object({
        groupId: z.number().describe('ID of the tab group to add tabs to'),
        tabIds: z.array(z.number()).describe('Array of tab IDs to add to the group'),
      }),
    });

    schemas.set('remove_tabs_from_group', {
      description: 'Remove tabs from their current group (ungroup them)',
      schema: z.object({
        tabIds: z.array(z.number()).describe('Array of tab IDs to remove from their groups'),
      }),
    });

    schemas.set('update_tab_group', {
      description: 'Update tab group properties like title, color, or collapsed state',
      schema: z.object({
        groupId: z.number().describe('ID of the tab group to update'),
        title: z.string().optional().describe('New title for the tab group (optional)'),
        color: z.enum(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan']).optional().describe('New color for the tab group (optional)'),
        collapsed: z.boolean().optional().describe('Whether to collapse or expand the tab group (optional)'),
      }),
    });

    schemas.set('get_tab_groups', {
      description: 'Get information about all tab groups in the current window',
      schema: z.object({}),
    });

    schemas.set('get_tabs_in_window', {
      description: 'Get information about all tabs in the current window, including their group status',
      schema: z.object({
        includeGroupInfo: z.boolean().optional().describe('Whether to include group information for each tab (default: true)'),
      }),
    });

    schemas.set('organize_tabs_by_domain', {
      description: 'Automatically organize tabs into groups by their domain/website',
      schema: z.object({
        minTabsPerGroup: z.number().optional().describe('Minimum number of tabs required to create a group for a domain (default: 2)'),
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

        // Tab Groups Management Cases
        case 'create_tab_group': {
          try {
            const { tabIds = [], title, color = 'grey' } = args;
            
            // Create the group - chrome.tabGroups.group takes just tab IDs
            let groupId: number;
            if (tabIds.length > 0) {
              groupId = await chrome.tabs.group({ tabIds });
            } else {
              // Create with current tab if no tabs specified
              const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
              if (currentTabs[0]?.id) {
                groupId = await chrome.tabs.group({ tabIds: [currentTabs[0].id] });
              } else {
                throw new Error('No tabs available to create group');
              }
            }
            
            // Update group properties if specified
            const updateProperties: chrome.tabGroups.UpdateProperties = {};
            if (title) updateProperties.title = title;
            if (color) updateProperties.color = color as chrome.tabGroups.ColorEnum;
            
            if (Object.keys(updateProperties).length > 0) {
              await chrome.tabGroups.update(groupId, updateProperties);
            }
            
            const group = await chrome.tabGroups.get(groupId);
            return {
              success: true,
              result: {
                groupId: group.id,
                title: group.title,
                color: group.color,
                collapsed: group.collapsed,
                windowId: group.windowId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to create tab group',
            };
          }
        }

        case 'add_tabs_to_group': {
          try {
            const { groupId, tabIds } = args;
            await chrome.tabs.group({ tabIds, groupId });
            
            const group = await chrome.tabGroups.get(groupId);
            return {
              success: true,
              result: {
                groupId: group.id,
                title: group.title,
                color: group.color,
                addedTabsCount: tabIds.length,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to add tabs to group',
            };
          }
        }

        case 'remove_tabs_from_group': {
          try {
            const { tabIds } = args;
            await chrome.tabs.ungroup(tabIds);
            
            return {
              success: true,
              result: {
                ungroupedTabsCount: tabIds.length,
                message: `Successfully removed ${tabIds.length} tab(s) from their groups`,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to remove tabs from group',
            };
          }
        }

        case 'update_tab_group': {
          try {
            const { groupId, title, color, collapsed } = args;
            
            const updateProperties: chrome.tabGroups.UpdateProperties = {};
            if (title !== undefined) updateProperties.title = title;
            if (color !== undefined) updateProperties.color = color as chrome.tabGroups.ColorEnum;
            if (collapsed !== undefined) updateProperties.collapsed = collapsed;
            
            const group = await chrome.tabGroups.update(groupId, updateProperties);
            return {
              success: true,
              result: {
                groupId: group.id,
                title: group.title,
                color: group.color,
                collapsed: group.collapsed,
                windowId: group.windowId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to update tab group',
            };
          }
        }

        case 'get_tab_groups': {
          try {
            const currentWindow = await chrome.windows.getCurrent();
            const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
            
            return {
              success: true,
              result: {
                groups: groups.map(group => ({
                  id: group.id,
                  title: group.title,
                  color: group.color,
                  collapsed: group.collapsed,
                  windowId: group.windowId,
                })),
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to get tab groups',
            };
          }
        }

        case 'get_tabs_in_window': {
          try {
            const { includeGroupInfo = true } = args;
            const currentWindow = await chrome.windows.getCurrent();
            const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
            
            const result = tabs.map(tab => ({
              id: tab.id,
              title: tab.title,
              url: tab.url,
              active: tab.active,
              pinned: tab.pinned,
              groupId: includeGroupInfo ? (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? tab.groupId : null) : undefined,
              index: tab.index,
            }));
            
            return {
              success: true,
              result: { tabs: result },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to get tabs in window',
            };
          }
        }

        case 'organize_tabs_by_domain': {
          try {
            const { minTabsPerGroup = 2 } = args;
            const currentWindow = await chrome.windows.getCurrent();
            const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
            
            // Group tabs by domain
            const domainGroups: Record<string, chrome.tabs.Tab[]> = {};
            
            for (const tab of tabs) {
              if (!tab.url || !tab.id) continue;
              
              try {
                const url = new URL(tab.url);
                const domain = url.hostname.replace(/^www\./, '');
                
                if (!domainGroups[domain]) {
                  domainGroups[domain] = [];
                }
                domainGroups[domain].push(tab);
              } catch (e) {
                // Skip invalid URLs
                continue;
              }
            }
            
            // Create groups for domains with enough tabs
            const createdGroups = [];
            const colors: chrome.tabGroups.ColorEnum[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
            let colorIndex = 0;
            
            for (const [domain, domainTabs] of Object.entries(domainGroups)) {
              if (domainTabs.length >= minTabsPerGroup) {
                const tabIds = domainTabs.map(tab => tab.id!).filter(Boolean);
                
                if (tabIds.length > 0) {
                  const groupId = await chrome.tabs.group({ tabIds });
                  await chrome.tabGroups.update(groupId, {
                    title: domain,
                    color: colors[colorIndex % colors.length],
                  });
                  
                  createdGroups.push({
                    domain,
                    groupId,
                    tabCount: tabIds.length,
                  });
                  
                  colorIndex++;
                }
              }
            }
            
            return {
              success: true,
              result: {
                createdGroups,
                totalDomainsProcessed: Object.keys(domainGroups).length,
                groupsCreated: createdGroups.length,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message || 'Failed to organize tabs by domain',
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

