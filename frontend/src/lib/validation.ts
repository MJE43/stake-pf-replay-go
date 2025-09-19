import { z } from 'zod';

// Base validation schemas
export const seedsSchema = z.object({
  Server: z.string().min(1, 'Server seed is required'),
  Client: z.string().min(1, 'Client seed is required'),
});

export const targetOpSchema = z.enum(['ge', 'gt', 'eq', 'le', 'lt']);

// Game-specific parameter schemas
export const limboParamsSchema = z.object({
  houseEdge: z.number()
    .min(0.01, 'House edge must be at least 0.01')
    .max(1, 'House edge cannot exceed 1')
    .default(0.99)
    .optional(),
});

export const diceParamsSchema = z.object({
  target: z.number().min(0).max(99.99, 'Target must be between 0 and 99.99'),
  condition: z.enum(['over', 'under']),
});

export const rouletteParamsSchema = z.object({
  // Roulette doesn't require additional parameters for basic scanning
});

export const pumpParamsSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert'])
    .default('expert')
    .optional(),
});

// Main scan form schema
export const scanFormSchema = z.object({
  serverSeed: z.string().min(1, 'Server seed is required'),
  clientSeed: z.string().min(1, 'Client seed is required'),
  nonceStart: z.number()
    .int('Nonce start must be an integer')
    .min(0, 'Nonce start must be non-negative'),
  nonceEnd: z.number()
    .int('Nonce end must be an integer')
    .min(0, 'Nonce end must be non-negative'),
  game: z.string().min(1, 'Game selection is required'),
  params: z.record(z.string(), z.any()).default({}),
  targetOp: targetOpSchema,
  targetVal: z.number().min(0, 'Target value must be non-negative'),
  tolerance: z.number().min(0, 'Tolerance must be non-negative').default(0),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(10000, 'Limit cannot exceed 10,000')
    .default(1000),
  timeoutMs: z.number()
    .int('Timeout must be an integer')
    .min(1000, 'Timeout must be at least 1 second')
    .max(3600000, 'Timeout cannot exceed 1 hour')
    .default(300000), // 5 minutes default
}).refine((data) => {
  return data.nonceEnd > data.nonceStart;
}, {
  message: 'Nonce end must be greater than nonce start',
  path: ['nonceEnd'],
}).refine((data) => {
  const nonceRange = data.nonceEnd - data.nonceStart;
  return nonceRange <= 1500000;
}, {
  message: 'Nonce range cannot exceed 1,500,000',
  path: ['nonceEnd'],
});

// Game parameter validation function
export function validateGameParams(game: string, params: any): z.ZodSchema {
  switch (game) {
    case 'limbo':
      return limboParamsSchema;
    case 'dice':
      return diceParamsSchema;
    case 'roulette':
      return rouletteParamsSchema;
    case 'pump':
      return pumpParamsSchema;
    default:
      return z.object({});
  }
}

// Type inference
export type ScanFormData = z.infer<typeof scanFormSchema>;
export type GameParams = {
  limbo: z.infer<typeof limboParamsSchema>;
  dice: z.infer<typeof diceParamsSchema>;
  roulette: z.infer<typeof rouletteParamsSchema>;
  pump: z.infer<typeof pumpParamsSchema>;
};