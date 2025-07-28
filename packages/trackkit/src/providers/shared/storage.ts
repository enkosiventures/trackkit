import { logger } from '../../util/logger';

/**
 * Storage options
 */
export interface StorageOptions {
  /**
   * Storage type preference
   */
  type?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory';
  
  /**
   * Cookie options (if using cookies)
   */
  cookie?: {
    domain?: string;
    path?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number; // seconds
  };
  
  /**
   * Key prefix for namespacing
   */
  prefix?: string;
}

/**
 * In-memory storage fallback
 */
class MemoryStorage {
  private data = new Map<string, string>();
  
  getItem(key: string): string | null {
    return this.data.get(key) || null;
  }
  
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  
  removeItem(key: string): void {
    this.data.delete(key);
  }
  
  clear(): void {
    this.data.clear();
  }
}

/**
 * Cross-browser storage utility
 */
export class Storage {
  private storage: typeof localStorage | typeof sessionStorage | MemoryStorage;
  private useCookies: boolean;
  private prefix: string;
  private cookieOptions: StorageOptions['cookie'];
  
  constructor(options: StorageOptions = {}) {
    this.prefix = options.prefix || 'trackkit_';
    this.cookieOptions = options.cookie;
    this.useCookies = options.type === 'cookie';
    
    // Determine storage backend
    if (this.useCookies) {
      this.storage = new MemoryStorage(); // Cookies handled separately
    } else if (options.type === 'memory') {
      this.storage = new MemoryStorage();
    } else {
      this.storage = this.getAvailableStorage(options.type);
    }
  }
  
  /**
   * Get value from storage
   */
  get(key: string): string | null {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useCookies) {
        return this.getCookie(fullKey);
      }
      return this.storage.getItem(fullKey);
    } catch (error) {
      logger.debug('Storage read error', { key: fullKey, error });
      return null;
    }
  }
  
  /**
   * Set value in storage
   */
  set(key: string, value: string): boolean {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useCookies) {
        this.setCookie(fullKey, value);
      } else {
        this.storage.setItem(fullKey, value);
      }
      return true;
    } catch (error) {
      logger.debug('Storage write error', { key: fullKey, error });
      return false;
    }
  }
  
  /**
   * Get and parse JSON value
   */
  getJSON<T>(key: string): T | null {
    const value = this.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  
  /**
   * Set JSON value
   */
  setJSON(key: string, value: any): boolean {
    try {
      return this.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  }
  
  /**
   * Remove value from storage
   */
  remove(key: string): void {
    const fullKey = this.prefix + key;
    
    try {
      if (this.useCookies) {
        this.deleteCookie(fullKey);
      } else {
        this.storage.removeItem(fullKey);
      }
    } catch (error) {
      logger.debug('Storage remove error', { key: fullKey, error });
    }
  }
  
  /**
   * Clear all storage (with prefix)
   */
  clear(): void {
    try {
      if (this.useCookies) {
        // Clear all cookies with prefix
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.split('=');
          if (name.trim().startsWith(this.prefix)) {
            this.deleteCookie(name.trim());
          }
        });
      } else if (this.storage instanceof MemoryStorage) {
        this.storage.clear();
      } else {
        // Clear only items with our prefix
        const keysToRemove: string[] = [];
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key?.startsWith(this.prefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => this.storage.removeItem(key));
      }
    } catch (error) {
      logger.debug('Storage clear error', error);
    }
  }
  
  /**
   * Get available storage backend
   */
  private getAvailableStorage(
    preferred?: 'localStorage' | 'sessionStorage' | 'cookie'
  ): typeof localStorage | typeof sessionStorage | MemoryStorage {
    // Test storage availability
    const testKey = '__trackkit_test__';
    
    // Try preferred storage first
    if (preferred) {
      try {
        // @ts-expect-error - indexing with string
        const storage = window[preferred];
        storage.setItem(testKey, 'test');
        storage.removeItem(testKey);
        return storage;
      } catch {
        logger.debug(`${preferred} not available`);
      }
    }
    
    // Try localStorage
    try {
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return localStorage;
    } catch {
      logger.debug('localStorage not available');
    }
    
    // Try sessionStorage
    try {
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return sessionStorage;
    } catch {
      logger.debug('sessionStorage not available');
    }
    
    // Fallback to memory
    logger.debug('Using in-memory storage');
    return new MemoryStorage();
  }
  
  /**
   * Get cookie value
   */
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  }
  
  /**
   * Set cookie value
   */
  private setCookie(name: string, value: string): void {
    if (typeof document === 'undefined') return;
    
    const options = this.cookieOptions || {};
    let cookie = `${name}=${encodeURIComponent(value)}`;
    
    if (options.maxAge) {
      cookie += `; max-age=${options.maxAge}`;
    }
    
    if (options.domain) {
      cookie += `; domain=${options.domain}`;
    }
    
    cookie += `; path=${options.path || '/'}`;
    
    if (options.secure) {
      cookie += '; secure';
    }
    
    if (options.sameSite) {
      cookie += `; samesite=${options.sameSite}`;
    }
    
    document.cookie = cookie;
  }
  
  /**
   * Delete cookie
   */
  private deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    
    const options = this.cookieOptions || {};
    let cookie = `${name}=; max-age=0`;
    
    if (options.domain) {
      cookie += `; domain=${options.domain}`;
    }
    
    cookie += `; path=${options.path || '/'}`;
    
    document.cookie = cookie;
  }
}

/**
 * Create a storage instance with fallback chain
 */
export function createStorage(options?: StorageOptions): Storage {
  return new Storage(options);
}

/**
 * Storage for temporary data (session-based)
 */
export const tempStorage = createStorage({
  type: 'sessionStorage',
  prefix: 'trackkit_temp_',
});

/**
 * Storage for persistent data
 */
export const persistentStorage = createStorage({
  type: 'localStorage',
  prefix: 'trackkit_',
});