import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { POLLING_SETTINGS_STORAGE_KEY } from '$lib/pollingSettings';
import Page from './+page.svelte';

describe('/settings/+page.svelte', () => {
	beforeEach(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.clear();
		}
	});

	it('should render settings page controls', async () => {
		render(Page);

		await expect.element(page.getByRole('heading', { name: '設定' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('combobox', { name: 'ガント画面の同期間隔' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('combobox', { name: '管理画面の同期間隔' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '保存' })).toBeInTheDocument();
	});

	it('should save polling settings into localStorage', async () => {
		render(Page);

		await page.getByRole('combobox', { name: 'ガント画面の同期間隔' }).selectOptions('off');
		await page.getByRole('combobox', { name: '管理画面の同期間隔' }).selectOptions('30000');
		await page.getByRole('button', { name: '保存' }).click();

		await expect
			.element(page.getByText('設定を保存しました。画面を開き直すと反映されます。'))
			.toBeInTheDocument();
		const raw = localStorage.getItem(POLLING_SETTINGS_STORAGE_KEY);
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw ?? '{}')).toEqual({
			ganttIntervalMs: null,
			adminIntervalMs: 30000
		});
	});
});
