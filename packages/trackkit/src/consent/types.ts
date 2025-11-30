// /**
//  * Core consent state
//  */
// export type ConsentStatus = 'pending' | 'granted' | 'denied';

// export type ConsentCategory = 'essential' | 'analytics' | 'marketing' | 'preferences' | 'functional';

// /**
//  * Consent state with metadata
//  */
// export interface ConsentStoredState {
//   /**
//    * Current consent status
//    */
//   status: ConsentStatus;
  
//   /**
//    * Optional consent version for policy updates
//    */
//   version?: string;
  
//   /**
//    * How consent was obtained (for audit trails)
//    */
//   method?: 'explicit' | 'implicit';
// }

// /**
//  * Consent options for configuring consent manager behavior.
//  */
// export interface ConsentOptions {
//   /** 
//    * Initial consent status.
//    */
//   initialStatus?: ConsentStatus;

//   /**
//    * If true we start as 'pending' and *require* an explicit call to grant.
//    * If false we auto‑grant on first track (implicit consent).
//    */
//   requireExplicit?: boolean;

//   /**
//    * Determine if we allow essential events when consent is denied
//    */
//   allowEssentialOnDenied?: boolean;
  
//   /**
//    * Current policy/version. If stored version < this => re‑prompt (reset to pending).
//    */
//   policyVersion?: string;

//   /**
//    * Disable all persistence (always start fresh).
//    */
//   disablePersistence?: boolean;

//   /**
//    * Custom storage key for consent state
//    */
//   storageKey?: string;
// }

// export interface ResolvedConsentOptions extends Required<Omit<ConsentOptions,'policyVersion'>> {
//   policyVersion?: string;
// }

// export type Listener = (status: ConsentStatus, prev: ConsentStatus) => void;

// /**
//  * Event classification for future extensibility
//  */
// export interface EventClassification {
//   /**
//    * Event category (default: 'analytics')
//    */
//   category?: string;
  
//   /**
//    * Whether event requires consent
//    */
//   requiresConsent?: boolean;
// }



/**
 * High-level consent status for a user.
 *
 * - `'pending'` – user has not made a choice yet.
 * - `'granted'` – user has actively or implicitly granted consent.
 * - `'denied'` – user has denied consent.
 */
export type ConsentStatus = 'pending' | 'granted' | 'denied';

/**
 * Logical consent categories used by Trackkit.
 *
 * These map to provider consent requirements and event classification.
 *
 * - `'essential'`   – strictly necessary events (e.g. security, core UX).
 * - `'analytics'`   – usage analytics and metrics.
 * - `'marketing'`   – advertising and remarketing.
 * - `'preferences'` – user preference storage beyond essential needs.
 * - `'functional'`  – additional functionality that is not strictly required.
 */
export type ConsentCategory =
  | 'essential'
  | 'analytics'
  | 'marketing'
  | 'preferences'
  | 'functional';

/**
 * Persisted consent state with optional metadata.
 *
 * This is the shape stored in local storage (or similar) when persistence
 * is enabled.
 */
export interface ConsentStoredState {
  /**
   * Current consent status.
   */
  status: ConsentStatus;

  /**
   * Optional consent policy/version identifier.
   *
   * When the stored version is older than the active
   * {@link ConsentOptions.policyVersion}, the consent manager may reset
   * status to `'pending'` and re-prompt the user.
   */
  version?: string;

  /**
   * How consent was obtained, for audit trails.
   *
   * - `'explicit'` – e.g. banner/checkbox.
   * - `'implicit'` – e.g. inferred from continued use.
   */
  method?: 'explicit' | 'implicit';
}

/**
 * High-level configuration for the consent manager.
 *
 * These options control:
 * - how initial consent is derived,
 * - whether explicit action is required,
 * - and how persistence/versioning behaves.
 */
export interface ConsentOptions {
  /**
   * Initial consent status when no stored state exists.
   *
   * If omitted, Trackkit will derive an appropriate default based on
   * {@link ConsentOptions.requireExplicit} and other settings.
   */
  initialStatus?: ConsentStatus;

  /**
   * If `true`, the consent manager starts as `'pending'` and requires an
   * explicit grant call.
   *
   * If `false`, consent may be auto-granted on first track (implicit
   * consent) depending on your policy.
   */
  requireExplicit?: boolean;

  /**
   * When `true`, essential events may still be allowed when consent is
   * explicitly denied.
   *
   * This typically covers things like security logging and critical
   * operational telemetry.
   */
  allowEssentialOnDenied?: boolean;

  /**
   * Current policy/version identifier.
   *
   * If a stored {@link ConsentStoredState.version} is less than this, the
   * manager should re-prompt (by resetting status to `'pending'`).
   */
  policyVersion?: string;

  /**
   * Disable all persistence.
   *
   * When `true`, consent state is never written to storage and always
   * starts from {@link ConsentOptions.initialStatus} on each page load.
   */
  disablePersistence?: boolean;

  /**
   * Custom storage key to use when persisting consent state.
   *
   * Useful when running multiple independent consent managers or when
   * migrating from a legacy key.
   */
  storageKey?: string;
}

/**
 * Fully resolved consent options with defaults applied.
 *
 * All fields except `policyVersion` are required internally.
 *
 * @see ConsentOptions
 * @internal
 */
export interface ResolvedConsentOptions
  extends Required<Omit<ConsentOptions, 'policyVersion'>> {
  policyVersion?: string;
}

/**
 * Listener callback for consent state changes.
 *
 * @param status - New consent status.
 * @param prev   - Previous consent status.
 *
 * @internal
 */
export type Listener = (status: ConsentStatus, prev: ConsentStatus) => void;

/**
 * Classification metadata for individual events.
 *
 * Used by the consent gate to decide whether an event:
 * - requires consent,
 * - is essential,
 * - or can be emitted regardless of consent status.
 */
export interface EventClassification {
  /**
   * Event category label (defaults to `'analytics'` when omitted).
   *
   * This is a free-form label but often maps to a
   * {@link ConsentCategory} in your policy.
   */
  category?: string;

  /**
   * Whether this event requires consent to be emitted.
   *
   * When `true`, the event is blocked unless consent has been granted
   * for the relevant category. When `false`, it can be sent regardless
   * of consent state.
   */
  requiresConsent?: boolean;
}
