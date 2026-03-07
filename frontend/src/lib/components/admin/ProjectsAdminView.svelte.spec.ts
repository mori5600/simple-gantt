import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const adminRepo = vi.hoisted(() => {
	const initialProjects = [
		{
			id: 'project-1',
			name: 'Project 1',
			taskCount: 2,
			sortOrder: 0,
			updatedAt: '2026-03-01T00:00:00.000Z'
		},
		{
			id: 'project-2',
			name: 'Project 2',
			taskCount: 0,
			sortOrder: 1,
			updatedAt: '2026-03-01T00:00:00.000Z'
		}
	];
	const initialUsers = [
		{ id: 'user-1', name: '伊藤', updatedAt: '2026-03-01T00:00:00.000Z' },
		{ id: 'user-2', name: '佐藤', updatedAt: '2026-03-01T00:00:00.000Z' }
	];
	let projects = initialProjects.map((project) => ({ ...project }));
	let users = initialUsers.map((user) => ({ ...user }));
	let membersByProject = new Map<string, string[]>([
		['project-1', ['user-1']],
		['project-2', []]
	]);

	const tasksRepo = {
		listProjectSummaries: vi.fn(async () => projects.map((project) => ({ ...project }))),
		createProject: vi.fn(async ({ name }: { name: string }) => {
			const created = {
				id: `project-${projects.length + 1}`,
				name,
				taskCount: 0,
				sortOrder: projects.length,
				updatedAt: '2026-03-02T00:00:00.000Z'
			};
			projects = [...projects, created];
			membersByProject.set(created.id, []);
			return { ...created };
		}),
		updateProject: vi.fn(async (id: string, input: { name: string; updatedAt: string }) => {
			projects = projects.map((project) =>
				project.id === id ? { ...project, name: input.name, updatedAt: input.updatedAt } : project
			);
			return { ...projects.find((project) => project.id === id)! };
		}),
		reorderProjects: vi.fn(async (ids: string[]) => {
			projects = ids
				.map((id, index) => {
					const project = projects.find((entry) => entry.id === id)!;
					return { ...project, sortOrder: index };
				})
				.filter(Boolean);
			return projects.map((project) => ({ ...project }));
		}),
		removeProject: vi.fn(async (id: string) => {
			projects = projects.filter((project) => project.id !== id);
			membersByProject.delete(id);
		}),
		listUsers: vi.fn(async () => users.map((user) => ({ ...user }))),
		listProjectMembers: vi.fn(async (projectId: string) =>
			users
				.filter((user) => (membersByProject.get(projectId) ?? []).includes(user.id))
				.map((user) => ({ ...user }))
		),
		setProjectMembers: vi.fn(async (projectId: string, userIds: string[]) => {
			membersByProject.set(projectId, [...userIds]);
			return users.filter((user) => userIds.includes(user.id)).map((user) => ({ ...user }));
		})
	};

	return {
		tasksRepo,
		setProjects(nextProjects: typeof initialProjects) {
			projects = nextProjects.map((project) => ({ ...project }));
		},
		setUsers(nextUsers: typeof initialUsers) {
			users = nextUsers.map((user) => ({ ...user }));
		},
		reset() {
			projects = initialProjects.map((project) => ({ ...project }));
			users = initialUsers.map((user) => ({ ...user }));
			membersByProject = new Map<string, string[]>([
				['project-1', ['user-1']],
				['project-2', []]
			]);
			vi.clearAllMocks();
		}
	};
});

vi.mock('$lib/data/tasks/repo', () => ({
	tasksRepo: adminRepo.tasksRepo
}));

vi.mock('$lib/shared/polling', () => ({
	resolvePollIntervalMs: vi.fn(() => 20_000),
	startVisibilityPolling: vi.fn(() => ({
		stop: vi.fn(),
		trigger: vi.fn()
	}))
}));

vi.mock('$lib/shared/pollingSettings', () => ({
	resolvePollingIntervalForScope: vi.fn(() => null)
}));

import { page } from 'vitest/browser';
import { startVisibilityPolling } from '$lib/shared/polling';
import { resolvePollingIntervalForScope } from '$lib/shared/pollingSettings';
import ProjectsAdminView from './ProjectsAdminView.svelte';

function findProjectRow(name: string): HTMLTableRowElement | undefined {
	return [...document.querySelectorAll('tbody tr')].find((row) =>
		row.textContent?.includes(name)
	) as HTMLTableRowElement | undefined;
}

describe('ProjectsAdminView.svelte', () => {
	beforeEach(() => {
		adminRepo.reset();
	});

	it('should create, search, edit, and reorder projects', async () => {
		render(ProjectsAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(page.getByText('Project 1').query()).toBeTruthy();
		});

		const createInput = document.querySelector('input[name="createProjectName"]');
		if (!(createInput instanceof HTMLInputElement)) {
			throw new Error('expected create project input');
		}
		createInput.value = 'Project 3';
		createInput.dispatchEvent(new Event('input', { bubbles: true }));
		(document.querySelector('form') as HTMLFormElement).dispatchEvent(
			new SubmitEvent('submit', { bubbles: true, cancelable: true })
		);

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクトを作成しました。');
			expect(document.body.textContent).toContain('Project 3');
		});

		const searchInput = document.querySelector('input[name="projectSearch"]');
		if (!(searchInput instanceof HTMLInputElement)) {
			throw new Error('expected search input');
		}
		searchInput.value = 'zzz';
		searchInput.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('検索条件に一致するプロジェクトがありません。');
		});
		searchInput.value = '';
		searchInput.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() => {
			expect(findProjectRow('Project 1')).toBeTruthy();
		});

		const projectRow = findProjectRow('Project 1');
		const editButton = projectRow?.querySelectorAll('button').item(3);
		if (!(editButton instanceof HTMLButtonElement)) {
			throw new Error('expected edit button');
		}
		editButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[name="editProjectName"]')).toBeTruthy();
		});
		const editInput = document.querySelector('input[name="editProjectName"]');
		if (!(editInput instanceof HTMLInputElement)) {
			throw new Error('expected edit input');
		}
		editInput.value = 'Project 1 updated';
		editInput.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() => {
			expect(
				[...document.querySelectorAll('button')].find(
					(button) => button.textContent?.trim() === '保存'
				)
			).toBeTruthy();
		});
		const saveButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '保存'
		);
		if (!(saveButton instanceof HTMLButtonElement)) {
			throw new Error('expected save button');
		}
		saveButton.click();

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクトを更新しました。');
			expect(document.body.textContent).toContain('Project 1 updated');
		});

		const updatedRow = findProjectRow('Project 1 updated');
		const moveDownButton = updatedRow?.querySelector('button[aria-label="move down"]');
		if (!(moveDownButton instanceof HTMLButtonElement)) {
			throw new Error('expected move down button');
		}
		moveDownButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('並び順を更新しました。');
		});
	});

	it('should manage project members and delete a project', async () => {
		render(ProjectsAdminView, {
			props: {
				showBackLink: true
			}
		});

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('Project 1');
		});
		expect(document.body.textContent).toContain('ガントへ戻る');

		const projectRow = findProjectRow('Project 1');
		const memberButton = projectRow?.querySelectorAll('button').item(2);
		if (!(memberButton instanceof HTMLButtonElement)) {
			throw new Error('expected member button');
		}
		memberButton.click();

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクトメンバー');
		});

		const memberCheckbox = document.querySelector('input[type="checkbox"][value="user-2"]');
		if (!(memberCheckbox instanceof HTMLInputElement)) {
			throw new Error('expected member checkbox');
		}
		memberCheckbox.checked = true;
		memberCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

		const saveMembersButton = [...document.querySelectorAll('button')].find(
			(button) =>
				button.textContent?.trim() === '保存' &&
				button.closest('[role="dialog"]')?.textContent?.includes('プロジェクトメンバー')
		);
		if (!(saveMembersButton instanceof HTMLButtonElement)) {
			throw new Error('expected save members button');
		}
		saveMembersButton.click();

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクトメンバーを更新しました。');
		});
		expect(adminRepo.tasksRepo.setProjectMembers).toHaveBeenCalledWith('project-1', [
			'user-1',
			'user-2'
		]);

		const deleteButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '削除'
		);
		if (!(deleteButton instanceof HTMLButtonElement)) {
			throw new Error('expected delete button');
		}
		deleteButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクトを削除');
		});

		const confirmInput = document.querySelector('input[name="deleteProjectConfirmName"]');
		if (!(confirmInput instanceof HTMLInputElement)) {
			throw new Error('expected delete confirm input');
		}
		confirmInput.value = 'Project 1';
		confirmInput.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() => {
			const confirmButton = [...document.querySelectorAll('button')].find(
				(button) => button.textContent?.trim() === '削除を確定'
			);
			expect(confirmButton instanceof HTMLButtonElement && !confirmButton.disabled).toBe(true);
		});

		const confirmDeleteButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '削除を確定'
		);
		if (!(confirmDeleteButton instanceof HTMLButtonElement)) {
			throw new Error('expected confirm delete button');
		}
		confirmDeleteButton.click();

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクトを削除しました。');
		});
		expect(adminRepo.tasksRepo.removeProject).toHaveBeenCalledWith('project-1');
		expect(findProjectRow('Project 1')).toBeUndefined();
	});

	it('should surface polling callbacks and list states', async () => {
		const stop = vi.fn();
		let pollingOptions: Parameters<typeof startVisibilityPolling>[0] | undefined;

		vi.mocked(resolvePollingIntervalForScope).mockReturnValue(15_000);
		vi.mocked(startVisibilityPolling).mockImplementation((options) => {
			pollingOptions = options;
			return { stop, trigger: vi.fn() };
		});

		const rendered = render(ProjectsAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(findProjectRow('Project 1')).toBeTruthy();
			expect(pollingOptions).toBeTruthy();
		});

		if (
			!pollingOptions ||
			typeof pollingOptions.isEnabled !== 'function' ||
			typeof pollingOptions.onError !== 'function'
		) {
			throw new Error('expected polling callbacks');
		}

		expect(pollingOptions.isEnabled()).toBe(true);

		const editButton = findProjectRow('Project 1')?.querySelectorAll('button').item(3);
		if (!(editButton instanceof HTMLButtonElement)) {
			throw new Error('expected edit button');
		}
		editButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[name="editProjectName"]')).toBeTruthy();
		});
		expect(pollingOptions.isEnabled()).toBe(false);

		const cancelEditButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '取消'
		);
		if (!(cancelEditButton instanceof HTMLButtonElement)) {
			throw new Error('expected cancel edit button');
		}
		cancelEditButton.click();
		expect(pollingOptions.isEnabled()).toBe(true);

		await pollingOptions.onPoll();
		expect(adminRepo.tasksRepo.listProjectSummaries).toHaveBeenCalledTimes(2);

		pollingOptions.onError(new Error('sync failed'));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('sync failed');
		});

		rendered.unmount();
		expect(stop).toHaveBeenCalledTimes(1);

		adminRepo.tasksRepo.listProjectSummaries.mockRejectedValueOnce(new Error('load failed'));
		render(ProjectsAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('load failed');
		});

		adminRepo.tasksRepo.listProjectSummaries.mockResolvedValueOnce([]);
		render(ProjectsAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクトがありません。');
		});
	});

	it('should validate project forms and surface action failures', async () => {
		render(ProjectsAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(findProjectRow('Project 1')).toBeTruthy();
		});

		const form = document.querySelector('form');
		if (!(form instanceof HTMLFormElement)) {
			throw new Error('expected create form');
		}

		form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクト名は必須です。');
		});

		const createInput = document.querySelector('input[name="createProjectName"]');
		if (!(createInput instanceof HTMLInputElement)) {
			throw new Error('expected create input');
		}
		adminRepo.tasksRepo.createProject.mockRejectedValueOnce(new Error('create failed'));
		createInput.value = 'Failure Project';
		createInput.dispatchEvent(new Event('input', { bubbles: true }));
		form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('create failed');
		});

		const firstRow = findProjectRow('Project 1');
		const editButton = firstRow?.querySelectorAll('button').item(3);
		if (!(editButton instanceof HTMLButtonElement)) {
			throw new Error('expected edit button');
		}
		editButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[name="editProjectName"]')).toBeTruthy();
		});

		const editInput = document.querySelector('input[name="editProjectName"]');
		if (!(editInput instanceof HTMLInputElement)) {
			throw new Error('expected edit input');
		}
		editInput.value = '   ';
		editInput.dispatchEvent(new Event('input', { bubbles: true }));

		const saveButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '保存'
		);
		if (!(saveButton instanceof HTMLButtonElement)) {
			throw new Error('expected save button');
		}
		saveButton.disabled = false;
		saveButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクト名は必須です。');
		});

		const refreshedEditInput = document.querySelector('input[name="editProjectName"]');
		const refreshedSaveButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '保存'
		);
		if (
			!(refreshedEditInput instanceof HTMLInputElement) ||
			!(refreshedSaveButton instanceof HTMLButtonElement)
		) {
			throw new Error('expected refreshed edit controls');
		}
		refreshedEditInput.value = 'Broken Project';
		refreshedEditInput.dispatchEvent(new Event('input', { bubbles: true }));
		adminRepo.tasksRepo.updateProject.mockRejectedValueOnce(new Error('update failed'));
		refreshedSaveButton.disabled = false;
		refreshedSaveButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('update failed');
		});

		const cancelButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '取消'
		);
		if (!(cancelButton instanceof HTMLButtonElement)) {
			throw new Error('expected cancel button');
		}
		cancelButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[name="editProjectName"]')).toBeNull();
		});

		const secondRow = findProjectRow('Project 2');
		const moveUpButton = secondRow?.querySelector('button[aria-label="move up"]');
		if (!(moveUpButton instanceof HTMLButtonElement)) {
			throw new Error('expected move up button');
		}
		adminRepo.tasksRepo.reorderProjects.mockRejectedValueOnce(new Error('reorder failed'));
		moveUpButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('reorder failed');
		});
	});

	it('should handle delete dialog validation and failure states', async () => {
		render(ProjectsAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(findProjectRow('Project 1')).toBeTruthy();
		});

		const deleteButton = findProjectRow('Project 1')?.querySelector(
			'button[title="プロジェクトを削除"]'
		);
		if (!(deleteButton instanceof HTMLButtonElement)) {
			throw new Error('expected delete button');
		}
		deleteButton.click();

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				'このプロジェクトの 2 件のタスクも削除されます。'
			);
		});

		let confirmDeleteButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '削除を確定'
		);
		const confirmInput = document.querySelector('input[name="deleteProjectConfirmName"]');
		if (
			!(confirmDeleteButton instanceof HTMLButtonElement) ||
			!(confirmInput instanceof HTMLInputElement)
		) {
			throw new Error('expected delete confirm controls');
		}

		confirmInput.value = 'Mismatch';
		confirmInput.dispatchEvent(new Event('input', { bubbles: true }));
		confirmDeleteButton.disabled = false;
		confirmDeleteButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('プロジェクト名が一致しません。');
		});

		const deleteBackdrop = document.querySelector('div[role="presentation"]');
		if (!(deleteBackdrop instanceof HTMLDivElement)) {
			throw new Error('expected delete dialog backdrop');
		}
		deleteBackdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).not.toContain('プロジェクトを削除');
		});

		deleteButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[name="deleteProjectConfirmName"]')).toBeTruthy();
		});
		const reopenInput = document.querySelector('input[name="deleteProjectConfirmName"]');
		if (!(reopenInput instanceof HTMLInputElement)) {
			throw new Error('expected reopened confirm input');
		}
		reopenInput.value = 'Project 1';
		reopenInput.dispatchEvent(new Event('input', { bubbles: true }));

		adminRepo.tasksRepo.removeProject.mockRejectedValueOnce(new Error('delete failed'));
		confirmDeleteButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '削除を確定'
		);
		if (!(confirmDeleteButton instanceof HTMLButtonElement)) {
			throw new Error('expected reopened confirm button');
		}
		await vi.waitFor(() => {
			expect(
				confirmDeleteButton instanceof HTMLButtonElement && !confirmDeleteButton.disabled
			).toBe(true);
		});
		confirmDeleteButton.click();
		await vi.waitFor(() => {
			expect(adminRepo.tasksRepo.removeProject).toHaveBeenCalledWith('project-1');
		});
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('delete failed');
		});
	});

	it('should handle member dialog empty, failure, toggle, and close states', async () => {
		render(ProjectsAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(findProjectRow('Project 1')).toBeTruthy();
		});

		const memberButton = findProjectRow('Project 1')?.querySelectorAll('button').item(2);
		if (!(memberButton instanceof HTMLButtonElement)) {
			throw new Error('expected member button');
		}

		adminRepo.setUsers([]);
		adminRepo.tasksRepo.listUsers.mockResolvedValueOnce([]);
		adminRepo.tasksRepo.listProjectMembers.mockResolvedValueOnce([]);
		memberButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				'ユーザーが存在しません。先に Users 画面でユーザーを作成してください。'
			);
		});

		const membersBackdrop = [...document.querySelectorAll('div[role="presentation"]')].at(-1);
		if (!(membersBackdrop instanceof HTMLDivElement)) {
			throw new Error('expected members dialog backdrop');
		}
		membersBackdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).not.toContain('プロジェクトメンバー');
		});

		adminRepo.setUsers([
			{ id: 'user-1', name: '伊藤', updatedAt: '2026-03-01T00:00:00.000Z' },
			{ id: 'user-2', name: '佐藤', updatedAt: '2026-03-01T00:00:00.000Z' }
		]);
		adminRepo.tasksRepo.listUsers.mockRejectedValueOnce(new Error('members load failed'));
		memberButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('members load failed');
		});

		const closeMembersButton = [...document.querySelectorAll('button')].find(
			(button) => button.getAttribute('aria-label') === 'close members dialog'
		);
		if (!(closeMembersButton instanceof HTMLButtonElement)) {
			throw new Error('expected close members button');
		}
		closeMembersButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).not.toContain('members load failed');
		});

		memberButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[type="checkbox"][value="user-1"]')).toBeTruthy();
		});
		const existingMemberCheckbox = document.querySelector('input[type="checkbox"][value="user-1"]');
		if (!(existingMemberCheckbox instanceof HTMLInputElement)) {
			throw new Error('expected existing member checkbox');
		}
		expect(existingMemberCheckbox.checked).toBe(true);
		existingMemberCheckbox.checked = false;
		existingMemberCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

		adminRepo.tasksRepo.setProjectMembers.mockRejectedValueOnce(new Error('save members failed'));
		const saveMembersButton = [...document.querySelectorAll('button')].find(
			(button) =>
				button.textContent?.trim() === '保存' &&
				button.closest('[role="dialog"]')?.textContent?.includes('プロジェクトメンバー')
		);
		if (!(saveMembersButton instanceof HTMLButtonElement)) {
			throw new Error('expected save members button');
		}
		saveMembersButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('save members failed');
		});
	});
});
