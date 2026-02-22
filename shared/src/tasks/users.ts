import { z } from 'zod';
import { isoDateTimeSchema } from './common';

const userNameSchema = z.string().trim().min(1, 'name は必須です。');

export const userSchema = z.object({
	id: z.string().min(1),
	name: userNameSchema,
	updatedAt: isoDateTimeSchema
});

export const userSummarySchema = userSchema.extend({
	taskCount: z.number().int().min(0)
});

export const createUserSchema = z.object({
	name: userNameSchema
});

export const updateUserSchema = z
	.object({
		updatedAt: isoDateTimeSchema,
		name: userNameSchema.optional()
	})
	.refine((value) => value.name !== undefined, {
		message: '更新対象の項目がありません。'
	});

export type User = z.infer<typeof userSchema>;
export type UserSummary = z.infer<typeof userSummarySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
