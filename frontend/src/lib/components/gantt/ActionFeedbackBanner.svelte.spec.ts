import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ActionFeedbackBanner from './ActionFeedbackBanner.svelte';

describe('ActionFeedbackBanner.svelte', () => {
	it('should render both error and success messages when provided', async () => {
		render(ActionFeedbackBanner, {
			props: {
				actionError: '保存に失敗しました。',
				actionSuccess: '保存しました。'
			}
		});

		await expect.element(page.getByText('保存に失敗しました。')).toBeInTheDocument();
		await expect.element(page.getByText('保存しました。')).toBeInTheDocument();
	});

	it('should render nothing when no feedback exists', async () => {
		render(ActionFeedbackBanner, {
			props: {
				actionError: '',
				actionSuccess: ''
			}
		});

		await expect.element(page.getByText('保存に失敗しました。')).not.toBeInTheDocument();
		await expect.element(page.getByText('保存しました。')).not.toBeInTheDocument();
	});
});
