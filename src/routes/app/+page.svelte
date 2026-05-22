<script>
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import icon from '$lib/assets/icon.svg';
	import { specToMarkdown } from '$lib/specToMarkdown.js';
	import { specToPrompt } from '$lib/specToPrompt.js';
	import { loadState, saveState, newSession, newSessionId } from '$lib/storage.js';

	let sessions = $state({});
	let activeId = $state(null);
	let input = $state('');
	let loading = $state(false);
	let errorMsg = $state('');
	let hydrated = $state(false);
	let copied = $state(false);
	let switcherOpen = $state(false);
	let historyOpen = $state(false);
	let view = $state('prompt'); // 'prompt' | 'markdown' | 'json'
	let pane = $state('spec'); // mobile-only: 'spec' | 'output'
	let assistantExpanded = $state(false);
	let switcherEl;
	let pendingDeleteId = $state(null);
	let confirmTimer;

	const active = $derived(activeId ? sessions[activeId] : null);
	const messages = $derived(active?.messages ?? []);
	const spec = $derived(active?.spec ?? null);
	const promptText = $derived(spec ? specToPrompt(spec) : '');
	const markdownText = $derived(spec ? specToMarkdown(spec) : '');
	const jsonText = $derived(spec ? JSON.stringify(spec, null, 2) : '');
	const viewText = $derived(
		view === 'prompt' ? promptText : view === 'markdown' ? markdownText : jsonText
	);
	const viewLines = $derived(viewText ? viewText.split('\n').length : 0);
	const lastAssistant = $derived(
		[...messages].reverse().find((m) => m.role === 'assistant')?.content || ''
	);
	const sessionList = $derived(
		Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt)
	);

	onMount(async () => {
		const s = loadState();
		sessions = s.sessions || {};
		activeId = s.activeId;
		if (!activeId || !sessions[activeId]) {
			goto('/');
			return;
		}
		hydrated = true;

		const sess = sessions[activeId];
		const needsFirstRun =
			sess.messages.length === 1 && sess.messages[0].role === 'user' && !sess.spec;
		if (needsFirstRun) {
			await tick();
			runTurn(sess.messages);
		}
	});

	$effect(() => {
		if (!hydrated) return;
		saveState({ sessions, activeId });
	});

	$effect(() => {
		function onDoc(e) {
			if (switcherOpen && switcherEl && !switcherEl.contains(e.target)) {
				switcherOpen = false;
				pendingDeleteId = null;
				clearTimeout(confirmTimer);
			}
			if (
				pendingDeleteId &&
				!e.target.closest?.('[data-delete-btn]') &&
				!switcherEl?.contains(e.target)
			) {
				pendingDeleteId = null;
				clearTimeout(confirmTimer);
			}
		}
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});

	function touch() {
		if (active) active.updatedAt = Date.now();
	}

	function selectSession(id) {
		activeId = id;
		errorMsg = '';
		switcherOpen = false;
		pendingDeleteId = null;
	}

	function requestDelete(id, e) {
		e?.stopPropagation();
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
		pendingDeleteId = null;
		clearTimeout(confirmTimer);
		if (activeId === id) {
			const remaining = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);
			if (remaining.length) activeId = remaining[0].id;
			else {
				saveState({ sessions, activeId: null });
				goto('/');
			}
		}
	}

	async function runTurn(nextMessages) {
		errorMsg = '';
		loading = true;
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
			const firstTurn = !active?.spec;
			const current = sessions[activeId];
			sessions = {
				...sessions,
				[activeId]: {
					...current,
					messages: [...nextMessages, assistantMsg],
					spec: data.spec,
					title: firstTurn && data.spec?.title ? data.spec.title : current.title,
					updatedAt: Date.now()
				}
			};
		} catch (e) {
			errorMsg = e?.message || 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	async function send() {
		const text = input.trim();
		if (!text || loading || !active) return;
		const userMsg = { role: 'user', content: text };
		const nextMessages = [...messages, userMsg];
		active.messages = nextMessages;
		touch();
		input = '';
		runTurn(nextMessages);
	}

	function onKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function ext() {
		return view === 'json' ? 'json' : 'md';
	}

	function exportFile() {
		if (!spec || !viewText) return;
		const mime = view === 'json' ? 'application/json' : 'text/markdown';
		const blob = new Blob([viewText], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const safe = (spec.title || 'spec')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
		const suffix = view === 'prompt' ? '-prompt' : view === 'markdown' ? '-spec' : '-spec';
		a.href = url;
		a.download = (safe || 'spec') + suffix + '.' + ext();
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function copyView() {
		if (!viewText) return;
		try {
			await navigator.clipboard.writeText(viewText);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* ignore */
		}
	}

	function addPersona() {
		active.spec.target_audience.push({ persona: 'New persona', needs: '', pain_points: '' });
		touch();
	}
	function removePersona(i) {
		active.spec.target_audience.splice(i, 1);
		touch();
	}
	function addFeature() {
		active.spec.features.push({
			name: 'New feature',
			description: '',
			priority: 'P1',
			user_value: ''
		});
		touch();
	}
	function removeFeature(i) {
		active.spec.features.splice(i, 1);
		touch();
	}
	function addStory() {
		active.spec.user_stories.push('As a user, I want to ... so that ...');
		touch();
	}
	function removeStory(i) {
		active.spec.user_stories.splice(i, 1);
		touch();
	}
	function addColor() {
		active.spec.design_spec.color_palette.push('#000000');
		touch();
	}
	function removeColor(i) {
		active.spec.design_spec.color_palette.splice(i, 1);
		touch();
	}
	function addScreen() {
		active.spec.design_spec.key_screens.push({ name: 'New screen', purpose: '', components: [] });
		touch();
	}
	function removeScreen(i) {
		active.spec.design_spec.key_screens.splice(i, 1);
		touch();
	}
	function addScreenComponent(si) {
		active.spec.design_spec.key_screens[si].components.push('Component');
		touch();
	}
	function removeScreenComponent(si, ci) {
		active.spec.design_spec.key_screens[si].components.splice(ci, 1);
		touch();
	}
	function addEntity() {
		active.spec.data_model.push({ entity: 'NewEntity', relationships: '', fields: [] });
		touch();
	}
	function removeEntity(i) {
		active.spec.data_model.splice(i, 1);
		touch();
	}
	function addField(ei) {
		active.spec.data_model[ei].fields.push({ name: '', type: 'string', notes: '' });
		touch();
	}
	function removeField(ei, fi) {
		active.spec.data_model[ei].fields.splice(fi, 1);
		touch();
	}
	function addEndpoint() {
		active.spec.api_schema.push({
			method: 'GET',
			path: '/',
			purpose: '',
			request_body: '',
			response_body: ''
		});
		touch();
	}
	function removeEndpoint(i) {
		active.spec.api_schema.splice(i, 1);
		touch();
	}
	function addNFR() {
		active.spec.non_functional_requirements.push('');
		touch();
	}
	function removeNFR(i) {
		active.spec.non_functional_requirements.splice(i, 1);
		touch();
	}
	function addQuestion() {
		active.spec.open_questions.push('');
		touch();
	}
	function removeQuestion(i) {
		active.spec.open_questions.splice(i, 1);
		touch();
	}
</script>

<svelte:head>
	<title>{active?.spec?.title || active?.title || 'write my app'}</title>
</svelte:head>

<div class="shell">
	{#if loading}
		<div class="loading-bar" role="progressbar" aria-label="Loading"></div>
	{/if}
	<!-- ---------- top bar ---------- -->
	<header class="bar">
		<div class="bar-left">
			<a class="brand" href="/" aria-label="Home">
				<img src={icon} alt="" width="20" height="20" />
			</a>
			<span class="bar-sep">/</span>
			<div class="switcher" bind:this={switcherEl}>
				<button
					class="switcher-btn"
					onclick={() => (switcherOpen = !switcherOpen)}
					aria-expanded={switcherOpen}
				>
					<span class="switcher-title">{active?.spec?.title || active?.title || 'untitled'}</span>
					<svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
						<path
							d="M3 4.5 L6 7.5 L9 4.5"
							stroke="currentColor"
							stroke-width="1.4"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
				{#if switcherOpen}
					<div class="switcher-menu">
						<div class="menu-list">
							{#each sessionList as s (s.id)}
								{@const armed = pendingDeleteId === s.id}
								<div class="menu-item" class:current={s.id === activeId} class:armed>
									<button class="menu-open" onclick={() => selectSession(s.id)}>
										<span class="menu-dot" class:active={s.id === activeId}></span>
										<span class="menu-item-title">{s.spec?.title || s.title}</span>
									</button>
									<button
										class="menu-del"
										class:armed
										data-delete-btn
										onclick={(e) => requestDelete(s.id, e)}
										aria-label={armed ? 'confirm delete' : 'delete'}
										title={armed ? 'click again' : 'delete'}
									>
										{#if armed}
											<span>delete</span>
										{:else}
											<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
												<path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9.5h5L11 4M7 6.5v5M9 6.5v5" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										{/if}
									</button>
								</div>
							{/each}
						</div>
						<a class="menu-foot" href="/">
							<span class="mf-plus">＋</span>
							<span>new spec</span>
						</a>
					</div>
				{/if}
			</div>
		</div>
		<div class="bar-right">
			<button class="btn ghost icon-only-mobile" onclick={() => (historyOpen = !historyOpen)} aria-label="History">
				<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
					<path d="M2 4h12M2 8h12M2 12h8" stroke-linecap="round"/>
				</svg>
				<span class="hide-on-mobile">history</span>
			</button>
		</div>
	</header>

	<!-- mobile-only pane switcher -->
	<nav class="pane-tabs" aria-label="View">
		<button class="pane-tab" class:active={pane === 'spec'} onclick={() => (pane = 'spec')}>
			<span class="pt-dot"></span>
			<span>spec</span>
		</button>
		<button class="pane-tab" class:active={pane === 'output'} onclick={() => (pane = 'output')}>
			<span class="pt-dot"></span>
			<span>output</span>
		</button>
	</nav>

	<main class="workspace" data-pane={pane}>
		<!-- ---------- LEFT: editor ---------- -->
		<section class="col col-left">
			<div class="col-bar">
				<span class="col-bar-label">spec</span>
				{#if spec}
					<span class="col-bar-meta">
						{spec.features?.length ?? 0} feat
						<span class="cm-sep">·</span>
						{spec.data_model?.length ?? 0} ent
						<span class="cm-sep">·</span>
						{spec.api_schema?.length ?? 0} ep
					</span>
				{/if}
			</div>

			<div class="col-body editor">
				{#if !spec && loading}
					<div class="big-loading">
						<div class="bl-status">
							<span class="bl-dot"></span>
							<span class="bl-text">generating spec</span>
							<span class="bl-dots"><span></span><span></span><span></span></span>
						</div>
						<p class="bl-sub">drafting features, schema, screens, and stack</p>
						<div class="skeleton">
							<div class="sk-line w60"></div>
							<div class="sk-line w40"></div>
							<div class="sk-block"></div>
							<div class="sk-block short"></div>
						</div>
					</div>
				{:else if !spec}
					<div class="empty">
						<p class="empty-line">// waiting...</p>
					</div>
				{:else}
					<input class="ed-title" bind:value={active.spec.title} placeholder="App title" />
					<textarea
						class="ed-tagline"
						bind:value={active.spec.tagline}
						placeholder="one-line tagline"
						rows="1"
					></textarea>

					<h3 id="overview"><span class="h3-num">01</span> overview</h3>
					<textarea
						class="ed-text"
						bind:value={active.spec.overview}
						placeholder="what the app does and why"
					></textarea>

					<div class="section-head">
						<h3 id="audience"><span class="h3-num">02</span> audience</h3>
						<button class="add" onclick={addPersona}>+ persona</button>
					</div>
					{#each active.spec.target_audience as a, i (i)}
						<div class="block group">
							<button class="remove-corner" aria-label="Remove" onclick={() => removePersona(i)}
								>×</button
							>
							<input
								class="ed-strong"
								bind:value={active.spec.target_audience[i].persona}
								placeholder="persona"
							/>
							<label>needs</label>
							<textarea
								class="ed-text sm"
								bind:value={active.spec.target_audience[i].needs}
								placeholder="what they need"
							></textarea>
							<label>pain points</label>
							<textarea
								class="ed-text sm"
								bind:value={active.spec.target_audience[i].pain_points}
								placeholder="what frustrates them"
							></textarea>
						</div>
					{/each}

					<div class="section-head">
						<h3 id="features"><span class="h3-num">03</span> features</h3>
						<button class="add" onclick={addFeature}>+ feature</button>
					</div>
					{#each active.spec.features as f, i (i)}
						<div class="block group">
							<button class="remove-corner" aria-label="Remove" onclick={() => removeFeature(i)}
								>×</button
							>
							<div class="row gap">
								<input
									class="ed-strong grow"
									bind:value={active.spec.features[i].name}
									placeholder="feature name"
								/>
								<select
									class="priority-select p-{active.spec.features[i].priority.toLowerCase()}"
									bind:value={active.spec.features[i].priority}
								>
									<option value="P0">P0</option>
									<option value="P1">P1</option>
									<option value="P2">P2</option>
								</select>
							</div>
							<textarea
								class="ed-text sm"
								bind:value={active.spec.features[i].description}
								placeholder="what it does"
							></textarea>
							<label>why this matters</label>
							<textarea
								class="ed-text sm"
								bind:value={active.spec.features[i].user_value}
								placeholder="user value"
							></textarea>
						</div>
					{/each}

					<div class="section-head">
						<h3 id="stories"><span class="h3-num">04</span> user stories</h3>
						<button class="add" onclick={addStory}>+ story</button>
					</div>
					{#each active.spec.user_stories as s, i (i)}
						<div class="list-row">
							<span class="bullet">▸</span>
							<textarea
								class="ed-text sm grow"
								bind:value={active.spec.user_stories[i]}
								placeholder="as a ... I want to ... so that ..."
							></textarea>
							<button class="remove" aria-label="Remove" onclick={() => removeStory(i)}>×</button>
						</div>
					{/each}

					<h3 id="design"><span class="h3-num">05</span> design</h3>
					<label>look &amp; feel</label>
					<textarea
						class="ed-text sm"
						bind:value={active.spec.design_spec.look_and_feel}
						placeholder="visual tone, mood, personality"
					></textarea>
					<label>typography</label>
					<input
						class="ed-input"
						bind:value={active.spec.design_spec.typography}
						placeholder="font choices"
					/>
					<div class="subhead">
						<label>colors</label>
						<button class="add small" onclick={addColor}>+ color</button>
					</div>
					<div class="palette-editor">
						{#each active.spec.design_spec.color_palette as c, i (i)}
							<div class="swatch-edit">
								<span class="swatch-dot" style="background: {c}"></span>
								<input
									class="swatch-input"
									bind:value={active.spec.design_spec.color_palette[i]}
									placeholder="#000000"
								/>
								<button class="swatch-x" aria-label="Remove" onclick={() => removeColor(i)}
									>×</button
								>
							</div>
						{/each}
					</div>

					<div class="subhead">
						<label>key screens</label>
						<button class="add small" onclick={addScreen}>+ screen</button>
					</div>
					{#each active.spec.design_spec.key_screens as scr, si (si)}
						<div class="block group">
							<button class="remove-corner" aria-label="Remove" onclick={() => removeScreen(si)}
								>×</button
							>
							<input
								class="ed-strong"
								bind:value={active.spec.design_spec.key_screens[si].name}
								placeholder="screen name"
							/>
							<label>purpose</label>
							<textarea
								class="ed-text sm"
								bind:value={active.spec.design_spec.key_screens[si].purpose}
								placeholder="what this screen is for"
							></textarea>
							<div class="subhead">
								<label>components</label>
								<button class="add small" onclick={() => addScreenComponent(si)}>+ component</button
								>
							</div>
							{#each scr.components as c, ci (ci)}
								<div class="list-row">
									<span class="bullet sm">·</span>
									<input
										class="ed-input grow"
										bind:value={active.spec.design_spec.key_screens[si].components[ci]}
										placeholder="component"
									/>
									<button
										class="remove"
										aria-label="Remove"
										onclick={() => removeScreenComponent(si, ci)}>×</button
									>
								</div>
							{/each}
						</div>
					{/each}

					<div class="section-head">
						<h3 id="data"><span class="h3-num">06</span> data model</h3>
						<button class="add" onclick={addEntity}>+ entity</button>
					</div>
					{#each active.spec.data_model as e, ei (ei)}
						<div class="block group">
							<button class="remove-corner" aria-label="Remove" onclick={() => removeEntity(ei)}
								>×</button
							>
							<input
								class="ed-strong mono"
								bind:value={active.spec.data_model[ei].entity}
								placeholder="EntityName"
							/>

							<div class="subhead">
								<label>fields</label>
								<button class="add small" onclick={() => addField(ei)}>+ field</button>
							</div>
							<div class="field-table">
								<div class="ft-head">
									<span>field</span>
									<span>type</span>
									<span>notes</span>
									<span></span>
								</div>
								{#each e.fields as f, fi (fi)}
									<div class="ft-row">
										<input
											class="ed-cell mono"
											bind:value={active.spec.data_model[ei].fields[fi].name}
											placeholder="field_name"
										/>
										<input
											class="ed-cell mono ed-cell-type"
											bind:value={active.spec.data_model[ei].fields[fi].type}
											placeholder="string"
										/>
										<input
											class="ed-cell"
											bind:value={active.spec.data_model[ei].fields[fi].notes}
											placeholder="notes"
										/>
										<button class="remove" aria-label="Remove" onclick={() => removeField(ei, fi)}
											>×</button
										>
									</div>
								{/each}
							</div>

							<label>relationships</label>
							<textarea
								class="ed-text sm"
								bind:value={active.spec.data_model[ei].relationships}
								placeholder="how this entity relates to others"
							></textarea>
						</div>
					{/each}

					<div class="section-head">
						<h3 id="api"><span class="h3-num">07</span> api</h3>
						<button class="add" onclick={addEndpoint}>+ endpoint</button>
					</div>
					{#each active.spec.api_schema as r, i (i)}
						<div class="block group">
							<button class="remove-corner" aria-label="Remove" onclick={() => removeEndpoint(i)}
								>×</button
							>
							<div class="row gap endpoint-row">
								<select
									class="method-select method-{active.spec.api_schema[i].method.toLowerCase()}"
									bind:value={active.spec.api_schema[i].method}
								>
									<option value="GET">GET</option>
									<option value="POST">POST</option>
									<option value="PUT">PUT</option>
									<option value="PATCH">PATCH</option>
									<option value="DELETE">DELETE</option>
								</select>
								<input
									class="ed-input mono grow"
									bind:value={active.spec.api_schema[i].path}
									placeholder="/path"
								/>
							</div>
							<label>purpose</label>
							<textarea
								class="ed-text sm"
								bind:value={active.spec.api_schema[i].purpose}
								placeholder="what this endpoint does"
							></textarea>
							<label>request</label>
							<textarea
								class="ed-text sm mono"
								bind:value={active.spec.api_schema[i].request_body}
								placeholder="request body shape"
							></textarea>
							<label>response</label>
							<textarea
								class="ed-text sm mono"
								bind:value={active.spec.api_schema[i].response_body}
								placeholder="response body shape"
							></textarea>
						</div>
					{/each}

					<h3 id="stack"><span class="h3-num">08</span> stack</h3>
					<div class="stack-grid">
						<label>frontend</label>
						<input class="ed-input mono" bind:value={active.spec.tech_stack.frontend} />
						<label>backend</label>
						<input class="ed-input mono" bind:value={active.spec.tech_stack.backend} />
						<label>database</label>
						<input class="ed-input mono" bind:value={active.spec.tech_stack.database} />
						<label>auth</label>
						<input class="ed-input mono" bind:value={active.spec.tech_stack.auth} />
						<label>hosting</label>
						<input class="ed-input mono" bind:value={active.spec.tech_stack.hosting} />
					</div>
					<label>notes</label>
					<textarea
						class="ed-text sm"
						bind:value={active.spec.tech_stack.notes}
						placeholder="stack rationale"
					></textarea>

					<div class="section-head">
						<h3 id="nfr"><span class="h3-num">09</span> non-functional</h3>
						<button class="add" onclick={addNFR}>+ item</button>
					</div>
					{#each active.spec.non_functional_requirements as n, i (i)}
						<div class="list-row">
							<span class="bullet">▸</span>
							<textarea
								class="ed-text sm grow"
								bind:value={active.spec.non_functional_requirements[i]}
								placeholder="requirement"
							></textarea>
							<button class="remove" aria-label="Remove" onclick={() => removeNFR(i)}>×</button>
						</div>
					{/each}

					<div class="section-head">
						<h3 id="open"><span class="h3-num">10</span> open questions</h3>
						<button class="add" onclick={addQuestion}>+ question</button>
					</div>
					{#each active.spec.open_questions as q, i (i)}
						<div class="list-row">
							<span class="bullet mark">?</span>
							<textarea
								class="ed-text sm grow"
								bind:value={active.spec.open_questions[i]}
								placeholder="question"
							></textarea>
							<button class="remove" aria-label="Remove" onclick={() => removeQuestion(i)}>×</button>
						</div>
					{/each}
				{/if}
			</div>

			<!-- composer -->
			<div class="composer-area">
				{#if errorMsg}
					<div class="error">
						<span class="error-tag">error</span>
						<span>{errorMsg}</span>
					</div>
				{:else if loading && spec}
					<div class="thinking">
						<div class="th-head">
							<span class="th-dot"></span>
							<span class="th-text">thinking</span>
							<span class="th-dots"><span></span><span></span><span></span></span>
							<span class="th-sub">drafting reply &amp; updating spec</span>
						</div>
						<div class="th-progress"></div>
					</div>
				{:else if lastAssistant}
					<div class="assistant-line" class:expanded={assistantExpanded}>
						<div class="al-head">
							<span class="al-tag">ai</span>
							<button
								class="al-toggle"
								onclick={() => (assistantExpanded = !assistantExpanded)}
								aria-label={assistantExpanded ? 'collapse message' : 'expand message'}
							>
								{assistantExpanded ? 'collapse' : 'expand'}
							</button>
						</div>
						<div class="al-text">{lastAssistant}</div>
					</div>
				{/if}
				<div class="composer-row" class:loading-state={loading}>
					<span class="composer-prefix">›</span>
					<textarea
						placeholder="refine..."
						bind:value={input}
						onkeydown={onKeydown}
						rows="1"
						disabled={loading}
					></textarea>
					<button class="send" onclick={send} disabled={loading || !input.trim()}>
						{#if loading}
							<span class="send-loading">
								<span class="sl-dot"></span>
							</span>
						{:else}
							send
						{/if}
					</button>
				</div>
			</div>
		</section>

		<!-- ---------- RIGHT: output ---------- -->
		<section class="col col-right">
			<div class="col-bar output-bar">
				<div class="tabs">
					<button class="tab" class:active={view === 'prompt'} onclick={() => (view = 'prompt')}
						>prompt</button
					>
					<button
						class="tab"
						class:active={view === 'markdown'}
						onclick={() => (view = 'markdown')}>markdown</button
					>
					<button class="tab" class:active={view === 'json'} onclick={() => (view = 'json')}
						>json</button
					>
				</div>
				<div class="output-actions">
					{#if viewLines > 0}
						<span class="output-stat">{viewLines} lines</span>
					{/if}
					<button class="btn" onclick={copyView} disabled={!spec}>
						{copied ? 'copied' : 'copy'}
					</button>
					<button class="btn primary" onclick={exportFile} disabled={!spec}>export</button>
				</div>
			</div>

			{#if view === 'prompt'}
				<div class="prompt-hint">
					paste into <span class="ic">claude code</span>, <span class="ic">codex</span>,
					<span class="ic">cursor</span>, <span class="ic">copilot</span>,
					<span class="ic">opencode</span>, etc.
				</div>
			{/if}

			<div class="col-body raw">
				{#if !spec && loading}
					<div class="skeleton">
						<div class="sk-line w60"></div>
						<div class="sk-line w90"></div>
						<div class="sk-line w70"></div>
					</div>
				{:else if !spec}
					<div class="empty">
						<p class="empty-line">// output appears here.</p>
					</div>
				{:else}
					<pre class="raw-md">{viewText}</pre>
				{/if}
			</div>
		</section>
	</main>

	{#if historyOpen}
		<div
			class="drawer-backdrop"
			role="button"
			tabindex="0"
			onclick={() => (historyOpen = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape' || e.key === 'Enter') historyOpen = false;
			}}
		></div>
		<aside class="drawer">
			<div class="drawer-head">
				<span class="drawer-title">history</span>
				<button class="icon-btn" onclick={() => (historyOpen = false)} aria-label="Close">×</button>
			</div>
			<div class="drawer-body">
				{#each messages as m, i (i)}
					<div class="msg" class:user={m.role === 'user'}>
						<div class="msg-role">
							<span class="msg-num">{String(i + 1).padStart(2, '0')}</span>
							<span class="msg-name">{m.role === 'user' ? 'you' : 'ai'}</span>
						</div>
						<div class="msg-content">{m.content}</div>
					</div>
				{/each}
				{#if !messages.length}
					<div class="empty"><p class="empty-line">// no messages yet.</p></div>
				{/if}
			</div>
		</aside>
	{/if}
</div>

<style>
	.shell {
		display: grid;
		grid-template-rows: 44px 1fr;
		height: 100vh;
		min-height: 0;
		position: relative;
	}

	/* ---------- top progress bar (during AI calls) ---------- */
	.loading-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--rule-soft);
		overflow: hidden;
		z-index: 100;
		pointer-events: none;
	}
	.loading-bar::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 38%;
		background: linear-gradient(
			90deg,
			transparent,
			var(--mark) 30%,
			var(--mark-bright) 50%,
			var(--mark) 70%,
			transparent
		);
		animation: bar-slide 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}
	@keyframes bar-slide {
		0% {
			left: -38%;
		}
		100% {
			left: 100%;
		}
	}

	/* ---------- big loading state (first-time spec generation) ---------- */
	.big-loading {
		padding: 8px 0;
	}
	.bl-status {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--text);
		padding: 8px 14px;
		background: var(--bg-1);
		border: 1px solid var(--rule);
		border-left: 3px solid var(--mark);
		border-radius: 3px;
		margin-bottom: 10px;
	}
	.bl-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--mark);
		display: inline-block;
		animation: dot-pulse 1.4s ease-in-out infinite;
	}
	@keyframes dot-pulse {
		0%, 100% {
			opacity: 0.4;
			transform: scale(0.85);
			box-shadow: 0 0 0 0 var(--mark-soft);
		}
		50% {
			opacity: 1;
			transform: scale(1);
			box-shadow: 0 0 0 6px transparent;
		}
	}
	.bl-text {
		font-weight: 500;
		letter-spacing: 0.01em;
	}
	.bl-dots {
		display: inline-flex;
		gap: 3px;
	}
	.bl-dots span,
	.th-dots span {
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: var(--mark);
		display: inline-block;
		animation: bounce-dot 1.2s ease-in-out infinite;
	}
	.bl-dots span:nth-child(2),
	.th-dots span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.bl-dots span:nth-child(3),
	.th-dots span:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes bounce-dot {
		0%, 80%, 100% {
			opacity: 0.25;
			transform: translateY(0);
		}
		40% {
			opacity: 1;
			transform: translateY(-3px);
		}
	}
	.bl-sub {
		margin: 4px 0 18px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
		padding-left: 14px;
	}

	/* ---------- thinking block (above composer during refinement) ---------- */
	.thinking {
		display: flex;
		flex-direction: column;
		background: var(--bg-1);
		border: 1px solid var(--mark);
		border-left-width: 2px;
		border-radius: 3px;
		padding: 10px 14px 12px;
		position: relative;
		overflow: hidden;
		box-shadow: 0 0 0 2px var(--mark-soft);
	}
	.th-head {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text);
	}
	.th-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--mark);
		animation: dot-pulse 1.4s ease-in-out infinite;
		flex-shrink: 0;
	}
	.th-text {
		font-weight: 600;
		color: var(--mark);
		letter-spacing: 0.01em;
	}
	.th-dots {
		display: inline-flex;
		gap: 3px;
	}
	.th-sub {
		margin-left: 8px;
		font-size: 11px;
		color: var(--text-muted);
		font-weight: 400;
	}
	.th-progress {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--rule-soft);
		overflow: hidden;
	}
	.th-progress::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 36%;
		background: linear-gradient(
			90deg,
			transparent,
			var(--mark) 30%,
			var(--mark-bright) 50%,
			var(--mark) 70%,
			transparent
		);
		animation: th-bar 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}
	@keyframes th-bar {
		0%   { left: -36%; }
		100% { left: 100%; }
	}

	/* composer subtly highlights while loading */
	.composer-row.loading-state {
		border-color: var(--mark) !important;
		background: var(--bg-2);
	}
	.send-loading {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
	.sl-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--bg);
		display: inline-block;
		animation: dot-pulse 1.4s ease-in-out infinite;
	}

	/* ---------- top bar ---------- */
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 14px;
		border-bottom: 1px solid var(--rule);
		background: var(--bg);
		gap: 12px;
		min-width: 0;
	}
	.bar-left,
	.bar-right {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.brand {
		display: flex;
		align-items: center;
		color: var(--text);
		text-decoration: none;
		padding: 4px;
		border-radius: 3px;
		transition: background 0.12s ease;
	}
	.brand:hover {
		background: var(--bg-2);
	}
	.brand img {
		border-radius: 4px;
		display: block;
	}
	.bar-sep {
		color: var(--text-dim);
		font-family: var(--font-mono);
		font-size: 14px;
	}

	/* switcher */
	.switcher {
		position: relative;
		min-width: 0;
	}
	.switcher-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		color: var(--text);
		border: 1px solid transparent;
		padding: 4px 10px;
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 12.5px;
		font-weight: 500;
		cursor: pointer;
		max-width: 360px;
		transition: background 0.12s ease, border-color 0.12s ease;
	}
	.switcher-btn:hover {
		background: var(--bg-2);
		border-color: var(--rule);
	}
	.switcher-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 280px;
	}

	.switcher-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		background: var(--bg-1);
		border: 1px solid var(--rule);
		border-radius: 4px;
		min-width: 280px;
		max-width: 360px;
		overflow: hidden;
		z-index: 30;
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
	}
	.menu-list {
		max-height: 320px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		padding: 4px;
	}
	.menu-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 28px;
		align-items: stretch;
		border-radius: 3px;
		overflow: hidden;
		transition: background 0.1s ease;
	}
	.menu-item:hover {
		background: var(--bg-2);
	}
	.menu-item.armed {
		background: rgba(232, 112, 76, 0.08);
	}
	.menu-item.current {
		background: var(--bg-2);
	}
	.menu-open {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		background: transparent;
		border: none;
		color: var(--text);
		padding: 6px 10px;
		text-align: left;
		cursor: pointer;
		font-size: 13px;
		min-width: 0;
		font-family: var(--font-sans);
	}
	.menu-dot {
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: var(--text-dim);
		flex-shrink: 0;
	}
	.menu-dot.active {
		background: var(--mark);
	}
	.menu-item-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.menu-del {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-dim);
		cursor: pointer;
		padding: 0 6px;
		transition: color 0.12s ease, background 0.12s ease;
		font-family: var(--font-mono);
		font-size: 10.5px;
	}
	.menu-del:hover {
		color: var(--err);
		background: rgba(232, 112, 76, 0.08);
	}
	.menu-del.armed {
		background: var(--err);
		color: var(--bg);
		min-width: 56px;
		font-weight: 600;
	}
	.menu-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		color: var(--text-soft);
		border-top: 1px solid var(--rule);
		padding: 8px 12px;
		text-align: left;
		font-family: var(--font-mono);
		font-size: 12px;
		text-decoration: none;
		transition: background 0.12s ease, color 0.12s ease;
	}
	.menu-foot:hover {
		background: var(--bg-2);
		color: var(--mark);
	}
	.mf-plus {
		color: var(--mark);
	}

	/* buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		background: transparent;
		color: var(--text);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 4px 10px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
	}
	.btn:hover:not(:disabled) {
		background: var(--bg-2);
		border-color: var(--rule-strong);
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn.ghost {
		border-color: transparent;
		color: var(--text-muted);
		padding: 4px 8px;
	}
	.btn.ghost:hover:not(:disabled) {
		color: var(--text);
		background: var(--bg-2);
	}
	.btn.primary {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--bg);
		font-weight: 600;
	}
	.btn.primary:hover:not(:disabled) {
		background: var(--mark-bright);
		border-color: var(--mark-bright);
	}

	/* ---------- workspace ---------- */
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
		min-height: 0;
		overflow: hidden;
	}
	.col {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}
	.col-left {
		border-right: 1px solid var(--rule);
	}

	.col-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 18px;
		border-bottom: 1px solid var(--rule);
		background: var(--bg);
		font-family: var(--font-mono);
		font-size: 11px;
		flex-shrink: 0;
	}
	.col-bar-label {
		color: var(--text-muted);
		text-transform: lowercase;
		letter-spacing: 0.04em;
	}
	.col-bar-meta {
		color: var(--text-dim);
		font-size: 11px;
	}
	.cm-sep {
		color: var(--rule-strong);
		padding: 0 2px;
	}

	/* output bar */
	.output-bar {
		padding: 5px 14px 5px 6px;
	}
	.tabs {
		display: inline-flex;
		gap: 0;
	}
	.tab {
		background: transparent;
		color: var(--text-muted);
		border: none;
		border-bottom: 1px solid transparent;
		padding: 8px 12px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease;
		margin-bottom: -1px; /* sit on the col-bar bottom border */
	}
	.tab:hover {
		color: var(--text);
	}
	.tab.active {
		color: var(--mark);
		border-bottom-color: var(--mark);
	}
	.output-actions {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.output-stat {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-dim);
		margin-right: 4px;
	}

	.prompt-hint {
		padding: 8px 18px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
		border-bottom: 1px solid var(--rule-soft);
		background: var(--bg);
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.ic {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-soft);
		background: var(--bg-2);
		padding: 0 6px;
		border: 1px solid var(--rule);
		border-radius: 3px;
		white-space: nowrap;
	}

	.col-body {
		flex: 1;
		overflow-y: auto;
		padding: 22px clamp(16px, 3vw, 32px);
		line-height: 1.5;
		font-size: 13.5px;
	}

	/* editor fields — always look like editable fields */
	.editor :global(input),
	.editor :global(textarea),
	.editor :global(select) {
		background: var(--bg-input);
		color: var(--text);
		border: 1px solid var(--rule-soft);
		border-radius: 3px;
		padding: 5px 8px;
		font-family: inherit;
		font-size: 13.5px;
		line-height: 1.5;
		outline: none;
		transition: background 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease;
		width: 100%;
	}
	.editor :global(input::placeholder),
	.editor :global(textarea::placeholder) {
		color: var(--text-dim);
	}
	.editor :global(input:hover),
	.editor :global(textarea:hover),
	.editor :global(select:hover) {
		background: var(--bg-2);
		border-color: var(--rule);
	}
	.editor :global(input:focus),
	.editor :global(textarea:focus),
	.editor :global(select:focus) {
		background: var(--bg-2);
		border-color: var(--mark);
		box-shadow: 0 0 0 2px var(--mark-soft);
	}
	.editor :global(textarea) {
		resize: vertical;
		min-height: 28px;
		field-sizing: content;
	}
	.editor :global(textarea.sm) {
		font-size: 13px;
	}
	.editor :global(.mono) {
		font-family: var(--font-mono);
		font-size: 12.5px;
	}

	.ed-title {
		font-size: 22px !important;
		font-weight: 600 !important;
		letter-spacing: -0.018em;
		padding: 4px 8px !important;
		margin: 0 0 2px -8px;
		background: transparent !important;
		border: 1px solid transparent !important;
		box-shadow: none !important;
	}
	.ed-title:hover {
		background: var(--bg-1) !important;
		border-color: var(--rule-soft) !important;
	}
	.ed-title:focus {
		background: var(--bg-1) !important;
		border-color: var(--mark) !important;
		box-shadow: 0 0 0 2px var(--mark-soft) !important;
	}
	.ed-tagline {
		color: var(--text-muted) !important;
		font-size: 13px !important;
		margin: 0 0 14px -8px;
		padding: 3px 8px !important;
		background: transparent !important;
		border: 1px solid transparent !important;
		box-shadow: none !important;
	}
	.ed-tagline:hover {
		background: var(--bg-1) !important;
		border-color: var(--rule-soft) !important;
	}
	.ed-tagline:focus {
		background: var(--bg-1) !important;
		border-color: var(--mark) !important;
		box-shadow: 0 0 0 2px var(--mark-soft) !important;
	}
	.ed-text {
		display: block;
		margin: 0 0 12px;
	}
	.ed-strong {
		font-weight: 600;
		font-size: 14px !important;
		margin-left: -7px;
		width: calc(100% + 7px);
	}
	.ed-strong.mono {
		font-family: var(--font-mono) !important;
		color: var(--mark) !important;
	}
	.ed-input {
		display: block;
		margin: 0 0 6px;
	}

	/* headings */
	h3 {
		display: inline-flex;
		align-items: baseline;
		gap: 10px;
		margin: 24px 0 8px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: lowercase;
		color: var(--text);
	}
	.h3-num {
		color: var(--mark);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	label {
		display: block;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-dim);
		font-weight: 500;
		letter-spacing: 0.04em;
		margin: 6px 0 2px;
	}

	.section-head,
	.subhead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.subhead {
		margin-top: 4px;
	}
	.add {
		background: transparent;
		color: var(--text-dim);
		border: 1px solid transparent;
		padding: 2px 7px;
		font-family: var(--font-mono);
		font-size: 11px;
		border-radius: 3px;
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
	}
	.add:hover {
		color: var(--mark);
		background: var(--bg-2);
	}
	.add.small {
		font-size: 10.5px;
		padding: 1px 6px;
	}

	.block {
		background: var(--bg-1);
		border: 1px solid var(--rule);
		padding: 10px 12px;
		border-radius: 4px;
		margin-bottom: 8px;
		position: relative;
	}
	.block:hover {
		border-color: var(--rule-strong);
	}
	.group {
		display: flex;
		flex-direction: column;
	}
	.remove-corner {
		position: absolute;
		top: 4px;
		right: 4px;
		background: transparent;
		border: none;
		color: var(--text-dim);
		font-size: 16px;
		line-height: 1;
		padding: 2px 7px;
		border-radius: 3px;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease, color 0.15s ease;
	}
	.block:hover .remove-corner {
		opacity: 1;
	}
	.remove-corner:hover {
		color: var(--err);
		background: var(--bg-2);
	}
	.remove {
		background: transparent;
		border: none;
		color: var(--text-dim);
		font-size: 15px;
		line-height: 1;
		padding: 2px 7px;
		border-radius: 3px;
		cursor: pointer;
		flex-shrink: 0;
		align-self: flex-start;
		opacity: 0;
		transition: opacity 0.15s ease, color 0.15s ease;
	}
	.list-row:hover .remove,
	.ft-row:hover .remove {
		opacity: 1;
	}
	.remove:hover {
		color: var(--err);
		background: var(--bg-2);
	}

	.row {
		display: flex;
		align-items: center;
	}
	.row.gap {
		gap: 6px;
	}
	.grow {
		flex: 1;
	}
	.list-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin-bottom: 3px;
	}
	.bullet {
		color: var(--mark);
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.8;
		flex-shrink: 0;
		user-select: none;
	}
	.bullet.sm {
		color: var(--text-dim);
		font-size: 13px;
	}
	.bullet.mark {
		color: var(--mark);
		font-weight: 600;
	}

	.priority-select {
		flex: 0 0 auto;
		width: 54px !important;
		text-align: center;
		font-family: var(--font-mono) !important;
		font-size: 10.5px !important;
		font-weight: 600 !important;
		cursor: pointer;
	}
	.p-p0 { color: var(--err) !important; }
	.p-p1 { color: var(--mark) !important; }
	.p-p2 { color: var(--text-muted) !important; }

	.endpoint-row {
		margin-bottom: 4px;
	}
	.method-select {
		flex: 0 0 auto;
		width: 78px !important;
		text-align: center;
		font-size: 10.5px !important;
		font-weight: 600 !important;
		font-family: var(--font-mono) !important;
		cursor: pointer;
	}
	.method-get    { color: var(--good) !important; }
	.method-post   { color: var(--mark) !important; }
	.method-put    { color: #d8a361 !important; }
	.method-patch  { color: #dc8d52 !important; }
	.method-delete { color: var(--err) !important; }

	.palette-editor {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 2px 0 10px;
	}
	.swatch-edit {
		display: flex;
		align-items: center;
		background: var(--bg-1);
		border: 1px solid var(--rule);
		border-radius: 3px;
		overflow: hidden;
	}
	.swatch-edit:focus-within {
		border-color: var(--rule-strong);
	}
	.swatch-dot {
		width: 16px;
		height: 16px;
		margin: 4px 0 4px 6px;
		border: 1px solid var(--rule);
		display: inline-block;
		flex-shrink: 0;
		border-radius: 2px;
	}
	.swatch-input {
		font-family: var(--font-mono) !important;
		font-size: 11.5px !important;
		padding: 3px 7px !important;
		width: auto !important;
		min-width: 96px;
		border: none !important;
		background: transparent !important;
		box-shadow: none !important;
	}
	.swatch-input:hover,
	.swatch-input:focus {
		background: transparent !important;
		border-color: transparent !important;
		box-shadow: none !important;
	}
	.swatch-x {
		background: transparent;
		border: none;
		color: var(--text-dim);
		padding: 3px 7px;
		cursor: pointer;
		font-size: 13px;
		line-height: 1;
	}
	.swatch-x:hover {
		color: var(--err);
	}

	.field-table {
		display: flex;
		flex-direction: column;
		margin: 2px 0 8px;
	}
	.ft-head,
	.ft-row {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 1.4fr) 24px;
		gap: 2px;
		align-items: center;
	}
	.ft-head {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--text-dim);
		padding: 2px 7px 3px;
		text-transform: lowercase;
	}
	.ft-row {
		margin-bottom: 1px;
	}
	.ed-cell {
		font-size: 12.5px !important;
		padding: 3px 7px !important;
	}
	.ed-cell.mono {
		font-family: var(--font-mono) !important;
		font-size: 12px !important;
	}
	.ed-cell-type {
		color: var(--mark) !important;
	}

	.stack-grid {
		display: grid;
		grid-template-columns: 86px 1fr;
		row-gap: 2px;
		column-gap: 10px;
		align-items: center;
		margin: 2px 0 10px;
	}
	.stack-grid label {
		margin: 0;
	}

	/* empty / loading */
	.empty {
		padding: 18px 0;
	}
	.empty-line {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12.5px;
		color: var(--text-dim);
	}

	/* right pane */
	.col-body.raw {
		padding: 22px clamp(16px, 3vw, 32px);
		background:
			linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.005) 100%);
	}
	.raw-md {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12.5px;
		line-height: 1.7;
		color: var(--text-soft);
		white-space: pre-wrap;
		word-wrap: break-word;
		tab-size: 2;
	}

	/* composer */
	.composer-area {
		border-top: 1px solid var(--rule);
		background: var(--bg);
		padding: 8px clamp(16px, 3vw, 32px) 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
	}
	.assistant-line {
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: var(--bg-1);
		border: 1px solid var(--rule);
		border-left: 2px solid var(--mark);
		border-radius: 3px;
		padding: 8px 12px;
	}
	.al-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.al-tag {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--mark);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.al-toggle {
		background: transparent;
		border: none;
		color: var(--text-dim);
		font-family: var(--font-mono);
		font-size: 10.5px;
		padding: 0;
		cursor: pointer;
		text-transform: lowercase;
		letter-spacing: 0.02em;
		transition: color 0.12s ease;
	}
	.al-toggle:hover {
		color: var(--mark);
	}
	.al-text {
		font-size: 13px;
		color: var(--text-soft);
		line-height: 1.55;
		white-space: pre-wrap;
		word-wrap: break-word;
		max-height: 5.5em;
		overflow-y: auto;
		padding-right: 4px;
		transition: max-height 0.2s ease;
	}
	.assistant-line.expanded .al-text {
		max-height: 240px;
	}

	.composer-row {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		background: var(--bg-1);
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 4px 4px 4px 10px;
		transition: border-color 0.12s ease, box-shadow 0.12s ease;
	}
	.composer-row:focus-within {
		border-color: var(--mark);
		box-shadow: 0 0 0 2px var(--mark-soft);
	}
	.composer-prefix {
		color: var(--mark);
		font-family: var(--font-mono);
		font-size: 15px;
		line-height: 1.5;
		padding-bottom: 4px;
		flex-shrink: 0;
		font-weight: 600;
	}
	.composer-row textarea {
		flex: 1;
		background: transparent;
		color: var(--text);
		border: none;
		outline: none;
		resize: none;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.5;
		padding: 5px 0;
		max-height: 140px;
		field-sizing: content;
	}
	.composer-row textarea::placeholder {
		color: var(--text-dim);
	}

	.send {
		background: var(--mark);
		color: var(--bg);
		border: 1px solid var(--mark);
		border-radius: 3px;
		padding: 5px 12px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s ease;
		min-width: 56px;
	}
	.send:hover:not(:disabled) {
		background: var(--mark-bright);
	}
	.send:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.error {
		display: flex;
		gap: 10px;
		align-items: baseline;
		background: var(--danger-bg);
		color: var(--text);
		border: 1px solid var(--danger-border);
		border-radius: 3px;
		padding: 6px 10px;
		font-size: 12.5px;
		font-family: var(--font-mono);
	}
	.error-tag {
		font-size: 10px;
		color: var(--err);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* skeletons — shimmer, not pulse, for visibility on dark bg */
	.skeleton {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 6px 0;
	}
	.sk-line,
	.sk-block {
		background: linear-gradient(
			90deg,
			var(--bg-2) 0%,
			var(--bg-3) 30%,
			var(--rule-strong) 50%,
			var(--bg-3) 70%,
			var(--bg-2) 100%
		);
		background-size: 200% 100%;
		border-radius: 3px;
		animation: shimmer 1.5s linear infinite;
	}
	.sk-line {
		height: 14px;
	}
	.sk-line.w90 { width: 90%; }
	.sk-line.w70 { width: 70%; }
	.sk-line.w60 { width: 60%; }
	.sk-line.w40 { width: 40%; }
	.sk-block {
		height: 48px;
	}
	.sk-block.short {
		width: 70%;
	}
	@keyframes shimmer {
		0%   { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* drawer */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 40;
		border: none;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: min(420px, 92vw);
		background: var(--bg-1);
		border-left: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		z-index: 50;
	}
	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--text-muted);
	}
	.drawer-title {
		color: var(--text);
		text-transform: lowercase;
	}
	.icon-btn {
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		padding: 3px 8px;
		border-radius: 3px;
	}
	.icon-btn:hover {
		background: var(--bg-2);
		color: var(--text);
		border-color: var(--rule);
	}
	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.msg {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.msg-role {
		display: inline-flex;
		gap: 7px;
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
	}
	.msg-num {
		color: var(--mark);
		font-weight: 600;
	}
	.msg-name {
		color: var(--text);
		font-weight: 500;
	}
	.msg-content {
		background: var(--bg-2);
		border-left: 2px solid var(--rule-strong);
		padding: 8px 12px;
		font-size: 13px;
		line-height: 1.5;
		white-space: pre-wrap;
		color: var(--text-soft);
		border-radius: 0 3px 3px 0;
	}
	.msg.user .msg-content {
		border-left-color: var(--mark);
		color: var(--text);
	}

	/* ---------- mobile pane switcher ---------- */
	.pane-tabs {
		display: none;
		border-bottom: 1px solid var(--rule);
		background: var(--bg);
		flex-shrink: 0;
	}
	.pane-tab {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: transparent;
		color: var(--text-muted);
		border: none;
		border-bottom: 2px solid transparent;
		padding: 9px 12px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease;
		margin-bottom: -1px;
	}
	.pane-tab .pt-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--text-dim);
		display: inline-block;
		transition: background 0.12s ease;
	}
	.pane-tab.active {
		color: var(--mark);
		border-bottom-color: var(--mark);
	}
	.pane-tab.active .pt-dot {
		background: var(--mark);
	}

	@media (max-width: 900px) {
		.shell {
			grid-template-rows: 44px auto 1fr;
		}
		.pane-tabs {
			display: flex;
		}
		.workspace {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr;
		}
		.col-left {
			border-right: none;
			display: none;
		}
		.col-right {
			display: none;
		}
		.workspace[data-pane='spec'] .col-left {
			display: flex;
		}
		.workspace[data-pane='output'] .col-right {
			display: flex;
		}
		.switcher-btn {
			max-width: none;
			padding: 4px 8px;
		}
		.switcher-title {
			max-width: 180px;
		}
		.switcher-menu {
			min-width: 260px;
			max-width: calc(100vw - 28px);
		}
		.hide-on-mobile {
			display: none;
		}
		.icon-only-mobile {
			padding: 4px 8px;
		}
	}

	@media (max-width: 560px) {
		.bar {
			padding: 0 10px;
			gap: 8px;
		}
		.bar-sep {
			font-size: 13px;
		}
		.switcher-title {
			max-width: 140px;
		}
		.col-body {
			padding: 14px 12px;
		}
		.col-body.raw {
			padding: 14px 12px;
		}
		.col-bar {
			padding: 6px 12px;
		}
		.output-bar {
			padding: 4px 8px 4px 0;
		}
		.tab {
			padding: 8px 10px;
			font-size: 11px;
		}
		.prompt-hint {
			padding: 6px 12px;
			font-size: 10.5px;
		}
		.composer-area {
			padding: 8px 12px 10px;
		}
		.composer-row {
			padding: 4px 4px 4px 8px;
		}
		.composer-row textarea {
			font-size: 14px; /* prevent iOS auto-zoom */
		}
		.editor :global(input),
		.editor :global(textarea),
		.editor :global(select) {
			font-size: 14px; /* prevent iOS auto-zoom */
		}
		.editor :global(textarea.sm) {
			font-size: 14px;
		}
		.ed-title {
			font-size: 20px !important;
		}
		.ed-strong {
			font-size: 15px !important;
		}
		.ed-tagline {
			font-size: 14px !important;
		}
		.raw-md {
			font-size: 12px;
			line-height: 1.6;
		}
		.field-table {
			margin: 4px -4px 8px;
		}
		.ft-head,
		.ft-row {
			grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr) 24px;
		}
		.ft-head > span:nth-child(3),
		.ft-row > input:nth-of-type(3) {
			display: none;
		}
		.stack-grid {
			grid-template-columns: 72px 1fr;
		}
		/* always-show remove buttons on touch — no hover to reveal */
		.remove-corner,
		.remove {
			opacity: 0.55;
		}
		.block:hover .remove-corner,
		.list-row:hover .remove {
			opacity: 1;
		}
		.output-stat {
			display: none;
		}
		.drawer {
			width: 100vw;
			border-left: none;
		}
	}

	@media (hover: none) and (pointer: coarse) {
		/* touch devices: keep remove buttons visible */
		.remove-corner,
		.remove {
			opacity: 0.6;
		}
	}
</style>
