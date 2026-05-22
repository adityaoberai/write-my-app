<script>
	import { page } from '$app/stores';
	import icon from '$lib/assets/icon.svg';

	let { children } = $props();

	const title = 'Write My App';
	const description = 'Turn one sentence into a buildable app spec.';
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
	<link rel="apple-touch-icon" href={icon} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={title} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	{#if $page?.url?.origin}
		<meta property="og:url" content={$page.url.origin + $page.url.pathname} />
		<meta property="og:image" content={$page.url.origin + '/og'} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta name="twitter:image" content={$page.url.origin + '/og'} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		/* Surfaces — warm dark graphite */
		--bg:        #0d0d0b;
		--bg-1:      #141310;
		--bg-2:      #1b1a16;
		--bg-3:      #26241e;
		--bg-input:  #100f0c;

		/* Rules */
		--rule:        #2a2823;
		--rule-soft:   #1f1e1a;
		--rule-strong: #3a382f;

		/* Type */
		--text:       #ece8da;
		--text-soft:  #c5c1b3;
		--text-muted: #8a8678;
		--text-dim:   #5d5b51;

		/* Single sharp accent — terminal amber */
		--mark:        #e8b938;
		--mark-bright: #f5c742;
		--mark-deep:   #c79a1f;
		--mark-soft:   rgba(232, 185, 56, 0.10);
		--mark-ring:   rgba(232, 185, 56, 0.40);

		/* Status */
		--good: #9ac76d;
		--warn: #e8b938;
		--err:  #e8704c;
		--danger-bg:     rgba(232, 112, 76, 0.08);
		--danger-fg:     #e8704c;
		--danger-border: rgba(232, 112, 76, 0.4);

		/* Type families */
		--font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
		--font-sans: 'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;

		/* Shims for legacy var names */
		--border: var(--rule);
		--border-strong: var(--rule-strong);
		--text-muted-: var(--text-muted);
		--accent: var(--mark);
		--accent-soft: var(--mark-soft);
		--accent-ring: var(--mark-ring);

		--radius: 4px;
		--radius-sm: 3px;
	}

	:global(html, body) {
		height: 100%;
		margin: 0;
		font-family: var(--font-sans);
		font-weight: 400;
		font-size: 14px;
		background: var(--bg);
		color: var(--text);
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
		font-feature-settings: 'ss01', 'ss03', 'cv11';
		font-variant-numeric: tabular-nums;
	}

	/* Subtle warm vignette so the dark canvas isn't flat */
	:global(body) {
		background-image:
			radial-gradient(ellipse 90% 60% at 100% 0%, rgba(232, 185, 56, 0.04), transparent 55%),
			radial-gradient(ellipse 80% 60% at 0% 100%, rgba(232, 185, 56, 0.025), transparent 55%);
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(button) {
		font-family: inherit;
	}

	:global(textarea, input, select) {
		font-family: inherit;
	}

	:global(::selection) {
		background: var(--mark);
		color: var(--bg);
	}

	:global(:focus-visible) {
		outline: 1px solid var(--mark);
		outline-offset: 2px;
	}

	/* Scrollbar — dev-tool flavored */
	:global(::-webkit-scrollbar) {
		width: 10px;
		height: 10px;
	}
	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: var(--rule);
		border: 3px solid var(--bg);
		border-radius: 999px;
	}
	:global(::-webkit-scrollbar-thumb:hover) {
		background: var(--rule-strong);
	}
</style>
