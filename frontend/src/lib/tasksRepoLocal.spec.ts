import { beforeEach, describe, expect, it } from 'vitest';
import { localTasksRepo, resetLocalTaskCacheForTest } from './tasksRepoLocal';

describe('localTasksRepo summaries', () => {
	beforeEach(() => {
		resetLocalTaskCacheForTest();
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
		await expect(localTasksRepo.setProjectMembers('project-default', ['user-sato'])).rejects.toThrow(
			'担当タスクが存在するメンバーはプロジェクトから外せません。'
		);
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
});
