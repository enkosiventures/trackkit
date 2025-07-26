import type { ValidationResult } from './types';

/**
 * Validate UUID format (loose check)
 */
export function validateUUID(id: string): ValidationResult {
  if (!id) {
    return { valid: false, error: 'UUID is required' };
  }
  
  // Remove hyphens for validation
  const clean = id.replace(/-/g, '');
  
  // Check if it's 32 hex characters
  if (!/^[0-9a-f]{32}$/i.test(clean)) {
    return { valid: false, error: 'Invalid UUID format' };
  }
  
  // Return formatted UUID
  const formatted = clean.replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    '$1-$2-$3-$4-$5'
  );
  
  return { valid: true, parsed: formatted };
}

/**
 * Validate GA4 Measurement ID
 */
export function validateGA4MeasurementId(id: string): ValidationResult {
  if (!id) {
    return { valid: false, error: 'Measurement ID is required' };
  }
  
  // Check format: G-XXXXXXXXXX
  const match = id.match(/^G-[A-Z0-9]{10}$/);
  if (!match) {
    // Try to extract from other formats
    const extracted = id.match(/G-[A-Z0-9]{10}/);
    if (extracted) {
      return { valid: true, parsed: extracted[0] };
    }
    return { valid: false, error: 'Invalid GA4 Measurement ID format (expected G-XXXXXXXXXX)' };
  }
  
  return { valid: true, parsed: id };
}

/**
 * Validate and parse domain
 */
export function validateDomain(domain: string): ValidationResult {
  if (!domain) {
    return { valid: false, error: 'Domain is required' };
  }
  
  // Remove protocol and trailing slash
  const cleaned = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase();
  
  // Basic domain validation
  const domainRegex = /^([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$/;
  if (!domainRegex.test(cleaned) && cleaned !== 'localhost') {
    return { valid: false, error: 'Invalid domain format' };
  }
  
  return { valid: true, parsed: cleaned };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  if (!url) {
    return { valid: false, error: 'URL is required' };
  }
  
  try {
    const parsed = new URL(url);
    
    // Check for valid protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    
    return { valid: true, parsed: parsed.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate API key format
 */
export function validateApiKey(
  key: string, 
  options: { minLength?: number; pattern?: RegExp } = {}
): ValidationResult {
  if (!key) {
    return { valid: false, error: 'API key is required' };
  }
  
  const { minLength = 10, pattern } = options;
  
  if (key.length < minLength) {
    return { valid: false, error: `API key must be at least ${minLength} characters` };
  }
  
  if (pattern && !pattern.test(key)) {
    return { valid: false, error: 'API key format is invalid' };
  }
  
  return { valid: true, parsed: key };
}

/**
 * Validate numeric value in range
 */
export function validateNumber(
  value: any,
  options: { min?: number; max?: number; name?: string } = {}
): ValidationResult {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, name = 'Value' } = options;
  
  const num = Number(value);
  
  if (isNaN(num)) {
    return { valid: false, error: `${name} must be a number` };
  }
  
  if (num < min) {
    return { valid: false, error: `${name} must be at least ${min}` };
  }
  
  if (num > max) {
    return { valid: false, error: `${name} must be at most ${max}` };
  }
  
  return { valid: true, parsed: num };
}

/**
 * Create a validation error message
 */
export function createValidationError(field: string, result: ValidationResult): string {
  return `${field}: ${result.error}`;
}