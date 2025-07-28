/**
 * Plausible configuration
 */
export interface PlausibleConfig {
  /**
   * Your domain as configured in Plausible
   * @example 'example.com'
   */
  domain: string;
  
  /**
   * Plausible API endpoint
   * @default 'https://plausible.io'
   */
  apiHost?: string;
  
  /**
   * Custom event endpoint
   * @default '/api/event'
   */
  eventEndpoint?: string;
  
  /**
   * Track localhost events
   * @default false
   */
  trackLocalhost?: boolean;
  
  /**
   * Hash mode for single-page apps
   * @default false
   */
  hashMode?: boolean;
  
  /**
   * Exclude specific paths from tracking
   */
  exclude?: string[];
  
  /**
   * Custom properties to include with every event
   */
  defaultProps?: Record<string, string>;
  
  /**
   * Revenue tracking configuration
   */
  revenue?: {
    currency: string;
    trackingEnabled: boolean;
  };
  
  /**
   * Error callback for async operations
   * The facade passes its error handler here
   */
  onError?: (error: Error) => void;
}

export interface Revenue {
  amount: number,
  currency: string,
}

/**
 * Plausible event payload
 */
export interface PlausibleEvent {
  // Required fields
  name: string;    // Event name
  url: string;    // URL
  domain: string;    // Domain
  referrer: string;    // Referrer

  // Optional fields
  revenue?: Revenue;    // Revenue amount (cents)
  props?: Record<string, string | number>; // Meta/props
  hashMode?: number;   // Hash mode

  // Are these still valid?
  w?: number;    // Screen width
  // p?: string;    // Custom properties (legacy)
}

/**
 * Plausible goals configuration
 */
export interface PlausibleGoals {
  [goalName: string]: {
    id?: number;
    conversionRate?: boolean;
    revenue?: boolean;
  };
}

/**
 * Plausible API error response
 */
export interface PlausibleError {
  error: string;
  status?: number;
}