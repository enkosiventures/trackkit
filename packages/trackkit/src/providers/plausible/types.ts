export type PlausibleOptions =  {
  provider: 'plausible';
  site?: string;
  domain: string;
  host?: string;
  revenue?: { currency: string; trackingEnabled: boolean };
};

export interface Revenue {
  amount: number | string,
  currency: string,
}

/**
 * Plausible event payload
 */
export interface PlausibleEventPayload {
  // Required fields
  name: string;    // Event name
  url: string;    // URL
  domain: string;    // Domain

  // Optional fields
  referrer?: string;    // Referrer
  props?: Record<string, string | number>; // Meta/props
  revenue?: Revenue;    // Revenue amount (cents)
  interactive?: boolean; // Whether the event was triggered by user interaction
}
