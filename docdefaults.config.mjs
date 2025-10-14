/** @type {import('@trackkit/dev-docdefaults').DocDefaultsConfig} */
export default {
  defaults: 'src/constants.ts',
  tsconfig: 'tsconfig.build.json',
  targets: [
    {
      types: 'src/consent/types.ts',
      interface: 'ConsentOptions',
      member: 'CONSENT_DEFAULTS',
    },
    {
      types: 'src/dispatcher/types.ts',
      interface: 'RetryOptions',
      member: 'RETRY_DEFAULTS',
    },
    {
      types: 'src/dispatcher/types.ts',
      interface: 'BatchingOptions',
      member: 'BATCHING_DEFAULTS',
    },
    {
      types: 'src/dispatcher/types.ts',
      interface: 'ConnectionOptions',
      member: 'CONNECTION_DEFAULTS',
    },
    {
      types: 'src/dispatcher/types.ts',
      interface: 'PerformanceOptions',
      member: 'PERFORMANCE_DEFAULTS',
    },
    {
      types: 'src/dispatcher/types.ts',
      interface: 'ResilienceOptions',
      member: 'RESILIENCE_DEFAULTS',
    },
  ],
};
