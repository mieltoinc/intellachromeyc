import TurndownService from 'turndown'


/**
 * Content Script - Injected into all pages
 * Handles page analysis and inline assistant
 */

// Inline types to avoid ES module imports
enum MessageType {
  SAVE_MEMORY = 'SAVE_MEMORY',
  GET_MEMORIES = 'GET_MEMORIES',
  GET_SETTINGS = 'GET_SETTINGS',
  GET_SITE_VISIBILITY = 'GET_SITE_VISIBILITY',
  ANALYZE_PAGE = 'ANALYZE_PAGE',
  SUMMARIZE_PAGE = 'SUMMARIZE_PAGE',
  EXTRACT_ENTITIES = 'EXTRACT_ENTITIES',
  GET_PAGE_CONTENT = 'GET_PAGE_CONTENT',
  ASK_INTELLA = 'ASK_INTELLA',
  IMPROVE_TEXT = 'IMPROVE_TEXT',
  TRANSLATE_TEXT = 'TRANSLATE_TEXT',
  CAPTURE_SELECTION = 'CAPTURE_SELECTION',
  CHECK_DOMAIN_BLOCKED = 'CHECK_DOMAIN_BLOCKED',
  BLOCKED_DOMAINS_UPDATED = 'BLOCKED_DOMAINS_UPDATED',
  // Feature 1: Floating Search Bar
  FLOAT_QUERY = 'FLOAT_QUERY',
  QUERY_MEMORIES = 'QUERY_MEMORIES',
  OPEN_SIDEPANEL = 'OPEN_SIDEPANEL',
  CLOSE_SIDEPANEL = 'CLOSE_SIDEPANEL',
  CLEAR_ALL_USER_DATA = 'CLEAR_ALL_USER_DATA',
}

interface Message<T = any> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

interface Memory {
  id: string;
  url: string;
  title: string;
  summary: string;
  content?: string;
  keywords: string[];
  entities?: {
    people?: string[];
    organizations?: string[];
    topics?: string[];
  };
  timestamp: string;
  accessCount: number;
  archived: boolean;
}

// Inline DOMReader class to avoid ES module imports
class DOMReader {
  static extractPageContent() {
    const url = window.location.href;
    const title = document.title;
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const content = this.extractMainContent();
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim() || '');
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href).filter(href => href && !href.startsWith('javascript:'));
    const images = Array.from(document.querySelectorAll('img[src]')).map(img => (img as HTMLImageElement).src);
    const metadata = {
      author: this.getMetaContent('author') || '',
      publishedTime: this.getMetaContent('article:published_time') || '',
      modifiedTime: this.getMetaContent('article:modified_time') || '',
      keywords: this.getMetaContent('keywords') || '',
    };

    return { url, title, description: metaDescription, content, headings, links, images, metadata };
  }

  private static extractMainContent(): string {

    let htmlBody = document.querySelector("body")
    const htmlString = htmlBody?.outerHTML || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const scripts = doc.querySelectorAll('script');
    const noscripts = doc.querySelectorAll('noscript');
    const links = doc.querySelectorAll('link');

    scripts.forEach(script => {
      script.remove();
    });
    const styles = doc.querySelectorAll('style');
    styles.forEach(style => {
      style.remove();
    });

    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      iframe.remove();
    });

    noscripts.forEach(n => {
      n.remove();
    });

    links.forEach(link => {
      link.remove();
    });

    const cleanedHtml = doc.documentElement.outerHTML;

    const turndownService = new TurndownService()
    const markdown = turndownService.turndown(cleanedHtml)
    return markdown;
  }


  private static getMetaContent(name: string): string | null {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta?.getAttribute('content') || null;
  }

  static extractKeywords(content: string, limit: number = 10): string[] {
    const stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their']);
    const words = content.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 3 && !stopWords.has(word));
    const frequencies = new Map<string, number>();
    words.forEach(word => {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });
    return Array.from(frequencies.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([word]) => word);
  }

  static getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  static isCapturable(): boolean {
    const url = window.location.href;
    if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
      return false;
    }
    if (!document.body || document.body.textContent?.trim().length === 0) {
      return false;
    }
    const content = document.body.textContent || '';
    if (content.trim().length < 200) {
      return false;
    }
    return true;
  }
}

// Inline domain blocking utilities to avoid ES module imports
class DomainBlocker {
  static normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '') // Remove protocol
      .replace(/\/.*$/, '') // Remove path
      .replace(/:\d+$/, ''); // Remove port
  }

  static isHostnameBlocked(hostname: string, blockedDomains: string[]): { 
    isBlocked: boolean; 
    matchedRule?: string 
  } {
    const normalizedHostname = this.normalizeDomain(hostname);
    
    for (const rule of blockedDomains) {
      const normalizedRule = this.normalizeDomain(rule);
      
      if (normalizedRule.startsWith('*.')) {
        // Wildcard pattern: *.example.com
        const baseDomain = normalizedRule.slice(2);
        
        // Match exact domain or any subdomain
        if (normalizedHostname === baseDomain || normalizedHostname.endsWith('.' + baseDomain)) {
          return { isBlocked: true, matchedRule: rule };
        }
      } else {
        // Exact match
        if (normalizedHostname === normalizedRule) {
          return { isBlocked: true, matchedRule: rule };
        }
      }
    }
    
    return { isBlocked: false };
  }

  static getCurrentHostname(): string {
    try {
      return new URL(window.location.href).hostname;
    } catch {
      return '';
    }
  }

  static isCurrentPageBlocked(blockedDomains: string[]): { 
    isBlocked: boolean; 
    matchedRule?: string 
  } {
    const hostname = this.getCurrentHostname();
    return this.isHostnameBlocked(hostname, blockedDomains);
  }
}

// Floating Sidepanel Toggle Button
class FloatingSidepanelToggle {
  private container: HTMLDivElement | null = null;
  private isVisible = true;

  constructor() {
    this.createFloatingButton();
  }

  private createFloatingButton() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'intella-sidepanel-toggle';
    this.container.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      right: 20px !important;
      transform: translateY(-50%) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif !important;
      pointer-events: auto !important;
      transition: all 0.3s ease !important;
    `;

    // Create the button
    const button = document.createElement('button');
    button.style.cssText = `
      width: 48px !important;
      height: 48px !important;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      border: none !important;
      border-radius: 24px !important;
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4) !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.2s ease !important;
      color: white !important;
      margin: 0 !important;
      padding: 0 !important;
    `;

    // Arrow icon (chevron right/left)
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9,18 15,12 9,6"></polyline>
      </svg>
    `;

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)';
    });

    // Click handler to toggle sidepanel
    button.addEventListener('click', async () => {
      try {
        console.log('🔵 Floating button clicked, sending message to background...');
        
        // Send message to background script (this preserves user gesture context)
        const response = await chrome.runtime.sendMessage({
          type: MessageType.OPEN_SIDEPANEL
        });
        
        if (response && response.success) {
          console.log('✅ Sidepanel opened successfully');
        } else {
          console.error('❌ Failed to open sidepanel:', response?.error || 'Unknown error');
        }
      } catch (error) {
        console.error('💥 Error sending message to open sidepanel:', error);
      }
    });

    this.container.appendChild(button);
    document.body.appendChild(this.container);
  }

  public show() {
    if (!this.container) return;
    this.container.style.opacity = '1';
    this.container.style.transform = 'translateY(-50%) translateX(0)';
    this.isVisible = true;
  }

  public hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateY(-50%) translateX(20px)';
    this.isVisible = false;
  }

  public toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

// Feature 1: Floating Search Bar Component
class FloatingSearchBar {
  private container: HTMLDivElement | null = null;
  private isExpanded = false;
  private isEnabled = false;

  constructor() {
    console.log('🔧 FloatingSearchBar constructor called');
    this.createFloatingSearchBar();
    this.setupKeyboardShortcut();
    console.log('✅ FloatingSearchBar constructor completed');
  }

  private createFloatingSearchBar() {
    console.log('🏗️ createFloatingSearchBar() called');
    console.log('📄 document.body exists?', !!document.body);
    
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'intella-floating-search';
    // Set individual style properties to avoid !important conflicts
    this.container.style.position = 'fixed';
    this.container.style.bottom = '30px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.zIndex = '2147483647';
    this.container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif';
    this.container.style.pointerEvents = 'none';
    this.container.style.transition = 'all 0.3s ease';
    this.container.style.opacity = '1';

    // Create the search bar
    const searchBar = document.createElement('div');
    searchBar.style.cssText = `
      background: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(10px) !important;
      border: 1px solid rgba(59, 130, 246, 0.2) !important;
      border-radius: 28px !important;
      box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15) !important;
      overflow: hidden !important;
      pointer-events: auto !important;
      width: 140px !important;
      height: 56px !important;
      transition: all 0.3s ease !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
    `;

    // Create search icon with text
    const searchIcon = document.createElement('div');
    searchIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <span style="font-size: 14px; font-weight: 500; margin-left: 6px;">Ask Intella</span>
    `;
    searchIcon.style.cssText = `
      color: #3b82f6 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;

    // Create expanded content (hidden initially)
    const expandedContent = document.createElement('div');
    expandedContent.style.cssText = `
      display: none !important;
      align-items: center !important;
      gap: 16px !important;
      padding: 0 24px !important;
      width: 400px !important;
      height: 56px !important;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search memories or ask Intella...';
    input.style.cssText = `
      flex: 1 !important;
      border: none !important;
      outline: none !important;
      background: transparent !important;
      font-size: 14px !important;
      color: #374151 !important;
      font-family: inherit !important;
    `;

    const submitBtn = document.createElement('button');
    submitBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22,2 15,22 11,13 2,9 22,2"/>
      </svg>
    `;
    submitBtn.style.cssText = `
      border: none !important;
      background: #3b82f6 !important;
      color: white !important;
      border-radius: 50% !important;
      width: 32px !important;
      height: 32px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      transition: background 0.2s ease !important;
    `;

    expandedContent.appendChild(input);
    expandedContent.appendChild(submitBtn);

    searchBar.appendChild(searchIcon);
    searchBar.appendChild(expandedContent);
    this.container.appendChild(searchBar);

    // Event listeners
    searchBar.addEventListener('mouseenter', () => this.expandSearchBar(searchBar, searchIcon, expandedContent, input));
    searchBar.addEventListener('mouseleave', () => this.collapseSearchBar(searchBar, searchIcon, expandedContent));
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        console.log('⌨️ Enter key pressed in floating search input, value:', input.value);
        this.handleSearch(input.value, input);
      }
    });
    
    submitBtn.addEventListener('click', () => {
      console.log('🖱️ Submit button clicked in floating search, value:', input.value);
      this.handleSearch(input.value, input);
    });
    
    submitBtn.addEventListener('mouseenter', () => {
      submitBtn.style.background = '#2563eb';
    });
    
    submitBtn.addEventListener('mouseleave', () => {
      submitBtn.style.background = '#3b82f6';
    });

    console.log('📦 About to append container to body');
    document.body.appendChild(this.container);
    console.log('✅ Container appended to body');
    console.log('🔍 Container in DOM?', document.getElementById('intella-floating-search'));
  }

  private expandSearchBar(searchBar: HTMLDivElement, searchIcon: HTMLDivElement, expandedContent: HTMLDivElement, input: HTMLInputElement) {
    if (this.isExpanded) return;
    this.isExpanded = true;

    searchBar.style.width = '420px';
    searchIcon.style.display = 'none';
    expandedContent.style.display = 'flex';
    
    setTimeout(() => {
      input.focus();
    }, 150);
  }

  private collapseSearchBar(searchBar: HTMLDivElement, searchIcon: HTMLDivElement, expandedContent: HTMLDivElement) {
    if (!this.isExpanded) return;
    this.isExpanded = false;

    searchBar.style.width = '140px';
    expandedContent.style.display = 'none';
    searchIcon.style.display = 'flex';
  }

  private async handleSearch(query: string, inputElement?: HTMLInputElement) {
    console.log('🔍 handleSearch called with query:', query);
    
    if (!query.trim()) {
      console.log('❌ Empty query, returning');
      return;
    }

    console.log('✅ Processing floating search query:', query);
    
    try {
      console.log('📤 Sending FLOAT_QUERY message to background script...');
      
      // Send query to sidepanel via background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.FLOAT_QUERY,
        payload: { query, source: 'floating' }
      });
      
      console.log('📥 Background script response:', response);

      // Open sidepanel
      console.log('🔄 Opening sidepanel...');
      await this.openSidepanel();
      
      // Clear the input field
      if (inputElement) {
        console.log('🧹 Clearing input field');
        inputElement.value = '';
      }
      
      // Collapse the search bar back to icon
      if (this.isExpanded) {
        console.log('📝 Collapsing search bar');
        const searchBar = this.container?.querySelector('div') as HTMLDivElement;
        const searchIcon = searchBar?.querySelector('div') as HTMLDivElement;
        const expandedContent = searchBar?.querySelectorAll('div')[1] as HTMLDivElement;
        if (searchBar && searchIcon && expandedContent) {
          this.collapseSearchBar(searchBar, searchIcon, expandedContent);
        }
      }
      
      console.log('✅ handleSearch completed successfully');
    } catch (error) {
      console.error('💥 Error handling floating search:', error);
    }
  }

  private async openSidepanel() {
    try {
      console.log('🔄 openSidepanel: Requesting background script to open sidepanel...');
      // Request background script to open sidepanel
      const response = await chrome.runtime.sendMessage({
        type: MessageType.OPEN_SIDEPANEL
      });
      console.log('📥 openSidepanel: Background script response:', response);
    } catch (error) {
      console.error('💥 openSidepanel: Error opening sidepanel:', error);
    }
  }

  private setupKeyboardShortcut() {
    console.log('⌨️ Setting up keyboard shortcut listener');
    document.addEventListener('keydown', (e) => {
      // Ctrl+J (Windows/Linux) or Cmd+J (Mac) - Toggle floating search bar
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        console.log('⌨️ Keyboard shortcut triggered: Ctrl/Cmd+J - Toggling floating search');
        e.preventDefault();
        this.toggle();
      }
      
      // Note: Ctrl+I / Cmd+I is handled by the manifest command and background script
    });
  }

  public show() {
    console.log('👁️ FloatingSearchBar.show() called');
    console.log('📦 Container exists?', !!this.container);
    console.log('🔛 Is enabled?', this.isEnabled);
    
    if (!this.container || !this.isEnabled) {
      console.log('❌ Cannot show: container missing or disabled');
      return;
    }
    
    console.log('✅ Showing floating search bar');
    this.container.style.opacity = '1';
    this.container.style.transform = 'translateX(-50%) translateY(0)';
    this.container.style.pointerEvents = 'none';
    const searchBar = this.container.querySelector('div');
    if (searchBar) {
      searchBar.style.pointerEvents = 'auto';
    }
  }

  public hide() {
    if (!this.container) return;
    
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateX(-50%) translateY(20px)';
  }

  public toggle() {
    console.log('🔄 toggle() called');
    console.log('🔛 Current enabled state:', this.isEnabled);
    
    if (this.isEnabled) {
      console.log('❌ Disabling floating search bar');
      this.setEnabled(false);
    } else {
      console.log('✅ Enabling floating search bar');
      this.setEnabled(true);
    }
  }

  public setEnabled(enabled: boolean) {
    console.log('🔛 setEnabled called with:', enabled);
    this.isEnabled = enabled;
    if (enabled) {
      console.log('✅ Enabling and showing floating search bar');
      this.show();
    } else {
      console.log('❌ Disabling and hiding floating search bar');
      this.hide();
    }
  }

  public destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

class ContentScript {
  private pageAnalyzed = false;
  private floatingSearchBar: FloatingSearchBar | null = null;
  private sidepanelToggle: FloatingSidepanelToggle | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    console.log('🚀 Intella content script initialized on:', window.location.href);

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
      this.handleMessage(message).then(sendResponse);
      return true;
    });

    // Check if page should be auto-captured
    await this.checkAutoCapture();

    // Initialize floating search bar
    await this.initializeFloatingSearchBar();
    
    // Initialize sidepanel toggle button
    await this.initializeSidepanelToggle();
  }

  private async initializeFloatingSearchBar() {
    try {
      console.log('🔧 initializeFloatingSearchBar() called');
      
      // Get settings to check if floating search is enabled
      const settingsResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_SETTINGS,
      });

      console.log('⚙️ Settings response:', settingsResponse);

      if (settingsResponse.success) {
        const settings = settingsResponse.data;
        console.log('📋 Settings data:', settings);
        console.log('🔍 Floating search enabled?', settings.ui?.floatingSearchEnabled);
        
        if (settings.ui?.floatingSearchEnabled) {
          console.log('✅ Floating search bar is enabled, creating component...');
          console.log('🔨 About to call new FloatingSearchBar()');
          try {
            this.floatingSearchBar = new FloatingSearchBar();
            console.log('🔨 FloatingSearchBar constructor completed');
            this.floatingSearchBar.setEnabled(true);
            console.log('✅ Floating search bar created and enabled');
          } catch (error) {
            console.error('💥 Error creating FloatingSearchBar:', error);
          }
        } else {
          console.log('❌ Floating search bar disabled in settings');
          console.log('🔍 Settings.ui:', settings.ui);
        }
      } else {
        console.error('❌ Failed to get settings:', settingsResponse.error);
      }
    } catch (error) {
      console.error('💥 Error initializing floating search bar:', error);
    }
  }

  private async initializeSidepanelToggle() {
    try {
      console.log('🔧 initializeSidepanelToggle() called');
      
      // Always create the sidepanel toggle - it's lightweight and useful
      this.sidepanelToggle = new FloatingSidepanelToggle();
      console.log('✅ Sidepanel toggle created');
    } catch (error) {
      console.error('💥 Error initializing sidepanel toggle:', error);
    }
  }

  private async handleMessage(message: Message): Promise<any> {
    switch (message.type) {
      case MessageType.GET_PAGE_CONTENT:
        return { success: true, data: DOMReader.extractPageContent() };

      case MessageType.SUMMARIZE_PAGE:
        return await this.summarizePage();

      case MessageType.ASK_INTELLA:
        // Note: This would now need to open the native side panel
        // For now, we'll just handle it as a regular ask request
        return { success: true, message: 'Native side panel should be used for chat' };

      case MessageType.IMPROVE_TEXT:
        return { success: true, message: 'Text improvement disabled - use side panel' };

      case MessageType.TRANSLATE_TEXT:
        return { success: true, message: 'Translation disabled - use side panel' };

      case MessageType.CAPTURE_SELECTION:
        return await this.captureSelection();

      case MessageType.CHECK_DOMAIN_BLOCKED:
        const hostname = message.payload?.hostname || DomainBlocker.getCurrentHostname();
        const settingsResp = await chrome.runtime.sendMessage({ type: MessageType.GET_SETTINGS });
        if (settingsResp.success && settingsResp.data.privacy?.blockedDomains) {
          const blockResult = DomainBlocker.isHostnameBlocked(hostname, settingsResp.data.privacy.blockedDomains);
          return { success: true, data: blockResult };
        }
        return { success: true, data: { isBlocked: false } };

      case MessageType.BLOCKED_DOMAINS_UPDATED:
        console.log('📢 Received blocked domains update:', message.payload?.blockedDomains);
        // Check if current page is now blocked
        if (message.payload?.blockedDomains) {
          const currentHostname = DomainBlocker.getCurrentHostname();
          const blockCheck = DomainBlocker.isHostnameBlocked(currentHostname, message.payload.blockedDomains);
          if (blockCheck.isBlocked) {
            console.log('❌ Current page is now blocked, will prevent future captures:', blockCheck.matchedRule);
            // Reset the pageAnalyzed flag so if domain is unblocked later, it can capture again
            this.pageAnalyzed = false;
          }
        }
        return { success: true };

      case MessageType.FLOAT_QUERY:
        console.log('📨 Received float query message:', message.payload);
        // This message is handled by the background script to relay to sidepanel
        return { success: true };

      case MessageType.QUERY_MEMORIES:
        console.log('📨 Received query memories message:', message.payload);
        // This message is handled by the background script
        return { success: true };

      case MessageType.OPEN_SIDEPANEL:
        // Handle sidepanel toggle visibility if needed
        if (this.sidepanelToggle) {
          // For now, just ensure it's visible
          this.sidepanelToggle.show();
        }
        return { success: true };

      default:
        // Handle tool execution requests from background
        if ((message as any).type === 'EXECUTE_TOOL') {
          return await this.executeToolInPage((message as any).payload);
        }
        return { success: false, error: 'Unknown message type' };
    }
  }

  /**
   * Execute a tool in the page context (DOM manipulation)
   */
  private async executeToolInPage(payload: { toolName: string; args: Record<string, any> }): Promise<any> {
    const { toolName, args } = payload;
    
    try {
      switch (toolName) {
        case 'scroll_to_element': {
          const { selector } = args;
          const element = document.querySelector(selector);
          if (!element) {
            return {
              success: false,
              error: `Element with selector "${selector}" not found`,
            };
          }
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return {
            success: true,
            data: { message: `Scrolled to element: ${selector}` },
          };
        }

        case 'click_element': {
          const { selector } = args;
          const element = document.querySelector(selector) as HTMLElement;
          if (!element) {
            return {
              success: false,
              error: `Element with selector "${selector}" not found`,
            };
          }
          element.click();
          return {
            success: true,
            data: { message: `Clicked element: ${selector}` },
          };
        }

        case 'extract_text': {
          const { selector } = args;
          const element = document.querySelector(selector);
          if (!element) {
            return {
              success: false,
              error: `Element with selector "${selector}" not found`,
            };
          }
          const text = element.textContent || '';
          return {
            success: true,
            data: { text },
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

  private async checkAutoCapture() {
    console.log('🔍 checkAutoCapture() called for URL:', window.location.href);
    
    // Check if page is suitable for capture
    if (!DOMReader.isCapturable()) {
      console.log('❌ Page not capturable (chrome://, about:/, or too short)');
      return;
    }
    console.log('✅ Page is capturable');

    // Check settings first (including blocked domains)
    const settingsResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_SETTINGS,
    });
    console.log('⚙️ Settings response:', settingsResponse);

    if (!settingsResponse.success) {
      console.log('❌ Failed to get settings');
      return;
    }

    const settings = settingsResponse.data;

    // Feature 4: Check if current domain is blocked
    if (settings.privacy && settings.privacy.blockedDomains) {
      const currentHostname = DomainBlocker.getCurrentHostname();
      console.log('🔍 Checking domain blocking for:', currentHostname);
      console.log('📋 Blocked domains list:', settings.privacy.blockedDomains);
      
      const blockCheck = DomainBlocker.isCurrentPageBlocked(settings.privacy.blockedDomains);
      console.log('🛡️ Block check result:', blockCheck);
      
      if (blockCheck.isBlocked) {
        console.log('❌ Domain is blocked for content analysis:', blockCheck.matchedRule);
        return;
      }
      console.log('✅ Domain is not blocked, proceeding with capture check');
    } else {
      console.log('ℹ️ No blocked domains configured or privacy settings missing');
    }

    // Check if analysis is active
    if (!settings.isAnalysisActive) {
      console.log('❌ Analysis is paused');
      return;
    }

    if (!settings.enableAutoCapture) {
      console.log('❌ Auto-capture disabled in settings');
      return;
    }

    // Check if site visibility is enabled
    const domain = DOMReader.getDomain(window.location.href);
    console.log('🌐 Checking visibility for domain:', domain);
    
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_SITE_VISIBILITY,
      payload: domain,
    });

    console.log('🔍 Site visibility response:', response);
    if (!response.success) {
      console.log('❌ Site visibility check failed for', domain, '- Response:', response);
      return;
    }
    
    if (response.data !== true) {
      console.log('❌ Site visibility disabled for', domain, '- Response data:', response.data);
      return;
    }
    console.log('✅ All checks passed, scheduling memory capture in 3 seconds...');

    // Wait a bit for page to fully load
    setTimeout(() => this.capturePageMemory(), 3000);
  }

  private async capturePageMemory() {
    if (this.pageAnalyzed) return;
    this.pageAnalyzed = true;

    try {
      console.log('📸 Capturing page memory...');
      
      // Double-check if domain is still not blocked (in case it was added after page load)
      const settingsResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_SETTINGS,
      });
      
      if (settingsResponse.success && settingsResponse.data.privacy?.blockedDomains) {
        const currentHostname = DomainBlocker.getCurrentHostname();
        const blockCheck = DomainBlocker.isCurrentPageBlocked(settingsResponse.data.privacy.blockedDomains);
        
        if (blockCheck.isBlocked) {
          console.log('❌ Domain was blocked while preparing to capture:', currentHostname, 'matched rule:', blockCheck.matchedRule);
          return;
        }
      }
      
      const pageContent = DOMReader.extractPageContent();
      const keywords = DOMReader.extractKeywords(pageContent.content);

      // Analyze page with AI
      const analysisResponse = await chrome.runtime.sendMessage({
        type: MessageType.ANALYZE_PAGE,
        payload: {
          content: pageContent.content,
          url: pageContent.url,
          title: pageContent.title,
        },
      });

      if (!analysisResponse.success) {
        console.error('Failed to analyze page:', analysisResponse.error);
        return;
      }

      const { summary, entities } = analysisResponse.data;

      // Create memory object
      const memory: Memory = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: pageContent.url,
        title: pageContent.title,
        summary: summary,
        content: pageContent.content,
        keywords: keywords,
        entities: entities,
        timestamp: new Date().toISOString(),
        accessCount: 1,
        archived: false,
      };

      // Save memory
      const saveResponse = await chrome.runtime.sendMessage({
        type: MessageType.SAVE_MEMORY,
        payload: memory,
      });

      if (saveResponse.success) {
        console.log('Page memory saved successfully');
        this.showNotification('Memory captured', 'Page saved to Intella');
      }
    } catch (error) {
      console.error('Error capturing page memory:', error);
    }
  }

  // Note: Sidebar functionality moved to Chrome's native side panel

  private async summarizePage() {
    const pageContent = DOMReader.extractPageContent();
    
    const response = await chrome.runtime.sendMessage({
      type: MessageType.ANALYZE_PAGE,
      payload: {
        content: pageContent.content,
        url: pageContent.url,
        title: pageContent.title,
      },
    });

    if (response.success) {
      this.showNotification('Summary', response.data.summary);
    }

    return response;
  }


  private async captureSelection() {
    console.log('📸 Capturing selection or focused element...');

    const selection = window.getSelection();
    let selectedText = '';
    let content = '';
    let elementType = 'text';

    if (selection && selection.toString().trim()) {
      // User has selected text
      selectedText = selection.toString().trim();
      content = selectedText;
      elementType = 'selection';
      console.log('📝 Captured selected text:', selectedText.substring(0, 100) + '...');
    } else {
      // No selection - try to capture the current focused element or intelligent content
      const activeElement = document.activeElement;
      
      if (activeElement && activeElement.tagName) {
        const tagName = activeElement.tagName.toLowerCase();
        
        if (tagName === 'input' || tagName === 'textarea') {
          // Capture form field content
          const element = activeElement as HTMLInputElement | HTMLTextAreaElement;
          content = element.value;
          elementType = `form_${tagName}`;
          selectedText = element.placeholder || `${tagName} field`;
        } else if (tagName === 'article' || activeElement.querySelector('article')) {
          // Capture article content
          const article = tagName === 'article' ? activeElement : activeElement.querySelector('article');
          if (article) {
            content = this.extractTextContent(article as HTMLElement);
            elementType = 'article';
            selectedText = article.querySelector('h1, h2, h3')?.textContent || 'Article content';
          }
        } else if (['div', 'section', 'main'].includes(tagName)) {
          // Capture container content
          content = this.extractTextContent(activeElement as HTMLElement);
          elementType = tagName;
          selectedText = activeElement.querySelector('h1, h2, h3, h4, h5, h6')?.textContent || 
                       content.substring(0, 50) + '...';
        } else {
          // Capture element text content
          content = this.extractTextContent(activeElement as HTMLElement);
          elementType = tagName;
          selectedText = content.substring(0, 50) + '...';
        }
      }

      // If still no content, try to capture the main content of the page
      if (!content.trim()) {
        const mainContent = document.querySelector('main, article, [role="main"], .content, #content');
        if (mainContent) {
          content = this.extractTextContent(mainContent as HTMLElement);
          elementType = 'main_content';
          selectedText = document.title || 'Page content';
        } else {
          // Fallback to page body content (filtered)
          content = this.extractTextContent(document.body);
          elementType = 'page';
          selectedText = document.title || 'Page content';
        }
      }
    }

    // Ensure we have meaningful content
    if (!content.trim()) {
      console.warn('❌ No meaningful content found to capture');
      this.showNotification('Capture Failed', 'No content found to capture');
      return { 
        success: false, 
        error: 'No content found to capture'
      };
    }

    // Limit content size for practical use
    const maxLength = 5000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }

    console.log('✅ Captured content:', {
      type: elementType,
      selectedText: selectedText.substring(0, 50),
      contentLength: content.length
    });

    this.showNotification('Content Captured!', `Captured ${elementType}: ${selectedText.substring(0, 30)}...`);

    return {
      success: true,
      data: {
        content,
        selectedText,
        elementType,
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
      }
    };
  }

  private extractTextContent(element: HTMLElement): string {
    // Clone to avoid modifying the original
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove unwanted elements
    const unwantedSelectors = ['script', 'style', 'nav', 'footer', 'header', '.ad', '.advertisement'];
    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    const text = clone.textContent || '';
    
    // Clean up whitespace
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000); // Limit to 5k characters for capture
  }

  private showNotification(title: string, message: string) {
    // Create a simple toast notification with inline styles
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      color: white !important;
      padding: 16px 20px !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 40px rgba(59, 130, 246, 0.3) !important;
      z-index: 2147483646 !important;
      transform: translateY(100px) !important;
      opacity: 0 !important;
      transition: all 0.3s ease !important;
      max-width: 350px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif !important;
      margin: 0 !important;
      border: none !important;
    `;
    
    notification.innerHTML = `
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">
        ${title}
      </div>
      <div style="font-size: 13px; opacity: 0.95; margin: 0; line-height: 1.4;">
        ${message}
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transform = 'translateY(0) !important';
      notification.style.opacity = '1 !important';
    }, 100);

    setTimeout(() => {
      notification.style.transform = 'translateY(100px) !important';
      notification.style.opacity = '0 !important';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize content script
new ContentScript();

