// import type { EventType } from "../../types";
// import { RequiredExcept } from "../../util/types";
// import { BaseProviderOptions } from "../types";

// export type UmamiOptions = BaseProviderOptions & {
//   name: 'umami';

//   /**
//    * Umami website ID (alternative to `site` alias)
//    * @example '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b'
//    */
//   website: string;
// };

// export type ResolvedUmamiOptions = RequiredExcept<UmamiOptions, 'site'>;

// export type UmamiPayload = {
//   website: string;
//   url?: string;
//   name?: string;                         // required for type:'event' ("custom event")
//   data?: Record<string, unknown>;
//   hostname?: string;
//   language?: string;
//   referrer?: string;
//   screen?: string;
//   title?: string;
// }

// export type UmamiSendBody = {
//   type: EventType;
//   payload: UmamiPayload;
// }


// src/providers/umami/types.ts

import type { EventType } from '../../types';
import { RequiredExcept } from '../../util/types';
import { BaseProviderOptions } from '../types';

/**
 * Configuration options for the Umami provider.
 *
 * Extends {@link BaseProviderOptions} with the required `website` ID.
 */
export type UmamiOptions = BaseProviderOptions & {
  /**
   * Provider name discriminator.
   */
  name: 'umami';

  /**
   * Umami website ID (alternative to `site` alias).
   *
   * @example '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b'
   */
  website: string;
};

/**
 * Umami options after normalisation and defaulting.
 *
 * Guarantees that `website` is set and normalised, while `site` remains
 * optional.
 *
 * @internal
 */
export type ResolvedUmamiOptions = RequiredExcept<UmamiOptions, 'site'>;

/**
 * Core Umami payload structure for both pageviews and events.
 */
export type UmamiPayload = {
  /** Website ID. */
  website: string;
  /** URL being tracked. */
  url?: string;
  /** Event name (required for `type: 'event'`). */
  name?: string;
  /** Arbitrary event data. */
  data?: Record<string, unknown>;
  /** Hostname. */
  hostname?: string;
  /** Browser language. */
  language?: string;
  /** Referrer URL. */
  referrer?: string;
  /** Screen resolution. */
  screen?: string;
  /** Document title. */
  title?: string;
};

/**
 * Umami request body shape.
 */
export type UmamiSendBody = {
  /** High-level event type (`'track'`, `'pageview'`, `'identify'`). */
  type: EventType;
  /** Payload containing Umami-specific fields. */
  payload: UmamiPayload;
};
