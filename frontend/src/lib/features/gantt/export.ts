import type { Task, User } from '$lib/tasksRepo';

type ExportCellValue = string | number;

export type TaskExportContext = {
	projectId: string;
	projectName: string;
	tasks: readonly Task[];
	users: readonly User[];
};

export type TaskExportRow = {
	projectId: string;
	projectName: string;
	taskId: string;
	title: string;
	startDate: string;
	endDate: string;
	progress: number;
	assignees: string;
	predecessorTaskId: string;
	predecessorTaskTitle: string;
	note: string;
	updatedAt: string;
};

export const TASK_EXPORT_COLUMNS = [
	{ key: 'projectId', label: 'プロジェクトID' },
	{ key: 'projectName', label: 'プロジェクト名' },
	{ key: 'taskId', label: 'タスクID' },
	{ key: 'title', label: 'タイトル' },
	{ key: 'startDate', label: '開始日' },
	{ key: 'endDate', label: '終了日' },
	{ key: 'progress', label: '進捗(%)' },
	{ key: 'assignees', label: '担当者' },
	{ key: 'predecessorTaskId', label: '先行タスクID' },
	{ key: 'predecessorTaskTitle', label: '先行タスク名' },
	{ key: 'note', label: 'メモ' },
	{ key: 'updatedAt', label: '更新日時' }
] as const satisfies readonly { key: keyof TaskExportRow; label: string }[];

const CSV_CONTENT_TYPE = 'text/csv;charset=utf-8';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function escapeCsvCell(value: ExportCellValue): string {
	const text = String(value);
	if (!/[",\r\n]/.test(text)) {
		return text;
	}
	return `"${text.replaceAll('"', '""')}"`;
}

function formatTimestamp(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	const second = String(date.getSeconds()).padStart(2, '0');
	return `${year}${month}${day}-${hour}${minute}${second}`;
}

function sanitizeFileNamePart(value: string): string {
	const sanitized = value
		.trim()
		.replace(/[\\/:*?"<>|]+/g, '-')
		.replace(/\s+/g, '_')
		.replace(/-+/g, '-')
		.replace(/^[-_]+|[-_]+$/g, '')
		.slice(0, 48);

	return sanitized.length > 0 ? sanitized : 'project';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
	if (typeof document === 'undefined') {
		throw new Error('ダウンロードはブラウザでのみ利用できます。');
	}
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.style.display = 'none';
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

export function buildTaskExportFileBaseName(projectName: string, now: Date = new Date()): string {
	const safeProjectName = sanitizeFileNamePart(projectName);
	return `tasks-${safeProjectName}-${formatTimestamp(now)}`;
}

export function toTaskExportRows(context: TaskExportContext): TaskExportRow[] {
	const assigneeNameById = new Map(context.users.map((user) => [user.id, user.name]));
	const titleByTaskId = new Map(context.tasks.map((task) => [task.id, task.title]));

	return context.tasks.map((task) => {
		const assigneeNames = task.assigneeIds
			.map((assigneeId) => assigneeNameById.get(assigneeId) ?? assigneeId)
			.join(', ');
		const predecessorTaskId = task.predecessorTaskId ?? '';
		return {
			projectId: context.projectId,
			projectName: context.projectName,
			taskId: task.id,
			title: task.title,
			startDate: task.startDate,
			endDate: task.endDate,
			progress: task.progress,
			assignees: assigneeNames.length > 0 ? assigneeNames : '未割り当て',
			predecessorTaskId,
			predecessorTaskTitle: predecessorTaskId ? (titleByTaskId.get(predecessorTaskId) ?? '') : '',
			note: task.note,
			updatedAt: task.updatedAt
		};
	});
}

export function toTaskExportCsv(rows: readonly TaskExportRow[]): string {
	const lines = [
		TASK_EXPORT_COLUMNS.map((column) => escapeCsvCell(column.label)).join(','),
		...rows.map((row) =>
			TASK_EXPORT_COLUMNS.map((column) => escapeCsvCell(row[column.key])).join(',')
		)
	];
	return `\uFEFF${lines.join('\r\n')}`;
}

export function toTaskExportSheetData(rows: readonly TaskExportRow[]): ExportCellValue[][] {
	return [
		TASK_EXPORT_COLUMNS.map((column) => column.label),
		...rows.map((row) => TASK_EXPORT_COLUMNS.map((column) => row[column.key]))
	];
}

export function exportTasksAsCsv(context: TaskExportContext, now: Date = new Date()): string {
	const rows = toTaskExportRows(context);
	const csvText = toTaskExportCsv(rows);
	const filename = `${buildTaskExportFileBaseName(context.projectName, now)}.csv`;
	const blob = new Blob([csvText], { type: CSV_CONTENT_TYPE });
	triggerBlobDownload(blob, filename);
	return filename;
}

export async function exportTasksAsXlsx(
	context: TaskExportContext,
	now: Date = new Date()
): Promise<string> {
	const xlsx = await import('xlsx');
	const rows = toTaskExportRows(context);
	const sheetData = toTaskExportSheetData(rows);
	const workbook = xlsx.utils.book_new();
	const worksheet = xlsx.utils.aoa_to_sheet(sheetData);
	xlsx.utils.book_append_sheet(workbook, worksheet, 'Tasks');
	const bytes = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' });
	const filename = `${buildTaskExportFileBaseName(context.projectName, now)}.xlsx`;
	const blob = new Blob([bytes], { type: XLSX_CONTENT_TYPE });
	triggerBlobDownload(blob, filename);
	return filename;
}
