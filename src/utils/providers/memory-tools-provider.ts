/**
 * Memory Tools Provider - Tools for interacting with Intella memories
 */

import { z } from 'zod';
import type { ToolProvider, Tool, ToolExecutionResult } from '@/types/tools';
import { storage } from '../storage';
import { mossClient } from '../moss-client';

export class MemoryToolsProvider implements ToolProvider {
  id = 'memory-tools';
  name = 'Memory Tools';
  description = 'Tools for searching and managing Intella memories';
  version = '1.0.0';
  enabled = true;
  tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerTools();
  }

  private registerTools() {
    // Search memories
    this.tools.set('search_memories', {
      id: 'search_memories',
      name: 'search_memories',
      description: 'Search through stored memories by keyword, URL, or content',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant memories',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of memories to return (default: 10)',
          },
        },
        required: ['query'],
      },
      enabled: true,
      providerId: this.id,
    });

    // Get recent memories
    this.tools.set('get_recent_memories', {
      id: 'get_recent_memories',
      name: 'get_recent_memories',
      description: 'Get the most recently captured memories',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of recent memories to return (default: 5)',
          },
        },
        required: [],
      },
      enabled: true,
      providerId: this.id,
    });

    // Get memory by URL
    this.tools.set('get_memory_by_url', {
      id: 'get_memory_by_url',
      name: 'get_memory_by_url',
      description: 'Get a memory by its URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL of the memory to retrieve',
          },
        },
        required: ['url'],
      },
      enabled: true,
      providerId: this.id,
    });
  }

  getZodSchemas(): Map<string, { description: string; schema: any }> {
    const schemas = new Map<string, { description: string; schema: any }>();
    
    schemas.set('search_memories', {
      description: 'Search through stored memories by keyword, URL, or content',
      schema: z.object({
        query: z.string().describe('Search query to find relevant memories'),
        limit: z.number().optional().describe('Maximum number of memories to return (default: 10)'),
      }),
    });
    
    schemas.set('get_recent_memories', {
      description: 'Get the most recently captured memories',
      schema: z.object({
        limit: z.number().optional().describe('Number of recent memories to return (default: 5)'),
      }),
    });
    
    schemas.set('get_memory_by_url', {
      description: 'Get a memory by its URL',
      schema: z.object({
        url: z.string().describe('URL of the memory to retrieve'),
      }),
    });
    
    return schemas;
  }

  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      switch (toolName) {
        case 'search_memories': {
          const { query, limit = 10 } = args;
          
          // Use Moss semantic search first
          let memories: any[] = [];
          
          try {
            console.log('🔍 Searching Moss for:', query);
            const mossSearchResults = await mossClient.searchMemories(query, limit);
            console.log('🔍 Moss search results:', mossSearchResults);
            
            if (mossSearchResults.length > 0) {
              console.log(`✅ Moss found ${mossSearchResults.length} semantically relevant memories`);
              
              // Fetch the actual memory objects for Moss results
              for (const mossResult of mossSearchResults) {
                try {
                  const memory = await storage.getMemory(mossResult.memoryId);
                  if (memory && memory.id && memory.summary) {
                    // Include relevance score from Moss
                    memories.push({
                      ...memory,
                      relevanceScore: mossResult.score,
                    });
                    console.log(`✅ Found memory locally: ${mossResult.memoryId} - "${memory.title?.substring(0, 50)}" (score: ${mossResult.score.toFixed(3)})`);
                  }
                } catch (error: any) {
                  // Memory might not exist locally, skip
                  console.warn(`⚠️ Memory ${mossResult.memoryId} from Moss not found locally:`, error.message || error);
                }
              }
              
              console.log(`📊 Moss search summary: Found ${memories.length} valid memories locally`);
            } else {
              console.log('ℹ️ Moss search returned empty results, falling back to local search');
            }
          } catch (mossError: any) {
            console.warn('⚠️ Moss search failed, falling back to local search:', mossError.message || mossError);
          }
          
          // Fallback to local text-based search if Moss returned empty or failed
          if (memories.length === 0) {
            console.log('🔍 Falling back to local text search...');
            const localMemories = await storage.searchMemories(query, limit);
            console.log(`✅ Local search found ${localMemories.length} results`);
            memories = localMemories;
          }
          
          return {
            success: true,
            result: {
              count: memories.length,
              memories: memories.map(m => ({
                id: m.id,
                url: m.url,
                title: m.title,
                summary: m.summary,
                keywords: m.keywords,
                timestamp: m.timestamp,
                ...(m.relevanceScore !== undefined && { relevanceScore: m.relevanceScore }),
              })),
            },
          };
        }

        case 'get_recent_memories': {
          const { limit = 5 } = args;
          const allMemories = await storage.getAllMemories();
          
          // Sort by timestamp (most recent first)
          const sorted = allMemories.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
          });

          const recent = sorted.slice(0, limit);
          return {
            success: true,
            result: {
              count: recent.length,
              memories: recent.map(m => ({
                id: m.id,
                url: m.url,
                title: m.title,
                summary: m.summary,
                timestamp: m.timestamp,
              })),
            },
          };
        }

        case 'get_memory_by_url': {
          const { url } = args;
          const memories = await storage.getAllMemories();
          const memory = memories.find(m => m.url === url);

          if (!memory) {
            return {
              success: false,
              error: `Memory not found for URL: ${url}`,
            };
          }

          return {
            success: true,
            result: {
              id: memory.id,
              url: memory.url,
              title: memory.title,
              summary: memory.summary,
              keywords: memory.keywords,
              entities: memory.entities,
              timestamp: memory.timestamp,
            },
          };
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

