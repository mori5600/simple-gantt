import type {
	CreateProjectInput,
	CreateTaskInput,
	CreateUserInput,
	Project,
	ProjectSummary,
	Task,
	TasksRepo,
	UpdateProjectInput,
	UpdateTaskInput,
	UpdateUserInput,
	User,
	UserSummary
} from '$lib/tasksRepo';

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_INITIAL_UPDATED_AT = new Date().toISOString();

export const LOCAL_PROJECTS: readonly Project[] = [
	{
		id: 'project-default',
		name: 'Default Project',
		sortOrder: 0,
		updatedAt: LOCAL_INITIAL_UPDATED_AT
	},
	{
		id: 'project-mobile',
		name: 'Mobile App',
		sortOrder: 1,
		updatedAt: LOCAL_INITIAL_UPDATED_AT
	}
];

export const LOCAL_USERS: readonly User[] = [
	{ id: 'user-ito', name: '伊藤', updatedAt: LOCAL_INITIAL_UPDATED_AT },
	{ id: 'user-sato', name: '佐藤', updatedAt: LOCAL_INITIAL_UPDATED_AT },
	{ id: 'user-yamada', name: '山田', updatedAt: LOCAL_INITIAL_UPDATED_AT },
	{ id: 'user-suzuki', name: '鈴木', updatedAt: LOCAL_INITIAL_UPDATED_AT }
];

let taskCache: Task[] | null = null;
let projectCache: Project[] | null = null;
let userCache: User[] | null = null;

function toIsoDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function fromIsoDate(value: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function addDays(value: string, days: number): string {
	const date = fromIsoDate(value);
	date.setUTCDate(date.getUTCDate() + days);
	return toIsoDate(date);
}

function isValidDateString(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}

	const match = DATE_REGEX.exec(value);
	if (!match) {
		return false;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));

	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

function clampProgress(progress: number): number {
	return Math.min(100, Math.max(0, Math.round(progress)));
}

function nowIsoTimestamp(): string {
	return new Date().toISOString();
}

function sortTasks(tasks: Task[]): Task[] {
	return [...tasks].sort(
		(a, b) =>
			a.projectId.localeCompare(b.projectId) ||
			a.sortOrder - b.sortOrder ||
			a.startDate.localeCompare(b.startDate) ||
			a.id.localeCompare(b.id)
	);
}

function sortProjects(projects: Project[]): Project[] {
	return [...projects].sort(
		(a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
	);
}

function sortUsers(users: User[]): User[] {
	return [...users].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function cloneTask(task: Task): Task {
	return {
		...task,
		note: task.note,
		updatedAt: task.updatedAt,
		assigneeIds: [...task.assigneeIds],
		predecessorTaskId: task.predecessorTaskId
	};
}

function cloneProject(project: Project): Project {
	return { ...project };
}

function cloneProjectSummary(summary: ProjectSummary): ProjectSummary {
	return { ...summary };
}

function cloneUser(user: User): User {
	return { ...user };
}

function cloneUserSummary(summary: UserSummary): UserSummary {
	return { ...summary };
}

function currentUserIdSet(): Set<string> {
	return new Set(ensureUsersData().map((user) => user.id));
}

function buildProjectSummaries(projects: Project[], tasks: Task[]): ProjectSummary[] {
	const countByProjectId = new Map<string, number>();
	for (const task of tasks) {
		countByProjectId.set(task.projectId, (countByProjectId.get(task.projectId) ?? 0) + 1);
	}

	return sortProjects(projects).map((project) => ({
		...project,
		taskCount: countByProjectId.get(project.id) ?? 0
	}));
}

function buildUserSummaries(users: User[], tasks: Task[]): UserSummary[] {
	const countByUserId = new Map<string, number>();
	for (const task of tasks) {
		for (const userId of task.assigneeIds) {
			countByUserId.set(userId, (countByUserId.get(userId) ?? 0) + 1);
		}
	}

	return sortUsers(users).map((user) => ({
		...user,
		taskCount: countByUserId.get(user.id) ?? 0
	}));
}

function normalizeAssigneeIds(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const userIdSet = currentUserIdSet();
	const ids = value.filter(
		(item): item is string => typeof item === 'string' && userIdSet.has(item)
	);
	return [...new Set(ids)];
}

function normalizePredecessorTaskId(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function assertProjectExists(projectId: string): void {
	if (!ensureProjectsData().some((project) => project.id === projectId)) {
		throw new Error(`project not found: ${projectId}`);
	}
}

function nextProjectSortOrder(projects: Project[]): number {
	if (projects.length === 0) {
		return 0;
	}
	return Math.max(...projects.map((project) => project.sortOrder)) + 1;
}

function nextSortOrder(tasks: Task[], projectId: string): number {
	const sortOrders = tasks
		.filter((task) => task.projectId === projectId)
		.map((task) => task.sortOrder);
	if (sortOrders.length === 0) {
		return 0;
	}
	return Math.max(...sortOrders) + 1;
}

function listProjectTasks(tasks: Task[], projectId: string): Task[] {
	return sortTasks(tasks)
		.filter((task) => task.projectId === projectId)
		.map(cloneTask);
}

function assertTaskFields(task: {
	id: string;
	projectId: string;
	title: string;
	note: string;
	startDate: string;
	endDate: string;
	progress: number;
	assigneeIds: string[];
	predecessorTaskId: string | null;
}): void {
	if (task.title.trim().length === 0) {
		throw new Error('title is required');
	}
	if (!isValidDateString(task.startDate) || !isValidDateString(task.endDate)) {
		throw new Error('date must be in YYYY-MM-DD format');
	}
	if (task.startDate > task.endDate) {
		throw new Error('startDate must be earlier than or equal to endDate');
	}
	if (!Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100) {
		throw new Error('progress must be between 0 and 100');
	}
	const userIdSet = currentUserIdSet();
	if (!task.assigneeIds.every((id) => userIdSet.has(id))) {
		throw new Error('assigneeIds include unknown user');
	}
	if (!task.predecessorTaskId) {
		return;
	}

	if (task.predecessorTaskId === task.id) {
		throw new Error('先行タスクに自分自身は指定できません。');
	}

	const predecessor = ensureData().find(
		(candidate) => candidate.projectId === task.projectId && candidate.id === task.predecessorTaskId
	);
	if (!predecessor) {
		throw new Error('先行タスクが見つかりません。');
	}

	const visited = new Set<string>([task.id]);
	let cursor: string | null = task.predecessorTaskId;
	const tasks = ensureData();
	while (cursor) {
		if (visited.has(cursor)) {
			throw new Error('依存関係が循環しています。');
		}
		visited.add(cursor);
		const next = tasks.find(
			(candidate) => candidate.projectId === task.projectId && candidate.id === cursor
		);
		cursor = next?.predecessorTaskId ?? null;
	}
}

function createTaskId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `task-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function createProjectId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `project-${crypto.randomUUID()}`;
	}
	return `project-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function createUserId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `user-${crypto.randomUUID()}`;
	}
	return `user-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function createDefaultTasks(): Task[] {
	const today = toIsoDate(new Date());
	const updatedAt = nowIsoTimestamp();
	return [
		{
			id: 'task-discovery',
			projectId: 'project-default',
			title: '要件確認',
			note: '初回ヒアリングのメモを整理する',
			startDate: addDays(today, -2),
			endDate: addDays(today, 1),
			progress: 100,
			sortOrder: 0,
			updatedAt,
			assigneeIds: ['user-ito'],
			predecessorTaskId: null
		},
		{
			id: 'task-ui',
			projectId: 'project-default',
			title: 'UI実装',
			note: '',
			startDate: addDays(today, 1),
			endDate: addDays(today, 4),
			progress: 40,
			sortOrder: 1,
			updatedAt,
			assigneeIds: ['user-sato', 'user-yamada'],
			predecessorTaskId: 'task-discovery'
		},
		{
			id: 'task-api',
			projectId: 'project-mobile',
			title: 'API接続',
			note: '',
			startDate: addDays(today, 1),
			endDate: addDays(today, 5),
			progress: 20,
			sortOrder: 0,
			updatedAt,
			assigneeIds: ['user-yamada'],
			predecessorTaskId: null
		},
		{
			id: 'task-check',
			projectId: 'project-mobile',
			title: '結合確認',
			note: '',
			startDate: addDays(today, 5),
			endDate: addDays(today, 7),
			progress: 0,
			sortOrder: 1,
			updatedAt,
			assigneeIds: ['user-suzuki'],
			predecessorTaskId: 'task-api'
		}
	];
}

function ensureProjectsData(): Project[] {
	if (!projectCache) {
		projectCache = sortProjects(LOCAL_PROJECTS.map(cloneProject));
	}
	return projectCache;
}

function ensureUsersData(): User[] {
	if (!userCache) {
		userCache = sortUsers(LOCAL_USERS.map(cloneUser));
	}
	return userCache;
}

function ensureData(): Task[] {
	if (!taskCache) {
		taskCache = sortTasks(createDefaultTasks());
	}
	return taskCache;
}

export const localTasksRepo: TasksRepo = {
	async listProjects(): Promise<Project[]> {
		return sortProjects(ensureProjectsData()).map(cloneProject);
	},

	async listProjectSummaries(): Promise<ProjectSummary[]> {
		return buildProjectSummaries(ensureProjectsData(), ensureData()).map(cloneProjectSummary);
	},

	async createProject(input: CreateProjectInput): Promise<Project> {
		const name = input.name.trim();
		if (name.length === 0) {
			throw new Error('name is required');
		}
		const projects = ensureProjectsData();
		const created: Project = {
			id: createProjectId(),
			name,
			sortOrder: nextProjectSortOrder(projects),
			updatedAt: nowIsoTimestamp()
		};
		projectCache = sortProjects([...projects, created]);
		return cloneProject(created);
	},

	async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
		const projects = ensureProjectsData();
		const target = projects.find((project) => project.id === id);
		if (!target) {
			throw new Error(`project not found: ${id}`);
		}

		if (target.updatedAt !== input.updatedAt) {
			throw new Error('project は他ユーザーによって更新されました。再読み込みしてください。');
		}

		const name = input.name !== undefined ? input.name.trim() : target.name;
		if (name.length === 0) {
			throw new Error('name is required');
		}

		const updated: Project = {
			...target,
			name,
			updatedAt: nowIsoTimestamp()
		};
		projectCache = sortProjects(projects.map((project) => (project.id === id ? updated : project)));
		return cloneProject(updated);
	},

	async reorderProjects(ids: string[]): Promise<Project[]> {
		const projects = ensureProjectsData();
		if (ids.length !== projects.length) {
			throw new Error('reorder ids length mismatch');
		}

		const projectById = new Map(projects.map((project) => [project.id, project] as const));
		const seen = new Set<string>();
		for (const id of ids) {
			if (seen.has(id)) {
				throw new Error(`duplicate project id: ${id}`);
			}
			seen.add(id);
			if (!projectById.has(id)) {
				throw new Error(`project not found: ${id}`);
			}
		}

		const updatedAt = nowIsoTimestamp();
		const reordered = ids.map((id, index) => {
			const project = projectById.get(id);
			if (!project) {
				throw new Error(`project not found: ${id}`);
			}
			return {
				...project,
				sortOrder: index,
				updatedAt
			};
		});

		projectCache = sortProjects(reordered);
		return projectCache.map(cloneProject);
	},

	async removeProject(id: string): Promise<void> {
		const projects = ensureProjectsData();
		const target = projects.find((project) => project.id === id);
		if (!target) {
			return;
		}

		const tasks = ensureData();
		const taskCount = tasks.filter((task) => task.projectId === id).length;
		if (taskCount > 0) {
			throw new Error('タスクが存在するプロジェクトは削除できません。');
		}

		projectCache = sortProjects(projects.filter((project) => project.id !== id));
	},

	async listUsers(): Promise<User[]> {
		return sortUsers(ensureUsersData()).map(cloneUser);
	},

	async listUserSummaries(): Promise<UserSummary[]> {
		return buildUserSummaries(ensureUsersData(), ensureData()).map(cloneUserSummary);
	},

	async createUser(input: CreateUserInput): Promise<User> {
		const name = input.name.trim();
		if (name.length === 0) {
			throw new Error('name is required');
		}

		const users = ensureUsersData();
		const created: User = {
			id: createUserId(),
			name,
			updatedAt: nowIsoTimestamp()
		};
		userCache = sortUsers([...users, created]);
		return cloneUser(created);
	},

	async updateUser(id: string, input: UpdateUserInput): Promise<User> {
		const users = ensureUsersData();
		const target = users.find((user) => user.id === id);
		if (!target) {
			throw new Error(`user not found: ${id}`);
		}

		if (target.updatedAt !== input.updatedAt) {
			throw new Error('user は他ユーザーによって更新されました。再読み込みしてください。');
		}

		const name = input.name !== undefined ? input.name.trim() : target.name;
		if (name.length === 0) {
			throw new Error('name is required');
		}

		const updated: User = {
			...target,
			name,
			updatedAt: nowIsoTimestamp()
		};
		userCache = sortUsers(users.map((user) => (user.id === id ? updated : user)));
		return cloneUser(updated);
	},

	async removeUser(id: string): Promise<void> {
		const users = ensureUsersData();
		const target = users.find((user) => user.id === id);
		if (!target) {
			return;
		}

		const tasks = ensureData();
		const assignedCount = tasks.filter((task) => task.assigneeIds.includes(id)).length;
		if (assignedCount > 0) {
			throw new Error('担当タスクが存在するユーザーは削除できません。');
		}

		userCache = sortUsers(users.filter((user) => user.id !== id));
	},

	async list(projectId: string): Promise<Task[]> {
		assertProjectExists(projectId);
		return listProjectTasks(ensureData(), projectId);
	},

	async create(projectId: string, input: CreateTaskInput): Promise<Task> {
		assertProjectExists(projectId);
		const tasks = ensureData();
		const next: Task = {
			id: createTaskId(),
			projectId: projectId,
			title: input.title.trim(),
			note: input.note ?? '',
			startDate: input.startDate,
			endDate: input.endDate,
			progress: clampProgress(input.progress),
			sortOrder:
				typeof input.sortOrder === 'number'
					? Math.trunc(input.sortOrder)
					: nextSortOrder(tasks, projectId),
			updatedAt: nowIsoTimestamp(),
			assigneeIds: normalizeAssigneeIds(input.assigneeIds),
			predecessorTaskId: normalizePredecessorTaskId(input.predecessorTaskId)
		};

		assertTaskFields(next);
		taskCache = sortTasks([...tasks, next]);
		return cloneTask(next);
	},

	async update(projectId: string, id: string, input: UpdateTaskInput): Promise<Task> {
		assertProjectExists(projectId);
		const tasks = ensureData();
		const target = tasks.find((task) => task.id === id && task.projectId === projectId);

		if (!target) {
			throw new Error(`task not found: ${id}`);
		}

		if (target.updatedAt !== input.updatedAt) {
			throw new Error('task は他ユーザーによって更新されました。再読み込みしてください。');
		}

		const next: Task = {
			...target,
			title: input.title !== undefined ? input.title.trim() : target.title,
			note: input.note !== undefined ? input.note : target.note,
			startDate: input.startDate ?? target.startDate,
			endDate: input.endDate ?? target.endDate,
			progress:
				input.progress !== undefined ? clampProgress(Number(input.progress)) : target.progress,
			sortOrder: input.sortOrder !== undefined ? Math.trunc(input.sortOrder) : target.sortOrder,
			updatedAt: nowIsoTimestamp(),
			assigneeIds:
				input.assigneeIds !== undefined
					? normalizeAssigneeIds(input.assigneeIds)
					: target.assigneeIds,
			predecessorTaskId:
				input.predecessorTaskId !== undefined
					? normalizePredecessorTaskId(input.predecessorTaskId)
					: target.predecessorTaskId
		};

		assertTaskFields(next);
		taskCache = sortTasks(tasks.map((task) => (task.id === id ? next : task)));
		return cloneTask(next);
	},

	async reorder(projectId: string, ids: string[]): Promise<Task[]> {
		assertProjectExists(projectId);
		const tasks = ensureData();
		const projectTasks = tasks.filter((task) => task.projectId === projectId);
		if (ids.length !== projectTasks.length) {
			throw new Error('reorder ids length mismatch');
		}

		const taskById = new Map(projectTasks.map((task) => [task.id, task] as const));
		const seen = new Set<string>();

		for (const id of ids) {
			if (seen.has(id)) {
				throw new Error(`duplicate task id: ${id}`);
			}
			seen.add(id);
			if (!taskById.has(id)) {
				throw new Error(`task not found: ${id}`);
			}
		}

		const updatedAt = nowIsoTimestamp();
		const reorderedTasks = ids.map((id, index) => {
			const task = taskById.get(id);
			if (!task) {
				throw new Error(`task not found: ${id}`);
			}
			return {
				...task,
				sortOrder: index,
				updatedAt
			};
		});
		const reorderedById = new Map(reorderedTasks.map((task) => [task.id, task] as const));

		taskCache = sortTasks(
			tasks.map((task) => {
				if (task.projectId !== projectId) {
					return task;
				}
				const reordered = reorderedById.get(task.id);
				if (!reordered) {
					throw new Error(`task not found: ${task.id}`);
				}
				return reordered;
			})
		);

		return listProjectTasks(taskCache, projectId);
	},

	async remove(projectId: string, id: string): Promise<void> {
		assertProjectExists(projectId);
		const tasks = ensureData();
		const updatedAt = nowIsoTimestamp();
		const next = tasks
			.filter((task) => !(task.projectId === projectId && task.id === id))
			.map((task) => {
				if (task.projectId === projectId && task.predecessorTaskId === id) {
					return {
						...task,
						predecessorTaskId: null,
						updatedAt
					};
				}
				return task;
			});

		if (next.length === tasks.length) {
			return;
		}

		taskCache = sortTasks(next);
	}
};

export function resetLocalTaskCacheForTest(): void {
	taskCache = null;
	projectCache = null;
	userCache = null;
}
