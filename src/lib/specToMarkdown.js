/**
 * Render a structured spec object as a single Markdown document.
 * Output is designed to be pasted into an AI IDE/CLI as a build brief.
 */
export function specToMarkdown(spec) {
	if (!spec) return '';
	const lines = [];

	lines.push(`# ${spec.title || 'Untitled App'}`);
	if (spec.tagline) lines.push(`> ${spec.tagline}`);
	lines.push('');

	if (spec.overview) {
		lines.push('## Overview');
		lines.push(spec.overview);
		lines.push('');
	}

	if (spec.target_audience?.length) {
		lines.push('## Target Audience');
		for (const a of spec.target_audience) {
			lines.push(`### ${a.persona}`);
			lines.push(`- **Needs:** ${a.needs}`);
			lines.push(`- **Pain points:** ${a.pain_points}`);
			lines.push('');
		}
	}

	if (spec.features?.length) {
		lines.push('## Features');
		for (const f of spec.features) {
			lines.push(`### ${f.name} _(${f.priority})_`);
			lines.push(f.description);
			if (f.user_value) lines.push(`- **User value:** ${f.user_value}`);
			lines.push('');
		}
	}

	if (spec.user_stories?.length) {
		lines.push('## User Stories');
		for (const s of spec.user_stories) lines.push(`- ${s}`);
		lines.push('');
	}

	if (spec.design_spec) {
		const d = spec.design_spec;
		lines.push('## Design Spec');
		if (d.look_and_feel) lines.push(`**Look & feel:** ${d.look_and_feel}`);
		if (d.typography) lines.push(`**Typography:** ${d.typography}`);
		if (d.color_palette?.length) {
			lines.push(`**Color palette:** ${d.color_palette.join(', ')}`);
		}
		lines.push('');
		if (d.key_screens?.length) {
			lines.push('### Key screens');
			for (const s of d.key_screens) {
				lines.push(`- **${s.name}**: ${s.purpose}`);
				if (s.components?.length) {
					for (const c of s.components) lines.push(`  - ${c}`);
				}
			}
			lines.push('');
		}
	}

	if (spec.data_model?.length) {
		lines.push('## Data Model');
		for (const e of spec.data_model) {
			lines.push(`### ${e.entity}`);
			if (e.fields?.length) {
				lines.push('| Field | Type | Notes |');
				lines.push('| --- | --- | --- |');
				for (const f of e.fields) {
					lines.push(`| ${f.name} | ${f.type} | ${f.notes || ''} |`);
				}
			}
			if (e.relationships) lines.push(`**Relationships:** ${e.relationships}`);
			lines.push('');
		}
	}

	if (spec.api_schema?.length) {
		lines.push('## API Schema');
		for (const r of spec.api_schema) {
			lines.push(`### \`${r.method} ${r.path}\``);
			lines.push(r.purpose);
			if (r.request_body) lines.push(`- **Request:** ${r.request_body}`);
			if (r.response_body) lines.push(`- **Response:** ${r.response_body}`);
			lines.push('');
		}
	}

	if (spec.tech_stack) {
		const t = spec.tech_stack;
		lines.push('## Recommended Tech Stack');
		lines.push(`- **Frontend:** ${t.frontend}`);
		lines.push(`- **Backend:** ${t.backend}`);
		lines.push(`- **Database:** ${t.database}`);
		lines.push(`- **Auth:** ${t.auth}`);
		lines.push(`- **Hosting:** ${t.hosting}`);
		if (t.notes) lines.push(`- **Notes:** ${t.notes}`);
		lines.push('');
	}

	if (spec.non_functional_requirements?.length) {
		lines.push('## Non-Functional Requirements');
		for (const n of spec.non_functional_requirements) lines.push(`- ${n}`);
		lines.push('');
	}

	if (spec.open_questions?.length) {
		lines.push('## Open Questions');
		for (const q of spec.open_questions) lines.push(`- ${q}`);
		lines.push('');
	}

	return lines.join('\n').trim() + '\n';
}
