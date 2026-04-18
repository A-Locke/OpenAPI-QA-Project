import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  /** Machine-readable error code (e.g. VALIDATION_ERROR, NOT_FOUND) */
  error: z.string(),
  /** Human-readable description */
  message: z.string(),
  /** Optional additional context */
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
