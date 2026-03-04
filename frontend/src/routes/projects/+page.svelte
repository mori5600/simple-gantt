<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { resolvePollIntervalMs, startVisibilityPolling } from '$lib/polling';
	import { resolvePollingIntervalForScope } from '$lib/pollingSettings';
	import { tasksRepo, type ProjectSummary, type User } from '$lib/tasksRepo';
	const DEFAULT_ADMIN_SYNC_POLL_INTERVAL_MS = resolvePollIntervalMs(
		20_000,
		'VITE_ADMIN_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_ADMIN_SYNC_POLL_INTERVAL_MS',
		'VITE_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_SYNC_POLL_INTERVAL_MS'
	);

	let projects = $state<ProjectSummary[]>([]);
	let users = $state<User[]>([]);
	let isLoading = $state(true);
	let isSubmitting = $state(false);
	let error = $state('');
	let success = $state('');

	let createName = $state('');
	let editingProjectId = $state<string | null>(null);
	let editingName = $state('');
	let searchQuery = $state('');
	let pendingDeleteProject = $state<ProjectSummary | null>(null);
	let deleteProjectNameInput = $state('');
	let deleteDialogError = $state('');
	let pendingMembersProject = $state<ProjectSummary | null>(null);
	let isMembersLoading = $state(false);
	let memberIds = $state<string[]>([]);
	let membersDialogError = $state('');

	const canCreate = $derived(createName.trim().length > 0 && !isSubmitting);
	const filteredProjects = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			return projects;
		}

		return projects.filter((project) => {
			const name = project.name.toLowerCase();
			const id = project.id.toLowerCase();
			return name.includes(query) || id.includes(query);
		});
	});

	onMount(() => {
		void loadProjects();
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
						isEnabled: () =>
							!isSubmitting &&
							editingProjectId === null &&
							pendingDeleteProject === null &&
							pendingMembersProject === null,
						onPoll: async () => {
							await loadProjects({ silent: true });
						},
						onError: (pollError) => {
							error =
								pollError instanceof Error ? pollError.message : 'プロジェクト同期に失敗しました。';
						}
					});
		return () => {
			syncPolling?.stop();
		};
	});

	async function loadProjects(options: { silent?: boolean } = {}): Promise<void> {
		const { silent = false } = options;
		if (!silent) {
			isLoading = true;
			error = '';
		}

		try {
			projects = await tasksRepo.listProjectSummaries();
		} catch (loadError) {
			error =
				loadError instanceof Error
					? loadError.message
					: 'プロジェクト一覧の読み込みに失敗しました。';
		} finally {
			if (!silent) {
				isLoading = false;
			}
		}
	}

	function beginEdit(project: ProjectSummary): void {
		editingProjectId = project.id;
		editingName = project.name;
		success = '';
		error = '';
	}

	function cancelEdit(): void {
		editingProjectId = null;
		editingName = '';
	}

	async function submitCreate(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		const name = createName.trim();
		if (!name) {
			error = 'プロジェクト名は必須です。';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		try {
			await tasksRepo.createProject({ name });
			createName = '';
			success = 'プロジェクトを作成しました。';
			await loadProjects();
		} catch (createError) {
			error =
				createError instanceof Error ? createError.message : 'プロジェクト作成に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitEdit(project: ProjectSummary): Promise<void> {
		const name = editingName.trim();
		if (!name) {
			error = 'プロジェクト名は必須です。';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		try {
			await tasksRepo.updateProject(project.id, {
				name,
				updatedAt: project.updatedAt
			});
			success = 'プロジェクトを更新しました。';
			cancelEdit();
			await loadProjects();
		} catch (updateError) {
			error =
				updateError instanceof Error ? updateError.message : 'プロジェクト更新に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}

	async function moveProject(projectId: string, direction: 'up' | 'down'): Promise<void> {
		const index = projects.findIndex((project) => project.id === projectId);
		if (index < 0) {
			return;
		}

		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= projects.length) {
			return;
		}

		const reorderedIds = projects.map((project) => project.id);
		[reorderedIds[index], reorderedIds[targetIndex]] = [
			reorderedIds[targetIndex],
			reorderedIds[index]
		];

		isSubmitting = true;
		error = '';
		success = '';
		try {
			await tasksRepo.reorderProjects(reorderedIds);
			success = '並び順を更新しました。';
			await loadProjects();
		} catch (reorderError) {
			error = reorderError instanceof Error ? reorderError.message : '並び順の更新に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}

	function findProjectIndex(projectId: string): number {
		return projects.findIndex((project) => project.id === projectId);
	}

	function beginDeleteProject(project: ProjectSummary): void {
		pendingDeleteProject = project;
		deleteProjectNameInput = '';
		deleteDialogError = '';
	}

	function closeDeleteDialog(): void {
		pendingDeleteProject = null;
		deleteProjectNameInput = '';
		deleteDialogError = '';
	}

	async function beginManageMembers(project: ProjectSummary): Promise<void> {
		pendingMembersProject = project;
		membersDialogError = '';
		memberIds = [];
		isMembersLoading = true;

		try {
			const [loadedUsers, loadedMembers] = await Promise.all([
				tasksRepo.listUsers(),
				tasksRepo.listProjectMembers(project.id)
			]);
			users = loadedUsers;
			memberIds = loadedMembers.map((member) => member.id);
		} catch (loadError) {
			membersDialogError =
				loadError instanceof Error ? loadError.message : 'メンバー情報の読み込みに失敗しました。';
		} finally {
			isMembersLoading = false;
		}
	}

	function closeMembersDialog(): void {
		pendingMembersProject = null;
		isMembersLoading = false;
		memberIds = [];
		membersDialogError = '';
	}

	function toggleMember(userId: string): void {
		if (memberIds.includes(userId)) {
			memberIds = memberIds.filter((id) => id !== userId);
			return;
		}
		memberIds = [...memberIds, userId];
	}

	async function saveMembers(): Promise<void> {
		const project = pendingMembersProject;
		if (!project) {
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		membersDialogError = '';
		try {
			await tasksRepo.setProjectMembers(project.id, memberIds);
			closeMembersDialog();
			success = 'プロジェクトメンバーを更新しました。';
		} catch (updateError) {
			membersDialogError =
				updateError instanceof Error ? updateError.message : 'メンバー更新に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}

	async function confirmDeleteProject(): Promise<void> {
		const project = pendingDeleteProject;
		if (!project) {
			return;
		}
		if (deleteProjectNameInput !== project.name) {
			deleteDialogError = 'プロジェクト名が一致しません。';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		deleteDialogError = '';
		try {
			await tasksRepo.removeProject(project.id);
			closeDeleteDialog();
			success = 'プロジェクトを削除しました。';
			await loadProjects();
		} catch (removeError) {
			error =
				removeError instanceof Error ? removeError.message : 'プロジェクト削除に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="min-h-screen bg-slate-100 text-slate-800">
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
		<header class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-slate-900">プロジェクト管理</h1>
				<p class="text-sm text-slate-600">Projects</p>
			</div>
			<a
				href={resolve('/')}
				class="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
			>
				ガントへ戻る
			</a>
		</header>

		<section class="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
			<form class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onsubmit={submitCreate}>
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>新規プロジェクト名</span>
					<input
						type="text"
						name="createProjectName"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						placeholder="例: Webサイト刷新"
						value={createName}
						oninput={(event) => (createName = (event.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<div class="flex items-end">
					<button
						type="submit"
						class="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-45"
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

		<section class="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-4 py-3">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="text-sm font-semibold text-slate-700">Projects</p>
					<label class="flex min-w-56 items-center gap-2 text-sm text-slate-600">
						<span class="font-semibold whitespace-nowrap text-slate-700">検索</span>
						<input
							type="search"
							name="projectSearch"
							class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
							placeholder="プロジェクト名 / ID"
							value={searchQuery}
							oninput={(event) => (searchQuery = (event.currentTarget as HTMLInputElement).value)}
							aria-label="プロジェクト検索"
						/>
					</label>
				</div>
			</div>
			{#if isLoading}
				<div class="px-4 py-6 text-sm text-slate-500">読み込み中...</div>
			{:else if projects.length === 0}
				<div class="px-4 py-6 text-sm text-slate-500">プロジェクトがありません。</div>
			{:else if filteredProjects.length === 0}
				<div class="px-4 py-6 text-sm text-slate-500">
					検索条件に一致するプロジェクトがありません。
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead class="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
							<tr>
								<th class="px-4 py-2">Name</th>
								<th class="px-4 py-2 text-right">Tasks</th>
								<th class="px-4 py-2 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredProjects as project (project.id)}
								<tr class="border-t border-slate-200">
									<td class="px-4 py-2">
										{#if editingProjectId === project.id}
											<input
												type="text"
												name="editProjectName"
												class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm ring-sky-500/40 transition outline-none focus:ring-2"
												value={editingName}
												oninput={(event) =>
													(editingName = (event.currentTarget as HTMLInputElement).value)}
											/>
										{:else}
											<span class="font-medium text-slate-800">{project.name}</span>
										{/if}
									</td>
									<td class="px-4 py-2 text-right text-slate-600 tabular-nums">
										{project.taskCount}
									</td>
									<td class="px-4 py-2">
										<div class="flex flex-wrap items-center justify-end gap-2">
											<button
												type="button"
												class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
												onclick={() => void moveProject(project.id, 'up')}
												disabled={findProjectIndex(project.id) === 0 || isSubmitting}
												aria-label="move up"
											>
												↑
											</button>
											<button
												type="button"
												class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
												onclick={() => void moveProject(project.id, 'down')}
												disabled={findProjectIndex(project.id) === projects.length - 1 ||
													isSubmitting}
												aria-label="move down"
											>
												↓
											</button>
											{#if editingProjectId === project.id}
												<button
													type="button"
													class="rounded-lg bg-sky-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-45"
													onclick={() => void submitEdit(project)}
													disabled={editingName.trim().length === 0 || isSubmitting}
												>
													保存
												</button>
												<button
													type="button"
													class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
													onclick={cancelEdit}
												>
													取消
												</button>
											{:else}
												<button
													type="button"
													class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
													onclick={() => void beginManageMembers(project)}
													disabled={isSubmitting}
												>
													メンバー
												</button>
												<button
													type="button"
													class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
													onclick={() => beginEdit(project)}
													disabled={isSubmitting}
												>
													編集
												</button>
												<button
													type="button"
													class="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
													onclick={() => beginDeleteProject(project)}
													disabled={isSubmitting}
													title="プロジェクトを削除"
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
	</div>
</div>

{#if pendingDeleteProject}
	<div
		class="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget && !isSubmitting) {
				closeDeleteDialog();
			}
		}}
	>
		<div
			class="w-full max-w-md rounded-xl border border-slate-300 bg-white p-4 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-project-dialog-title"
		>
			<div class="mb-3 flex items-center justify-between">
				<h2 id="delete-project-dialog-title" class="text-base font-semibold text-slate-900">
					プロジェクトを削除
				</h2>
				<button
					type="button"
					class="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
					onclick={closeDeleteDialog}
					disabled={isSubmitting}
					aria-label="close delete dialog"
				>
					×
				</button>
			</div>
			<div class="grid gap-3">
				<p class="text-sm text-slate-700">
					この操作は取り消せません。削除を続行するには、
					<span class="rounded bg-slate-100 px-1 py-0.5 font-semibold text-slate-900">
						{pendingDeleteProject.name}
					</span>
					を入力してください。
				</p>
				{#if pendingDeleteProject.taskCount > 0}
					<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
						このプロジェクトの {pendingDeleteProject.taskCount} 件のタスクも削除されます。
					</p>
				{/if}
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>プロジェクト名</span>
					<input
						type="text"
						name="deleteProjectConfirmName"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						value={deleteProjectNameInput}
						oninput={(event) => {
							deleteProjectNameInput = (event.currentTarget as HTMLInputElement).value;
							deleteDialogError = '';
						}}
						placeholder={pendingDeleteProject.name}
					/>
				</label>
				{#if deleteDialogError}
					<p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{deleteDialogError}</p>
				{/if}
				<div class="mt-1 flex justify-end gap-2">
					<button
						type="button"
						class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
						onclick={closeDeleteDialog}
						disabled={isSubmitting}
					>
						キャンセル
					</button>
					<button
						type="button"
						class="rounded-lg border border-rose-300 bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
						onclick={() => void confirmDeleteProject()}
						disabled={isSubmitting || deleteProjectNameInput !== pendingDeleteProject.name}
					>
						削除を確定
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if pendingMembersProject}
	<div
		class="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget && !isSubmitting) {
				closeMembersDialog();
			}
		}}
	>
		<div
			class="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-4 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="project-members-dialog-title"
		>
			<div class="mb-3 flex items-center justify-between">
				<h2 id="project-members-dialog-title" class="text-base font-semibold text-slate-900">
					プロジェクトメンバー
				</h2>
				<button
					type="button"
					class="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
					onclick={closeMembersDialog}
					disabled={isSubmitting}
					aria-label="close members dialog"
				>
					×
				</button>
			</div>

			<p class="text-sm text-slate-700">
				<span class="font-semibold">{pendingMembersProject.name}</span> の担当候補ユーザーを選択します。
			</p>

			{#if isMembersLoading}
				<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
					読み込み中...
				</div>
			{:else if users.length === 0}
				<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
					ユーザーが存在しません。先に Users 画面でユーザーを作成してください。
				</div>
			{:else}
				<div class="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
					<div class="grid gap-2 sm:grid-cols-2">
						{#each users as user (user.id)}
							<label class="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm text-slate-700">
								<input
									type="checkbox"
									name="projectMemberUserIds"
									value={user.id}
									class="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
									checked={memberIds.includes(user.id)}
									onchange={() => toggleMember(user.id)}
								/>
								<span class="truncate">{user.name}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}

			{#if membersDialogError}
				<p class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{membersDialogError}</p>
			{/if}

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
					onclick={closeMembersDialog}
					disabled={isSubmitting}
				>
					キャンセル
				</button>
				<button
					type="button"
					class="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-45"
					onclick={() => void saveMembers()}
					disabled={isSubmitting || isMembersLoading}
				>
					保存
				</button>
			</div>
		</div>
	</div>
{/if}
