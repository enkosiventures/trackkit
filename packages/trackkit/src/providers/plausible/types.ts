import { RequiredExcept } from "../../util/types";
import { BaseProviderOptions } from "../types";

export type PlausibleOptions = BaseProviderOptions & {
  name: 'plausible';

  /**
   * Default properties for all events (Plausible)
   */
  defaultProps?: Record<string, string>;

  /**
   * Plausible domain to track (alternative to `site` alias)
   * @example 'example.com'
   */
  domain: string;

  /**
   * Revenue tracking configuration (Plausible)
   */
  revenue?: { currency: string; trackingEnabled: boolean };
};

export type ResolvedPlausibleOptions = RequiredExcept<PlausibleOptions, 'defaultProps' | 'revenue' | 'site'>;

export type Revenue = {
  amount: number | string,
  currency: string,
}

/**
 * Plausible event payload
 */
export type PlausibleEventPayload = {
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
