/**
 * Render a structured spec as a prompt for a coding agent
 * (Claude Code, Codex, Cursor, Aider, etc.).
 *
 * The output is a single, self-contained build brief: a role line at the
 * top, a complete spec, and an explicit build sequence at the bottom.
 * It is markdown so it renders nicely in any chat UI, but flat enough
 * that agents can scan it linearly.
 */
export function specToPrompt(spec) {
	if (!spec) return '';
	const out = [];
	const push = (...l) => out.push(...l);
	const blank = () => out.push('');

	const title = spec.title?.trim() || 'Untitled App';
	const tagline = spec.tagline?.trim();

	// --- Role / framing ---
	push(
		'You are an AI coding agent. Build the web application specified below, end to end.',
		'',
		'Read the entire spec before writing any code. Follow it precisely. When a detail is missing or ambiguous, ask the user before assuming. Implement features strictly in priority order (P0 first, then P1, then P2).'
	);
	blank();
	push('---');
	blank();

	// --- Project ---
	push(`# ${title}`);
	if (tagline) push('', `_${tagline}_`);
	blank();

	if (spec.overview?.trim()) {
		push('## Overview', '', spec.overview.trim());
		blank();
	}

	// --- Target users ---
	if (spec.target_audience?.length) {
		push('## Target users');
		blank();
		for (const a of spec.target_audience) {
			if (!a.persona && !a.needs && !a.pain_points) continue;
			push(`### ${a.persona || 'Persona'}`);
			if (a.needs) push(`- **Needs:** ${a.needs}`);
			if (a.pain_points) push(`- **Pain points:** ${a.pain_points}`);
			blank();
		}
	}

	// --- Features (grouped by priority for an agent to scan) ---
	if (spec.features?.length) {
		push('## Features');
		blank();
		const order = ['P0', 'P1', 'P2'];
		const groups = { P0: [], P1: [], P2: [] };
		for (const f of spec.features) {
			const p = (f.priority || 'P1').toUpperCase();
			(groups[p] || groups.P1).push(f);
		}
		for (const p of order) {
			if (!groups[p].length) continue;
			const label =
				p === 'P0'
					? 'P0 — must ship in v1'
					: p === 'P1'
						? 'P1 — next'
						: 'P2 — later';
			push(`### ${label}`);
			blank();
			for (const f of groups[p]) {
				push(`- **${f.name || 'Feature'}**`);
				if (f.description) push(`  - ${f.description}`);
				if (f.user_value) push(`  - _Why:_ ${f.user_value}`);
			}
			blank();
		}
	}

	// --- User stories ---
	if (spec.user_stories?.length) {
		push('## User stories');
		blank();
		spec.user_stories.forEach((s, i) => {
			if (s?.trim()) push(`${i + 1}. ${s.trim()}`);
		});
		blank();
	}

	// --- Design ---
	const d = spec.design_spec;
	if (d) {
		const designLines = [];
		if (d.look_and_feel) designLines.push(`- **Look & feel:** ${d.look_and_feel}`);
		if (d.typography) designLines.push(`- **Typography:** ${d.typography}`);
		if (d.color_palette?.length) {
			designLines.push(
				`- **Color palette:** ${d.color_palette
					.filter(Boolean)
					.map((c) => `\`${c}\``)
					.join(', ')}`
			);
		}
		if (designLines.length || d.key_screens?.length) {
			push('## Design');
			blank();
			if (designLines.length) {
				push(...designLines);
				blank();
			}
			if (d.key_screens?.length) {
				push('### Key screens');
				blank();
				for (const s of d.key_screens) {
					if (!s.name && !s.purpose && !s.components?.length) continue;
					push(`#### ${s.name || 'Screen'}`);
					if (s.purpose) push('', s.purpose);
					if (s.components?.length) {
						blank();
						push('Components:');
						for (const c of s.components) if (c?.trim()) push(`- ${c}`);
					}
					blank();
				}
			}
		}
	}

	// --- Data model ---
	if (spec.data_model?.length) {
		push('## Data model');
		blank();
		for (const e of spec.data_model) {
			if (!e.entity && !e.fields?.length) continue;
			push(`### \`${e.entity || 'Entity'}\``);
			blank();
			if (e.fields?.length) {
				push('| Field | Type | Notes |', '| ----- | ---- | ----- |');
				for (const f of e.fields) {
					const name = (f.name || '').trim() || '_unnamed_';
					const type = (f.type || '').trim() || '_string_';
					const notes = (f.notes || '').trim().replace(/\|/g, '\\|') || '';
					push(`| \`${name}\` | \`${type}\` | ${notes} |`);
				}
				blank();
			}
			if (e.relationships) {
				push(`**Relationships:** ${e.relationships}`);
				blank();
			}
		}
	}

	// --- API ---
	if (spec.api_schema?.length) {
		push('## API');
		blank();
		for (const r of spec.api_schema) {
			if (!r.method && !r.path) continue;
			const method = (r.method || 'GET').toUpperCase();
			const path = r.path || '/';
			push(`### \`${method} ${path}\``);
			if (r.purpose) push('', r.purpose);
			if (r.request_body?.trim()) {
				blank();
				push('**Request:**', '```json', r.request_body.trim(), '```');
			}
			if (r.response_body?.trim()) {
				blank();
				push('**Response:**', '```json', r.response_body.trim(), '```');
			}
			blank();
		}
	}

	// --- Stack ---
	const t = spec.tech_stack;
	if (t) {
		push('## Tech stack');
		blank();
		if (t.frontend) push(`- **Frontend:** ${t.frontend}`);
		if (t.backend) push(`- **Backend:** ${t.backend}`);
		if (t.database) push(`- **Database:** ${t.database}`);
		if (t.auth) push(`- **Auth:** ${t.auth}`);
		if (t.hosting) push(`- **Hosting:** ${t.hosting}`);
		if (t.notes) {
			blank();
			push(`**Notes:** ${t.notes}`);
		}
		blank();
	}

	// --- Non-functional ---
	if (spec.non_functional_requirements?.length) {
		const items = spec.non_functional_requirements.filter((n) => n?.trim());
		if (items.length) {
			push('## Non-functional requirements');
			blank();
			for (const n of items) push(`- ${n}`);
			blank();
		}
	}

	// --- Open questions (treat as blockers) ---
	if (spec.open_questions?.length) {
		const items = spec.open_questions.filter((q) => q?.trim());
		if (items.length) {
			push('## Open questions');
			blank();
			push('Before writing code, ask the user to resolve:');
			blank();
			for (const q of items) push(`- ${q}`);
			blank();
		}
	}

	// --- Build instructions ---
	push('---');
	blank();
	push('## Build instructions');
	blank();
	push(
		'1. Use the tech stack above exactly. Do not substitute frameworks without asking.',
		'2. Scaffold the project, install dependencies, and configure dev tooling.',
		'3. Create the data model from the schema above.',
		'4. Implement the API endpoints exactly as specified, including request and response shapes.',
		'5. Build the UI shell using the design tokens (look & feel, typography, colors).',
		'6. Implement the screens listed under **Key screens**, then implement features in priority order: every P0 first, then P1, then P2.',
		'7. Satisfy the non-functional requirements throughout (do not bolt them on at the end).',
		'8. If any **open question** is still unresolved, ask before you implement the affected feature.',
		'9. When done, print the project file tree and the commands needed to run it locally.'
	);
	blank();
	push(
		'Write production-quality code: typed where the stack supports it, readable, with no commented-out scaffolding. Keep components small. Prefer the simplest design that satisfies the spec.'
	);
	out.push('');

	return out.join('\n').trim() + '\n';
}
