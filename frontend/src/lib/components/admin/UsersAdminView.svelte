<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { resolvePollIntervalMs, startVisibilityPolling } from '$lib/shared/polling';
	import { resolvePollingIntervalForScope } from '$lib/shared/pollingSettings';
	import { tasksRepo, type UserSummary } from '$lib/data/tasks/repo';

	let { showBackLink = true } = $props<{ showBackLink?: boolean }>();
	const DEFAULT_ADMIN_SYNC_POLL_INTERVAL_MS = resolvePollIntervalMs(
		20_000,
		'VITE_ADMIN_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_ADMIN_SYNC_POLL_INTERVAL_MS',
		'VITE_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_SYNC_POLL_INTERVAL_MS'
	);

	let users = $state<UserSummary[]>([]);
	let isLoading = $state(true);
	let isSubmitting = $state(false);
	let error = $state('');
	let success = $state('');

	let createName = $state('');
	let editingUserId = $state<string | null>(null);
	let editingName = $state('');
	let searchQuery = $state('');

	const canCreate = $derived(createName.trim().length > 0 && !isSubmitting);
	const filteredUsers = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			return users;
		}

		return users.filter((user) => {
			const name = user.name.toLowerCase();
			const id = user.id.toLowerCase();
			return name.includes(query) || id.includes(query);
		});
	});

	onMount(() => {
		void loadUsers();
		const syncPollIntervalMs = resolvePollingIntervalForScope({
			scope: 'admin',
			defaultIntervalMs: DEFAULT_ADMIN_SYNC_POLL_INTERVAL_MS,
			storage: typeof localStorage === 'undefined' ? undefined : localStorage
		});
		const syncPolling =
			syncPollIntervalMs === null
				? null
				: startVisibilityPolling({
						intervalMs: syncPollIntervalMs,
						isEnabled: () => !isSubmitting && editingUserId === null,
						onPoll: async () => {
							await loadUsers({ silent: true });
						},
						onError: (pollError) => {
							error =
								pollError instanceof Error ? pollError.message : 'ユーザー同期に失敗しました。';
						}
					});
		return () => {
			syncPolling?.stop();
		};
	});

	async function loadUsers(options: { silent?: boolean } = {}): Promise<void> {
		const { silent = false } = options;
		if (!silent) {
			isLoading = true;
			error = '';
		}

		try {
			users = await tasksRepo.listUserSummaries();
		} catch (loadError) {
			error =
				loadError instanceof Error ? loadError.message : 'ユーザー一覧の読み込みに失敗しました。';
		} finally {
			if (!silent) {
				isLoading = false;
			}
		}
	}

	function beginEdit(user: UserSummary): void {
		editingUserId = user.id;
		editingName = user.name;
		success = '';
		error = '';
	}

	function cancelEdit(): void {
		editingUserId = null;
		editingName = '';
	}

	async function submitCreate(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		const name = createName.trim();
		if (!name) {
			error = 'ユーザー名は必須です。';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		try {
			await tasksRepo.createUser({ name });
			createName = '';
			success = 'ユーザーを作成しました。';
			await loadUsers();
		} catch (createError) {
			error = createError instanceof Error ? createError.message : 'ユーザー作成に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitEdit(user: UserSummary): Promise<void> {
		const name = editingName.trim();
		if (!name) {
			error = 'ユーザー名は必須です。';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		try {
			await tasksRepo.updateUser(user.id, {
				name,
				updatedAt: user.updatedAt
			});
			success = 'ユーザーを更新しました。';
			cancelEdit();
			await loadUsers();
		} catch (updateError) {
			error = updateError instanceof Error ? updateError.message : 'ユーザー更新に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}

	async function removeUser(user: UserSummary): Promise<void> {
		if (user.taskCount > 0 || typeof window === 'undefined') {
			return;
		}

		const confirmed = window.confirm(`"${user.name}" を削除します。よろしいですか？`);
		if (!confirmed) {
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		try {
			await tasksRepo.removeUser(user.id);
			success = 'ユーザーを削除しました。';
			await loadUsers();
		} catch (removeError) {
			error = removeError instanceof Error ? removeError.message : 'ユーザー削除に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<header class="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 sm:px-5">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="space-y-1">
			<p class="text-[10px] font-medium tracking-[0.28em] text-slate-400 uppercase">Users</p>
			<h1 class="text-base font-medium text-slate-900">ユーザー管理</h1>
		</div>
		{#if showBackLink}
			<a
				href={resolve('/')}
				class="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
			>
				ガントへ戻る
			</a>
		{/if}
	</div>
</header>

<section class="rounded-2xl border border-slate-200 bg-white/85 p-5">
	<form class="grid gap-3" onsubmit={submitCreate}>
		<label class="grid gap-1 text-sm font-semibold text-slate-700">
			<span>新規ユーザー名</span>
			<input
				type="text"
				name="createUserName"
				class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-slate-400/35 transition outline-none focus:ring-2"
				placeholder="例: 田中"
				value={createName}
				oninput={(event) => (createName = (event.currentTarget as HTMLInputElement).value)}
			/>
		</label>
		<div class="flex">
			<button
				type="submit"
				class="h-10 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-stone-50 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
				disabled={!canCreate}
			>
				追加
			</button>
		</div>
	</form>
	{#if error}
		<p class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}
	{#if success}
		<p class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
	{/if}
</section>

<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white/85">
	<div class="border-b border-slate-200 px-4 py-3">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm font-medium text-slate-700">Users</p>
			<label class="flex min-w-56 items-center gap-2 text-sm text-slate-600">
				<span class="font-medium whitespace-nowrap text-slate-700">検索</span>
				<input
					type="search"
					name="userSearch"
					class="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 ring-slate-400/35 transition outline-none focus:ring-2"
					placeholder="ユーザー名 / ID"
					value={searchQuery}
					oninput={(event) => (searchQuery = (event.currentTarget as HTMLInputElement).value)}
					aria-label="ユーザー検索"
				/>
			</label>
		</div>
	</div>
	{#if isLoading}
		<div class="px-4 py-6 text-sm text-slate-500">読み込み中...</div>
	{:else if users.length === 0}
		<div class="px-4 py-6 text-sm text-slate-500">ユーザーがありません。</div>
	{:else if filteredUsers.length === 0}
		<div class="px-4 py-6 text-sm text-slate-500">検索条件に一致するユーザーがありません。</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead class="bg-stone-50 text-left text-[11px] tracking-[0.16em] text-slate-400 uppercase">
					<tr>
						<th class="px-4 py-2">Name</th>
						<th class="px-4 py-2 text-right">Tasks</th>
						<th class="px-4 py-2 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredUsers as user (user.id)}
						<tr class="border-t border-slate-200">
							<td class="px-4 py-2">
								{#if editingUserId === user.id}
									<input
										type="text"
										name="editUserName"
										class="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm ring-slate-400/35 transition outline-none focus:ring-2"
										value={editingName}
										oninput={(event) =>
											(editingName = (event.currentTarget as HTMLInputElement).value)}
									/>
								{:else}
									<span class="font-medium text-slate-800">{user.name}</span>
								{/if}
							</td>
							<td class="px-4 py-2 text-right text-slate-600 tabular-nums">{user.taskCount}</td>
							<td class="px-4 py-2">
								<div class="flex flex-wrap items-center justify-end gap-2">
									{#if editingUserId === user.id}
										<button
											type="button"
											class="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-stone-50 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
											onclick={() => void submitEdit(user)}
											disabled={editingName.trim().length === 0 || isSubmitting}
										>
											保存
										</button>
										<button
											type="button"
											class="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-stone-50"
											onclick={cancelEdit}
										>
											取消
										</button>
									{:else}
										<button
											type="button"
											class="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
											onclick={() => beginEdit(user)}
											disabled={isSubmitting}
										>
											編集
										</button>
										<button
											type="button"
											class="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50/60 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
											onclick={() => void removeUser(user)}
											disabled={user.taskCount > 0 || isSubmitting}
											title={user.taskCount > 0
												? '担当タスクがあるため削除できません'
												: 'ユーザーを削除'}
										>
											削除
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
