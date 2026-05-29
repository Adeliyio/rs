export const AI_CONFIG = {
  generation: {
    model: 'gpt-4o-2024-08-06',
    maxTokens: 4096,
    temperature: 0.3,
  },
  extraction: {
    model: 'gpt-4o-2024-08-06',
    maxTokens: 2048,
    temperature: 0.1,
  },
  lawMonitor: {
    model: 'gpt-4o-2024-08-06',
    maxTokens: 2048,
    temperature: 0.1,
  },
} as const;
