/**
 * Granular consent categories for different regulations
 */
export interface ConsentCategories {
  /**
   * Basic analytics (pageviews, sessions)
   */
  necessary?: boolean;
  
  /**
   * Enhanced analytics (events, conversions)
   */
  analytics?: boolean;
  
  /**
   * Marketing and advertising tracking
   */
  marketing?: boolean;
  
  /**
   * User preferences and settings
   */
  preferences?: boolean;
}

/**
 * Consent state with metadata
 */
export interface ConsentState {
  /**
   * Overall consent status
   */
  status: 'pending' | 'granted' | 'denied' | 'partial';
  
  /**
   * Granular category consents
   */
  categories: ConsentCategories;
  
  /**
   * Timestamp of consent decision
   */
  timestamp?: number;
  
  /**
   * Consent version/policy version
   */
  version?: string;
  
  /**
   * How consent was obtained
   */
  method?: 'explicit' | 'implicit' | 'opt-out';
  
  /**
   * Legal basis for processing
   */
  legalBasis?: 'consent' | 'legitimate_interest' | 'contract';
}

/**
 * Consent persistence options
 */
export interface ConsentStorage {
  /**
   * Storage mechanism to use
   */
  type: 'cookie' | 'localStorage' | 'memory' | 'custom';
  
  /**
   * Storage key/cookie name
   */
  key?: string;
  
  /**
   * Cookie options (if using cookies)
   */
  cookieOptions?: {
    domain?: string;
    path?: string;
    expires?: number; // days
    sameSite?: 'strict' | 'lax' | 'none';
    secure?: boolean;
  };
  
  /**
   * Custom storage adapter
   */
  adapter?: {
    get(): ConsentState | null;
    set(state: ConsentState): void;
    remove(): void;
  };
}

/**
 * Consent configuration
 */
export interface ConsentConfig {
  /**
   * Default consent state before user decision
   */
  defaultState?: ConsentState;
  
  /**
   * Storage configuration
   */
  storage?: ConsentStorage;
  
  /**
   * Callback when consent changes
   */
  onConsentChange?: (state: ConsentState, previousState: ConsentState) => void;
  
  /**
   * Geographic-based defaults
   */
  geographicDefaults?: {
    EU?: Partial<ConsentState>;
    US?: Partial<ConsentState>;
    default?: Partial<ConsentState>;
  };
  
  /**
   * Require explicit consent (no implied consent)
   */
  requireExplicit?: boolean;
  
  /**
   * Enable consent mode debugging
   */
  debug?: boolean;
}

/**
 * Consent manager events
 */
export type ConsentEvent = 
  | { type: 'GRANT'; categories?: ConsentCategories }
  | { type: 'DENY' }
  | { type: 'WITHDRAW' }
  | { type: 'UPDATE'; categories: ConsentCategories }
  | { type: 'RESET' };