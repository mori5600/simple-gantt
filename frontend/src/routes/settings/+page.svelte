<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { resolvePollIntervalMs } from '$lib/polling';
	import {
		clearPollingSettings,
		loadPollingSettings,
		POLLING_INTERVAL_OPTIONS,
		savePollingSettings
	} from '$lib/pollingSettings';

	const DEFAULT_GANTT_SYNC_POLL_INTERVAL_MS = resolvePollIntervalMs(
		15_000,
		'VITE_GANTT_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_GANTT_SYNC_POLL_INTERVAL_MS',
		'VITE_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_SYNC_POLL_INTERVAL_MS'
	);
	const DEFAULT_ADMIN_SYNC_POLL_INTERVAL_MS = resolvePollIntervalMs(
		20_000,
		'VITE_ADMIN_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_ADMIN_SYNC_POLL_INTERVAL_MS',
		'VITE_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_SYNC_POLL_INTERVAL_MS'
	);

	const intervalOptions = POLLING_INTERVAL_OPTIONS.map((intervalMs) => ({
		value: String(intervalMs),
		label: `${intervalMs / 1_000} 秒`
	}));

	let ganttIntervalValue = $state(String(DEFAULT_GANTT_SYNC_POLL_INTERVAL_MS));
	let adminIntervalValue = $state(String(DEFAULT_ADMIN_SYNC_POLL_INTERVAL_MS));
	let success = $state('');
	let error = $state('');
	let hasCustomSettings = $state(false);

	function toSelectionValue(value: number | null | undefined, fallback: number): string {
		if (value === null) {
			return 'off';
		}
		if (typeof value === 'number') {
			return String(value);
		}
		return String(fallback);
	}

	function toIntervalMs(value: string): number | null {
		if (value === 'off') {
			return null;
		}
		const parsed = Number.parseInt(value, 10);
		if (!Number.isFinite(parsed)) {
			return null;
		}
		return parsed;
	}

	onMount(() => {
		const settings = loadPollingSettings(localStorage);
		ganttIntervalValue = toSelectionValue(
			settings.ganttIntervalMs,
			DEFAULT_GANTT_SYNC_POLL_INTERVAL_MS
		);
		adminIntervalValue = toSelectionValue(
			settings.adminIntervalMs,
			DEFAULT_ADMIN_SYNC_POLL_INTERVAL_MS
		);
		hasCustomSettings =
			settings.ganttIntervalMs !== undefined || settings.adminIntervalMs !== undefined;
	});

	function save(): void {
		error = '';
		success = '';

		const nextGanttIntervalMs = toIntervalMs(ganttIntervalValue);
		const nextAdminIntervalMs = toIntervalMs(adminIntervalValue);

		if (
			nextGanttIntervalMs !== null &&
			!POLLING_INTERVAL_OPTIONS.includes(
				nextGanttIntervalMs as (typeof POLLING_INTERVAL_OPTIONS)[number]
			)
		) {
			error = 'ガント画面の同期間隔が不正です。';
			return;
		}
		if (
			nextAdminIntervalMs !== null &&
			!POLLING_INTERVAL_OPTIONS.includes(
				nextAdminIntervalMs as (typeof POLLING_INTERVAL_OPTIONS)[number]
			)
		) {
			error = '管理画面の同期間隔が不正です。';
			return;
		}

		savePollingSettings(localStorage, {
			ganttIntervalMs: nextGanttIntervalMs as (typeof POLLING_INTERVAL_OPTIONS)[number] | null,
			adminIntervalMs: nextAdminIntervalMs as (typeof POLLING_INTERVAL_OPTIONS)[number] | null
		});
		hasCustomSettings = true;
		success = '設定を保存しました。画面を開き直すと反映されます。';
	}

	function reset(): void {
		clearPollingSettings(localStorage);
		ganttIntervalValue = String(DEFAULT_GANTT_SYNC_POLL_INTERVAL_MS);
		adminIntervalValue = String(DEFAULT_ADMIN_SYNC_POLL_INTERVAL_MS);
		hasCustomSettings = false;
		error = '';
		success = '既定値に戻しました。';
	}
</script>

<div class="min-h-screen bg-slate-100 text-slate-800">
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
		<header class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-slate-900">設定</h1>
				<p class="text-sm text-slate-600">Polling</p>
			</div>
			<a
				href={resolve('/')}
				class="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
			>
				ガントへ戻る
			</a>
		</header>

		<section class="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
			<div class="grid gap-3">
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>ガント画面の同期間隔</span>
					<select
						name="ganttPollingInterval"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						bind:value={ganttIntervalValue}
					>
						<option value="off">OFF</option>
						{#each intervalOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>管理画面の同期間隔</span>
					<select
						name="adminPollingInterval"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						bind:value={adminIntervalValue}
					>
						<option value="off">OFF</option>
						{#each intervalOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<p class="text-xs text-slate-500">
					この設定はブラウザごとに保存されます。既存画面には再表示後に反映されます。
				</p>

				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800"
						onclick={save}
					>
						保存
					</button>
					<button
						type="button"
						class="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
						onclick={reset}
						disabled={!hasCustomSettings}
					>
						既定値に戻す
					</button>
				</div>

				{#if error}
					<p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
				{/if}
				{#if success}
					<p class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
				{/if}
			</div>
		</section>
	</div>
</div>
