// import { z } from 'zod';
// import { DEFAULT_PROVIDER, FACADE_BASE_DEFAULTS, CONSENT_DEFAULTS, RESILIENCE_DEFAULTS } from '../constants';
// import type { ProviderType } from '../types';

// const ProviderEnum = z.enum(['umami', 'plausible', 'ga4', 'noop'] satisfies ProviderType[]);

// const ConsentSchema = z.object({
//   initialStatus: z.enum(['pending', 'granted', 'denied']).default(CONSENT_DEFAULTS.initialStatus),
//   requireExplicit: z.boolean().default(CONSENT_DEFAULTS.requireExplicit),
//   allowEssentialOnDenied: z.boolean().default(CONSENT_DEFAULTS.allowEssentialOnDenied),
//   disablePersistence: z.boolean().default(CONSENT_DEFAULTS.disablePersistence),
//   storageKey: z.string().default(CONSENT_DEFAULTS.storageKey),
//   policyVersion: z.string().optional(),
// });

// const ResilienceSchema = z.object({
//   detectBlockers: z.boolean().default(RESILIENCE_DEFAULTS.detectBlockers),
//   fallbackStrategy: z.enum(['proxy', 'beacon', 'none']).default(RESILIENCE_DEFAULTS.fallbackStrategy),
//   proxy: z
//     .object({
//       proxyUrl: z.string().url(),
//       token: z.string().optional(),
//       headers: z.record(z.string()).optional(),
//     })
//     .optional(),
// });

// export const TrackkitConfigSchema = z.object({
//   provider: ProviderEnum.default(DEFAULT_PROVIDER),
//   site: z.string().optional(),
//   host: z.string().url().optional(),

//   autoTrack: z.boolean().default(FACADE_BASE_DEFAULTS.autoTrack),
//   includeHash: z.boolean().default(FACADE_BASE_DEFAULTS.includeHash),
//   trackLocalhost: z.boolean().default(FACADE_BASE_DEFAULTS.trackLocalhost),
//   doNotTrack: z.boolean().default(FACADE_BASE_DEFAULTS.doNotTrack),

//   queueSize: z.number().int().positive().default(FACADE_BASE_DEFAULTS.queueSize),
//   batchSize: z.number().int().positive().default(FACADE_BASE_DEFAULTS.batchSize),
//   batchTimeout: z.number().int().positive().default(FACADE_BASE_DEFAULTS.batchTimeout),

//   domains: z.array(z.string()).optional(),
//   exclude: z.array(z.string()).optional(),

//   consent: ConsentSchema.default(CONSENT_DEFAULTS),
//   resilience: ResilienceSchema.default(RESILIENCE_DEFAULTS),

//   debug: z.boolean().default(FACADE_BASE_DEFAULTS.debug),
//   onError: z.function().optional(), // this will be refined or left out of schema – see below
// });