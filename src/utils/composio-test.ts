/**
 * Composio Test Utilities - Test Composio tools integration
 */

import { composioClient } from './composio-client';
import { composioToolsHandler } from './composio-tools';
import { aiSDKClient, type AIMessage } from './ai-sdk-client';

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Test Composio client initialization
 */
export async function testComposioClient(): Promise<TestResult> {
  try {
    await composioClient.initialize();
    
    if (!composioClient.isReady()) {
      return {
        success: false,
        message: 'Composio client failed to initialize',
        error: 'Client not ready',
      };
    }

    return {
      success: true,
      message: 'Composio client initialized successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to initialize Composio client',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test loading Composio tools
 */
export async function testComposioTools(): Promise<TestResult> {
  try {
    const tools = await composioToolsHandler.getAvailableToolsInfo();
    const connectionStatus = await composioToolsHandler.checkToolkitConnections();

    return {
      success: true,
      message: `Found ${tools.length} Composio tools`,
      data: {
        toolCount: tools.length,
        tools: tools.map(t => ({
          name: t.name,
          toolkit: t.toolkit,
          description: t.description,
        })),
        connections: {
          shopify: connectionStatus.shopify,
          perplexity: connectionStatus.perplexity,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to load Composio tools',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test Perplexity search using AI SDK with Composio tools
 */
export async function testPerplexitySearch(query: string = 'What is the weather in San Francisco?'): Promise<TestResult> {
  try {
    // First, check if Perplexity is connected
    const connectionStatus = await composioToolsHandler.checkToolkitConnections();
    
    if (!connectionStatus.perplexity) {
      return {
        success: false,
        message: 'Perplexity is not connected',
        error: 'Please connect Perplexity AI in the settings first',
        data: {
          perplexityConnected: false,
        },
      };
    }

    // Check if tools are loaded
    const tools = await composioToolsHandler.getAvailableToolsInfo(['perplexityai']);
    const perplexityTools = tools.filter(t => 
      t.toolkit.toLowerCase().includes('perplexity')
    );

    if (perplexityTools.length === 0) {
      return {
        success: false,
        message: 'No Perplexity tools found',
        error: 'Perplexity tools are not available',
      };
    }

    console.log(`🧪 Testing Perplexity search with query: "${query}"`);
    console.log(`📋 Found ${perplexityTools.length} Perplexity tools`);

    // Create a test message that should trigger Perplexity search
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant with access to Perplexity AI for web search. When the user asks a question that requires current information, use the Perplexity search tool.',
      },
      {
        role: 'user',
        content: query,
      },
    ];

    // Use AI SDK with tools enabled
    const result = await aiSDKClient.generate(messages, {
      enableTools: true,
      maxToolIterations: 3,
    });

    return {
      success: true,
      message: 'Perplexity search test completed',
      data: {
        query,
        response: result.content,
        usage: result.usage,
        perplexityToolsCount: perplexityTools.length,
        perplexityTools: perplexityTools.map(t => ({
          name: t.name,
          description: t.description,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Perplexity search test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all Composio tests
 */
export async function runAllComposioTests(): Promise<{
  client: TestResult;
  tools: TestResult;
  perplexitySearch?: TestResult;
}> {
  console.log('🧪 Running Composio tests...');
  
  const clientTest = await testComposioClient();
  console.log('✅ Client test:', clientTest.success ? 'PASSED' : 'FAILED', clientTest.message);

  const toolsTest = await testComposioTools();
  console.log('✅ Tools test:', toolsTest.success ? 'PASSED' : 'FAILED', toolsTest.message);

  // Only test Perplexity if it's connected
  const connectionStatus = await composioToolsHandler.checkToolkitConnections();
  let perplexitySearchTest: TestResult | undefined;

  if (connectionStatus.perplexity) {
    perplexitySearchTest = await testPerplexitySearch();
    console.log('✅ Perplexity search test:', perplexitySearchTest.success ? 'PASSED' : 'FAILED', perplexitySearchTest.message);
  } else {
    console.log('⚠️ Skipping Perplexity search test - Perplexity not connected');
  }

  return {
    client: clientTest,
    tools: toolsTest,
    perplexitySearch: perplexitySearchTest,
  };
}
