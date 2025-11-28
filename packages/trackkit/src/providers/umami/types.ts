import type { EventType } from "../../types";
import { RequiredExcept } from "../../util/types";
import { BaseProviderOptions } from "../types";

export type UmamiOptions = BaseProviderOptions & {
  name: 'umami';

  /**
   * Umami website ID (alternative to `site` alias)
   * @example '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b'
   */
  website: string;
};

export type ResolvedUmamiOptions = RequiredExcept<UmamiOptions, 'site'>;

export type UmamiPayload = {
  website: string;
  url?: string;
  name?: string;                         // required for type:'event' ("custom event")
  data?: Record<string, unknown>;
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
}

export type UmamiSendBody = {
  type: EventType;
  payload: UmamiPayload;
}