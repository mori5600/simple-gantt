import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { POLLING_SETTINGS_STORAGE_KEY } from '$lib/shared/pollingSettings';
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

	it('should restore custom settings and reset them to defaults', async () => {
		localStorage.setItem(
			POLLING_SETTINGS_STORAGE_KEY,
			JSON.stringify({
				ganttIntervalMs: null,
				adminIntervalMs: 30000
			})
		);

		render(Page);

		await expect
			.element(page.getByRole('combobox', { name: 'ガント画面の同期間隔' }))
			.toHaveValue('off');
		await expect
			.element(page.getByRole('combobox', { name: '管理画面の同期間隔' }))
			.toHaveValue('30000');
		await expect.element(page.getByRole('button', { name: '既定値に戻す' })).toBeEnabled();

		await page.getByRole('button', { name: '既定値に戻す' }).click();

		await expect.element(page.getByText('既定値に戻しました。')).toBeInTheDocument();
		expect(localStorage.getItem(POLLING_SETTINGS_STORAGE_KEY)).toBeNull();
		await expect.element(page.getByRole('button', { name: '既定値に戻す' })).toBeDisabled();
	});

	it('should show validation errors for unsupported interval values', async () => {
		render(Page);

		const ganttSelect = document.querySelector('select[name="ganttPollingInterval"]');
		if (!(ganttSelect instanceof HTMLSelectElement)) {
			throw new Error('expected gantt interval select');
		}
		const invalidOption = document.createElement('option');
		invalidOption.value = '1234';
		invalidOption.textContent = 'invalid';
		ganttSelect.append(invalidOption);
		ganttSelect.value = '1234';
		ganttSelect.dispatchEvent(new Event('change', { bubbles: true }));

		await page.getByRole('button', { name: '保存' }).click();

		await expect.element(page.getByText('ガント画面の同期間隔が不正です。')).toBeInTheDocument();
	});
});
