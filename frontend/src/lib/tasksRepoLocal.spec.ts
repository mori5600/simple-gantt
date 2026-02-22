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
});
