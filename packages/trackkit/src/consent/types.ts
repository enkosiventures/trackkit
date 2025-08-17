/**
 * Core consent state
 */
export type ConsentStatus = 'pending' | 'granted' | 'denied';

export type ConsentCategory = 'essential' | 'analytics' | 'marketing' | 'preferences' | 'functional';

/**
 * Consent state with metadata
 */
export interface ConsentStoredState {
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
 * Consent options for configuring consent manager behavior
 */
export interface ConsentOptions {
  /**
   * Initial consent status; defaults to 'pending'
   * @default 'pending'
   */
  initialStatus?: ConsentStatus;

  /**
   * If true we start as 'pending' and *require* an explicit call to grant.
   * If false we auto‑grant on first track (implicit consent).
   * @default true
   */
  requireExplicit?: boolean;

  /**
   * Determine if we allow essential events when consent is denied
   * @default false
   */
  allowEssentialOnDenied?: boolean;
  
  /**
   * Current policy/version. If stored version < this => re‑prompt (reset to pending).
   */
  policyVersion?: string;

  /**
   * Disable all persistence (always start fresh).
   * @default false
   */
  disablePersistence?: boolean;

  /**
   * Custom storage key for consent state
   * @default '__trackkit_consent__'
   */
  storageKey?: string;
}

/**
 * Snapshot of current consent state including queued events
 */
export interface ConsentSnapshot extends ConsentStoredState {
  queuedEvents: number;
  droppedEventsDenied: number;
}

export type Listener = (status: ConsentStatus, prev: ConsentStatus) => void;

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
