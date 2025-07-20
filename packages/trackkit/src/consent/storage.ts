import type { ConsentState, ConsentStorage } from './types';
import { logger } from '../util/logger';

/**
 * Cookie utilities
 */
const CookieUtil = {
  set(name: string, value: string, options: any = {}): void {
    if (typeof document === 'undefined') return;
    
    const {
      expires = 365,
      domain,
      path = '/',
      sameSite = 'lax',
      secure = window.location.protocol === 'https:',
    } = options;
    
    const date = new Date();
    date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
    
    const cookieParts = [
      `${name}=${encodeURIComponent(value)}`,
      `expires=${date.toUTCString()}`,
      `path=${path}`,
      `SameSite=${sameSite}`,
    ];
    
    if (domain) cookieParts.push(`domain=${domain}`);
    if (secure) cookieParts.push('Secure');
    
    document.cookie = cookieParts.join('; ');
  },
  
  get(name: string): string | null {
    if (typeof document === 'undefined') return null;
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    
    return null;
  },
  
  remove(name: string, options: any = {}): void {
    this.set(name, '', { ...options, expires: -1 });
  },
};

/**
 * Create storage adapter based on configuration
 */
export function createStorageAdapter(config: ConsentStorage): {
  get(): ConsentState | null;
  set(state: ConsentState): void;
  remove(): void;
} {
  const key = config.key || 'trackkit_consent';
  
  switch (config.type) {
    case 'cookie':
      return {
        get() {
          try {
            const value = CookieUtil.get(key);
            return value ? JSON.parse(value) : null;
          } catch (error) {
            logger.error('Failed to parse consent cookie', error);
            return null;
          }
        },
        
        set(state) {
          try {
            CookieUtil.set(
              key,
              JSON.stringify(state),
              config.cookieOptions
            );
          } catch (error) {
            logger.error('Failed to set consent cookie', error);
          }
        },
        
        remove() {
          CookieUtil.remove(key, config.cookieOptions);
        },
      };
      
    case 'localStorage':
      return {
        get() {
          if (typeof window === 'undefined') return null;
          try {
            const value = window.localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
          } catch (error) {
            logger.error('Failed to parse consent from localStorage', error);
            return null;
          }
        },
        
        set(state) {
          if (typeof window === 'undefined') return;
          try {
            window.localStorage.setItem(key, JSON.stringify(state));
          } catch (error) {
            logger.error('Failed to save consent to localStorage', error);
          }
        },
        
        remove() {
          if (typeof window === 'undefined') return;
          try {
            window.localStorage.removeItem(key);
          } catch (error) {
            logger.error('Failed to remove consent from localStorage', error);
          }
        },
      };
      
    case 'memory':
      let memoryState: ConsentState | null = null;
      return {
        get: () => memoryState,
        set: (state) => { memoryState = state; },
        remove: () => { memoryState = null; },
      };
      
    case 'custom':
      if (!config.adapter) {
        throw new Error('Custom storage requires adapter implementation');
      }
      return config.adapter;
      
    default:
      throw new Error(`Unknown storage type: ${config.type}`);
  }
}

/**
 * Detect user's region for geographic defaults
 */
export async function detectRegion(): Promise<'EU' | 'US' | 'OTHER'> {
  try {
    // Check timezone for rough detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const euTimezones = [
      'Europe/', 'Africa/Ceuta', 'Africa/Melilla',
      'Atlantic/Canary', 'Atlantic/Madeira',
    ];
    
    if (euTimezones.some(tz => timezone.startsWith(tz))) {
      return 'EU';
    }
    
    const usTimezones = [
      'America/New_York', 'America/Chicago',
      'America/Denver', 'America/Los_Angeles',
      'America/Anchorage', 'Pacific/Honolulu',
    ];
    
    if (usTimezones.includes(timezone)) {
      return 'US';
    }
    
    // Could also use IP geolocation service here
    
    return 'OTHER';
  } catch {
    return 'OTHER';
  }
}