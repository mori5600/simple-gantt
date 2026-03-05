<script lang="ts">
	import ProjectsAdminView from '$lib/components/admin/ProjectsAdminView.svelte';
</script>

<div class="min-h-screen bg-slate-100 text-slate-800">
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
		<ProjectsAdminView showBackLink={true} />
	</div>
</div>
