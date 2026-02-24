import { createTaskSchema } from '@simple-gantt/shared/tasks';
import type { CreateTaskInput, User } from '$lib/tasksRepo';

type TaskImportColumnKey =
	| 'taskId'
	| 'title'
	| 'startDate'
	| 'endDate'
	| 'progress'
	| 'assignees'
	| 'predecessorTaskId'
	| 'note';

const COLUMN_ALIASES = {
	taskId: ['タスクID', 'taskId'],
	title: ['タイトル', 'title'],
	startDate: ['開始日', 'startDate'],
	endDate: ['終了日', 'endDate'],
	progress: ['進捗(%)', 'progress'],
	assignees: ['担当者', 'assignees'],
	predecessorTaskId: ['先行タスクID', 'predecessorTaskId'],
	note: ['メモ', 'note']
} as const satisfies Record<TaskImportColumnKey, readonly string[]>;

const REQUIRED_COLUMNS = ['title', 'startDate', 'endDate', 'progress'] as const;

export type TaskImportRow = {
	rowNumber: number;
	taskId: string;
	title: string;
	startDate: string;
	endDate: string;
	progress: string;
	assignees: string;
	predecessorTaskId: string;
	note: string;
};

export type TaskImportDraft = {
	sourceTaskId: string | null;
	predecessorSourceTaskId: string | null;
	createInput: CreateTaskInput;
};

export type TaskImportDraftPlan =
	| {
			kind: 'ready';
			drafts: TaskImportDraft[];
	  }
	| {
			kind: 'missing_assignees';
			missingAssigneeNames: string[];
	  };

export class TaskImportContractError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TaskImportContractError';
	}
}

function assertContract(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new TaskImportContractError(message);
	}
}

function normalizeHeaderToken(value: string): string {
	return value.trim().replace(/\s+/g, '').toLowerCase();
}

function toCellText(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}
	return String(value).trim();
}

function isEmptyRow(cells: readonly string[]): boolean {
	return cells.every((cell) => cell.length === 0);
}

function findColumnIndexMap(headers: readonly string[]): Record<TaskImportColumnKey, number> {
	const normalizedHeaders = headers.map(normalizeHeaderToken);
	const indices = {} as Record<TaskImportColumnKey, number>;

	for (const key of Object.keys(COLUMN_ALIASES) as TaskImportColumnKey[]) {
		const aliases = COLUMN_ALIASES[key].map(normalizeHeaderToken);
		const index = normalizedHeaders.findIndex((token) => aliases.includes(token));
		indices[key] = index;
	}

	for (const key of REQUIRED_COLUMNS) {
		assertContract(indices[key] >= 0, `必須列 "${key}" が見つかりません。`);
	}

	return indices;
}

function toTaskImportRows(table: readonly (readonly unknown[])[]): TaskImportRow[] {
	assertContract(table.length > 0, '取込ファイルにデータがありません。');
	const headerRow = table[0]?.map(toCellText) ?? [];
	assertContract(headerRow.length > 0 && !isEmptyRow(headerRow), 'ヘッダー行が見つかりません。');
	const columnIndices = findColumnIndexMap(headerRow);
	const rows: TaskImportRow[] = [];

	for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
		const cells = (table[rowIndex] ?? []).map(toCellText);
		if (isEmptyRow(cells)) {
			continue;
		}
		const read = (key: TaskImportColumnKey): string => {
			const columnIndex = columnIndices[key];
			if (columnIndex < 0) {
				return '';
			}
			return toCellText(cells[columnIndex]);
		};
		rows.push({
			rowNumber: rowIndex + 1,
			taskId: read('taskId'),
			title: read('title'),
			startDate: read('startDate'),
			endDate: read('endDate'),
			progress: read('progress'),
			assignees: read('assignees'),
			predecessorTaskId: read('predecessorTaskId'),
			note: read('note')
		});
	}

	assertContract(rows.length > 0, '取込対象のデータ行がありません。');
	return rows;
}

function parseCsvTable(csvText: string): string[][] {
	const text = csvText.replace(/^\uFEFF/, '');
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let isInQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		const nextChar = text[index + 1];

		if (isInQuotes) {
			if (char === '"') {
				if (nextChar === '"') {
					cell += '"';
					index += 1;
					continue;
				}
				isInQuotes = false;
				continue;
			}
			cell += char;
			continue;
		}

		if (char === '"') {
			isInQuotes = true;
			continue;
		}
		if (char === ',') {
			row.push(cell);
			cell = '';
			continue;
		}
		if (char === '\r') {
			if (nextChar === '\n') {
				index += 1;
			}
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
			continue;
		}
		if (char === '\n') {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
			continue;
		}
		cell += char;
	}

	assertContract(!isInQuotes, 'CSV の引用符が閉じられていません。');
	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

function normalizeOptionalId(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function parseAssigneeNames(text: string): string[] {
	const normalized = text.trim();
	if (normalized.length === 0 || normalized === '未割り当て') {
		return [];
	}
	return [
		...new Set(
			normalized
				.split(/[、,]/)
				.map((name) => name.trim())
				.filter((name) => name.length > 0)
		)
	];
}

function toUserIdByNameMap(users: readonly User[]): Map<string, string> {
	const userIdByName = new Map<string, string>();
	for (const user of users) {
		const key = user.name.trim();
		assertContract(key.length > 0, '担当者名が空のユーザーは取込に使用できません。');
		assertContract(!userIdByName.has(key), `担当者名 "${key}" が重複しています。`);
		userIdByName.set(key, user.id);
	}
	return userIdByName;
}

function toProgressValue(text: string, rowNumber: number): number {
	const parsed = Number(text.trim());
	assertContract(Number.isInteger(parsed), `行 ${rowNumber}: progress は整数で指定してください。`);
	return parsed;
}

export function parseTaskImportCsv(csvText: string): TaskImportRow[] {
	assertContract(csvText.trim().length > 0, '取込ファイルが空です。');
	return toTaskImportRows(parseCsvTable(csvText));
}

export function parseTaskImportSheetData(
	sheetData: readonly (readonly unknown[])[]
): TaskImportRow[] {
	return toTaskImportRows(sheetData);
}

export async function parseTaskImportFile(file: File): Promise<TaskImportRow[]> {
	const fileName = file.name.toLowerCase();
	if (fileName.endsWith('.csv')) {
		const text = await file.text();
		return parseTaskImportCsv(text);
	}
	if (fileName.endsWith('.xlsx')) {
		const xlsx = await import('xlsx');
		const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' });
		const firstSheetName = workbook.SheetNames[0];
		assertContract(
			typeof firstSheetName === 'string' && firstSheetName.length > 0,
			'XLSX にシートがありません。'
		);
		const firstSheet = workbook.Sheets[firstSheetName];
		assertContract(Boolean(firstSheet), 'XLSX シートの読み込みに失敗しました。');
		const sheetData = xlsx.utils.sheet_to_json(firstSheet, {
			header: 1,
			raw: false,
			defval: ''
		}) as unknown[][];
		return parseTaskImportSheetData(sheetData);
	}
	throw new TaskImportContractError('取込可能な形式は CSV / XLSX のみです。');
}

type ValidatedImportRow = {
	rowNumber: number;
	sourceTaskId: string | null;
	predecessorSourceTaskId: string | null;
	assigneeNames: string[];
	baseCreateInput: CreateTaskInput;
};

function toValidatedImportRows(rows: readonly TaskImportRow[]): ValidatedImportRow[] {
	assertContract(rows.length > 0, '取込対象のタスクがありません。');
	const seenSourceTaskIds = new Set<string>();

	return rows.map((row) => {
		const sourceTaskId = normalizeOptionalId(row.taskId);
		if (sourceTaskId) {
			assertContract(
				!seenSourceTaskIds.has(sourceTaskId),
				`行 ${row.rowNumber}: taskId "${sourceTaskId}" が重複しています。`
			);
			seenSourceTaskIds.add(sourceTaskId);
		}

		const predecessorSourceTaskId = normalizeOptionalId(row.predecessorTaskId);
		if (sourceTaskId && predecessorSourceTaskId === sourceTaskId) {
			throw new TaskImportContractError(
				`行 ${row.rowNumber}: 先行タスクに自分自身は指定できません。`
			);
		}

		const parsed = createTaskSchema.safeParse({
			title: row.title,
			startDate: row.startDate,
			endDate: row.endDate,
			progress: toProgressValue(row.progress, row.rowNumber),
			note: row.note,
			assigneeIds: [],
			predecessorTaskId: null
		});
		assertContract(
			parsed.success,
			`行 ${row.rowNumber}: ${parsed.error?.issues[0]?.message ?? '入力値が不正です。'}`
		);

		return {
			rowNumber: row.rowNumber,
			sourceTaskId,
			predecessorSourceTaskId,
			assigneeNames: parseAssigneeNames(row.assignees),
			baseCreateInput: parsed.data
		};
	});
}

function assertPredecessorReferencesExist(params: {
	validatedRows: readonly ValidatedImportRow[];
	existingTaskIds: ReadonlySet<string>;
}): void {
	const importedIds = new Set(
		params.validatedRows
			.map((row) => row.sourceTaskId)
			.filter((value): value is string => typeof value === 'string')
	);

	for (const row of params.validatedRows) {
		const predecessorId = row.predecessorSourceTaskId;
		if (!predecessorId) {
			continue;
		}
		if (importedIds.has(predecessorId) || params.existingTaskIds.has(predecessorId)) {
			continue;
		}
		throw new TaskImportContractError(
			`行 ${row.rowNumber}: 先行タスクID "${predecessorId}" が見つかりません。`
		);
	}
}

function collectMissingAssigneeNames(
	validatedRows: readonly ValidatedImportRow[],
	userIdByName: ReadonlyMap<string, string>
): string[] {
	const missing = new Set<string>();
	for (const row of validatedRows) {
		for (const assigneeName of row.assigneeNames) {
			if (!userIdByName.has(assigneeName)) {
				missing.add(assigneeName);
			}
		}
	}
	return [...missing].sort((left, right) => left.localeCompare(right, 'ja'));
}

export function planTaskImportDrafts(params: {
	rows: readonly TaskImportRow[];
	users: readonly User[];
	existingTaskIds: ReadonlySet<string>;
	allowMissingAssignees?: boolean;
}): TaskImportDraftPlan {
	const { rows, users, existingTaskIds, allowMissingAssignees = false } = params;
	const userIdByName = toUserIdByNameMap(users);
	const validatedRows = toValidatedImportRows(rows);

	assertPredecessorReferencesExist({
		validatedRows,
		existingTaskIds
	});

	const missingAssigneeNames = collectMissingAssigneeNames(validatedRows, userIdByName);
	if (missingAssigneeNames.length > 0) {
		if (allowMissingAssignees) {
			return {
				kind: 'missing_assignees',
				missingAssigneeNames
			};
		}
		throw new TaskImportContractError(`担当者が未登録です: ${missingAssigneeNames.join(', ')}`);
	}

	const drafts = validatedRows.map((row) => {
		const assigneeIds = row.assigneeNames.map((name) => {
			const userId = userIdByName.get(name);
			assertContract(
				typeof userId === 'string',
				`行 ${row.rowNumber}: 担当者 "${name}" が存在しません。`
			);
			return userId;
		});
		return {
			sourceTaskId: row.sourceTaskId,
			predecessorSourceTaskId: row.predecessorSourceTaskId,
			createInput: {
				...row.baseCreateInput,
				assigneeIds
			}
		} satisfies TaskImportDraft;
	});

	return {
		kind: 'ready',
		drafts
	};
}

export function toTaskImportDrafts(params: {
	rows: readonly TaskImportRow[];
	users: readonly User[];
	existingTaskIds: ReadonlySet<string>;
}): TaskImportDraft[] {
	const plan = planTaskImportDrafts({
		rows: params.rows,
		users: params.users,
		existingTaskIds: params.existingTaskIds,
		allowMissingAssignees: false
	});
	assertContract(plan.kind === 'ready', '取込計画の構築に失敗しました。');
	return plan.drafts;
}
