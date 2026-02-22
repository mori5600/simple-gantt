import { z } from 'zod';
import { isoDateTimeSchema } from './common';

const projectNameSchema = z.string().trim().min(1, 'name は必須です。');

export const projectSchema = z.object({
	id: z.string().min(1),
	name: projectNameSchema,
	sortOrder: z.number().int().min(0),
	updatedAt: isoDateTimeSchema
});

export const projectSummarySchema = projectSchema.extend({
	taskCount: z.number().int().min(0)
});

export const createProjectSchema = z.object({
	name: projectNameSchema
});

export const updateProjectSchema = z
	.object({
		updatedAt: isoDateTimeSchema,
		name: projectNameSchema.optional()
	})
	.refine((value) => value.name !== undefined, {
		message: '更新対象の項目がありません。'
	});

export const reorderProjectsSchema = z
	.object({
		ids: z.array(z.string().min(1)).min(1)
	})
	.superRefine((value, ctx) => {
		if (new Set(value.ids).size !== value.ids.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['ids'],
				message: 'ids に重複があります。'
			});
		}
	});

export type Project = z.infer<typeof projectSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ReorderProjectsInput = z.infer<typeof reorderProjectsSchema>;
