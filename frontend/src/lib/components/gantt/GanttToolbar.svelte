<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ZoomLevel } from '$lib/features/gantt/types';
	import type { Project } from '$lib/tasksRepo';

	type ExportFormat = 'csv' | 'xlsx';

	let {
		zoom,
		projects,
		selectedProjectId,
		hasSelectedTask,
		exportDisabled,
		isExporting,
		onProjectChange,
		onCreate,
		onEdit,
		onDelete,
		onOpenHistory,
		onExport,
		onZoomChange
	} = $props<{
		zoom: ZoomLevel;
		projects: readonly Project[];
		selectedProjectId: string;
		hasSelectedTask: boolean;
		exportDisabled: boolean;
		isExporting: boolean;
		onProjectChange: (projectId: string) => void;
		onCreate: () => void;
		onEdit: () => void;
		onDelete: () => void;
		onOpenHistory: () => void;
		onExport: (format: ExportFormat) => void;
		onZoomChange: (zoom: ZoomLevel) => void;
	}>();

	let isExportMenuOpen = $state(false);
	let exportMenuContainer: HTMLDivElement | null = null;

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

<header class="sticky top-0 z-30 border-b border-slate-300/90 bg-slate-50/95 backdrop-blur">
	<div class="px-3 py-3 sm:px-4">
		<div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
			<div class="flex min-w-0 flex-col gap-3">
				<div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
					<h1 class="truncate text-base font-semibold text-slate-900 sm:text-lg">
						プロジェクト ガント
					</h1>
					<label
						class="flex min-w-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
					>
						<span
							class="text-[11px] font-semibold tracking-wide text-slate-500 uppercase sm:text-xs"
						>
							Project
						</span>
						<select
							name="selectedProjectId"
							class="max-w-60 min-w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
							value={selectedProjectId}
							onchange={(event) =>
								onProjectChange((event.currentTarget as HTMLSelectElement).value)}
						>
							{#each projects as project (project.id)}
								<option value={project.id}>{project.name}</option>
							{/each}
						</select>
					</label>
					<a
						href={resolve('/projects')}
						class="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
					>
						プロジェクト管理
					</a>
					<a
						href={resolve('/users')}
						class="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
					>
						ユーザー管理
					</a>
					<button
						type="button"
						class="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
						onclick={onOpenHistory}
						disabled={!hasSelectedTask}
					>
						変更履歴
					</button>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-45"
						onclick={onCreate}
						disabled={selectedProjectId.length === 0 || projects.length === 0}
					>
						Task 追加
					</button>
					<button
						type="button"
						class="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
						onclick={onEdit}
						disabled={!hasSelectedTask}
					>
						Edit
					</button>
					<button
						type="button"
						class="h-10 rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
						onclick={onDelete}
						disabled={!hasSelectedTask}
					>
						Delete
					</button>
					<div class="relative" bind:this={exportMenuContainer}>
						<button
							type="button"
							class="h-10 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45"
							onclick={toggleExportMenu}
							disabled={exportDisabled}
							aria-haspopup="menu"
							aria-expanded={isExportMenuOpen}
						>
							{isExporting ? '出力中...' : '出力'}
						</button>
						{#if isExportMenuOpen}
							<div
								class="absolute top-11 left-0 z-40 min-w-36 rounded-xl border border-slate-300 bg-white p-1 shadow-lg"
								role="menu"
								aria-label="export format"
							>
								<button
									type="button"
									class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
									onclick={() => selectExport('csv')}
									disabled={isExporting}
								>
									CSV
								</button>
								<button
									type="button"
									class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
									onclick={() => selectExport('xlsx')}
									disabled={isExporting}
								>
									XLSX
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex items-center gap-2 xl:justify-self-end">
				<span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Zoom</span>
				<div
					class="inline-flex rounded-full border border-slate-300 bg-white p-1 shadow-sm"
					role="group"
					aria-label="zoom"
				>
					<button
						type="button"
						class={`rounded-full px-4 py-1 text-sm font-semibold transition ${
							zoom === 'day' ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-100'
						}`}
						aria-pressed={zoom === 'day'}
						onclick={() => onZoomChange('day')}
					>
						Day
					</button>
					<button
						type="button"
						class={`rounded-full px-4 py-1 text-sm font-semibold transition ${
							zoom === 'week' ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-100'
						}`}
						aria-pressed={zoom === 'week'}
						onclick={() => onZoomChange('week')}
					>
						Week
					</button>
					<button
						type="button"
						class={`rounded-full px-4 py-1 text-sm font-semibold transition ${
							zoom === 'month' ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-100'
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
</header>
