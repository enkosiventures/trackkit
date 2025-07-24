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
   * Revenue tracking currency
   * @default 'USD'
   */
  revenue?: {
    currency: string;
    trackingEnabled: boolean;
  };
}

/**
 * Plausible event payload
 */
export interface PlausibleEvent {
  // Required fields
  n: string;    // Event name
  u: string;    // URL
  d: string;    // Domain
  r: string;    // Referrer
  w: number;    // Screen width
  h?: number;   // Hash mode
  
  // Optional fields
  m?: Record<string, string | number>; // Meta/props
  p?: string;    // Custom properties (legacy)
  $?: number;    // Revenue amount (cents)
  $$?: string;   // Revenue currency
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