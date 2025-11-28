import { BaseProviderOptions } from "../types";


/** Normalized alias: accept `site` at input, but canonicalize below and drop `site`. */
export type NoopOptions = BaseProviderOptions & {
  name: 'noop';
};

export type ResolvedNoopOptions = { name: 'noop'; };