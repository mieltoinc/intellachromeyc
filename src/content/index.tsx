import TurndownService from 'turndown'
import HalloweenContentTheme from './HalloweenContentTheme'


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
  GET_SIDEPANEL_STATE = 'GET_SIDEPANEL_STATE',
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
  private button: HTMLButtonElement | null = null;
  private isVisible = true;
  private isSidebarOpen = false;

  constructor() {
    this.createFloatingButton();
    this.setupSidepanelStateListener();
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
    this.button = document.createElement('button');
    this.button.style.cssText = `
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
      transition: all 0.3s ease !important;
      color: white !important;
      margin: 0 !important;
      padding: 0 !important;
    `;

    // Set initial icon state
    this.updateButtonIcon();

    // Hover effects
    this.button.addEventListener('mouseenter', () => {
      this.button!.style.transform = 'scale(1.1)';
      this.button!.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
    });

    this.button.addEventListener('mouseleave', () => {
      this.button!.style.transform = 'scale(1)';
      this.button!.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)';
    });

    // Click handler to toggle sidepanel
    this.button.addEventListener('click', async () => {
      try {
        console.log('🔵 Floating button clicked, sending message to background...');
        
        // Animate button (flip effect)
        this.animateButtonClick();
        
        // Send message to background script (this preserves user gesture context)
        const response = await chrome.runtime.sendMessage({
          type: MessageType.OPEN_SIDEPANEL
        });
        
        if (response && response.success) {
          console.log('✅ Sidepanel toggled successfully');
          // Toggle state and update icon after successful response
          this.isSidebarOpen = !this.isSidebarOpen;
          this.updateButtonIcon();
        } else {
          console.error('❌ Failed to toggle sidepanel:', response?.error || 'Unknown error');
        }
      } catch (error) {
        console.error('💥 Error sending message to open sidepanel:', error);
      }
    });

    this.container.appendChild(this.button);
    document.body.appendChild(this.container);
  }

  private updateButtonIcon() {
    if (!this.button) return;

    // Icon points left when sidebar is closed (indicating it will open sidebar)
    // Icon points right when sidebar is open (indicating it will close sidebar)
    const points = this.isSidebarOpen ? '15,6 9,12 15,18' : '9,18 15,12 9,6';
    
    this.button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s ease;">
        <polyline points="${points}"></polyline>
      </svg>
    `;
  }

  private animateButtonClick() {
    if (!this.button) return;

    // Add flip animation class
    const svg = this.button.querySelector('svg');
    if (svg) {
      // Apply a vertical flip animation
      svg.style.transform = 'rotateY(180deg)';
      
      // Reset after animation completes
      setTimeout(() => {
        if (svg) {
          svg.style.transform = 'rotateY(0deg)';
        }
      }, 300);
    }
  }

  private setupSidepanelStateListener() {
    // Listen for messages from background script about sidepanel state
    // Note: Since we can't easily track sidepanel state from content script,
    // we'll use our local state and update it based on user interactions
    // This is a simplified approach for now
    
    // Listen for storage changes to detect if sidebar state is tracked elsewhere
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SIDEPANEL_STATE_CHANGED') {
        this.isSidebarOpen = message.payload.isOpen;
        this.updateButtonIcon();
      }
    });
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

// Speech-to-Text Floating Bar Component for Meet Pages
class SpeechToTextOverlay {
  private container: HTMLDivElement | null = null;
  private floatingBar: HTMLDivElement | null = null;
  private suggestionsPopup: HTMLDivElement | null = null;
  private recognition: any = null;
  private isListening = false;
  private transcript = '';
  private conversationHistory: string[] = [];
  private lastAnalysisTime = 0;
  private isAnalyzing = false;
  private suggestions: string[] = [];
  private showSuggestions = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Check if Speech Recognition API is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('⚠️ Speech Recognition API not available in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      this.isListening = true;
    };

    this.recognition.onresult = async (event: any) => {
      let newTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newTranscript += event.results[i][0].transcript + ' ';
        }
      }
      
      if (newTranscript.trim()) {
        this.transcript += newTranscript;
        this.conversationHistory.push(newTranscript.trim());
        // Keep only last 10 utterances for context
        if (this.conversationHistory.length > 10) {
          this.conversationHistory.shift();
        }
        
        // Analyze conversation every 5 seconds or after significant utterances
        const now = Date.now();
        if (now - this.lastAnalysisTime > 5000 || newTranscript.length > 50) {
          this.lastAnalysisTime = now;
          this.analyzeConversation();
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Restart if no speech detected (normal behavior)
        if (this.isListening) {
          this.recognition.stop();
          setTimeout(() => {
            if (this.isListening) {
              this.recognition.start();
            }
          }, 100);
        }
      } else if (event.error === 'not-allowed') {
        this.isListening = false;
      }
    };

    this.recognition.onend = () => {
      // Automatically restart if we're still supposed to be listening
      if (this.isListening) {
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (error) {
              console.error('Error restarting recognition:', error);
            }
          }
        }, 100);
      }
    };

    this.createFloatingBar();
    this.startListening();
  }

  private createFloatingBar() {
    // Ensure document.body exists
    if (!document.body) {
      console.warn('⚠️ document.body not ready, retrying...');
      setTimeout(() => this.createFloatingBar(), 100);
      return;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'intella-speech-overlay';
    this.container.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif !important;
    `;

    // Create floating bar
    this.floatingBar = document.createElement('div');
    this.floatingBar.id = 'intella-speech-bar';
    this.floatingBar.style.cssText = `
      position: fixed !important;
      bottom: 30px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: rgba(139, 116, 95, 0.95) !important;
      backdrop-filter: blur(10px) !important;
      border-radius: 12px !important;
      padding: 12px 16px !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2) !important;
      pointer-events: auto !important;
      transition: all 0.3s ease !important;
    `;

    // Create icon (left side)
    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 32px !important;
      height: 32px !important;
      background: #4fd1c5 !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
    `;
    icon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <line x1="8" y1="6" x2="8" y2="10"/>
        <line x1="16" y1="6" x2="16" y2="10"/>
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      </svg>
    `;

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    `;

    // Insights button
    const insightsBtn = this.createBarButton('Insights', `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3h18v18H3z"/>
        <path d="M7 7h10v10H7z"/>
        <path d="M11 11h2v2h-2z"/>
      </svg>
    `, () => this.showInsights());

    // Ask button
    const askBtn = this.createBarButton('Ask', `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    `, () => this.openAskDialog());

    // Separator
    const separator = document.createElement('div');
    separator.style.cssText = `
      width: 1px !important;
      height: 20px !important;
      background: rgba(255, 255, 255, 0.3) !important;
    `;

    // Pause button
    const pauseBtn = document.createElement('button');
    pauseBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <line x1="10" y1="4" x2="10" y2="20"/>
        <line x1="14" y1="4" x2="14" y2="20"/>
      </svg>
    `;
    pauseBtn.style.cssText = `
      width: 32px !important;
      height: 32px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      padding: 0 !important;
      transition: background 0.2s ease !important;
    `;
    pauseBtn.addEventListener('mouseenter', () => {
      pauseBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    pauseBtn.addEventListener('mouseleave', () => {
      pauseBtn.style.background = 'transparent';
    });
    pauseBtn.addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });

    // More menu button
    const moreBtn = document.createElement('button');
    moreBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="1"/>
        <circle cx="19" cy="12" r="1"/>
        <circle cx="5" cy="12" r="1"/>
      </svg>
    `;
    moreBtn.style.cssText = `
      width: 32px !important;
      height: 32px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      padding: 0 !important;
      transition: background 0.2s ease !important;
    `;
    moreBtn.addEventListener('mouseenter', () => {
      moreBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    moreBtn.addEventListener('mouseleave', () => {
      moreBtn.style.background = 'transparent';
    });

    // Chevron down button
    const chevronBtn = document.createElement('button');
    chevronBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <polyline points="6,9 12,15 18,9"/>
      </svg>
    `;
    chevronBtn.style.cssText = `
      width: 32px !important;
      height: 32px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      padding: 0 !important;
      transition: background 0.2s ease !important;
    `;
    chevronBtn.addEventListener('mouseenter', () => {
      chevronBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    chevronBtn.addEventListener('mouseleave', () => {
      chevronBtn.style.background = 'transparent';
    });
    chevronBtn.addEventListener('click', () => {
      this.toggleSuggestions();
    });

    buttonsContainer.appendChild(insightsBtn);
    buttonsContainer.appendChild(askBtn);
    buttonsContainer.appendChild(separator);
    buttonsContainer.appendChild(pauseBtn);
    buttonsContainer.appendChild(moreBtn);
    buttonsContainer.appendChild(chevronBtn);

    this.floatingBar.appendChild(icon);
    this.floatingBar.appendChild(buttonsContainer);
    this.container.appendChild(this.floatingBar);
    this.createSuggestionsPopup();
    this.container.appendChild(this.suggestionsPopup!);
    document.body.appendChild(this.container);
  }

  private createBarButton(label: string, icon: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerHTML = `${icon} <span style="margin-left: 6px; color: white; font-size: 14px;">${label}</span>`;
    btn.style.cssText = `
      display: flex !important;
      align-items: center !important;
      padding: 8px 12px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      color: white !important;
      transition: background 0.2s ease !important;
      font-size: 14px !important;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private createSuggestionsPopup() {
    this.suggestionsPopup = document.createElement('div');
    this.suggestionsPopup.id = 'intella-suggestions-popup';
    this.suggestionsPopup.style.cssText = `
      position: fixed !important;
      bottom: 100px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: rgba(139, 116, 95, 0.95) !important;
      backdrop-filter: blur(10px) !important;
      border-radius: 12px !important;
      padding: 16px !important;
      min-width: 300px !important;
      max-width: 500px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2) !important;
      pointer-events: auto !important;
      opacity: 0 !important;
      transform: translateX(-50%) translateY(10px) !important;
      transition: all 0.3s ease !important;
      display: none !important;
    `;

    const title = document.createElement('div');
    title.textContent = 'Suggested Responses';
    title.style.cssText = `
      font-size: 14px !important;
      font-weight: 600 !important;
      color: white !important;
      margin-bottom: 12px !important;
    `;

    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'intella-suggestions-list';
    suggestionsContainer.style.cssText = `
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    `;

    this.suggestionsPopup.appendChild(title);
    this.suggestionsPopup.appendChild(suggestionsContainer);
  }

  private async analyzeConversation() {
    if (this.isAnalyzing || this.conversationHistory.length === 0) return;
    
    this.isAnalyzing = true;
    const recentConversation = this.conversationHistory.slice(-5).join(' ');
    
    try {
      // Analyze conversation and get suggestions
      const response = await chrome.runtime.sendMessage({
        type: MessageType.ASK_INTELLA,
        payload: {
          question: `Based on this conversation context: "${recentConversation}", provide 2-3 brief, actionable suggestions (like "How can I answer?" or "Follow-up question") that would be helpful for the user in this meeting. Keep each suggestion under 30 characters and make them conversational. Return only the suggestions, one per line, no numbering or bullets.`,
        },
      });

      if (response.success) {
        const suggestionsText = response.data || '';
        this.suggestions = suggestionsText
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0 && s.length < 50)
          .slice(0, 3);
        
        this.updateSuggestionsPopup();
        
        // Auto-show suggestions if we have them
        if (this.suggestions.length > 0 && !this.showSuggestions) {
          this.showSuggestionsPopup();
        }
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  private updateSuggestionsPopup() {
    const container = document.getElementById('intella-suggestions-list');
    if (!container) return;

    container.innerHTML = '';

    if (this.suggestions.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Listening... suggestions will appear here';
      empty.style.cssText = `
        color: rgba(255, 255, 255, 0.6) !important;
        font-size: 13px !important;
        padding: 12px !important;
        text-align: center !important;
      `;
      container.appendChild(empty);
      return;
    }

    this.suggestions.forEach((suggestion) => {
      const btn = document.createElement('button');
      btn.textContent = suggestion;
      btn.style.cssText = `
        padding: 12px 16px !important;
        background: rgba(255, 255, 255, 0.1) !important;
        border: none !important;
        border-radius: 8px !important;
        color: white !important;
        font-size: 14px !important;
        cursor: pointer !important;
        text-align: left !important;
        transition: background 0.2s ease !important;
        width: 100% !important;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
      });
      btn.addEventListener('click', () => {
        this.handleSuggestionClick(suggestion);
      });
      container.appendChild(btn);
    });
  }

  private showSuggestionsPopup() {
    if (!this.suggestionsPopup) return;
    
    this.showSuggestions = true;
    this.suggestionsPopup.style.display = 'block';
    
    setTimeout(() => {
      if (this.suggestionsPopup) {
        this.suggestionsPopup.style.opacity = '1';
        this.suggestionsPopup.style.transform = 'translateX(-50%) translateY(0)';
      }
    }, 10);

    // Auto-hide after 10 seconds
    setTimeout(() => {
      this.hideSuggestionsPopup();
    }, 10000);
  }

  private hideSuggestionsPopup() {
    if (!this.suggestionsPopup) return;
    
    this.suggestionsPopup.style.opacity = '0';
    this.suggestionsPopup.style.transform = 'translateX(-50%) translateY(10px)';
    
    setTimeout(() => {
      if (this.suggestionsPopup) {
        this.suggestionsPopup.style.display = 'none';
      }
      this.showSuggestions = false;
    }, 300);
  }

  private toggleSuggestions() {
    if (this.showSuggestions) {
      this.hideSuggestionsPopup();
    } else {
      this.showSuggestionsPopup();
    }
  }

  private async handleSuggestionClick(suggestion: string) {
    // Open sidepanel with the suggestion as a query
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.FLOAT_QUERY,
        payload: { query: suggestion, source: 'speech-overlay' },
      });
      
      await chrome.runtime.sendMessage({
        type: MessageType.OPEN_SIDEPANEL,
      });
      
      this.hideSuggestionsPopup();
    } catch (error) {
      console.error('Error handling suggestion click:', error);
    }
  }

  private showInsights() {
    // Open sidepanel with conversation summary
    chrome.runtime.sendMessage({
      type: MessageType.FLOAT_QUERY,
      payload: { 
        query: `Summarize the key points from this meeting conversation: ${this.conversationHistory.join(' ')}`,
        source: 'speech-insights'
      },
    }).then(() => {
      chrome.runtime.sendMessage({ type: MessageType.OPEN_SIDEPANEL });
    });
  }

  private openAskDialog() {
    // Open sidepanel for asking questions
    chrome.runtime.sendMessage({ type: MessageType.OPEN_SIDEPANEL });
  }

  public startListening() {
    if (!this.recognition || this.isListening) return;
    
    try {
      this.recognition.start();
      console.log('🎤 Started speech recognition');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }

  public stopListening() {
    if (!this.recognition || !this.isListening) return;
    
    this.isListening = false;
    this.recognition.stop();
    console.log('🔇 Stopped speech recognition');
  }

  public destroy() {
    this.stopListening();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.floatingBar = null;
    this.suggestionsPopup = null;
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
    this.setupSidepanelStateWatcher();
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
    this.container.style.transition = 'all 0.5s ease';
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
      transition: all 0.5s ease !important;
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
    }, 250);
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
      
      // Check if sidebar is open by trying to detect sidepanel state
      // If sidebar is open, we want to add to existing conversation
      const isSidebarOpen = await this.checkIfSidebarOpen();
      
      // Send query to sidepanel via background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.FLOAT_QUERY,
        payload: { 
          query, 
          source: 'floating',
          appendToExisting: isSidebarOpen // Flag to indicate we want to append to existing conversation
        }
      });
      
      console.log('📥 Background script response:', response);

      // Only open sidepanel if not already open
      if (!isSidebarOpen) {
        console.log('🔄 Opening sidepanel...');
        await this.openSidepanel();
      } else {
        console.log('✅ Sidebar already open, query sent to existing conversation');
        // Don't call openSidepanel() when sidebar is already open to avoid closing it
      }
      
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

  private async checkIfSidebarOpen(): Promise<boolean> {
    try {
      // Query the background script for the actual sidepanel state
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_SIDEPANEL_STATE
      });
      
      if (response && response.success) {
        console.log('📊 Sidepanel state from background:', response.data);
        return response.data.isOpen || false;
      }
      
      // Fallback: check session storage
      const result = await chrome.storage.session.get('sidepanel-state');
      const isOpen = result['sidepanel-state']?.isOpen || false;
      console.log('📊 Sidepanel state from session storage:', isOpen);
      return isOpen;
    } catch (error) {
      console.log('⚠️ Could not determine sidebar state:', error);
      return false; // Default to closed to avoid accidentally closing sidebar
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

  private setupSidepanelStateWatcher() {
    console.log('👁️ Setting up sidepanel state watcher');
    
    // Check sidepanel state periodically and update visibility accordingly
    const checkSidepanelState = async () => {
      try {
        const isSidebarOpen = await this.checkIfSidebarOpen();
        
        // Hide floating search bar when sidepanel is open
        if (isSidebarOpen) {
          if (this.isEnabled) {
            console.log('🙈 Hiding floating search bar (sidepanel is open)');
            this.hide();
            this.setEnabled(false);
          }
        } else {
          // Show floating search bar when sidepanel is closed (if it was enabled before)
          if (!this.isEnabled) {
            console.log('👀 Showing floating search bar (sidepanel is closed)');
            this.setEnabled(true);
            this.show();
          }
        }
      } catch (error) {
        console.log('⚠️ Error checking sidepanel state:', error);
      }
    };

    // Check immediately and then periodically
    checkSidepanelState();
    const interval = setInterval(checkSidepanelState, 1000); // Check every second

    // Store interval for potential cleanup
    (this as any).sidepanelStateInterval = interval;
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
    // Clean up interval
    if ((this as any).sidepanelStateInterval) {
      clearInterval((this as any).sidepanelStateInterval);
      (this as any).sidepanelStateInterval = null;
    }
    
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
  private halloweenTheme: HalloweenContentTheme | null = null;
  private speechOverlay: SpeechToTextOverlay | null = null;

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
    
    // Initialize Halloween theme
    await this.initializeHalloweenTheme();
    
    // Initialize speech-to-text overlay for Google Meet
    await this.initializeSpeechToTextOverlay();
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
          console.log(this.floatingSearchBar);
          try {
            this.floatingSearchBar = new FloatingSearchBar();
            console.log('🔨 FloatingSearchBar constructor completed');
            // Don't enable immediately - let the sidepanel state watcher determine visibility
            console.log('✅ Floating search bar created (visibility managed by sidepanel state watcher)');
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

  private async initializeHalloweenTheme() {
    try {
      console.log('🎃 initializeHalloweenTheme() called');
      
      // Get settings to check if Halloween theme is enabled
      const settingsResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_SETTINGS,
      });

      if (settingsResponse.success) {
        const settings = settingsResponse.data;
        console.log('🎃 Halloween theme enabled?', settings.ui?.halloweenThemeEnabled);
        
        if (settings.ui?.halloweenThemeEnabled) {
          console.log('✅ Halloween theme is enabled, creating component...');
          this.halloweenTheme = new HalloweenContentTheme();
          this.halloweenTheme.setEnabled(true);
          console.log('✅ Halloween theme created and enabled');
        } else {
          console.log('❌ Halloween theme disabled in settings');
        }
      } else {
        console.error('❌ Failed to get settings for Halloween theme:', settingsResponse.error);
      }
    } catch (error) {
      console.error('💥 Error initializing Halloween theme:', error);
    }
  }

  private async initializeSpeechToTextOverlay() {
    try {
      console.log('🎤 initializeSpeechToTextOverlay() called');
      
      // Check if we're on Google Meet
      const hostname = window.location.hostname;
      const isGoogleMeet = hostname.includes('meet.google.com');
      
      if (!isGoogleMeet) {
        console.log('❌ Not on Google Meet, skipping speech overlay');
        return;
      }

      console.log('✅ On Google Meet, initializing speech-to-text overlay...');
      
      // Check if Speech Recognition API is available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('⚠️ Speech Recognition API not available');
        return;
      }

      this.speechOverlay = new SpeechToTextOverlay();
      console.log('✅ Speech-to-text overlay created and initialized');
    } catch (error) {
      console.error('💥 Error initializing speech-to-text overlay:', error);
    }

    console.log('🎤 Speech-to-text overlay initialized');
    console.log(this.speechOverlay)
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

        case 'search_element': {
          const { criteria, method, query, limit = 10 } = args;
          
          try {
            // Helper function to search elements by a single criterion
            const searchByCriterion = (searchMethod: string, searchQuery: string): Element[] => {
              let foundElements: Element[] = [];
              
              switch (searchMethod) {
                case 'css': {
                  foundElements = Array.from(document.querySelectorAll(searchQuery));
                  break;
                }
                
                case 'xpath': {
                  const xpathResult = document.evaluate(
                    searchQuery,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                  );
                  const nodeArray: Element[] = [];
                  for (let i = 0; i < xpathResult.snapshotLength; i++) {
                    const node = xpathResult.snapshotItem(i);
                    if (node && node.nodeType === Node.ELEMENT_NODE) {
                      nodeArray.push(node as Element);
                    }
                  }
                  foundElements = nodeArray;
                  break;
                }
                
                case 'text': {
                  // Search for elements containing the text (case-insensitive partial match)
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null
                  );
                  const textNodes: Text[] = [];
                  let node;
                  while ((node = walker.nextNode())) {
                    if (node.textContent && node.textContent.toLowerCase().includes(searchQuery.toLowerCase())) {
                      textNodes.push(node as Text);
                    }
                  }
                  // Get unique parent elements
                  const uniqueElements = new Set<Element>();
                  textNodes.forEach(textNode => {
                    let parent = textNode.parentElement;
                    while (parent && parent !== document.body) {
                      uniqueElements.add(parent);
                      parent = parent.parentElement;
                    }
                  });
                  foundElements = Array.from(uniqueElements);
                  break;
                }
                
                case 'id': {
                  const element = document.getElementById(searchQuery);
                  if (element) {
                    foundElements = [element];
                  }
                  break;
                }
                
                case 'class': {
                  foundElements = Array.from(document.getElementsByClassName(searchQuery));
                  break;
                }
                
                case 'name': {
                  foundElements = Array.from(document.getElementsByName(searchQuery));
                  break;
                }
                
                case 'tag': {
                  foundElements = Array.from(document.getElementsByTagName(searchQuery));
                  break;
                }
                
                case 'role': {
                  foundElements = Array.from(document.querySelectorAll(`[role="${searchQuery}"]`));
                  break;
                }
                
                case 'attribute': {
                  // Parse attribute query: "attrName=attrValue" or just "attrName" for any value
                  const parts = searchQuery.split('=');
                  if (parts.length === 2) {
                    const [attrName, attrValue] = parts;
                    foundElements = Array.from(document.querySelectorAll(`[${attrName}="${attrValue}"]`));
                  } else {
                    // Search for any element with this attribute
                    foundElements = Array.from(document.querySelectorAll(`[${searchQuery}]`));
                  }
                  break;
                }
                
                default:
                  throw new Error(`Unknown search method: ${searchMethod}`);
              }
              
              return foundElements;
            };
            
            // Determine which criteria to use
            let searchCriteria: Array<{ method: string; query: string }> = [];
            
            if (criteria && Array.isArray(criteria) && criteria.length > 0) {
              // Use criteria array if provided
              searchCriteria = criteria;
            } else if (method && query) {
              // Fall back to single method/query for backward compatibility
              searchCriteria = [{ method, query }];
            } else {
              return {
                success: false,
                error: 'Either criteria array or method/query must be provided',
              };
            }
            
            // Start with first criterion
            let elements = searchByCriterion(searchCriteria[0].method, searchCriteria[0].query);
            
            // Apply remaining criteria (AND logic - elements must match all criteria)
            for (let i = 1; i < searchCriteria.length; i++) {
              const criterion = searchCriteria[i];
              const criterionElements = searchByCriterion(criterion.method, criterion.query);
              
              // Filter to only elements that match this criterion too
              const criterionSet = new Set(criterionElements);
              elements = elements.filter(el => criterionSet.has(el));
            }
            
            // Limit results
            elements = elements.slice(0, limit);
            
            // Extract useful information about each element
            const results = elements.map((el, index) => {
              const rect = el.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(el);
              
              // Build a unique selector for the element
              const getSelector = (element: Element): string => {
                if (element.id) {
                  return `#${element.id}`;
                }
                if (element.className && typeof element.className === 'string') {
                  const classes = element.className.split(' ').filter(c => c.trim()).join('.');
                  if (classes) {
                    return `${element.tagName.toLowerCase()}.${classes}`;
                  }
                }
                return element.tagName.toLowerCase();
              };
              
              return {
                index: index + 1,
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                classes: el.className && typeof el.className === 'string' 
                  ? el.className.split(' ').filter(c => c.trim()) 
                  : [],
                text: (el.textContent || '').trim().substring(0, 100),
                selector: getSelector(el),
                attributes: Array.from(el.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {} as Record<string, string>),
                position: {
                  x: Math.round(rect.x),
                  y: Math.round(rect.y),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                },
                visible: rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
              };
            });
            
            return {
              success: true,
              data: {
                count: results.length,
                elements: results,
                criteria: searchCriteria,
                method: searchCriteria.length === 1 ? searchCriteria[0].method : undefined,
                query: searchCriteria.length === 1 ? searchCriteria[0].query : undefined,
              },
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error during element search',
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

