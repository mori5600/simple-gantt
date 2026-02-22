import { z } from 'zod';
import { isoDateSchema, isoDateTimeSchema } from './common';

const taskTitleSchema = z.string().trim().min(1, 'title は必須です。');
const taskProgressSchema = z.number().int().min(0).max(100);
const taskNoteSchema = z.string();
const taskAssigneesSchema = z.array(z.string().min(1)).transform((ids) => [...new Set(ids)]);
const predecessorTaskIdSchema = z.string().min(1).nullable();

export const taskSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	title: taskTitleSchema,
	startDate: isoDateSchema,
	endDate: isoDateSchema,
	progress: taskProgressSchema,
	note: taskNoteSchema,
	sortOrder: z.number().int().min(0),
	updatedAt: isoDateTimeSchema,
	assigneeIds: taskAssigneesSchema,
	predecessorTaskId: predecessorTaskIdSchema
});

const taskHistoryActionSchema = z.enum(['created', 'updated', 'deleted']);

export const taskHistoryEntrySchema = z.object({
	id: z.string().min(1),
	taskId: z.string().min(1),
	projectId: z.string().min(1),
	action: taskHistoryActionSchema,
	changedFields: z.array(z.string().min(1)),
	title: taskTitleSchema,
	note: taskNoteSchema,
	startDate: isoDateSchema,
	endDate: isoDateSchema,
	progress: taskProgressSchema,
	assigneeIds: taskAssigneesSchema,
	predecessorTaskId: predecessorTaskIdSchema,
	createdAt: isoDateTimeSchema
});

export const createTaskSchema = z
	.object({
		title: taskTitleSchema,
		startDate: isoDateSchema,
		endDate: isoDateSchema,
		progress: taskProgressSchema,
		note: taskNoteSchema.optional().default(''),
		sortOrder: z.number().int().min(0).optional(),
		assigneeIds: taskAssigneesSchema.optional().default([]),
		predecessorTaskId: predecessorTaskIdSchema.optional().default(null)
	})
	.superRefine((value, ctx) => {
		if (value.startDate > value.endDate) {
			ctx.addIssue({
				code: 'custom',
				path: ['startDate'],
				message: 'startDate は endDate 以下にしてください。'
			});
		}
	});

export const updateTaskSchema = z
	.object({
		updatedAt: isoDateTimeSchema,
		title: taskTitleSchema.optional(),
		startDate: isoDateSchema.optional(),
		endDate: isoDateSchema.optional(),
		progress: taskProgressSchema.optional(),
		note: taskNoteSchema.optional(),
		sortOrder: z.number().int().min(0).optional(),
		assigneeIds: taskAssigneesSchema.optional(),
		predecessorTaskId: predecessorTaskIdSchema.optional()
	})
	.refine(
		(value) =>
			value.title !== undefined ||
			value.startDate !== undefined ||
			value.endDate !== undefined ||
			value.progress !== undefined ||
			value.note !== undefined ||
			value.sortOrder !== undefined ||
			value.assigneeIds !== undefined ||
			value.predecessorTaskId !== undefined,
		{
			message: '更新対象の項目がありません。'
		}
	);

export const reorderTasksSchema = z
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

export type Task = z.infer<typeof taskSchema>;
export type TaskHistoryEntry = z.infer<typeof taskHistoryEntrySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;
