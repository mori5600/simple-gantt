import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const adminUsersRepo = vi.hoisted(() => {
	const initialUsers = [
		{
			id: 'user-1',
			name: '伊藤',
			taskCount: 2,
			updatedAt: '2026-03-01T00:00:00.000Z'
		},
		{
			id: 'user-2',
			name: '佐藤',
			taskCount: 0,
			updatedAt: '2026-03-01T00:00:00.000Z'
		}
	];
	let users = initialUsers.map((user) => ({ ...user }));

	const tasksRepo = {
		listUserSummaries: vi.fn(async () => users.map((user) => ({ ...user }))),
		createUser: vi.fn(async ({ name }: { name: string }) => {
			const created = {
				id: `user-${users.length + 1}`,
				name,
				taskCount: 0,
				updatedAt: '2026-03-02T00:00:00.000Z'
			};
			users = [...users, created];
			return { id: created.id, name: created.name, updatedAt: created.updatedAt };
		}),
		updateUser: vi.fn(async (id: string, input: { name: string; updatedAt: string }) => {
			users = users.map((user) =>
				user.id === id ? { ...user, name: input.name, updatedAt: input.updatedAt } : user
			);
			const user = users.find((entry) => entry.id === id)!;
			return { id: user.id, name: user.name, updatedAt: user.updatedAt };
		}),
		removeUser: vi.fn(async (id: string) => {
			users = users.filter((user) => user.id !== id);
		})
	};

	return {
		tasksRepo,
		setUsers(nextUsers: typeof initialUsers) {
			users = nextUsers.map((user) => ({ ...user }));
		},
		reset() {
			users = initialUsers.map((user) => ({ ...user }));
			vi.clearAllMocks();
		}
	};
});

vi.mock('$lib/data/tasks/repo', () => ({
	tasksRepo: adminUsersRepo.tasksRepo
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

import { startVisibilityPolling } from '$lib/shared/polling';
import { resolvePollingIntervalForScope } from '$lib/shared/pollingSettings';
import UsersAdminView from './UsersAdminView.svelte';

function findUserRow(name: string): HTMLTableRowElement | undefined {
	return [...document.querySelectorAll('tbody tr')].find((row) =>
		row.textContent?.includes(name)
	) as HTMLTableRowElement | undefined;
}

describe('UsersAdminView.svelte', () => {
	beforeEach(() => {
		adminUsersRepo.reset();
		vi.restoreAllMocks();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
	});

	it('should create, search, and edit users', async () => {
		render(UsersAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('伊藤');
		});

		const createInput = document.querySelector('input[name="createUserName"]');
		if (!(createInput instanceof HTMLInputElement)) {
			throw new Error('expected create user input');
		}
		createInput.value = '山田';
		createInput.dispatchEvent(new Event('input', { bubbles: true }));
		(document.querySelector('form') as HTMLFormElement).dispatchEvent(
			new SubmitEvent('submit', { bubbles: true, cancelable: true })
		);

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('ユーザーを作成しました。');
			expect(document.body.textContent).toContain('山田');
		});

		const searchInput = document.querySelector('input[name="userSearch"]');
		if (!(searchInput instanceof HTMLInputElement)) {
			throw new Error('expected user search input');
		}
		searchInput.value = 'zzz';
		searchInput.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('検索条件に一致するユーザーがありません。');
		});
		searchInput.value = '';
		searchInput.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() => {
			expect(findUserRow('伊藤')).toBeTruthy();
		});

		const userRow = findUserRow('伊藤');
		const editButton = userRow?.querySelector('button');
		if (!(editButton instanceof HTMLButtonElement)) {
			throw new Error('expected edit user button');
		}
		editButton.click();

		await vi.waitFor(() => {
			expect(document.querySelector('input[name="editUserName"]')).toBeTruthy();
		});
		const editInput = document.querySelector('input[name="editUserName"]');
		if (!(editInput instanceof HTMLInputElement)) {
			throw new Error('expected edit user input');
		}
		editInput.value = '伊藤更新';
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
			throw new Error('expected save user button');
		}
		saveButton.click();

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('ユーザーを更新しました。');
			expect(document.body.textContent).toContain('伊藤更新');
		});
	});

	it('should delete removable users and keep locked delete buttons disabled', async () => {
		render(UsersAdminView, {
			props: {
				showBackLink: true
			}
		});

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('佐藤');
		});
		expect(document.body.textContent).toContain('ガントへ戻る');

		const lockedDelete = findUserRow('伊藤')?.querySelector('button[title*="担当タスク"]');
		const removableDelete = findUserRow('佐藤')?.querySelector('button[title="ユーザーを削除"]');

		if (
			!(lockedDelete instanceof HTMLButtonElement) ||
			!(removableDelete instanceof HTMLButtonElement)
		) {
			throw new Error('expected delete buttons');
		}

		expect(lockedDelete.disabled).toBe(true);
		removableDelete.click();

		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('ユーザーを削除しました。');
		});
		expect(adminUsersRepo.tasksRepo.removeUser).toHaveBeenCalledWith('user-2');
		expect(findUserRow('佐藤')).toBeUndefined();
		expect(window.confirm).toHaveBeenCalled();
	});

	it('should handle polling, loading failure, and empty list states', async () => {
		const stop = vi.fn();
		let pollingOptions: Parameters<typeof startVisibilityPolling>[0] | undefined;

		vi.mocked(resolvePollingIntervalForScope).mockReturnValue(12_000);
		vi.mocked(startVisibilityPolling).mockImplementation((options) => {
			pollingOptions = options;
			return { stop, trigger: vi.fn() };
		});

		const rendered = render(UsersAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(findUserRow('伊藤')).toBeTruthy();
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

		const editButton = findUserRow('伊藤')?.querySelector('button');
		if (!(editButton instanceof HTMLButtonElement)) {
			throw new Error('expected edit button');
		}
		editButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[name="editUserName"]')).toBeTruthy();
		});
		expect(pollingOptions.isEnabled()).toBe(false);

		const cancelButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '取消'
		);
		if (!(cancelButton instanceof HTMLButtonElement)) {
			throw new Error('expected cancel button');
		}
		cancelButton.click();
		expect(pollingOptions.isEnabled()).toBe(true);

		await pollingOptions.onPoll();
		expect(adminUsersRepo.tasksRepo.listUserSummaries).toHaveBeenCalledTimes(2);

		pollingOptions.onError(new Error('user sync failed'));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('user sync failed');
		});

		rendered.unmount();
		expect(stop).toHaveBeenCalledTimes(1);

		adminUsersRepo.tasksRepo.listUserSummaries.mockRejectedValueOnce(new Error('load failed'));
		render(UsersAdminView, {
			props: {
				showBackLink: false
			}
		});
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('load failed');
		});

		adminUsersRepo.tasksRepo.listUserSummaries.mockResolvedValueOnce([]);
		render(UsersAdminView, {
			props: {
				showBackLink: false
			}
		});
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('ユーザーがありません。');
		});
	});

	it('should validate and surface create and edit failures', async () => {
		render(UsersAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(findUserRow('伊藤')).toBeTruthy();
		});

		const form = document.querySelector('form');
		if (!(form instanceof HTMLFormElement)) {
			throw new Error('expected create form');
		}

		form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('ユーザー名は必須です。');
		});

		const createInput = document.querySelector('input[name="createUserName"]');
		if (!(createInput instanceof HTMLInputElement)) {
			throw new Error('expected create user input');
		}
		adminUsersRepo.tasksRepo.createUser.mockRejectedValueOnce(new Error('create failed'));
		createInput.value = '失敗ユーザー';
		createInput.dispatchEvent(new Event('input', { bubbles: true }));
		form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('create failed');
		});

		const editButton = findUserRow('伊藤')?.querySelector('button');
		if (!(editButton instanceof HTMLButtonElement)) {
			throw new Error('expected edit button');
		}
		editButton.click();
		await vi.waitFor(() => {
			expect(document.querySelector('input[name="editUserName"]')).toBeTruthy();
		});

		const editInput = document.querySelector('input[name="editUserName"]');
		if (!(editInput instanceof HTMLInputElement)) {
			throw new Error('expected edit user input');
		}
		editInput.value = '   ';
		editInput.dispatchEvent(new Event('input', { bubbles: true }));

		const saveButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '保存'
		);
		if (!(saveButton instanceof HTMLButtonElement)) {
			throw new Error('expected save user button');
		}
		saveButton.disabled = false;
		saveButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('ユーザー名は必須です。');
		});

		const refreshedEditInput = document.querySelector('input[name="editUserName"]');
		const refreshedSaveButton = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === '保存'
		);
		if (
			!(refreshedEditInput instanceof HTMLInputElement) ||
			!(refreshedSaveButton instanceof HTMLButtonElement)
		) {
			throw new Error('expected refreshed edit controls');
		}
		refreshedEditInput.value = '更新失敗';
		refreshedEditInput.dispatchEvent(new Event('input', { bubbles: true }));
		adminUsersRepo.tasksRepo.updateUser.mockRejectedValueOnce(new Error('update failed'));
		refreshedSaveButton.disabled = false;
		refreshedSaveButton.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('update failed');
		});
	});

	it('should keep users when delete is cancelled and surface remove failures', async () => {
		vi.mocked(window.confirm).mockReturnValueOnce(false);
		render(UsersAdminView, {
			props: {
				showBackLink: false
			}
		});

		await vi.waitFor(() => {
			expect(findUserRow('佐藤')).toBeTruthy();
		});

		const removableDelete = findUserRow('佐藤')?.querySelector('button[title="ユーザーを削除"]');
		if (!(removableDelete instanceof HTMLButtonElement)) {
			throw new Error('expected removable delete button');
		}
		removableDelete.click();
		expect(adminUsersRepo.tasksRepo.removeUser).not.toHaveBeenCalled();
		expect(findUserRow('佐藤')).toBeTruthy();

		adminUsersRepo.tasksRepo.removeUser.mockRejectedValueOnce(new Error('remove failed'));
		removableDelete.click();
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('remove failed');
		});
	});
});
