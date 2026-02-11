/**
 * Input Validation Utilities
 * 
 * Provides security-focused validation for user inputs to prevent:
 * - Path traversal attacks
 * - Command injection
 * - Invalid input handling
 */

import { resolve, normalize, isAbsolute } from 'path';
import { existsSync, statSync } from 'fs';

/**
 * Validate and sanitize a local file path
 * Prevents path traversal attacks
 */
export function validateLocalPath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Path must be a non-empty string');
  }

  // Normalize the path to resolve .. and . segments
  const normalizedPath = normalize(inputPath);
  
  // Convert to absolute path
  const absolutePath = isAbsolute(normalizedPath) 
    ? normalizedPath 
    : resolve(process.cwd(), normalizedPath);

  // Check for suspicious patterns that might indicate path traversal attempts
  const suspicious = ['..', '~', '%', '\x00'];
  for (const pattern of suspicious) {
    if (inputPath.includes(pattern) && !existsSync(absolutePath)) {
      throw new Error(`Suspicious path pattern detected: ${pattern}`);
    }
  }

  return absolutePath;
}

/**
 * Validate that a path exists and is a directory
 */
export function validateDirectory(path: string): string {
  const validatedPath = validateLocalPath(path);
  
  if (!existsSync(validatedPath)) {
    throw new Error(`Directory does not exist: ${validatedPath}`);
  }

  const stats = statSync(validatedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${validatedPath}`);
  }

  return validatedPath;
}

/**
 * Validate GitHub URL format
 * Returns sanitized URL components
 */
export function validateGitHubUrl(url: string): {
  owner: string;
  repo: string;
  sanitizedUrl: string;
} {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  // Trim whitespace and remove trailing slashes
  let cleanUrl = url.trim().replace(/\/+$/, '');
  
  // Remove .git suffix if present
  cleanUrl = cleanUrl.replace(/\.git$/, '');
  
  // Remove path components after repo (like /tree/main, /blob/main/file.txt)
  cleanUrl = cleanUrl.replace(/^(https:\/\/github\.com\/[^\/]+\/[^\/]+)\/.*$/, '$1');

  // Only allow HTTPS GitHub URLs (no SSH for security in automated contexts)
  const match = cleanUrl.match(/^https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  
  if (!match) {
    throw new Error(
      'Invalid GitHub URL format. Expected: https://github.com/owner/repo\n' +
      'Only HTTPS URLs are supported for security reasons.'
    );
  }

  const [, owner, repo] = match;

  // Additional validation - ensure no special characters
  if (!/^[a-zA-Z0-9_-]+$/.test(owner)) {
    throw new Error('Invalid characters in repository owner');
  }
  
  if (!/^[a-zA-Z0-9_.-]+$/.test(repo)) {
    throw new Error('Invalid characters in repository name');
  }

  // Length limits (GitHub's actual limits)
  if (owner.length > 39) {
    throw new Error('Repository owner name too long (max 39 characters)');
  }
  
  if (repo.length > 100) {
    throw new Error('Repository name too long (max 100 characters)');
  }

  // Reconstruct clean URL
  const sanitizedUrl = `https://github.com/${owner}/${repo}.git`;

  return { owner, repo, sanitizedUrl };
}

/**
 * Sanitize a string for safe logging (remove potential injection)
 */
export function sanitizeForLogging(input: string, maxLength = 200): string {
  if (!input) return '';
  
  return input
    .slice(0, maxLength)
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, ''); // Remove potential HTML
}

/**
 * Validate model name (alphanumeric, hyphens, underscores, dots)
 */
export function validateModelName(model: string): string {
  if (!model || typeof model !== 'string') {
    throw new Error('Model name must be a non-empty string');
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(model)) {
    throw new Error('Invalid model name format');
  }

  if (model.length > 100) {
    throw new Error('Model name too long');
  }

  return model;
}

/**
 * Validate cloud endpoint URL (must be HTTPS)
 */
export function validateCloudEndpoint(endpoint: string): string {
  const validated = validateEndpoint(endpoint);
  if (!validated.startsWith('https://')) {
    throw new Error('Cloud endpoint must use HTTPS');
  }
  return validated;
}

/**
 * Validate API key (non-empty, no control characters)
 */
export function validateApiKey(key: string): string {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('API key must be a non-empty string');
  }
  if (/[\x00-\x1F\x7F]/.test(key)) {
    throw new Error('API key contains invalid characters');
  }
  if (key.length > 256) {
    throw new Error('API key too long');
  }
  return key.trim();
}

/**
 * Validate endpoint URL
 */
export function validateEndpoint(endpoint: string): string {
  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('Endpoint must be a non-empty string');
  }

  try {
    const url = new URL(endpoint);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Endpoint must use HTTP or HTTPS protocol');
    }

    // Don't allow credentials in URL
    if (url.username || url.password) {
      throw new Error('Endpoint URL should not contain credentials');
    }

    return url.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch (error) {
    if (error instanceof Error && error.message.includes('Endpoint')) {
      throw error;
    }
    throw new Error('Invalid endpoint URL format');
  }
}
