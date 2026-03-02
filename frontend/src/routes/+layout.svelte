<script lang="ts">
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href="/favicon.png" type="image/png" /></svelte:head>
{@render children()}
