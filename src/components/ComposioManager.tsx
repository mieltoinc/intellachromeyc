/**
 * Composio Manager Component - Handles tool authorization and management
 */

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { composioClient, type ComposioConnection } from '@/utils/composio-client';
import { composioToolsHandler } from '@/utils/composio-tools';
import { storage } from '@/utils/storage';
import type { UserSettings } from '@/types/memory';

interface ComposioManagerProps {
  className?: string;
}

export function ComposioManager({ className }: ComposioManagerProps) {
  const [settings, setSettings] = useState<UserSettings['composio']>({
    apiKey: undefined,
    baseUrl: undefined,
    enabled: false,
    toolsEnabled: false,
    shopifyConnected: false,
    perplexityConnected: false,
    hackernewsConnected: false,
  });
  
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const composioSettings = await storage.getComposioSettings();
      setSettings(composioSettings);
      setApiKey(composioSettings.apiKey || '');
      setBaseUrl(composioSettings.baseUrl || '');
      
      if (composioSettings.enabled && composioSettings.apiKey) {
        loadConnections();
      }
    } catch (error) {
      console.error('Failed to load Composio settings:', error);
      setError('Failed to load settings');
    }
  };

  const loadConnections = async () => {
    try {
      const connectionsList = await composioClient.getConnections();
      setConnections(connectionsList);
      
      // Update connection status in settings
      const shopifyConnected = connectionsList.some(conn => 
        conn.toolkit.toLowerCase().includes('shopify') && conn.status === 'active'
      );
      const perplexityConnected = connectionsList.some(conn => 
        conn.toolkit.toLowerCase().includes('perplexity') && conn.status === 'active'
      );
      const hackernewsConnected = connectionsList.some(conn => 
        (conn.toolkit.toLowerCase().includes('hackernews') || conn.toolkit.toLowerCase().includes('hacker')) && conn.status === 'active'
      );
      
      await storage.updateComposioSettings({
        shopifyConnected,
        perplexityConnected,
        hackernewsConnected,
      });
      
      setSettings(prev => ({
        ...prev,
        shopifyConnected,
        perplexityConnected,
        hackernewsConnected,
      }));
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await storage.updateComposioSettings({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
        enabled: true,
      });
      
      // Update the client configuration
      await composioClient.updateConfig({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
      });
      
      setSuccess('API key saved successfully');
      loadSettings();
    } catch (error) {
      console.error('Failed to save API key:', error);
      setError('Failed to save API key');
    } finally {
      setLoading(false);
    }
  };

  const toggleTools = async () => {
    setLoading(true);
    try {
      const newToolsEnabled = !settings.toolsEnabled;
      await storage.updateComposioSettings({
        toolsEnabled: newToolsEnabled,
      });
      
      setSettings(prev => ({ ...prev, toolsEnabled: newToolsEnabled }));
      setSuccess(`Tools ${newToolsEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle tools:', error);
      setError('Failed to update tools setting');
    } finally {
      setLoading(false);
    }
  };

  const authorizeToolkit = async (toolkit: 'shopify' | 'perplexityai' | 'hackernews') => {
    if (!settings.enabled || !settings.apiKey) {
      setError('Please save your API key first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log(`Starting authorization for ${toolkit}...`);
      const authFlow = await composioClient.authorizeToolkit(toolkit);
      
      // Open the authorization URL in a new tab
      chrome.tabs.create({ url: authFlow.redirectUrl });
      
      setSuccess(`Authorization started for ${toolkit}. Please complete the process in the new tab.`);
      
      // Start polling for connection completion
      setTimeout(() => checkConnectionStatus(authFlow.id, toolkit), 3000);
    } catch (error) {
      console.error(`Failed to authorize ${toolkit}:`, error);
      setError(`Failed to start authorization for ${toolkit}`);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async (authFlowId: string, toolkit: string) => {
    try {
      await composioClient.waitForConnection(authFlowId);
      setSuccess(`${toolkit} connected successfully!`);
      loadConnections();
    } catch (error) {
      console.error(`Connection check failed for ${toolkit}:`, error);
      setError(`Failed to complete ${toolkit} connection`);
    }
  };

  const disconnectToolkit = async (connectionId: string, toolkitName: string) => {
    setLoading(true);
    try {
      await composioClient.disconnectToolkit(connectionId);
      setSuccess(`${toolkitName} disconnected successfully`);
      loadConnections();
    } catch (error) {
      console.error(`Failed to disconnect ${toolkitName}:`, error);
      setError(`Failed to disconnect ${toolkitName}`);
    } finally {
      setLoading(false);
    }
  };

  const testTools = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const toolsInfo = await composioToolsHandler.getAvailableToolsInfo();
      const connectionStatus = await composioToolsHandler.checkToolkitConnections();
      
      setSuccess(
        `Found ${toolsInfo.length} tools. ` +
        `Shopify: ${connectionStatus.shopify ? 'Connected' : 'Not connected'}, ` +
        `Perplexity: ${connectionStatus.perplexity ? 'Connected' : 'Not connected'}, ` +
        `HackerNews: ${connectionStatus.hackernews ? 'Connected' : 'Not connected'}`
      );
    } catch (error) {
      console.error('Failed to test tools:', error);
      setError('Failed to test tools');
    } finally {
      setLoading(false);
    }
  };

  const testPerplexitySearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { testPerplexitySearch } = await import('@/utils/composio-test');
      const result = await testPerplexitySearch('What are the latest developments in AI?');
      
      if (result.success) {
        setSuccess(`Perplexity search test passed! Response length: ${result.data?.response?.length || 0} chars`);
        console.log('🧪 Perplexity search result:', result.data);
      } else {
        setError(result.error || result.message);
      }
    } catch (error) {
      console.error('Failed to test Perplexity search:', error);
      setError('Failed to test Perplexity search');
    } finally {
      setLoading(false);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className={className}>
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-darkText-primary">
          Composio Tools Integration
        </h3>
        
        {/* API Key Configuration */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-darkText-secondary">
              Composio API Key
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Composio API key"
                className="flex-1"
              />
              <Button 
                onClick={saveApiKey} 
                disabled={loading}
                variant="outline"
                className="whitespace-nowrap"
              >
                Save
              </Button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-darkText-secondary">
              Base URL (Optional)
            </label>
            <Input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.composio.dev (leave empty for default)"
            />
          </div>
        </div>

        {/* Status Display */}
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-darkBg-tertiary rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-darkText-secondary">Status:</span>
            <span className={`text-sm font-medium ${settings.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-darkText-secondary">Tools:</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${settings.toolsEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-darkText-tertiary'}`}>
                {settings.toolsEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleTools}
                disabled={!settings.enabled || loading}
                className="min-w-[80px]"
              >
                {settings.toolsEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        </div>

        {/* Toolkit Connections */}
        {settings.enabled && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-darkText-primary">Connected Tools</h4>
            
            {/* Shopify */}
            <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-darkBg-secondary rounded-lg bg-white dark:bg-darkBg-secondary">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 dark:text-darkText-primary block mb-1">
                  Shopify
                </span>
                <p className="text-sm text-gray-600 dark:text-darkText-tertiary">
                  E-commerce platform integration
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className={`text-sm whitespace-nowrap ${settings.shopifyConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-darkText-tertiary'}`}>
                  {settings.shopifyConnected ? 'Connected' : 'Not connected'}
                </span>
                {settings.shopifyConnected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const shopifyConnection = connections.find(c => 
                        c.toolkit.toLowerCase().includes('shopify')
                      );
                      if (shopifyConnection) {
                        disconnectToolkit(shopifyConnection.id, 'Shopify');
                      }
                    }}
                    disabled={loading}
                    className="min-w-[90px]"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => authorizeToolkit('shopify')}
                    disabled={loading}
                    className="min-w-[90px]"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {/* Perplexity */}
            <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-darkBg-secondary rounded-lg bg-white dark:bg-darkBg-secondary">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 dark:text-darkText-primary block mb-1">
                  Perplexity AI
                </span>
                <p className="text-sm text-gray-600 dark:text-darkText-tertiary">
                  AI-powered search and analysis
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className={`text-sm whitespace-nowrap ${settings.perplexityConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-darkText-tertiary'}`}>
                  {settings.perplexityConnected ? 'Connected' : 'Not connected'}
                </span>
                {settings.perplexityConnected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const perplexityConnection = connections.find(c => 
                        c.toolkit.toLowerCase().includes('perplexity')
                      );
                      if (perplexityConnection) {
                        disconnectToolkit(perplexityConnection.id, 'Perplexity');
                      }
                    }}
                    disabled={loading}
                    className="min-w-[90px]"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => authorizeToolkit('perplexityai')}
                    disabled={loading}
                    className="min-w-[90px]"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {/* HackerNews */}
            <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-darkBg-secondary rounded-lg bg-white dark:bg-darkBg-secondary">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 dark:text-darkText-primary block mb-1">
                  HackerNews
                </span>
                <p className="text-sm text-gray-600 dark:text-darkText-tertiary">
                  Tech news and discussions
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className={`text-sm whitespace-nowrap ${settings.hackernewsConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-darkText-tertiary'}`}>
                  {settings.hackernewsConnected ? 'Connected' : 'Not connected'}
                </span>
                {settings.hackernewsConnected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const hackernewsConnection = connections.find(c => 
                        c.toolkit.toLowerCase().includes('hackernews') || c.toolkit.toLowerCase().includes('hacker')
                      );
                      if (hackernewsConnection) {
                        disconnectToolkit(hackernewsConnection.id, 'HackerNews');
                      }
                    }}
                    disabled={loading}
                    className="min-w-[90px]"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => authorizeToolkit('hackernews')}
                    disabled={loading}
                    className="min-w-[90px]"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {/* Test Tools */}
            <div className="pt-4 border-t border-gray-200 dark:border-darkBg-secondary space-y-2">
              <Button
                variant="outline"
                onClick={testTools}
                disabled={loading}
                className="w-full"
              >
                Test Tools Connection
              </Button>
              
              {settings.perplexityConnected && (
                <Button
                  variant="outline"
                  onClick={testPerplexitySearch}
                  disabled={loading}
                  className="w-full"
                >
                  Test Perplexity Search
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
}