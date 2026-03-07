import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localTasksRepo, resetLocalTaskCacheForTest } from './repoLocal';

describe('localTasksRepo summaries', () => {
	beforeEach(() => {
		resetLocalTaskCacheForTest();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('listProjectSummaries should include initial task counts', async () => {
		const summaries = await localTasksRepo.listProjectSummaries();
		const defaultProject = summaries.find((summary) => summary.id === 'project-default');
		const mobileProject = summaries.find((summary) => summary.id === 'project-mobile');

		expect(defaultProject?.taskCount).toBe(2);
		expect(mobileProject?.taskCount).toBe(2);
	});

	it('listUserSummaries should include initial assignment counts', async () => {
		const summaries = await localTasksRepo.listUserSummaries();

		expect(summaries.find((summary) => summary.id === 'user-ito')?.taskCount).toBe(1);
		expect(summaries.find((summary) => summary.id === 'user-sato')?.taskCount).toBe(1);
		expect(summaries.find((summary) => summary.id === 'user-yamada')?.taskCount).toBe(2);
		expect(summaries.find((summary) => summary.id === 'user-suzuki')?.taskCount).toBe(1);
	});

	it('summary counts should update after creating a task', async () => {
		const project = await localTasksRepo.createProject({ name: 'summary-check' });
		await localTasksRepo.setProjectMembers(project.id, ['user-ito', 'user-yamada']);

		await localTasksRepo.create(project.id, {
			title: 'count me',
			note: '',
			startDate: '2026-02-20',
			endDate: '2026-02-21',
			progress: 0,
			assigneeIds: ['user-ito', 'user-yamada'],
			predecessorTaskId: null
		});

		const projectSummaries = await localTasksRepo.listProjectSummaries();
		const userSummaries = await localTasksRepo.listUserSummaries();

		expect(projectSummaries.find((summary) => summary.id === project.id)?.taskCount).toBe(1);
		expect(userSummaries.find((summary) => summary.id === 'user-ito')?.taskCount).toBe(2);
		expect(userSummaries.find((summary) => summary.id === 'user-yamada')?.taskCount).toBe(3);
	});

	it('listProjectMembers should return project-scoped users only', async () => {
		const defaultMembers = await localTasksRepo.listProjectMembers('project-default');
		const mobileMembers = await localTasksRepo.listProjectMembers('project-mobile');

		expect(defaultMembers.map((user) => user.id)).toEqual(
			expect.arrayContaining(['user-ito', 'user-sato', 'user-yamada'])
		);
		expect(defaultMembers.map((user) => user.id)).not.toContain('user-suzuki');
		expect(mobileMembers.map((user) => user.id)).toEqual(
			expect.arrayContaining(['user-yamada', 'user-suzuki'])
		);
		expect(mobileMembers.map((user) => user.id)).not.toContain('user-ito');
	});

	it('create should reject assignee outside project members', async () => {
		await expect(
			localTasksRepo.create('project-default', {
				title: 'invalid assignee',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				assigneeIds: ['user-suzuki'],
				predecessorTaskId: null
			})
		).rejects.toThrow('assigneeIds にプロジェクト未参加の user が含まれます。');
	});

	it('setProjectMembers should reject removing users who still have assignments', async () => {
		await expect(
			localTasksRepo.setProjectMembers('project-default', ['user-sato'])
		).rejects.toThrow('担当タスクが存在するメンバーはプロジェクトから外せません。');
	});

	it('listTaskHistory should return created and updated entries', async () => {
		const before = await localTasksRepo.list('project-default');
		const target = before[0];
		const initialHistory = await localTasksRepo.listTaskHistory('project-default', target.id);

		expect(initialHistory.length).toBeGreaterThan(0);
		expect(initialHistory[0]?.action).toBe('created');

		await localTasksRepo.update('project-default', target.id, {
			updatedAt: target.updatedAt,
			title: `${target.title} 更新`
		});

		const nextHistory = await localTasksRepo.listTaskHistory('project-default', target.id);
		expect(nextHistory[0]?.action).toBe('updated');
		expect(nextHistory[0]?.changedFields).toContain('title');
	});

	it('removeProject should delete project with its tasks', async () => {
		await expect(localTasksRepo.list('project-default')).resolves.toHaveLength(2);

		await localTasksRepo.removeProject('project-default');

		const projects = await localTasksRepo.listProjects();
		expect(projects.some((project) => project.id === 'project-default')).toBe(false);
		await expect(localTasksRepo.list('project-default')).rejects.toThrow(
			'project not found: project-default'
		);

		const userSummaries = await localTasksRepo.listUserSummaries();
		expect(userSummaries.find((summary) => summary.id === 'user-ito')?.taskCount).toBe(0);
		expect(userSummaries.find((summary) => summary.id === 'user-sato')?.taskCount).toBe(0);
		expect(userSummaries.find((summary) => summary.id === 'user-yamada')?.taskCount).toBe(1);
		expect(userSummaries.find((summary) => summary.id === 'user-suzuki')?.taskCount).toBe(1);
	});

	it('project mutations should trim names, update, and reorder with validation', async () => {
		const created = await localTasksRepo.createProject({ name: '  Ops  ' });
		expect(created.name).toBe('Ops');

		await expect(
			localTasksRepo.updateProject(created.id, {
				name: 'Ops updated',
				updatedAt: 'stale'
			})
		).rejects.toThrow('project は他ユーザーによって更新されました。再読み込みしてください。');

		const updated = await localTasksRepo.updateProject(created.id, {
			name: ' Ops updated ',
			updatedAt: created.updatedAt
		});
		expect(updated.name).toBe('Ops updated');

		const projects = await localTasksRepo.listProjects();
		await expect(localTasksRepo.reorderProjects([projects[0].id])).rejects.toThrow(
			'reorder ids length mismatch'
		);
		await expect(
			localTasksRepo.reorderProjects([projects[0].id, 'missing-project', projects[2].id])
		).rejects.toThrow('project not found: missing-project');
		await expect(
			localTasksRepo.reorderProjects([projects[0].id, projects[0].id, projects[2].id])
		).rejects.toThrow(`duplicate project id: ${projects[0].id}`);

		const reordered = await localTasksRepo.reorderProjects(
			projects.map((project) => project.id).reverse()
		);
		expect(reordered[0]?.id).toBe(created.id);
	});

	it('user mutations should update names, reject deleting assigned users, and remove free users', async () => {
		const created = await localTasksRepo.createUser({ name: '  高橋  ' });
		expect(created.name).toBe('高橋');

		await expect(
			localTasksRepo.updateUser(created.id, {
				name: '高橋更新',
				updatedAt: 'stale'
			})
		).rejects.toThrow('user は他ユーザーによって更新されました。再読み込みしてください。');

		const updated = await localTasksRepo.updateUser(created.id, {
			name: ' 高橋更新 ',
			updatedAt: created.updatedAt
		});
		expect(updated.name).toBe('高橋更新');

		await expect(localTasksRepo.removeUser('user-yamada')).rejects.toThrow(
			'担当タスクが存在するユーザーは削除できません。'
		);

		await localTasksRepo.setProjectMembers('project-mobile', [
			'user-yamada',
			'user-suzuki',
			created.id
		]);
		await localTasksRepo.removeUser(created.id);

		const users = await localTasksRepo.listUsers();
		const mobileMembers = await localTasksRepo.listProjectMembers('project-mobile');
		expect(users.some((user) => user.id === created.id)).toBe(false);
		expect(mobileMembers.some((user) => user.id === created.id)).toBe(false);
	});

	it('task creation should validate predecessor/date constraints and normalize data', async () => {
		await expect(
			localTasksRepo.create('project-default', {
				title: 'bad date',
				note: '',
				startDate: '2026/03/01',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null
			})
		).rejects.toThrow('date must be in YYYY-MM-DD format');

		await expect(
			localTasksRepo.create('project-default', {
				title: 'bad range',
				note: '',
				startDate: '2026-03-03',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null
			})
		).rejects.toThrow('startDate must be earlier than or equal to endDate');

		await expect(
			localTasksRepo.create('project-default', {
				title: 'missing predecessor',
				note: '',
				startDate: '2026-03-03',
				endDate: '2026-03-04',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: 'task-missing'
			})
		).rejects.toThrow('先行タスクが見つかりません。');

		const created = await localTasksRepo.create('project-default', {
			title: 'normalize me',
			note: '',
			startDate: '2026-03-06',
			endDate: '2026-03-06',
			progress: 120,
			assigneeIds: ['user-ito', 'user-ito', ''],
			predecessorTaskId: '  '
		});
		expect(created.progress).toBe(100);
		expect(created.assigneeIds).toEqual(['user-ito']);
		expect(created.predecessorTaskId).toBeNull();
	});

	it('task updates should reject self/cyclic predecessors and skip history when unchanged', async () => {
		const tasks = await localTasksRepo.list('project-default');
		const discovery = tasks.find((task) => task.id === 'task-discovery');
		const ui = tasks.find((task) => task.id === 'task-ui');
		if (!discovery || !ui) {
			throw new Error('expected default tasks');
		}

		await expect(
			localTasksRepo.update('project-default', discovery.id, {
				updatedAt: discovery.updatedAt,
				predecessorTaskId: discovery.id
			})
		).rejects.toThrow('先行タスクに自分自身は指定できません。');

		await expect(
			localTasksRepo.update('project-default', discovery.id, {
				updatedAt: discovery.updatedAt,
				predecessorTaskId: ui.id
			})
		).rejects.toThrow('依存関係が循環しています。');

		const historyBefore = await localTasksRepo.listTaskHistory('project-default', ui.id);
		await localTasksRepo.update('project-default', ui.id, {
			updatedAt: ui.updatedAt
		});
		const historyAfter = await localTasksRepo.listTaskHistory('project-default', ui.id);
		expect(historyAfter).toHaveLength(historyBefore.length);
	});

	it('task reorder and remove should validate ids and clear dependent predecessors', async () => {
		const before = await localTasksRepo.list('project-default');
		await expect(localTasksRepo.reorder('project-default', [before[0].id])).rejects.toThrow(
			'reorder ids length mismatch'
		);
		await expect(
			localTasksRepo.reorder('project-default', [before[0].id, before[0].id])
		).rejects.toThrow(`duplicate task id: ${before[0].id}`);

		const reordered = await localTasksRepo.reorder('project-default', [before[1].id, before[0].id]);
		expect(reordered[0]?.id).toBe(before[1].id);

		await localTasksRepo.remove('project-default', 'task-discovery');

		const afterRemove = await localTasksRepo.list('project-default');
		expect(afterRemove).toHaveLength(1);
		expect(afterRemove[0]?.predecessorTaskId).toBeNull();

		const deletedHistory = await localTasksRepo.listTaskHistory(
			'project-default',
			'task-discovery'
		);
		expect(deletedHistory[0]?.action).toBe('deleted');
		expect(deletedHistory[0]?.changedFields).toEqual(['deleted']);
	});

	it('project and user mutations should reject missing or empty names and ignore missing deletes', async () => {
		await expect(localTasksRepo.createProject({ name: '   ' })).rejects.toThrow('name is required');
		await expect(
			localTasksRepo.updateProject('missing-project', {
				name: 'x',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow('project not found: missing-project');

		const project = (await localTasksRepo.listProjects())[0];
		await expect(
			localTasksRepo.updateProject(project.id, {
				name: '   ',
				updatedAt: project.updatedAt
			})
		).rejects.toThrow('name is required');
		await expect(localTasksRepo.removeProject('missing-project')).resolves.toBeUndefined();

		await expect(localTasksRepo.createUser({ name: '   ' })).rejects.toThrow('name is required');
		await expect(
			localTasksRepo.updateUser('missing-user', {
				name: 'x',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow('user not found: missing-user');

		const user = (await localTasksRepo.listUsers())[0];
		await expect(
			localTasksRepo.updateUser(user.id, {
				name: '   ',
				updatedAt: user.updatedAt
			})
		).rejects.toThrow('name is required');
		await expect(localTasksRepo.removeUser('missing-user')).resolves.toBeUndefined();
	});

	it('project member and listing APIs should validate unknown ids and project existence', async () => {
		await expect(localTasksRepo.list('missing-project')).rejects.toThrow(
			'project not found: missing-project'
		);
		await expect(localTasksRepo.listTaskHistory('missing-project', 'task-1')).rejects.toThrow(
			'project not found: missing-project'
		);
		await expect(localTasksRepo.listProjectMembers('missing-project')).rejects.toThrow(
			'project not found: missing-project'
		);
		await expect(
			localTasksRepo.setProjectMembers('project-default', ['user-ito', 'missing-user'])
		).rejects.toThrow('user not found: missing-user');

		const deduped = await localTasksRepo.setProjectMembers('project-mobile', [
			'user-yamada',
			'user-yamada',
			'user-suzuki',
			'',
			'user-suzuki'
		]);
		expect(deduped.map((user) => user.id)).toEqual(['user-yamada', 'user-suzuki']);
	});

	it('task create and update should validate missing entities, title, and custom sort order paths', async () => {
		await expect(
			localTasksRepo.create('missing-project', {
				title: 'x',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-01',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null
			})
		).rejects.toThrow('project not found: missing-project');

		await expect(
			localTasksRepo.create('project-default', {
				title: '   ',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-01',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null
			})
		).rejects.toThrow('title is required');

		await expect(
			localTasksRepo.create('project-default', {
				title: 'unknown assignee',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-01',
				progress: 0,
				assigneeIds: ['missing-user'],
				predecessorTaskId: null
			})
		).rejects.toThrow('assigneeIds include unknown user');

		const created = await localTasksRepo.create('project-default', {
			title: 'custom order',
			note: undefined as never,
			startDate: '2026-03-10',
			endDate: '2026-03-11',
			progress: 50,
			sortOrder: 9.8,
			assigneeIds: [],
			predecessorTaskId: null
		});
		expect(created.note).toBe('');
		expect(created.sortOrder).toBe(9);

		await expect(
			localTasksRepo.update('project-default', 'missing-task', {
				updatedAt: '2026-03-01T00:00:00.000Z',
				title: 'x'
			})
		).rejects.toThrow('task not found: missing-task');

		await expect(
			localTasksRepo.update('project-default', 'task-ui', {
				updatedAt: 'stale',
				title: 'x'
			})
		).rejects.toThrow('task は他ユーザーによって更新されました。再読み込みしてください。');

		const uiTask = (await localTasksRepo.list('project-default')).find(
			(task) => task.id === 'task-ui'
		);
		if (!uiTask) {
			throw new Error('expected task-ui');
		}
		const updated = await localTasksRepo.update('project-default', uiTask.id, {
			updatedAt: uiTask.updatedAt,
			progress: 33.7,
			sortOrder: 5.9,
			predecessorTaskId: ''
		});
		expect(updated.progress).toBe(34);
		expect(updated.sortOrder).toBe(5);
		expect(updated.predecessorTaskId).toBeNull();

		const history = await localTasksRepo.listTaskHistory('project-default', uiTask.id);
		expect(history[0]?.changedFields).toContain('predecessorTaskId');
	});

	it('task reorder and remove should handle missing ids and no-op removals', async () => {
		const before = await localTasksRepo.list('project-default');
		await expect(
			localTasksRepo.reorder('project-default', [before[0].id, 'missing-task'])
		).rejects.toThrow('task not found: missing-task');

		await expect(localTasksRepo.remove('project-default', 'missing-task')).resolves.toBeUndefined();
		await expect(localTasksRepo.list('project-default')).resolves.toHaveLength(2);
	});

	it('should use fallback id generation and clear warmed caches when removing a project', async () => {
		vi.stubGlobal('crypto', undefined);

		const project = await localTasksRepo.createProject({ name: 'fallback project' });
		const user = await localTasksRepo.createUser({ name: 'fallback user' });
		await localTasksRepo.setProjectMembers(project.id, [user.id]);
		const task = await localTasksRepo.create(project.id, {
			title: 'fallback task',
			note: '',
			startDate: '2026-03-20',
			endDate: '2026-03-21',
			progress: 0,
			assigneeIds: [user.id],
			predecessorTaskId: null
		});

		expect(project.id).toMatch(/^project-/);
		expect(user.id).toMatch(/^user-/);
		expect(task.id).toMatch(/^task-/);

		await localTasksRepo.listProjectMembers(project.id);
		await localTasksRepo.listTaskHistory(project.id, task.id);
		await localTasksRepo.removeProject(project.id);

		await expect(localTasksRepo.list(project.id)).rejects.toThrow(
			`project not found: ${project.id}`
		);
		await expect(localTasksRepo.listProjectMembers(project.id)).rejects.toThrow(
			`project not found: ${project.id}`
		);
	});

	it('should handle empty repositories and invalid typed task input', async () => {
		await localTasksRepo.removeProject('project-default');
		await localTasksRepo.removeProject('project-mobile');

		const firstProject = await localTasksRepo.createProject({ name: 'first project' });
		expect(firstProject.sortOrder).toBe(0);

		await expect(
			localTasksRepo.create(firstProject.id, {
				title: 'bad typed date',
				note: '',
				startDate: 123 as never,
				endDate: '2026-03-01',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null
			})
		).rejects.toThrow('date must be in YYYY-MM-DD format');

		const created = await localTasksRepo.create(firstProject.id, {
			title: 'normalized assignees',
			note: '',
			startDate: '2026-03-01',
			endDate: '2026-03-01',
			progress: 0,
			assigneeIds: undefined as never,
			predecessorTaskId: null
		});
		expect(created.sortOrder).toBe(0);
		expect(created.assigneeIds).toEqual([]);
	});

	it('should reject NaN progress and record assignee changes by value', async () => {
		const task = (await localTasksRepo.list('project-default')).find(
			(entry) => entry.id === 'task-discovery'
		);
		if (!task) {
			throw new Error('expected discovery task');
		}

		await expect(
			localTasksRepo.update('project-default', task.id, {
				updatedAt: task.updatedAt,
				progress: Number.NaN
			})
		).rejects.toThrow('progress must be between 0 and 100');

		const refreshedTask = (await localTasksRepo.list('project-default')).find(
			(entry) => entry.id === task.id
		);
		if (!refreshedTask) {
			throw new Error('expected refreshed task');
		}

		const updated = await localTasksRepo.update('project-default', task.id, {
			updatedAt: refreshedTask.updatedAt,
			assigneeIds: ['user-sato']
		});
		expect(updated.assigneeIds).toEqual(['user-sato']);

		const history = await localTasksRepo.listTaskHistory('project-default', task.id);
		expect(history[0]?.changedFields).toContain('assigneeIds');
	});

	it('should rebuild default project members without removed users', async () => {
		await localTasksRepo.removeProject('project-mobile');
		await localTasksRepo.removeUser('user-suzuki');

		const users = await localTasksRepo.listUsers();
		expect(users.some((user) => user.id === 'user-suzuki')).toBe(false);

		const members = await localTasksRepo.listProjectMembers('project-default');
		expect(members.some((user) => user.id === 'user-suzuki')).toBe(false);
	});
});
