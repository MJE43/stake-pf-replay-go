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

export const plinkoParamsSchema = z.object({
  risk: z.enum(['low', 'medium', 'high']).default('medium'),
  rows: z
    .number()
    .int('Rows must be an integer')
    .min(8, 'Rows must be between 8 and 16')
    .max(16, 'Rows must be between 8 and 16')
    .default(16),
});

export const wheelParamsSchema = z.object({
  segments: z.number()
    .int('Segments must be an integer')
    .refine((v) => [10, 20, 30, 40, 50].includes(v), 'Segments must be 10, 20, 30, 40, or 50')
    .default(10),
  risk: z.enum(['low', 'medium', 'high']).default('low'),
});

export const minesParamsSchema = z.object({
  mineCount: z.number()
    .int('Mine count must be an integer')
    .min(1, 'Mine count must be at least 1')
    .max(24, 'Mine count cannot exceed 24')
    .default(3),
});

export const chickenParamsSchema = z.object({
  bones: z.number()
    .int('Bones must be an integer')
    .min(1, 'Bones must be at least 1')
    .max(20, 'Bones cannot exceed 20')
    .default(1),
});

export const kenoParamsSchema = z.object({
  risk: z.enum(['classic', 'low', 'medium', 'high']).default('classic'),
  picks: z.array(
    z.number().int('Pick must be an integer').min(0, 'Pick must be between 0 and 39').max(39, 'Pick must be between 0 and 39'),
  )
    .min(1, 'Keno requires at least 1 pick')
    .max(10, 'Keno supports up to 10 picks')
    .refine((arr) => new Set(arr).size === arr.length, 'Keno picks must be unique')
    .default([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
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
    case 'plinko':
      return plinkoParamsSchema;
    case 'wheel':
      return wheelParamsSchema;
    case 'mines':
      return minesParamsSchema;
    case 'chicken':
      return chickenParamsSchema;
    case 'keno':
      return kenoParamsSchema;
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
  plinko: z.infer<typeof plinkoParamsSchema>;
  wheel: z.infer<typeof wheelParamsSchema>;
  mines: z.infer<typeof minesParamsSchema>;
  chicken: z.infer<typeof chickenParamsSchema>;
  keno: z.infer<typeof kenoParamsSchema>;
};
