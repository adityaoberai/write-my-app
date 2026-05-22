const KEY = 'wma:state:v1';

function emptyState() {
	return { sessions: {}, activeId: null };
}

export function loadState() {
	if (typeof localStorage === 'undefined') return emptyState();
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return emptyState();
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || !parsed.sessions) return emptyState();
		return parsed;
	} catch {
		return emptyState();
	}
}

export function saveState(state) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// quota or serialization failure: silently ignore
	}
}

export function newSessionId() {
	return 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function newSession(id = newSessionId()) {
	return {
		id,
		title: 'Untitled session',
		messages: [],
		spec: null,
		createdAt: Date.now(),
		updatedAt: Date.now()
	};
}
