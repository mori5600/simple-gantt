<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	const navItems: ReadonlyArray<{ path: '/admin/projects' | '/admin/users'; label: string }> = [
		{ path: '/admin/projects', label: 'プロジェクト管理' },
		{ path: '/admin/users', label: 'ユーザー管理' }
	];

	function isActive(path: string): boolean {
		const pathname = page.url.pathname;
		const target = resolve(path);
		return pathname === target || pathname.startsWith(`${target}/`);
	}
</script>

<div class="min-h-screen bg-slate-100 text-slate-800">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row">
		<aside class="shrink-0 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm lg:w-64">
			<h1 class="text-lg font-semibold text-slate-900">管理画面</h1>
			<p class="mt-1 text-sm text-slate-600">Admin</p>
			<nav class="mt-4 grid gap-2" aria-label="管理メニュー">
				{#each navItems as item (item.path)}
					<a
						href={resolve(item.path)}
						class={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
							isActive(item.path)
								? 'border-sky-300 bg-sky-50 text-sky-800'
								: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
						}`}
					>
						{item.label}
					</a>
				{/each}
			</nav>
			<a
				href={resolve('/')}
				class="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
			>
				ガントへ戻る
			</a>
		</aside>

		<main class="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-100">
			<div class="flex w-full flex-col gap-4 p-4 sm:p-6">
				{@render children()}
			</div>
		</main>
	</div>
</div>
