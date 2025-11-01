/**
 * Domain Blocking Utilities for Intella
 * Feature 4: Blocked Sites List
 */

/**
 * Normalize a domain string for consistent matching
 */
export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/\/.*$/, '') // Remove path
    .replace(/:\d+$/, ''); // Remove port
}

/**
 * Validate a domain pattern
 */
export function validateDomainPattern(pattern: string): { valid: boolean; error?: string } {
  const normalized = normalizeDomain(pattern);
  
  // Check for empty pattern
  if (!normalized) {
    return { valid: false, error: 'Domain cannot be empty' };
  }
  
  // Check for multiple wildcards or wildcards not at the start
  const wildcardCount = (normalized.match(/\*/g) || []).length;
  if (wildcardCount > 1) {
    return { valid: false, error: 'Only one wildcard (*) is allowed per pattern' };
  }
  
  if (wildcardCount === 1 && !normalized.startsWith('*.')) {
    return { valid: false, error: 'Wildcard (*) can only be used at the beginning as "*."' };
  }
  
  // Check for valid domain format (basic validation)
  const domainPart = normalized.startsWith('*.') ? normalized.slice(2) : normalized;
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
  
  if (!domainRegex.test(domainPart)) {
    return { valid: false, error: 'Invalid domain format' };
  }
  
  return { valid: true };
}

/**
 * Check if a hostname matches any blocked domain pattern
 */
export function isHostnameBlocked(hostname: string, blockedDomains: string[]): { 
  isBlocked: boolean; 
  matchedRule?: string 
} {
  const normalizedHostname = normalizeDomain(hostname);
  
  for (const rule of blockedDomains) {
    const normalizedRule = normalizeDomain(rule);
    
    if (normalizedRule.startsWith('*.')) {
      // Wildcard pattern: *.example.com
      const baseDomain = normalizedRule.slice(2);
      
      // Match exact domain or any subdomain
      if (normalizedHostname === baseDomain || normalizedHostname.endsWith('.' + baseDomain)) {
        return { isBlocked: true, matchedRule: rule };
      }
    } else {
      // Exact match only
      if (normalizedHostname === normalizedRule) {
        return { isBlocked: true, matchedRule: rule };
      }
    }
  }
  
  return { isBlocked: false };
}

/**
 * Get the current page's hostname for blocking checks
 */
export function getCurrentHostname(): string {
  try {
    return new URL(window.location.href).hostname;
  } catch {
    return '';
  }
}

/**
 * Check if the current page should be blocked
 */
export function isCurrentPageBlocked(blockedDomains: string[]): { 
  isBlocked: boolean; 
  matchedRule?: string 
} {
  const hostname = getCurrentHostname();
  return isHostnameBlocked(hostname, blockedDomains);
}

/**
 * Add a domain to the blocked list with validation
 */
export function addBlockedDomain(
  currentList: string[], 
  newDomain: string
): { success: boolean; updatedList?: string[]; error?: string } {
  const normalized = normalizeDomain(newDomain);
  
  // Validate the domain
  const validation = validateDomainPattern(normalized);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  // Check if already in list
  if (currentList.some(domain => normalizeDomain(domain) === normalized)) {
    return { success: false, error: 'Domain is already in the blocked list' };
  }
  
  return { 
    success: true, 
    updatedList: [...currentList, normalized]
  };
}

/**
 * Remove a domain from the blocked list
 */
export function removeBlockedDomain(
  currentList: string[], 
  domainToRemove: string
): string[] {
  const normalized = normalizeDomain(domainToRemove);
  return currentList.filter(domain => normalizeDomain(domain) !== normalized);
}