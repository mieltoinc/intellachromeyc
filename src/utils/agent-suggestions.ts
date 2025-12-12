/**
 * Agent Mode Suggestions Configuration
 * Defines context-aware AI prompts based on the current website domain
 */

export interface AgentSuggestion {
  icon: string;
  title: string;
  description: string;
  prompt: string;
}

export type SuggestionMode = 'basic' | 'intelligent';

interface CachedSuggestions {
  url: string;
  urlHash: string;
  suggestions: AgentSuggestion[];
  timestamp: number;
  pageTitle: string;
  contentHash: string;
}

interface DomainPattern {
  pattern: RegExp;
  suggestions: AgentSuggestion[];
}

/**
 * Domain-specific agent suggestions
 * Patterns are matched in order, first match wins
 */
const domainSuggestions: DomainPattern[] = [
  // GitHub
  {
    pattern: /github\.com/i,
    suggestions: [
      {
        icon: '📝',
        title: 'Summarize repository',
        description: 'Get a comprehensive overview of this repository\'s purpose and structure',
        prompt: 'Please analyze this GitHub repository and provide a comprehensive summary including: 1) The main purpose and functionality, 2) Key technologies and dependencies used, 3) Project structure and organization, 4) Notable features or capabilities, 5) Getting started steps if available.',
      },
      {
        icon: '🔍',
        title: 'Explain this code',
        description: 'Get a detailed explanation of the code visible on this page',
        prompt: 'Please analyze the code visible on this page and provide: 1) A clear explanation of what this code does, 2) Key functions or classes and their purposes, 3) Any notable patterns or best practices used, 4) Potential use cases or examples of how this code would be used.',
      },
      {
        icon: '🐛',
        title: 'Review for issues',
        description: 'Identify potential bugs, security issues, or improvements',
        prompt: 'Please review the code on this page for: 1) Potential bugs or edge cases not handled, 2) Security vulnerabilities or concerns, 3) Performance optimization opportunities, 4) Code quality improvements (readability, maintainability), 5) Best practices that could be applied.',
      },
    ],
  },

  // Documentation sites
  {
    pattern: /\b(docs?|documentation|developer|api|reference|guide)\./i,
    suggestions: [
      {
        icon: '📚',
        title: 'Summarize documentation',
        description: 'Get a concise summary of this documentation page',
        prompt: 'Please summarize this documentation page including: 1) The main topic or API being documented, 2) Key concepts or features explained, 3) Important parameters, options, or configurations, 4) Code examples and their purposes, 5) Common use cases or best practices mentioned.',
      },
      {
        icon: '🚀',
        title: 'Quick start guide',
        description: 'Extract getting started steps and essential setup information',
        prompt: 'Based on this documentation, provide a quick start guide including: 1) Prerequisites or requirements, 2) Installation or setup steps, 3) Basic configuration needed, 4) A simple "Hello World" example if applicable, 5) Next steps or where to learn more.',
      },
      {
        icon: '💡',
        title: 'Find examples',
        description: 'Locate and explain code examples from this documentation',
        prompt: 'Please find and explain the code examples on this page: 1) What each example demonstrates, 2) How to use or adapt each example, 3) Important parameters or options shown, 4) Common patterns or best practices illustrated, 5) Potential pitfalls or gotchas to avoid.',
      },
    ],
  },

  // Stack Overflow
  {
    pattern: /stackoverflow\.com/i,
    suggestions: [
      {
        icon: '❓',
        title: 'Summarize question',
        description: 'Get a clear summary of the problem being asked',
        prompt: 'Please summarize this Stack Overflow question including: 1) The core problem or issue being faced, 2) What the user is trying to accomplish, 3) What they\'ve tried so far, 4) Any error messages or unexpected behavior, 5) The technology stack involved.',
      },
      {
        icon: '✅',
        title: 'Explain best answer',
        description: 'Understand why the accepted answer solves the problem',
        prompt: 'Please explain the accepted or top-voted answer: 1) How it solves the problem, 2) Why this approach is recommended, 3) Key concepts or techniques used, 4) Potential limitations or edge cases, 5) Alternative approaches mentioned if any.',
      },
      {
        icon: '🔄',
        title: 'Compare solutions',
        description: 'Compare different answers and their trade-offs',
        prompt: 'Please compare the different solutions provided: 1) What approach each answer takes, 2) Pros and cons of each solution, 3) Which solution works best for different scenarios, 4) Performance or compatibility considerations, 5) Your recommendation based on modern best practices.',
      },
    ],
  },

  // YouTube
  {
    pattern: /youtube\.com|youtu\.be/i,
    suggestions: [
      {
        icon: '🎥',
        title: 'Summarize video',
        description: 'Get a summary of this video\'s content',
        prompt: 'Based on the video title, description, and any visible information, please provide: 1) The main topic or purpose of this video, 2) Key points or sections likely covered, 3) Target audience or skill level, 4) Duration and time investment needed, 5) Whether this would be useful for learning the topic.',
      },
      {
        icon: '📌',
        title: 'Key takeaways',
        description: 'Extract the most important points from this video',
        prompt: 'From the video information available, identify: 1) The most important concepts or lessons, 2) Practical tips or techniques demonstrated, 3) Resources or tools mentioned, 4) Common mistakes or pitfalls discussed, 5) Action items or next steps suggested.',
      },
    ],
  },

  // Twitter/X
  {
    pattern: /twitter\.com|x\.com/i,
    suggestions: [
      {
        icon: '🧵',
        title: 'Summarize thread',
        description: 'Get a cohesive summary of this Twitter thread',
        prompt: 'Please summarize this Twitter thread including: 1) The main topic or argument being made, 2) Key points in logical order, 3) Important data, examples, or evidence shared, 4) Conclusions or takeaways, 5) Any resources or links mentioned.',
      },
      {
        icon: '📊',
        title: 'Analyze discussion',
        description: 'Understand the context and reactions to this post',
        prompt: 'Please analyze this Twitter post: 1) The main message or claim, 2) Context or background needed to understand it, 3) Common reactions or perspectives in replies, 4) Key counterarguments if any, 5) Factual accuracy and credibility considerations.',
      },
    ],
  },

  // LinkedIn
  {
    pattern: /linkedin\.com/i,
    suggestions: [
      {
        icon: '💼',
        title: 'Summarize post',
        description: 'Extract key insights from this LinkedIn post',
        prompt: 'Please summarize this LinkedIn post including: 1) The main message or insight being shared, 2) Professional context or industry relevance, 3) Key advice or recommendations, 4) Examples or case studies mentioned, 5) Actionable takeaways for professionals.',
      },
      {
        icon: '📈',
        title: 'Career insights',
        description: 'Extract career advice and professional development tips',
        prompt: 'From this content, identify: 1) Career development advice or strategies, 2) Industry trends or insights mentioned, 3) Skills or qualifications highlighted, 4) Networking or professional growth opportunities, 5) How to apply these insights to your own career.',
      },
    ],
  },

  // Reddit
  {
    pattern: /reddit\.com/i,
    suggestions: [
      {
        icon: '💬',
        title: 'Summarize discussion',
        description: 'Get an overview of this Reddit post and top comments',
        prompt: 'Please summarize this Reddit discussion: 1) The original post\'s topic and key points, 2) Main perspectives or opinions in top comments, 3) Consensus viewpoints vs. debates, 4) Useful information or solutions shared, 5) Overall community sentiment.',
      },
      {
        icon: '🏆',
        title: 'Top insights',
        description: 'Extract the most valuable comments and information',
        prompt: 'From this Reddit thread, extract: 1) The most upvoted and insightful comments, 2) Expert opinions or verified information, 3) Practical tips or solutions provided, 4) Common experiences or patterns mentioned, 5) Resources or links worth checking out.',
      },
    ],
  },

  // News sites
  {
    pattern: /\b(news|techcrunch|theverge|arstechnica|reuters|nytimes|wsj|bloomberg)\./i,
    suggestions: [
      {
        icon: '📰',
        title: 'Summarize article',
        description: 'Get a concise summary of this news article',
        prompt: 'Please summarize this article including: 1) The main news or story, 2) Key facts and figures, 3) Important context or background, 4) Quotes from relevant people or sources, 5) Implications or significance of this news.',
      },
      {
        icon: '🎯',
        title: 'Key facts',
        description: 'Extract the most important facts and data points',
        prompt: 'From this article, extract: 1) Verified facts and statistics, 2) Timeline of events, 3) Key people or organizations involved, 4) Data sources and their credibility, 5) What remains uncertain or unconfirmed.',
      },
    ],
  },

  // E-commerce (Amazon, etc.)
  {
    pattern: /amazon\.|ebay\.|etsy\.|shopify\./i,
    suggestions: [
      {
        icon: '🛍️',
        title: 'Product summary',
        description: 'Summarize product features and specifications',
        prompt: 'Please summarize this product including: 1) Main features and capabilities, 2) Technical specifications, 3) What\'s included in the package, 4) Key use cases or applications, 5) Compatibility or requirements.',
      },
      {
        icon: '⭐',
        title: 'Review analysis',
        description: 'Analyze customer reviews and ratings',
        prompt: 'Based on visible reviews, provide: 1) Common praise and positive experiences, 2) Frequent complaints or issues, 3) Quality and reliability consensus, 4) Who this product works best for, 5) Important considerations before buying.',
      },
    ],
  },
];

/**
 * Default suggestions when no domain pattern matches
 */
const defaultSuggestions: AgentSuggestion[] = [
  {
    icon: '📝',
    title: 'Summarize this page',
    description: 'Get a comprehensive summary of the main content and key points',
    prompt: 'Please analyze this webpage and provide a comprehensive summary including: 1) The main topic or purpose of the page, 2) Key information, arguments, or points made, 3) Important data, facts, or examples provided, 4) Notable sections or features, 5) Overall takeaways or conclusions.',
  },
  {
    icon: '💡',
    title: 'Explain key concepts',
    description: 'Break down complex topics into understandable explanations',
    prompt: 'Please identify and explain the key concepts on this page: 1) Main ideas or topics presented, 2) Technical terms or jargon explained simply, 3) How different concepts relate to each other, 4) Real-world applications or examples, 5) Additional context needed to fully understand.',
  },
  {
    icon: '🎯',
    title: 'Action items',
    description: 'Extract actionable steps, tasks, or recommendations',
    prompt: 'From this page, extract actionable information: 1) Specific steps or instructions to follow, 2) Recommended actions or best practices, 3) Tools, resources, or links to use, 4) Prerequisites or requirements, 5) Expected outcomes or results.',
  },
  {
    icon: '🔍',
    title: 'Answer questions',
    description: 'Help me understand specific aspects of this content',
    prompt: 'I have questions about this page. Please help me understand: 1) What are the most important points I should know?, 2) Is there anything confusing that needs clarification?, 3) What context am I missing?, 4) How can I apply this information?, 5) What should I read or explore next?',
  },
];

// Cache for intelligent suggestions (in-memory, per session)
const intelligentSuggestionsCache = new Map<string, CachedSuggestions>();

// Cache expiry time (30 minutes)
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

/**
 * URL patterns that should use intelligent prompts
 * These are specific content pages, not general feeds
 */
const intelligentPromptPatterns = [
  // Twitter/X specific posts
  /^https?:\/\/(twitter\.com|x\.com)\/[^\/]+\/status\/\d+/i,
  
  // Gmail specific emails (not just inbox view)
  /^https?:\/\/mail\.google\.com\/mail\/u\/\d+\/#inbox\/[a-f0-9]+$/i,
  
  // LinkedIn specific posts
  /^https?:\/\/www\.linkedin\.com\/posts\//i,
  /^https?:\/\/www\.linkedin\.com\/feed\/update\/urn:li:activity:\d+/i,
  
  // Facebook specific posts
  /^https?:\/\/(www\.)?facebook\.com\/[^\/]+\/posts\/\d+/i,
  /^https?:\/\/(www\.)?facebook\.com\/photo\//i,
  
  // Reddit specific posts
  /^https?:\/\/(www\.)?reddit\.com\/r\/[^\/]+\/comments\//i,
  
  // YouTube specific videos
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/i,
  /^https?:\/\/youtu\.be\//i,
  
  // GitHub specific pages (repos, issues, PRs)
  /^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/(issues|pull|blob|tree|commit)/i,
  
  // News article pages (specific articles, not homepage feeds)
  /^https?:\/\/(www\.)?(nytimes\.com)\/\d{4}\/\d{2}\/\d{2}\//i,
  /^https?:\/\/(www\.)?(wsj\.com)\/articles\//i,
  /^https?:\/\/(www\.)?(reuters\.com)\/[^\/]+\/[^\/]+\//i,
  
  // Documentation pages (specific docs, not landing pages)
  /^https?:\/\/[^\/]*docs?[^\/]*\/[^\/]+\//i,
  
  // Stack Overflow specific questions
  /^https?:\/\/stackoverflow\.com\/questions\/\d+/i,
  
  // Product pages on e-commerce sites
  /^https?:\/\/(www\.)?amazon\.[^\/]+\/(dp|gp\/product)\/[A-Z0-9]+/i,
  
  // Medium articles
  /^https?:\/\/[^\/]*medium\.com\/[^\/]+\/[^\/]+-[a-f0-9]+/i,
  
  // Substack articles
  /^https?:\/\/[^\/]+\.substack\.com\/p\//i,
];

/**
 * Check if a URL should use intelligent prompts based on pattern matching
 */
export function shouldUseIntelligentPrompts(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    return intelligentPromptPatterns.some(pattern => pattern.test(url));
  } catch (error) {
    console.error('Error checking intelligent prompt patterns:', error);
    return false;
  }
}

/**
 * Generate a hash for URL + content to detect significant page changes
 */
function generateContentHash(url: string, title: string, content: string): string {
  const combined = `${url}|${title}|${content.substring(0, 500)}`;
  // Simple hash function (for demo - could use crypto.subtle in production)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Get cached suggestions if available and still valid
 */
function getCachedSuggestions(url: string, title: string, content: string): AgentSuggestion[] | null {
  const contentHash = generateContentHash(url, title, content);
  const cached = intelligentSuggestionsCache.get(url);

  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > CACHE_EXPIRY_MS;
  const contentChanged = cached.contentHash !== contentHash;

  if (isExpired || contentChanged) {
    intelligentSuggestionsCache.delete(url);
    return null;
  }

  console.log('🎯 Using cached intelligent suggestions for:', url);
  return cached.suggestions;
}

/**
 * Cache intelligent suggestions
 */
function cacheIntelligentSuggestions(
  url: string,
  title: string,
  content: string,
  suggestions: AgentSuggestion[]
): void {
  const contentHash = generateContentHash(url, title, content);
  const urlHash = url.split('?')[0]; // Remove query params for grouping

  intelligentSuggestionsCache.set(url, {
    url,
    urlHash,
    suggestions,
    timestamp: Date.now(),
    pageTitle: title,
    contentHash
  });

  console.log('💾 Cached intelligent suggestions for:', url);
}

/**
 * Get intelligent suggestions using GPT-5-nano (with caching)
 */
export async function getIntelligentSuggestions(
  url: string,
  title: string,
  content: string
): Promise<AgentSuggestion[]> {
  try {
    if (!url) {
      return defaultSuggestions;
    }
    // Check cache first
    const cached = getCachedSuggestions(url, title, content);
    if (cached) return cached;

    console.log('🤖 Generating intelligent suggestions for:', url);

    // Create simplified prompt for GPT-5-nano
    const analysisPrompt = `Analyze this webpage and suggest 3 relevant actions a user might want to take. Return ONLY a JSON array in this exact format:
[
  {
    "icon": "📝",
    "title": "Action title",
    "description": "What this action does",
    "prompt": "Detailed prompt for the AI assistant"
  }
]

Website: ${url}
Title: ${title}
Content: ${content.substring(0, 800)}

Make the suggestions specific to this page's content and domain. Examples:
- For GitHub: "Review code quality", "Explain repository structure"  
- For docs: "Create quick start guide", "Explain API endpoints"
- For articles: "Summarize key points", "Extract action items"
- For products: "Analyze features", "Compare alternatives"

Return only the JSON array, no other text.`;

    // Send request to background script
    const response = await chrome.runtime.sendMessage({
      type: 'ASK_INTELLA',
      payload: {
        question: analysisPrompt,
        model: 'gpt-5-nano',
        maxTokens: 500
      }
    });

    if (!response.success) {
      console.error('Failed to get intelligent suggestions:', response.error);
      return getBasicSuggestions(url);
    }

    // Parse response
    let suggestions: AgentSuggestion[];
    try {
      suggestions = JSON.parse(response.data);
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('Failed to parse intelligent suggestions:', parseError);
      return getBasicSuggestions(url);
    }

    // Cache the results
    cacheIntelligentSuggestions(url, title, content, suggestions);
    return suggestions;

  } catch (error) {
    console.error('Error getting intelligent suggestions:', error);
    return getBasicSuggestions(url);
  }
}

/**
 * Get basic (hardcoded) agent suggestions for a given URL
 */
export function getBasicSuggestions(url: string): AgentSuggestion[] {
  try {
    // Handle empty, undefined, or invalid URLs
    if (!url || typeof url !== 'string' || url.trim() === '') {
      console.log('⚠️ getBasicSuggestions: Invalid or empty URL:', url);
      return defaultSuggestions;
    }

    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Find first matching pattern
    for (const { pattern, suggestions } of domainSuggestions) {
      if (pattern.test(domain)) {
        return suggestions;
      }
    }

    // Return default suggestions if no pattern matches
    return defaultSuggestions;
  } catch (error) {
    console.error('Error parsing URL for basic suggestions:', error);
    return defaultSuggestions;
  }
}

/**
 * Main function to get suggestions - automatically determines if intelligent or basic should be used
 */
export async function getSuggestions(
  url: string,
  pageData?: { title: string; content: string },
  forceMode?: SuggestionMode
): Promise<AgentSuggestion[]> {
  let useIntelligent = false;
  
  if (forceMode === 'basic') {
    useIntelligent = false;
  } else if (forceMode === 'intelligent') {
    useIntelligent = true;
  } else {
    // Auto-determine based on URL patterns
    useIntelligent = shouldUseIntelligentPrompts(url);
  }
  
  if (useIntelligent && pageData?.title && pageData?.content) {
    try {
      console.log('🤖 Using intelligent suggestions for URL:', url);
      return await getIntelligentSuggestions(url, pageData.title, pageData.content);
    } catch (error) {
      console.error('❌ Intelligent suggestions failed, falling back to basic:', error);
      return getBasicSuggestions(url);
    }
  }
  
  console.log('📋 Using basic suggestions for URL:', url);
  return getBasicSuggestions(url);
}

/**
 * @deprecated Use getSuggestions instead
 */
export async function getAgentSuggestions(
  url: string,
  mode: SuggestionMode = 'basic',
  pageData?: { title: string; content: string }
): Promise<AgentSuggestion[]> {
  if (mode === 'basic') {
    return getBasicSuggestions(url);
  }

  if (mode === 'intelligent' && pageData) {
    return await getIntelligentSuggestions(url, pageData.title, pageData.content);
  }

  // Fallback to basic if intelligent mode requested but no page data
  return getBasicSuggestions(url);
}

/**
 * Clear cached suggestions (useful for testing or manual refresh)
 */
export function clearSuggestionsCache(url?: string): void {
  if (url) {
    intelligentSuggestionsCache.delete(url);
  } else {
    intelligentSuggestionsCache.clear();
  }
  console.log('🗑️ Cleared suggestions cache' + (url ? ` for ${url}` : ''));
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: intelligentSuggestionsCache.size,
    entries: Array.from(intelligentSuggestionsCache.keys())
  };
}

/**
 * Get domain name for display purposes
 */
export function getDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return 'this page';
  }
}
