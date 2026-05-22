<script>
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import icon from '$lib/assets/icon.svg';
	import { loadState, saveState, newSession, newSessionId } from '$lib/storage.js';

	let idea = $state('');
	let loading = $state(false);
	let sessions = $state({});
	let textareaEl;
	let pendingDeleteId = $state(null);
	let confirmTimer;
	let clearAllPending = $state(false);
	let clearAllTimer;

	const examples = [
		'focus timer that blocks distracting sites',
		'meal planner from fridge photos',
		'reading app that summarises PDFs'
	];

	const fileList = $derived(
		Object.values(sessions)
			.filter((s) => s?.messages?.length)
			.sort((a, b) => b.updatedAt - a.updatedAt)
	);

	onMount(async () => {
		const state = loadState();
		sessions = state.sessions || {};
		await tick();
		textareaEl?.focus();
	});

	function useExample(text) {
		idea = text;
		textareaEl?.focus();
	}

	async function start() {
		const text = idea.trim();
		if (!text || loading) return;
		loading = true;

		const id = newSessionId();
		const session = newSession(id);
		session.messages = [{ role: 'user', content: text }];
		session.title = text.slice(0, 60) + (text.length > 60 ? '...' : '');
		session.updatedAt = Date.now();

		const nextSessions = { ...sessions, [id]: session };
		saveState({ sessions: nextSessions, activeId: id });

		await goto('/app');
	}

	function openSession(id) {
		if (!sessions[id]) return;
		if (pendingDeleteId) return;
		saveState({ sessions, activeId: id });
		goto('/app');
	}

	function requestDelete(id, e) {
		e?.stopPropagation();
		clearAllPending = false;
		if (pendingDeleteId === id) {
			confirmDelete(id);
			return;
		}
		pendingDeleteId = id;
		clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => (pendingDeleteId = null), 2800);
	}

	function confirmDelete(id) {
		const next = { ...sessions };
		delete next[id];
		sessions = next;
		saveState({ sessions, activeId: null });
		pendingDeleteId = null;
		clearTimeout(confirmTimer);
	}

	function cancelPending(e) {
		if (pendingDeleteId && !e.target.closest?.('[data-delete-btn]')) {
			pendingDeleteId = null;
			clearTimeout(confirmTimer);
		}
		if (clearAllPending && !e.target.closest?.('[data-clear-all]')) {
			clearAllPending = false;
			clearTimeout(clearAllTimer);
		}
	}

	function requestClearAll() {
		if (clearAllPending) {
			sessions = {};
			saveState({ sessions: {}, activeId: null });
			clearAllPending = false;
			clearTimeout(clearAllTimer);
			return;
		}
		clearAllPending = true;
		clearTimeout(clearAllTimer);
		clearAllTimer = setTimeout(() => (clearAllPending = false), 2800);
	}

	function onKeydown(e) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			start();
		}
	}

	function rel(ts) {
		const diff = Math.max(0, Date.now() - ts);
		if (diff < 60_000) return 'now';
		if (diff < 3600_000) return Math.floor(diff / 60_000) + 'm';
		if (diff < 86400_000) return Math.floor(diff / 3600_000) + 'h';
		if (diff < 30 * 86400_000) return Math.floor(diff / 86400_000) + 'd';
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>write my app</title>
</svelte:head>

<svelte:window on:click={cancelPending} />

<main class="page">
	<header class="bar">
		<a class="brand" href="/">
			<img src={icon} alt="" width="20" height="20" />
			<span>write my app</span>
		</a>
		{#if fileList.length}
			<span class="bar-stat">{fileList.length} {fileList.length === 1 ? 'spec' : 'specs'}</span>
		{/if}
	</header>

	<div class="content">
		<section class="composer-wrap">
			<div class="composer">
				<div class="composer-row">
					<span class="prefix">›</span>
					<textarea
						bind:this={textareaEl}
						bind:value={idea}
						onkeydown={onKeydown}
						placeholder="describe an app..."
						rows="4"
						disabled={loading}
					></textarea>
				</div>
				<div class="composer-foot">
					<div class="examples">
						{#each examples as ex (ex)}
							<button class="chip" onclick={() => useExample(ex)}>{ex}</button>
						{/each}
					</div>
					<button class="primary" onclick={start} disabled={loading || !idea.trim()}>
						{#if loading}
							<span class="primary-loading">
								<span class="pl-dot"></span>
								<span>generating</span>
							</span>
						{:else}
							<span>generate</span>
							<span class="kbd-row"><kbd>⌘</kbd><kbd>↵</kbd></span>
						{/if}
					</button>
				</div>
			</div>
		</section>

		<section class="reference">
			<div class="ref-col">
				<div class="ref-head">// what you get</div>
				<ul class="tree">
					<li><span class="tw-branch">└─</span><span class="tw-root">spec.md</span></li>
					<li><span class="tw-branch">  ├─</span><span class="tw-key">overview</span></li>
					<li><span class="tw-branch">  ├─</span><span class="tw-key">target users</span></li>
					<li>
						<span class="tw-branch">  ├─</span><span class="tw-key">features</span>
						<span class="tw-meta">P0 · P1 · P2</span>
					</li>
					<li><span class="tw-branch">  ├─</span><span class="tw-key">user stories</span></li>
					<li>
						<span class="tw-branch">  ├─</span><span class="tw-key">design</span>
						<span class="tw-meta">look · type · colors · screens</span>
					</li>
					<li>
						<span class="tw-branch">  ├─</span><span class="tw-key">data model</span>
						<span class="tw-meta">entities · fields · relations</span>
					</li>
					<li>
						<span class="tw-branch">  ├─</span><span class="tw-key">api</span>
						<span class="tw-meta">endpoints · req · res</span>
					</li>
					<li><span class="tw-branch">  ├─</span><span class="tw-key">tech stack</span></li>
					<li><span class="tw-branch">  ├─</span><span class="tw-key">non-functional</span></li>
					<li><span class="tw-branch">  └─</span><span class="tw-key">open questions</span></li>
				</ul>
			</div>

			<div class="ref-col">
				<div class="ref-head">// works with</div>
				<div class="agent-pills">
					<span class="agent">claude code</span>
					<span class="agent">codex</span>
					<span class="agent">cursor</span>
					<span class="agent">copilot</span>
					<span class="agent">opencode</span>
					<span class="agent-etc">+ etc.</span>
				</div>
				<div class="ref-foot">
					<span class="rf-line">› iterate by chat to refine</span>
					<span class="rf-line">› export as <code>.md</code> or <code>.json</code></span>
					<span class="rf-line">› local-only, nothing leaves your browser</span>
				</div>
			</div>
		</section>

		{#if fileList.length}
			<section class="files">
				<div class="files-head">
					<span class="fh-label">specs</span>
					{#if fileList.length > 1}
						<button
							class="clear-all"
							class:armed={clearAllPending}
							data-clear-all
							onclick={requestClearAll}
						>
							{clearAllPending ? 'sure?' : 'clear all'}
						</button>
					{/if}
				</div>
				<ul class="files-list">
					{#each fileList as s (s.id)}
						{@const armed = pendingDeleteId === s.id}
						<li class="file-row" class:armed>
							<button class="file-open" onclick={() => openSession(s.id)}>
								<span class="fr-title">{s.spec?.title || s.title || 'untitled'}</span>
								<span class="fr-date">{rel(s.updatedAt)}</span>
							</button>
							<button
								class="file-del"
								class:armed
								data-delete-btn
								onclick={(e) => requestDelete(s.id, e)}
								aria-label={armed ? 'confirm delete' : 'delete'}
								title={armed ? 'click again' : 'delete'}
							>
								{#if armed}
									<span>delete</span>
								{:else}
									<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
										<path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9.5h5L11 4M7 6.5v5M9 6.5v5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</main>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* ---------- Top bar ---------- */
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 22px;
		border-bottom: 1px solid var(--rule);
		gap: 16px;
		flex-shrink: 0;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 13px;
		color: var(--text);
		text-decoration: none;
		letter-spacing: -0.005em;
	}
	.brand img {
		border-radius: 4px;
		display: block;
	}
	.bar-stat {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
	}

	/* ---------- Content ---------- */
	.content {
		flex: 1;
		max-width: 820px;
		width: 100%;
		margin: 0 auto;
		padding: clamp(20px, 4vh, 40px) 22px 56px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	/* ---------- Composer ---------- */
	.composer {
		background: var(--bg-1);
		border: 1px solid var(--rule);
		border-radius: 5px;
		transition: border-color 0.12s ease, box-shadow 0.12s ease;
	}
	.composer:focus-within {
		border-color: var(--mark);
		box-shadow: 0 0 0 3px var(--mark-soft);
	}
	.composer-row {
		display: flex;
		gap: 12px;
		padding: 18px 18px 10px;
	}
	.prefix {
		color: var(--mark);
		font-family: var(--font-mono);
		font-size: 22px;
		line-height: 1.4;
		flex-shrink: 0;
		font-weight: 600;
		user-select: none;
		padding-top: 0;
	}
	textarea {
		width: 100%;
		background: transparent;
		color: var(--text);
		border: none;
		outline: none;
		resize: none;
		font-family: var(--font-mono);
		font-size: 17px;
		line-height: 1.5;
		min-height: 140px;
		field-sizing: content;
	}
	textarea::placeholder {
		color: var(--text-dim);
	}

	.composer-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px 12px;
		border-top: 1px solid var(--rule-soft);
	}
	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		flex: 1;
		min-width: 0;
	}
	.chip {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--rule);
		padding: 4px 10px;
		font-family: var(--font-mono);
		font-size: 12px;
		border-radius: 3px;
		cursor: pointer;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.12s ease, border-color 0.12s ease;
	}
	.chip:hover {
		color: var(--text);
		border-color: var(--rule-strong);
	}

	.primary {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		background: var(--mark);
		color: var(--bg);
		border: 1px solid var(--mark);
		padding: 8px 14px;
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 600;
		border-radius: 3px;
		cursor: pointer;
		transition: background 0.12s ease, transform 0.05s ease;
		flex-shrink: 0;
	}
	.primary:hover:not(:disabled) {
		background: var(--mark-bright);
	}
	.primary:active:not(:disabled) {
		transform: translateY(1px);
	}
	.primary:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.kbd-row {
		display: inline-flex;
		gap: 2px;
		opacity: 0.65;
	}

	.primary-loading {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.pl-dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--bg);
		display: inline-block;
		animation: pl-pulse 1.3s ease-in-out infinite;
	}
	@keyframes pl-pulse {
		0%, 100% { opacity: 0.4; transform: scale(0.85); }
		50%      { opacity: 1;   transform: scale(1); }
	}

	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		background: var(--bg-2);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0 5px;
		min-width: 16px;
		height: 16px;
		font-size: 10.5px;
		color: var(--text-muted);
	}
	.primary kbd {
		background: rgba(0, 0, 0, 0.18);
		border-color: rgba(0, 0, 0, 0.18);
		color: rgba(0, 0, 0, 0.65);
	}

	/* ---------- Reference (what you get / works with) ---------- */
	.reference {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 32px;
		padding-top: 4px;
	}
	.ref-col {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.ref-head {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-muted);
		letter-spacing: 0.02em;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--rule-soft);
	}

	/* file tree */
	.tree {
		list-style: none;
		margin: 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 12.5px;
		line-height: 1.7;
		color: var(--text-soft);
	}
	.tree li {
		display: flex;
		align-items: baseline;
		gap: 8px;
		white-space: nowrap;
		overflow: hidden;
	}
	.tw-branch {
		color: var(--text-dim);
		white-space: pre;
		flex-shrink: 0;
	}
	.tw-root {
		color: var(--mark);
		font-weight: 600;
	}
	.tw-key {
		color: var(--text);
		flex-shrink: 0;
	}
	.tw-meta {
		color: var(--text-dim);
		font-size: 11.5px;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	/* agent pills */
	.agent-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.agent {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-soft);
		background: var(--bg-1);
		border: 1px solid var(--rule);
		padding: 3px 9px;
		border-radius: 3px;
	}
	.agent-etc {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-dim);
		padding: 3px 4px;
	}

	.ref-foot {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px dashed var(--rule-soft);
	}
	.rf-line {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-muted);
		line-height: 1.55;
	}
	.rf-line code {
		font-family: var(--font-mono);
		color: var(--mark);
		background: var(--bg-1);
		padding: 0 4px;
		border-radius: 2px;
		border: 1px solid var(--rule);
		font-size: 11px;
	}

	@media (max-width: 640px) {
		.reference {
			grid-template-columns: 1fr;
			gap: 24px;
		}
	}

	/* ---------- Files ---------- */
	.files-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--rule);
	}
	.fh-label {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
		text-transform: lowercase;
		letter-spacing: 0.04em;
	}
	.clear-all {
		background: transparent;
		color: var(--text-dim);
		border: 1px solid transparent;
		padding: 2px 8px;
		font-family: var(--font-mono);
		font-size: 11px;
		border-radius: 3px;
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
	}
	.clear-all:hover {
		color: var(--err);
	}
	.clear-all.armed {
		color: var(--bg);
		background: var(--err);
		border-color: var(--err);
	}

	.files-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.file-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 32px;
		border-bottom: 1px solid var(--rule-soft);
		transition: background 0.1s ease;
	}
	.file-row:hover {
		background: var(--bg-1);
	}
	.file-row.armed {
		background: rgba(232, 112, 76, 0.06);
	}
	.file-open {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 16px;
		align-items: center;
		background: transparent;
		border: none;
		padding: 11px 10px;
		text-align: left;
		cursor: pointer;
		color: var(--text);
		min-width: 0;
	}
	.fr-title {
		font-family: var(--font-sans);
		font-size: 14px;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.file-row:hover .fr-title {
		color: var(--mark-bright);
	}
	.fr-date {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
	}

	.file-del {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-dim);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 0 8px;
		transition: color 0.12s ease, background 0.12s ease;
	}
	.file-del:hover {
		color: var(--err);
	}
	.file-del.armed {
		color: var(--bg);
		background: var(--err);
		min-width: 60px;
	}
	.file-del.armed span {
		font-weight: 600;
	}

	@media (max-width: 640px) {
		.bar {
			padding: 12px 14px;
		}
		.content {
			padding: clamp(28px, 6vh, 48px) 14px 48px;
			gap: 32px;
		}
		textarea {
			font-size: 16px; /* prevent iOS auto-zoom on focus */
			line-height: 1.5;
		}
		.composer-row {
			padding: 12px 12px 6px;
		}
		.composer-foot {
			flex-direction: column-reverse;
			align-items: stretch;
			gap: 10px;
			padding: 8px 10px 10px;
		}
		.primary {
			width: 100%;
			justify-content: center;
			padding: 9px 14px;
		}
		.chip {
			padding: 4px 9px;
		}
		.file-open {
			padding: 12px 8px;
			gap: 10px;
		}
		.fr-title {
			font-size: 14.5px;
		}
		.file-del {
			min-width: 38px;
		}
		.file-del.armed {
			min-width: 68px;
		}
	}
</style>
