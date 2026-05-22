import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '$lib/systemPrompt.js';
import { turnJsonSchema } from '$lib/specSchema.js';

const MODEL = env.OPENAI_MODEL || 'gpt-5.4-mini';

/** @type {OpenAI | null} */
let _client = null;
function getClient() {
	if (!env.OPENAI_API_KEY) return null;
	if (!_client) _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	return _client;
}

export async function POST({ request }) {
	const client = getClient();
	if (!client) {
		throw error(500, 'OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.');
	}

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { messages, currentSpec } = body || {};
	if (!Array.isArray(messages) || messages.length === 0) {
		throw error(400, 'messages must be a non-empty array');
	}

	const conversation = [
		{ role: 'system', content: SYSTEM_PROMPT },
		...(currentSpec
			? [
					{
						role: 'system',
						content:
							'Current spec (carry forward unless the user is changing it):\n' +
							JSON.stringify(currentSpec)
					}
				]
			: []),
		...messages.map((m) => ({ role: m.role, content: m.content }))
	];

	let completion;
	try {
		completion = await client.chat.completions.create({
			model: MODEL,
			messages: conversation,
			response_format: {
				type: 'json_schema',
				json_schema: turnJsonSchema
			}
		});
	} catch (e) {
		const msg = e?.error?.message || e?.message || 'OpenAI request failed';
		throw error(502, msg);
	}

	const raw = completion.choices?.[0]?.message?.content;
	if (!raw) throw error(502, 'OpenAI returned no content');

	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw error(502, 'OpenAI returned non-JSON content');
	}

	if (!parsed.reply || !parsed.spec) {
		throw error(502, 'OpenAI response missing required fields');
	}

	return json(parsed);
}
