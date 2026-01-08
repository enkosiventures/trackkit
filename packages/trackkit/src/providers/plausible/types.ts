import { RequiredExcept } from '../../util/types';
import { BaseProviderOptions } from '../types';

/**
 * Configuration options for the Plausible provider.
 *
 * Extends {@link BaseProviderOptions} with Plausible-specific fields such as
 * the tracked domain and optional revenue tracking.
 */
export type PlausibleOptions = BaseProviderOptions & {
  /**
   * Provider name discriminator.
   */
  name: 'plausible';

  /**
   * Default properties for all events (Plausible).
   *
   * These are merged into each event’s `props` object unless overridden.
   */
  defaultProps?: Record<string, string | undefined>;

  /**
   * Plausible domain to track (alternative to `site` alias).
   *
   * @example 'example.com'
   */
  domain?: string;

  /**
   * Revenue tracking configuration (Plausible).
   */
  revenue?: { currency: string; trackingEnabled: boolean };
};

/**
 * Plausible options after normalisation and defaulting.
 *
 * Ensures required fields are set while remaining optional fields are
 * preserved as-is.
 *
 * @internal
 */
export type ResolvedPlausibleOptions = RequiredExcept<
  PlausibleOptions,
  'defaultProps' | 'revenue' | 'site'
>;

/**
 * Revenue payload used in Plausible events.
 */
export type Revenue = {
  amount: number | string;
  currency: string;
};

/**
 * Plausible event payload sent to `/api/event`.
 */
export type PlausibleEventPayload = {
  // Required fields
  /** Event name. */
  name: string;
  /** URL associated with the event. */
  url: string;
  /** Tracked domain. */
  domain: string;

  // Optional fields
  /** Referrer URL. */
  referrer?: string;
  /** Custom properties attached to the event. */
  props?: Record<string, string | number>;
  /** Revenue information (if revenue tracking enabled). */
  revenue?: Revenue;
  /** Whether the event was triggered by user interaction. */
  interactive?: boolean;
};
