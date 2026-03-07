<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ZoomLevel } from '$lib/features/gantt/types';
	import type { Project } from '$lib/data/tasks/repo';

	type ExportFormat = 'csv' | 'xlsx';

	let {
		zoom,
		projects,
		selectedProjectId,
		isListColumnAuto,
		hasSelectedTask,
		importDisabled,
		isImporting,
		exportDisabled,
		isExporting,
		hasUndoableChange,
		isUndoing,
		onProjectChange,
		onCreate,
		onEdit,
		onDelete,
		onJumpToToday,
		onAutoFit,
		onUndo,
		onImport,
		onExport,
		onZoomChange
	} = $props<{
		zoom: ZoomLevel;
		projects: readonly Project[];
		selectedProjectId: string;
		isListColumnAuto: boolean;
		hasSelectedTask: boolean;
		importDisabled: boolean;
		isImporting: boolean;
		exportDisabled: boolean;
		isExporting: boolean;
		hasUndoableChange: boolean;
		isUndoing: boolean;
		onProjectChange: (projectId: string) => void;
		onCreate: () => void;
		onEdit: () => void;
		onDelete: () => void;
		onJumpToToday: () => void;
		onAutoFit: () => void;
		onUndo: () => void;
		onImport: (file: File) => void;
		onExport: (format: ExportFormat) => void;
		onZoomChange: (zoom: ZoomLevel) => void;
	}>();

	let isExportMenuOpen = $state(false);
	let exportMenuContainer: HTMLDivElement | null = null;
	let importFileInput: HTMLInputElement | null = null;
	const selectedProjectName = $derived.by(
		() => projects.find((project: Project) => project.id === selectedProjectId)?.name ?? 'Project'
	);

	function toggleExportMenu(): void {
		if (exportDisabled) {
			return;
		}
		isExportMenuOpen = !isExportMenuOpen;
	}

	function closeExportMenu(): void {
		isExportMenuOpen = false;
	}

	function selectExport(format: ExportFormat): void {
		closeExportMenu();
		onExport(format);
	}

	function openImportFileDialog(): void {
		if (importDisabled || isImporting) {
			return;
		}
		importFileInput?.click();
	}

	function handleImportFileChange(event: Event): void {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) {
			return;
		}
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			return;
		}
		onImport(file);
	}

	onMount(() => {
		function handleDocumentClick(event: MouseEvent): void {
			if (!isExportMenuOpen) {
				return;
			}
			const target = event.target;
			if (!(target instanceof Node)) {
				return;
			}
			if (exportMenuContainer?.contains(target)) {
				return;
			}
			closeExportMenu();
		}

		document.addEventListener('click', handleDocumentClick);
		return () => {
			document.removeEventListener('click', handleDocumentClick);
		};
	});
</script>

<header class="sticky top-0 z-30 border-b border-slate-200/90 bg-stone-50/95 backdrop-blur">
	<div class="px-3 py-4 sm:px-5">
		<h1 class="sr-only">{selectedProjectName} のガント</h1>
		<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
			<div class="min-w-0 space-y-4">
				<div class="flex min-w-0 flex-wrap items-center gap-3">
					<label
						class="flex max-w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 px-3 py-2.5"
					>
						<span class="text-[10px] font-medium tracking-[0.28em] text-slate-400 uppercase">
							Project
						</span>
						<select
							name="selectedProjectId"
							class="max-w-72 min-w-36 truncate border-0 bg-transparent px-0 text-base font-medium text-slate-800 transition outline-none focus:outline-none"
							value={selectedProjectId}
							onchange={(event) =>
								onProjectChange((event.currentTarget as HTMLSelectElement).value)}
						>
							{#each projects as project (project.id)}
								<option value={project.id}>{project.name}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="flex flex-wrap items-center gap-2.5">
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="h-10 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-stone-50 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
							onclick={onCreate}
							disabled={selectedProjectId.length === 0 || projects.length === 0}
						>
							タスク追加
						</button>
						<button
							type="button"
							class="h-10 rounded-xl border border-slate-200 bg-white/85 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
							onclick={onEdit}
							disabled={!hasSelectedTask}
						>
							編集
						</button>
						<button
							type="button"
							class="h-10 rounded-xl border border-slate-200 bg-white/85 px-4 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50/60 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
							onclick={onDelete}
							disabled={!hasSelectedTask}
						>
							削除
						</button>
						<button
							type="button"
							class="h-10 rounded-xl border border-slate-200 bg-white/85 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
							onclick={openImportFileDialog}
							disabled={importDisabled || isImporting}
						>
							{isImporting ? '取込中...' : '取込'}
						</button>
						<label for="gantt-import-file" class="sr-only">取込ファイル</label>
						<input
							id="gantt-import-file"
							type="file"
							accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							class="sr-only"
							bind:this={importFileInput}
							onchange={handleImportFileChange}
						/>
						<div class="relative" bind:this={exportMenuContainer}>
							<button
								type="button"
								class="h-10 rounded-xl border border-slate-200 bg-white/85 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
								onclick={toggleExportMenu}
								disabled={exportDisabled}
								aria-haspopup="menu"
								aria-expanded={isExportMenuOpen}
							>
								{isExporting ? '出力中...' : '出力'}
							</button>
							{#if isExportMenuOpen}
								<div
									class="absolute top-11 left-0 z-40 min-w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/5"
									role="menu"
									aria-label="export format"
								>
									<button
										type="button"
										class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-45"
										onclick={() => selectExport('csv')}
										disabled={isExporting}
									>
										CSV
									</button>
									<button
										type="button"
										class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-45"
										onclick={() => selectExport('xlsx')}
										disabled={isExporting}
									>
										XLSX
									</button>
								</div>
							{/if}
						</div>
					</div>

					<div class="h-5 w-px bg-slate-200"></div>

					<div class="flex flex-wrap items-center gap-2" role="group" aria-label="view utilities">
						<button
							type="button"
							class={`h-9 rounded-xl border px-3.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:outline-none ${
								isListColumnAuto
									? 'border-slate-300 bg-slate-100 text-slate-800'
									: 'border-slate-200 bg-white/80 text-slate-600 hover:bg-white'
							}`}
							onclick={onAutoFit}
							aria-pressed={isListColumnAuto}
							title="タスクリストの列幅を自動調整"
						>
							Auto Fit
						</button>
						<button
							type="button"
							class="h-9 rounded-xl border border-slate-200 bg-white/80 px-3.5 text-sm font-medium text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
							onclick={onUndo}
							disabled={!hasUndoableChange || isUndoing}
							title="直前の変更を元に戻す"
						>
							{isUndoing ? 'Undo...' : 'Undo'}
						</button>
						<button
							type="button"
							class="h-9 rounded-xl border border-slate-200 bg-white/80 px-3.5 text-sm font-medium text-slate-600 transition hover:bg-white"
							onclick={onJumpToToday}
							title="今日へ移動"
						>
							今日
						</button>
					</div>
				</div>
			</div>

			<div class="flex flex-col items-start gap-3 xl:items-end xl:justify-self-end">
				<div class="flex flex-wrap items-center gap-2">
					<a
						href={resolve('/admin/projects')}
						class="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-3 text-slate-600 transition hover:bg-white hover:text-slate-800"
						aria-label="管理"
						title="管理"
					>
						<i class="bi bi-people text-base" aria-hidden="true"></i>
					</a>
					<a
						href={resolve('/settings')}
						class="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-3 text-slate-600 transition hover:bg-white hover:text-slate-800"
						aria-label="設定"
						title="設定"
					>
						<i class="bi bi-gear text-base" aria-hidden="true"></i>
					</a>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-[10px] font-medium tracking-[0.24em] text-slate-400 uppercase"
						>Zoom</span
					>
					<div
						class="inline-flex rounded-full border border-slate-200 bg-white/80 p-1"
						role="group"
						aria-label="zoom"
					>
						<button
							type="button"
							class={`rounded-full px-4 py-1 text-sm font-medium transition ${
								zoom === 'day' ? 'bg-slate-800 text-stone-50' : 'text-slate-600 hover:bg-stone-100'
							}`}
							aria-pressed={zoom === 'day'}
							onclick={() => onZoomChange('day')}
						>
							Day
						</button>
						<button
							type="button"
							class={`rounded-full px-4 py-1 text-sm font-medium transition ${
								zoom === 'week' ? 'bg-slate-800 text-stone-50' : 'text-slate-600 hover:bg-stone-100'
							}`}
							aria-pressed={zoom === 'week'}
							onclick={() => onZoomChange('week')}
						>
							Week
						</button>
						<button
							type="button"
							class={`rounded-full px-4 py-1 text-sm font-medium transition ${
								zoom === 'month'
									? 'bg-slate-800 text-stone-50'
									: 'text-slate-600 hover:bg-stone-100'
							}`}
							aria-pressed={zoom === 'month'}
							onclick={() => onZoomChange('month')}
						>
							Month
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</header>
