/**
 * JSON schema for the generated app specification.
 * Passed to OpenAI structured outputs (strict mode), so every object
 * needs `additionalProperties: false` and every property listed in `required`.
 */
export const specJsonSchema = {
	name: 'AppSpec',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: [
			'title',
			'tagline',
			'overview',
			'target_audience',
			'features',
			'user_stories',
			'design_spec',
			'data_model',
			'api_schema',
			'tech_stack',
			'non_functional_requirements',
			'open_questions'
		],
		properties: {
			title: { type: 'string' },
			tagline: { type: 'string' },
			overview: { type: 'string' },
			target_audience: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['persona', 'needs', 'pain_points'],
					properties: {
						persona: { type: 'string' },
						needs: { type: 'string' },
						pain_points: { type: 'string' }
					}
				}
			},
			features: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['name', 'description', 'priority', 'user_value'],
					properties: {
						name: { type: 'string' },
						description: { type: 'string' },
						priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
						user_value: { type: 'string' }
					}
				}
			},
			user_stories: {
				type: 'array',
				items: { type: 'string' }
			},
			design_spec: {
				type: 'object',
				additionalProperties: false,
				required: ['look_and_feel', 'color_palette', 'typography', 'key_screens'],
				properties: {
					look_and_feel: { type: 'string' },
					color_palette: {
						type: 'array',
						items: { type: 'string' }
					},
					typography: { type: 'string' },
					key_screens: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							required: ['name', 'purpose', 'components'],
							properties: {
								name: { type: 'string' },
								purpose: { type: 'string' },
								components: { type: 'array', items: { type: 'string' } }
							}
						}
					}
				}
			},
			data_model: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['entity', 'fields', 'relationships'],
					properties: {
						entity: { type: 'string' },
						relationships: { type: 'string' },
						fields: {
							type: 'array',
							items: {
								type: 'object',
								additionalProperties: false,
								required: ['name', 'type', 'notes'],
								properties: {
									name: { type: 'string' },
									type: { type: 'string' },
									notes: { type: 'string' }
								}
							}
						}
					}
				}
			},
			api_schema: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['method', 'path', 'purpose', 'request_body', 'response_body'],
					properties: {
						method: {
							type: 'string',
							enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
						},
						path: { type: 'string' },
						purpose: { type: 'string' },
						request_body: { type: 'string' },
						response_body: { type: 'string' }
					}
				}
			},
			tech_stack: {
				type: 'object',
				additionalProperties: false,
				required: ['frontend', 'backend', 'database', 'auth', 'hosting', 'notes'],
				properties: {
					frontend: { type: 'string' },
					backend: { type: 'string' },
					database: { type: 'string' },
					auth: { type: 'string' },
					hosting: { type: 'string' },
					notes: { type: 'string' }
				}
			},
			non_functional_requirements: {
				type: 'array',
				items: { type: 'string' }
			},
			open_questions: {
				type: 'array',
				items: { type: 'string' }
			}
		}
	}
};

export const turnJsonSchema = {
	name: 'SpecTurn',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['reply', 'spec'],
		properties: {
			reply: {
				type: 'string',
				description:
					'Short conversational message to the user explaining what changed in the spec or asking clarifying questions.'
			},
			spec: specJsonSchema.schema
		}
	}
};
