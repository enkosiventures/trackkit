/**
 * Umami-specific configuration
 */
export interface UmamiConfig {
  /**
   * Website ID from Umami dashboard
   */
  websiteId: string;
  
  /**
   * Umami instance URL
   * @default 'https://cloud.umami.is'
   */
  hostUrl?: string;
  
  /**
   * Automatically track page views
   * @default true
   */
  autoTrack?: boolean;
  
  /**
   * Honor Do Not Track browser setting
   * @default true
   */
  doNotTrack?: boolean;
  
  /**
   * Domains to track (defaults to current domain)
   */
  domains?: string[];
  
  /**
   * Enable cache busting for requests
   * @default false
   */
  cache?: boolean;
  
  /**
   * Error callback for async operations
   * The facade passes its error handler here
   */
  onError?: (error: Error) => void;
}

/**
 * Umami event payload
 */
export interface UmamiPayload {
  website: string;
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  url?: string;
  name?: string;
  data?: Record<string, unknown>;
}
