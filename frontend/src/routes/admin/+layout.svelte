<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	const navItems: ReadonlyArray<{ path: '/admin/projects' | '/admin/users'; label: string }> = [
		{ path: '/admin/projects', label: 'プロジェクト管理' },
		{ path: '/admin/users', label: 'ユーザー管理' }
	];

	function isActive(path: '/admin/projects' | '/admin/users'): boolean {
		const pathname = page.url.pathname;
		const target = resolve(path);
		return pathname === target || pathname.startsWith(`${target}/`);
	}
</script>

<div class="min-h-screen bg-slate-100 text-slate-800">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
		<header class="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 sm:px-5">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-[0.28em] text-slate-400 uppercase">Admin</p>
					<h1 class="text-base font-medium text-slate-900">管理</h1>
				</div>

				<div class="flex flex-wrap items-center justify-end gap-2">
					<nav class="flex flex-wrap items-center justify-end gap-2" aria-label="管理メニュー">
						{#each navItems as item (item.path)}
							<a
								href={resolve(item.path)}
								class={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
									isActive(item.path)
										? 'border-slate-300 bg-slate-100 text-slate-900'
										: 'border-slate-200 bg-white/80 text-slate-600 hover:bg-white hover:text-slate-800'
								}`}
							>
								{item.label}
							</a>
						{/each}
					</nav>
					<a
						href={resolve('/')}
						class="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
					>
						ガントへ戻る
					</a>
				</div>
			</div>
		</header>

		<main class="min-w-0">
			<div class="flex w-full flex-col gap-4">
				{@render children()}
			</div>
		</main>
	</div>
</div>
