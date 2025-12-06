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

/**
 * Get agent suggestions for a given URL
 */
export function getAgentSuggestions(url: string): AgentSuggestion[] {
  try {

    console.log('🔍 AGENT SUGGESTIONS - URL:', url);
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
    console.error('Error parsing URL for agent suggestions:', error);
    return defaultSuggestions;
  }
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
