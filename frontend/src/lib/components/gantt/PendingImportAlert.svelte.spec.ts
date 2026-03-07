import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PendingImportAlert from './PendingImportAlert.svelte';

describe('PendingImportAlert.svelte', () => {
	it('should render missing assignee details and invoke actions', async () => {
		const onContinue = vi.fn();
		const onCancel = vi.fn();

		render(PendingImportAlert, {
			props: {
				fileName: 'tasks.csv',
				missingAssigneeNames: ['佐藤', '山田'],
				isImporting: false,
				onContinue,
				onCancel
			}
		});

		await expect.element(page.getByText('未登録担当者が見つかりました (2 名)')).toBeInTheDocument();
		await expect
			.element(
				page.getByText('tasks.csv に未登録担当者が含まれています。ユーザーを作成して続行しますか？')
			)
			.toBeInTheDocument();
		await expect.element(page.getByText('佐藤, 山田')).toBeInTheDocument();

		await page.getByRole('button', { name: '不足ユーザーを作成して続行' }).click();
		await page.getByRole('button', { name: 'キャンセル' }).click();

		expect(onContinue).toHaveBeenCalledOnce();
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it('should disable actions while import is in progress and fallback to default file label', async () => {
		render(PendingImportAlert, {
			props: {
				fileName: '',
				missingAssigneeNames: ['佐藤'],
				isImporting: true,
				onContinue: vi.fn(),
				onCancel: vi.fn()
			}
		});

		await expect
			.element(
				page.getByText(
					'取込ファイル に未登録担当者が含まれています。ユーザーを作成して続行しますか？'
				)
			)
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: '不足ユーザーを作成して続行' }))
			.toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
	});
});
