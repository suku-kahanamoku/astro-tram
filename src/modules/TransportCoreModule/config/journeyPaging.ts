export const journeyPaging = {
  size: 10,
  scanStepMs: 60 * 60 * 1000,
  horizonMs: 24 * 60 * 60 * 1000,
  maxRequests: 24,
  timeoutMs: 25_000,
} as const;
