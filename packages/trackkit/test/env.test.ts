import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readEnvConfig, parseEnvBoolean, parseEnvNumber } from '../src/util/env';

describe('Environment configuration', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear window mock
    if (global.window) {
      delete (global.window as any).__TRACKKIT_ENV__;
    }
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  describe('readEnvConfig', () => {
    it('reads direct environment variables', () => {
      process.env.TRACKKIT_PROVIDER = 'umami';
      process.env.TRACKKIT_SITE_ID = 'test-123';
      
      const config = readEnvConfig();
      expect(config.provider).toBe('umami');
      expect(config.siteId).toBe('test-123');
    });
    
    it('reads Vite-prefixed variables', () => {
      process.env.VITE_TRACKKIT_PROVIDER = 'plausible';
      
      const config = readEnvConfig();
      expect(config.provider).toBe('plausible');
    });
    
    it('reads React App prefixed variables', () => {
      process.env.REACT_APP_TRACKKIT_HOST = 'https://analytics.test';
      
      const config = readEnvConfig();
      expect(config.host).toBe('https://analytics.test');
    });
    
    it('prioritizes direct vars over prefixed', () => {
      process.env.TRACKKIT_DEBUG = 'true';
      process.env.VITE_TRACKKIT_DEBUG = 'false';
      
      const config = readEnvConfig();
      expect(config.debug).toBe('true');
    });
  });
  
  describe('parseEnvBoolean', () => {
    it.each([
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['false', false],
      ['0', false],
      ['', false],
      [undefined, false],
    ])('parseEnvBoolean(%s) = %s', (input, expected) => {
      expect(parseEnvBoolean(input)).toBe(expected);
    });
  });
  
  describe('parseEnvNumber', () => {
    it.each([
      ['50', 50],
      ['0', 0],
      ['-1', -1],
      ['abc', 10],
      ['', 10],
      [undefined, 10],
    ])('parseEnvNumber(%s, 10) = %s', (input, expected) => {
      expect(parseEnvNumber(input, 10)).toBe(expected);
    });
  });
});