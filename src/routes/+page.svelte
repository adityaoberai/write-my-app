<script>
	import { onMount, tick } from 'svelte';
	import { specToMarkdown } from '$lib/specToMarkdown.js';
	import { loadState, saveState, newSession, newSessionId } from '$lib/storage.js';

	let sessions = $state({});
	let activeId = $state(null);
	let input = $state('');
	let loading = $state(false);
	let errorMsg = $state('');
	let chatEl;
	let hydrated = $state(false);

	const active = $derived(activeId ? sessions[activeId] : null);
	const messages = $derived(active?.messages ?? []);
	const spec = $derived(active?.spec ?? null);
	const sessionList = $derived(
		Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt)
	);

	onMount(() => {
		const s = loadState();
		sessions = s.sessions;
		activeId = s.activeId;
		if (!activeId || !sessions[activeId]) {
			startNewSession();
		}
		hydrated = true;
	});

	$effect(() => {
		if (!hydrated) return;
		saveState({ sessions, activeId });
	});

	function startNewSession() {
		const id = newSessionId();
		sessions = { ...sessions, [id]: newSession(id) };
		activeId = id;
		input = '';
		errorMsg = '';
	}

	function selectSession(id) {
		activeId = id;
		errorMsg = '';
	}

	function deleteSession(id) {
		const next = { ...sessions };
		delete next[id];
		sessions = next;
		if (activeId === id) {
			const remaining = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);
			if (remaining.length) activeId = remaining[0].id;
			else startNewSession();
		}
	}

	function updateActive(patch) {
		if (!activeId) return;
		const current = sessions[activeId];
		sessions = {
			...sessions,
			[activeId]: { ...current, ...patch, updatedAt: Date.now() }
		};
	}

	async function send() {
		const text = input.trim();
		if (!text || loading || !active) return;

		errorMsg = '';
		const userMsg = { role: 'user', content: text };
		const nextMessages = [...messages, userMsg];
		const titleFromFirst =
			active.messages.length === 0
				? text.slice(0, 60) + (text.length > 60 ? '…' : '')
				: active.title;

		updateActive({ messages: nextMessages, title: titleFromFirst });
		input = '';
		loading = true;
		await tick();
		scrollChat();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ messages: nextMessages, currentSpec: spec })
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `Request failed (${res.status})`);
			}
			const data = await res.json();
			const assistantMsg = { role: 'assistant', content: data.reply };
			updateActive({
				messages: [...nextMessages, assistantMsg],
				spec: data.spec,
				title:
					data.spec?.title && active.messages.length === 0 ? data.spec.title : titleFromFirst
			});
		} catch (e) {
			errorMsg = e?.message || 'Something went wrong';
		} finally {
			loading = false;
			await tick();
			scrollChat();
		}
	}

	function scrollChat() {
		if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
	}

	function onKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function exportMarkdown() {
		if (!spec) return;
		const md = specToMarkdown(spec);
		const blob = new Blob([md], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const safe = (spec.title || 'spec').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
		a.href = url;
		a.download = (safe || 'spec') + '.md';
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function copyMarkdown() {
		if (!spec) return;
		const md = specToMarkdown(spec);
		try {
			await navigator.clipboard.writeText(md);
		} catch {
			// ignore
		}
	}
</script>

<svelte:head>
	<title>Write My App — Spec generator</title>
</svelte:head>

<div class="app">
	<aside class="sidebar">
		<button class="primary" onclick={startNewSession}>+ New session</button>
		<div class="session-list">
			{#each sessionList as s (s.id)}
				<div class="session-row" class:active={s.id === activeId}>
					<button class="session-pick" onclick={() => selectSession(s.id)}>
						<div class="session-title">{s.title}</div>
						<div class="session-sub">
							{s.messages.length} msg · {new Date(s.updatedAt).toLocaleDateString()}
						</div>
					</button>
					<button class="icon" title="Delete" onclick={() => deleteSession(s.id)}>×</button>
				</div>
			{/each}
		</div>
		<div class="brand">Write My App</div>
	</aside>

	<section class="chat">
		<header class="chat-header">
			<h2>{active?.title || 'New session'}</h2>
		</header>

		<div class="messages" bind:this={chatEl}>
			{#if messages.length === 0}
				<div class="empty">
					<h3>Describe your app idea</h3>
					<p>
						Give me the seed of an idea — e.g. <em>"a recipe app that suggests meals based on
						what's in my fridge"</em> — and I'll write a full build spec. Then iterate by chatting:
						add features, narrow the audience, swap the stack.
					</p>
					<p class="muted">Backend defaults to Appwrite unless you say otherwise.</p>
				</div>
			{:else}
				{#each messages as m, i (i)}
					<div class="msg" class:user={m.role === 'user'} class:assistant={m.role === 'assistant'}>
						<div class="role">{m.role}</div>
						<div class="content">{m.content}</div>
					</div>
				{/each}
				{#if loading}
					<div class="msg assistant">
						<div class="role">assistant</div>
						<div class="content thinking">Writing spec…</div>
					</div>
				{/if}
			{/if}
			{#if errorMsg}
				<div class="error">{errorMsg}</div>
			{/if}
		</div>

		<div class="composer">
			<textarea
				placeholder="Describe your app or send feedback…"
				bind:value={input}
				onkeydown={onKeydown}
				rows="3"
				disabled={loading}
			></textarea>
			<button class="primary send" onclick={send} disabled={loading || !input.trim()}>
				{loading ? '…' : 'Send'}
			</button>
		</div>
	</section>

	<section class="spec">
		<header class="spec-header">
			<h2>Specification</h2>
			<div class="spec-actions">
				<button onclick={copyMarkdown} disabled={!spec}>Copy MD</button>
				<button class="primary" onclick={exportMarkdown} disabled={!spec}>Export .md</button>
			</div>
		</header>
		<div class="spec-body">
			{#if !spec}
				<div class="empty">
					<p class="muted">No spec yet. Send a message to generate one.</p>
				</div>
			{:else}
				<h1 class="spec-title">{spec.title}</h1>
				{#if spec.tagline}<blockquote>{spec.tagline}</blockquote>{/if}
				{#if spec.overview}
					<h3>Overview</h3>
					<p>{spec.overview}</p>
				{/if}

				{#if spec.target_audience?.length}
					<h3>Target Audience</h3>
					{#each spec.target_audience as a, i (i)}
						<div class="block">
							<strong>{a.persona}</strong>
							<div><em>Needs:</em> {a.needs}</div>
							<div><em>Pain points:</em> {a.pain_points}</div>
						</div>
					{/each}
				{/if}

				{#if spec.features?.length}
					<h3>Features</h3>
					{#each spec.features as f, i (i)}
						<div class="block">
							<strong>{f.name}</strong> <span class="priority p-{f.priority.toLowerCase()}">{f.priority}</span>
							<div>{f.description}</div>
							{#if f.user_value}<div class="muted"><em>Why:</em> {f.user_value}</div>{/if}
						</div>
					{/each}
				{/if}

				{#if spec.user_stories?.length}
					<h3>User Stories</h3>
					<ul>
						{#each spec.user_stories as s, i (i)}
							<li>{s}</li>
						{/each}
					</ul>
				{/if}

				{#if spec.design_spec}
					<h3>Design</h3>
					{#if spec.design_spec.look_and_feel}
						<p><strong>Look & feel:</strong> {spec.design_spec.look_and_feel}</p>
					{/if}
					{#if spec.design_spec.typography}
						<p><strong>Typography:</strong> {spec.design_spec.typography}</p>
					{/if}
					{#if spec.design_spec.color_palette?.length}
						<div class="palette">
							{#each spec.design_spec.color_palette as c, i (i)}
								<span class="swatch">{c}</span>
							{/each}
						</div>
					{/if}
					{#if spec.design_spec.key_screens?.length}
						<h4>Key screens</h4>
						{#each spec.design_spec.key_screens as scr, i (i)}
							<div class="block">
								<strong>{scr.name}</strong> — {scr.purpose}
								{#if scr.components?.length}
									<ul>
										{#each scr.components as c, j (j)}<li>{c}</li>{/each}
									</ul>
								{/if}
							</div>
						{/each}
					{/if}
				{/if}

				{#if spec.data_model?.length}
					<h3>Data Model</h3>
					{#each spec.data_model as e, i (i)}
						<div class="block">
							<strong>{e.entity}</strong>
							{#if e.fields?.length}
								<table>
									<thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead>
									<tbody>
										{#each e.fields as f, j (j)}
											<tr><td>{f.name}</td><td><code>{f.type}</code></td><td>{f.notes || ''}</td></tr>
										{/each}
									</tbody>
								</table>
							{/if}
							{#if e.relationships}<div class="muted"><em>Relationships:</em> {e.relationships}</div>{/if}
						</div>
					{/each}
				{/if}

				{#if spec.api_schema?.length}
					<h3>API</h3>
					{#each spec.api_schema as r, i (i)}
						<div class="block">
							<code class="endpoint"><strong>{r.method}</strong> {r.path}</code>
							<div>{r.purpose}</div>
							{#if r.request_body}<div class="muted"><em>Request:</em> {r.request_body}</div>{/if}
							{#if r.response_body}<div class="muted"><em>Response:</em> {r.response_body}</div>{/if}
						</div>
					{/each}
				{/if}

				{#if spec.tech_stack}
					<h3>Recommended Stack</h3>
					<ul>
						<li><strong>Frontend:</strong> {spec.tech_stack.frontend}</li>
						<li><strong>Backend:</strong> {spec.tech_stack.backend}</li>
						<li><strong>Database:</strong> {spec.tech_stack.database}</li>
						<li><strong>Auth:</strong> {spec.tech_stack.auth}</li>
						<li><strong>Hosting:</strong> {spec.tech_stack.hosting}</li>
					</ul>
					{#if spec.tech_stack.notes}<p class="muted">{spec.tech_stack.notes}</p>{/if}
				{/if}

				{#if spec.non_functional_requirements?.length}
					<h3>Non-functional</h3>
					<ul>
						{#each spec.non_functional_requirements as n, i (i)}<li>{n}</li>{/each}
					</ul>
				{/if}

				{#if spec.open_questions?.length}
					<h3>Open Questions</h3>
					<ul>
						{#each spec.open_questions as q, i (i)}<li>{q}</li>{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</section>
</div>

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;
		font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		background: #0b0d11;
		color: #e6e7ea;
	}
	:global(*) { box-sizing: border-box; }

	.app {
		display: grid;
		grid-template-columns: 240px 1fr 1fr;
		height: 100vh;
		min-height: 0;
	}

	.sidebar {
		background: #0f1218;
		border-right: 1px solid #1f2530;
		display: flex;
		flex-direction: column;
		padding: 14px;
		gap: 10px;
		min-height: 0;
	}
	.brand {
		margin-top: auto;
		font-size: 11px;
		color: #6b7280;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.session-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.session-row {
		display: flex;
		gap: 4px;
		align-items: stretch;
	}
	.session-row.active .session-pick {
		background: #1a2230;
		border-color: #2a3344;
	}
	.session-pick {
		flex: 1;
		text-align: left;
		background: transparent;
		border: 1px solid transparent;
		color: inherit;
		padding: 8px 10px;
		border-radius: 8px;
		cursor: pointer;
	}
	.session-pick:hover { background: #141923; }
	.session-title {
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.session-sub {
		font-size: 11px;
		color: #6b7280;
		margin-top: 2px;
	}
	.icon {
		background: transparent;
		color: #6b7280;
		border: none;
		font-size: 18px;
		line-height: 1;
		padding: 4px 8px;
		cursor: pointer;
		border-radius: 6px;
	}
	.icon:hover { background: #1a2230; color: #e6e7ea; }

	.chat {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-right: 1px solid #1f2530;
	}
	.chat-header, .spec-header {
		padding: 12px 18px;
		border-bottom: 1px solid #1f2530;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.chat-header h2, .spec-header h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #9aa3b2;
	}
	.spec-actions { display: flex; gap: 8px; }

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.msg {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.msg .role {
		font-size: 10px;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.msg .content {
		white-space: pre-wrap;
		line-height: 1.55;
		font-size: 14px;
		background: #141923;
		border: 1px solid #1f2530;
		padding: 10px 12px;
		border-radius: 10px;
		max-width: 60ch;
	}
	.msg.user .content {
		background: #1a2230;
		border-color: #2a3344;
		align-self: flex-end;
	}
	.msg.user { align-items: flex-end; }
	.thinking { color: #9aa3b2; font-style: italic; }
	.error {
		background: #2a1414;
		color: #ffb4b4;
		border: 1px solid #5a1f1f;
		padding: 10px 12px;
		border-radius: 8px;
		font-size: 13px;
	}

	.composer {
		display: flex;
		gap: 8px;
		padding: 12px;
		border-top: 1px solid #1f2530;
		background: #0f1218;
	}
	.composer textarea {
		flex: 1;
		resize: none;
		background: #141923;
		color: inherit;
		border: 1px solid #1f2530;
		border-radius: 8px;
		padding: 10px 12px;
		font: inherit;
		font-size: 14px;
		outline: none;
	}
	.composer textarea:focus { border-color: #3b82f6; }

	button.primary {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 8px 14px;
		font-weight: 600;
		cursor: pointer;
	}
	button.primary:hover { background: #2563eb; }
	button.primary:disabled { background: #1f2937; color: #6b7280; cursor: not-allowed; }
	button:not(.primary):not(.icon):not(.session-pick) {
		background: #141923;
		color: inherit;
		border: 1px solid #1f2530;
		border-radius: 8px;
		padding: 6px 12px;
		font-size: 13px;
		cursor: pointer;
	}
	button:not(.primary):not(.icon):not(.session-pick):hover { background: #1a2230; }
	button:disabled { opacity: 0.5; cursor: not-allowed; }
	.send { align-self: flex-end; }

	.spec { display: flex; flex-direction: column; min-height: 0; }
	.spec-body {
		flex: 1;
		overflow-y: auto;
		padding: 18px 22px;
		line-height: 1.55;
		font-size: 14px;
	}
	.spec-title { margin: 0 0 6px; font-size: 22px; }
	.spec blockquote {
		border-left: 3px solid #3b82f6;
		margin: 0 0 16px;
		padding: 4px 12px;
		color: #9aa3b2;
		font-style: italic;
	}
	.spec h3 {
		margin: 22px 0 8px;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #9aa3b2;
	}
	.spec h4 { margin: 14px 0 6px; font-size: 13px; color: #cbd2db; }
	.block {
		background: #11151c;
		border: 1px solid #1f2530;
		padding: 10px 12px;
		border-radius: 8px;
		margin-bottom: 8px;
	}
	.priority {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 4px;
		margin-left: 6px;
		vertical-align: middle;
	}
	.p-p0 { background: #5b1e1e; color: #ffb4b4; }
	.p-p1 { background: #1e3a5b; color: #b4d4ff; }
	.p-p2 { background: #1f2530; color: #9aa3b2; }
	.endpoint { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
	.muted { color: #9aa3b2; font-size: 13px; }
	.empty {
		color: #9aa3b2;
		max-width: 56ch;
	}
	.empty h3 { color: #e6e7ea; }
	.palette { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
	.swatch {
		background: #11151c;
		border: 1px solid #1f2530;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		margin-top: 6px;
	}
	th, td {
		text-align: left;
		padding: 6px 8px;
		border-bottom: 1px solid #1f2530;
	}
	th { color: #9aa3b2; font-weight: 500; font-size: 12px; }
	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		background: #1f2530;
		padding: 1px 5px;
		border-radius: 4px;
	}

	@media (max-width: 1100px) {
		.app { grid-template-columns: 200px 1fr 1fr; }
	}
	@media (max-width: 900px) {
		.app { grid-template-columns: 1fr; grid-template-rows: auto auto auto; height: auto; }
		.chat, .spec, .sidebar { height: auto; }
		.messages, .spec-body { max-height: 60vh; }
	}
</style>
