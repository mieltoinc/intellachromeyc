/**
 * DOM Content Extraction Utility
 */

import { ContentAnalysis } from '@/types/memory';

export class DOMReader {
  /**
   * Extract readable content from the current page
   */
  static extractPageContent(): ContentAnalysis {
    const url = window.location.href;
    const title = document.title;

    console.log('🔍 DOMReader: Starting content extraction for:', { url, title });

    // Extract meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    console.log('📝 DOMReader: Meta description:', metaDescription);

    // Extract all text content (simplified - we'd want to use Readability.js in production)
    const content = this.extractMainContent();
    console.log('📄 DOMReader: Main content extracted:', {
      length: content.length,
      preview: content.substring(0, 150),
      isEmpty: content.trim().length === 0
    });

    // Extract headings
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim() || '');

    // Extract links
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => {
      const href = (a as HTMLAnchorElement).href;
      return href;
    }).filter(href => href && !href.startsWith('javascript:'));

    // Extract images
    const images = Array.from(document.querySelectorAll('img[src]')).map(img => (img as HTMLImageElement).src);

    // Extract metadata
    const metadata: Record<string, string> = {
      author: this.getMetaContent('author') || '',
      publishedTime: this.getMetaContent('article:published_time') || '',
      modifiedTime: this.getMetaContent('article:modified_time') || '',
      keywords: this.getMetaContent('keywords') || '',
    };

    const result = {
      url,
      title,
      description: metaDescription,
      content,
      headings,
      links,
      images,
      metadata,
    };

    console.log('✅ DOMReader: Final content analysis result:', {
      url,
      title,
      descriptionLength: metaDescription.length,
      contentLength: content.length,
      headingsCount: headings.length,
      linksCount: links.length,
      imagesCount: images.length,
      hasValidContent: content.trim().length > 50,
      contentPreview: content.substring(0, 200)
    });

    return result;
  }

  /**
   * Extract main content from page (simple version)
   */
  private static extractMainContent(): string {
    // Try common content selectors
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '#content',
      '.post-content',
      '.entry-content',
    ];

    console.log('🔍 DOMReader: Trying content selectors...');
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = this.getTextContent(element);
        console.log(`✅ DOMReader: Found content with selector "${selector}":`, {
          length: content.length,
          preview: content.substring(0, 100)
        });
        return content;
      }
    }

    // Fallback to body
    console.log('⚠️ DOMReader: No specific content selector found, falling back to document.body');
    const bodyContent = this.getTextContent(document.body);
    console.log('📄 DOMReader: Body content extracted:', {
      length: bodyContent.length,
      preview: bodyContent.substring(0, 100)
    });
    return bodyContent;
  }

  /**
   * Get clean text content from an element
   */
  private static getTextContent(element: Element): string {
    // Clone to avoid modifying the original
    const clone = element.cloneNode(true) as Element;

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
      .slice(0, 10000); // Limit to first 10k characters
  }

  /**
   * Get meta tag content
   */
  private static getMetaContent(name: string): string | null {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta?.getAttribute('content') || null;
  }

  /**
   * Extract keywords from content (simple version)
   */
  static extractKeywords(content: string, limit: number = 10): string[] {
    // Remove common words
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
    ]);

    // Extract words
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    // Count frequencies
    const frequencies = new Map<string, number>();
    words.forEach(word => {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });

    // Sort by frequency and return top N
    return Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  /**
   * Get domain from URL
   */
  static getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * Check if page is suitable for memory capture
   */
  static isCapturable(): boolean {
    const url = window.location.href;
    
    // Skip internal browser pages
    if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
      return false;
    }

    // Skip empty pages
    if (!document.body || document.body.textContent?.trim().length === 0) {
      return false;
    }

    // Skip very short pages
    const content = document.body.textContent || '';
    if (content.trim().length < 200) {
      return false;
    }

    return true;
  }
}

