import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { MAX_QUANTITY } from './cart.types'

export const addItemSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().positive().default(1),
})

export const setQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
})

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) =>
        issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      )
      .join('; ')
    throw new BadRequestException(message)
  }
  return result.data
}
