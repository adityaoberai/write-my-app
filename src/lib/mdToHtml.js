/**
 * Minimal Markdown to HTML renderer tailored to the spec format produced
 * by specToMarkdown.js. Handles: headings (#..####), paragraphs, blockquotes,
 * unordered lists (with one level of nesting), tables, bold/italic/inline-code.
 */

function escapeHtml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(escaped) {
	return escaped
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^a-zA-Z0-9])_([^_\n]+)_(?=$|[^a-zA-Z0-9])/g, '$1<em>$2</em>');
}

function renderList(items) {
	let html = '<ul>';
	for (const it of items) {
		html += '<li>' + inline(escapeHtml(it.content));
		if (it.children.length) html += renderList(it.children);
		html += '</li>';
	}
	html += '</ul>';
	return html;
}

export function mdToHtml(md) {
	if (!md) return '';
	const lines = md.replace(/\r\n?/g, '\n').split('\n');
	const out = [];
	let i = 0;

	while (i < lines.length) {
		const raw = lines[i];
		const trimmed = raw.trim();

		if (!trimmed) {
			i++;
			continue;
		}

		const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
		if (h) {
			const level = Math.min(h[1].length, 6);
			out.push(`<h${level}>${inline(escapeHtml(h[2]))}</h${level}>`);
			i++;
			continue;
		}

		if (trimmed.startsWith('>')) {
			const buf = [];
			while (i < lines.length && lines[i].trim().startsWith('>')) {
				buf.push(lines[i].trim().replace(/^>\s?/, ''));
				i++;
			}
			out.push(`<blockquote>${inline(escapeHtml(buf.join(' ')))}</blockquote>`);
			continue;
		}

		if (
			trimmed.startsWith('|') &&
			i + 1 < lines.length &&
			/^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())
		) {
			const splitRow = (line) => {
				const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
				return t.split('|').map((c) => c.trim());
			};
			const header = splitRow(trimmed);
			i += 2;
			const rows = [];
			while (i < lines.length && lines[i].trim().startsWith('|')) {
				rows.push(splitRow(lines[i]));
				i++;
			}
			let tbl = '<table><thead><tr>';
			for (const c of header) tbl += `<th>${inline(escapeHtml(c))}</th>`;
			tbl += '</tr></thead><tbody>';
			for (const r of rows) {
				tbl += '<tr>';
				for (const c of r) tbl += `<td>${inline(escapeHtml(c))}</td>`;
				tbl += '</tr>';
			}
			tbl += '</tbody></table>';
			out.push(tbl);
			continue;
		}

		if (/^[-*]\s+/.test(trimmed)) {
			const items = [];
			const baseIndent = raw.length - raw.trimStart().length;
			while (i < lines.length) {
				const cur = lines[i];
				const curT = cur.trim();
				if (!curT) {
					let j = i + 1;
					while (j < lines.length && !lines[j].trim()) j++;
					if (
						j < lines.length &&
						/^[-*]\s+/.test(lines[j].trim()) &&
						lines[j].length - lines[j].trimStart().length >= baseIndent
					) {
						i = j;
						continue;
					}
					break;
				}
				const indent = cur.length - cur.trimStart().length;
				if (!/^[-*]\s+/.test(curT) || indent < baseIndent) break;
				const content = curT.replace(/^[-*]\s+/, '');
				if (indent === baseIndent) {
					items.push({ content, children: [] });
				} else {
					const parent = items[items.length - 1];
					if (parent) parent.children.push({ content, children: [] });
				}
				i++;
			}
			out.push(renderList(items));
			continue;
		}

		const para = [trimmed];
		i++;
		while (i < lines.length) {
			const ln = lines[i];
			const t = ln.trim();
			if (!t) break;
			if (/^(#{1,6}\s|[-*]\s|>|\|)/.test(t)) break;
			para.push(t);
			i++;
		}
		out.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`);
	}

	return out.join('\n');
}
