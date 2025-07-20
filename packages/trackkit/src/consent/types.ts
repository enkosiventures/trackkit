/**
 * Core consent state - intentionally minimal
 */
export type ConsentStatus = 'pending' | 'granted' | 'denied';

/**
 * Consent state with metadata
 */
export interface ConsentState {
  /**
   * Current consent status
   */
  status: ConsentStatus;
  
  /**
   * When consent was last updated
   */
  timestamp: number;
  
  /**
   * Optional consent version for policy updates
   */
  version?: string;
  
  /**
   * How consent was obtained (for audit trails)
   */
  method?: 'explicit' | 'implicit';
}

/**
 * Consent configuration options
 */
export interface ConsentOptions {
  /**
   * Initial consent state (default: 'pending')
   */
  initial?: ConsentStatus | ConsentState;
  
  /**
   * Storage key for persistence
   * @default 'trackkit_consent'
   */
  storageKey?: string;
  
  /**
   * Disable persistence (memory-only)
   * @default false
   */
  disablePersistence?: boolean;
  
  /**
   * Callback when consent changes
   */
  onChange?: (state: ConsentState, previousState: ConsentState) => void;
  
  /**
   * Require explicit consent (no implicit grants)
   * @default true
   */
  requireExplicit?: boolean;
}

/**
 * Event classification for future extensibility
 */
export interface EventClassification {
  /**
   * Event category (default: 'analytics')
   */
  category?: string;
  
  /**
   * Whether event requires consent
   */
  requiresConsent?: boolean;
}

/**
 * Consent evaluator interface for extensibility
 */
export interface ConsentEvaluator {
  /**
   * Get current consent state
   */
  getState(): ConsentState;
  
  /**
   * Check if tracking is allowed
   */
  canTrack(classification?: EventClassification): boolean;
  
  /**
   * Subscribe to consent changes
   */
  subscribe(callback: (state: ConsentState) => void): () => void;
}