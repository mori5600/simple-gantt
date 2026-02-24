import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readText(url: URL): string {
	return readFileSync(url, 'utf8');
}

describe('a11y controls regression checks', () => {
	it('associates import file input with a label in GanttToolbar', () => {
		const source = readText(new URL('./components/gantt/GanttToolbar.svelte', import.meta.url));

		expect(source).toMatch(/<label\s+for="gantt-import-file"\s+class="sr-only">/);
		expect(source).toMatch(/<input[\s\S]*id="gantt-import-file"[\s\S]*class="sr-only"/);
	});

	it('keeps tap targets large enough in TaskListPane header resize controls', () => {
		const source = readText(new URL('./components/gantt/TaskListPane.svelte', import.meta.url));

		expect(source).toMatch(/h-12 w-12[^"\n]*cursor-col-resize/);
		expect(source).not.toMatch(/cursor-col-resize[^"\n]*w-11/);
		expect(source).not.toContain('列幅を自動調整');
	});

	it('renders column auto-fit control beside export button in toolbar', () => {
		const toolbarSource = readText(
			new URL('./components/gantt/GanttToolbar.svelte', import.meta.url)
		);
		const filtersSource = readText(
			new URL('./components/gantt/TaskFiltersBar.svelte', import.meta.url)
		);

		expect(toolbarSource).toMatch(/isListColumnAuto/);
		expect(toolbarSource).toMatch(/onclick=\{onAutoFit\}/);
		expect(toolbarSource).toMatch(/aria-pressed=\{isListColumnAuto\}/);
		expect(toolbarSource).toMatch(/Auto Fit/);
		const exportButtonIndex = toolbarSource.indexOf('onclick={toggleExportMenu}');
		const autoFitButtonIndex = toolbarSource.indexOf('onclick={onAutoFit}');
		expect(exportButtonIndex).toBeGreaterThan(-1);
		expect(autoFitButtonIndex).toBeGreaterThan(exportButtonIndex);
		expect(toolbarSource).toMatch(/h-10[\s\S]*px-4[\s\S]*text-sm/);
		expect(filtersSource).not.toMatch(/onAutoFit|isListColumnAuto|列幅自動調整/);
	});
});
