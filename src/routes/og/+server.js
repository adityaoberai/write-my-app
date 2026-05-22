import { ImageResponse } from '@vercel/og';

const FONT_URLS = {
	mono400:
		'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.20/files/jetbrains-mono-latin-400-normal.woff',
	mono500:
		'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.20/files/jetbrains-mono-latin-500-normal.woff',
	mono700:
		'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.20/files/jetbrains-mono-latin-700-normal.woff'
};

let _fontsCache;
async function loadFonts() {
	if (_fontsCache) return _fontsCache;
	const [r400, r500, r700] = await Promise.all(
		Object.values(FONT_URLS).map((u) =>
			fetch(u).then((r) => {
				if (!r.ok) throw new Error(`Failed to fetch font: ${u}`);
				return r.arrayBuffer();
			})
		)
	);
	_fontsCache = [
		{ name: 'JetBrains Mono', data: r400, weight: 400, style: 'normal' },
		{ name: 'JetBrains Mono', data: r500, weight: 500, style: 'normal' },
		{ name: 'JetBrains Mono', data: r700, weight: 700, style: 'normal' }
	];
	return _fontsCache;
}

// Color tokens — match the app
const C = {
	bg: '#0d0d0b',
	bg1: '#141310',
	bg2: '#1b1a16',
	rule: '#2a2823',
	ruleSoft: '#1f1e1a',
	text: '#ece8da',
	textSoft: '#c5c1b3',
	muted: '#8a8678',
	dim: '#5d5b51',
	mark: '#e8b938',
	markBright: '#f5c742',
	markDim: 'rgba(232, 185, 56, 0.10)'
};

function pill(label) {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				alignItems: 'center',
				border: `1px solid ${C.rule}`,
				backgroundColor: C.bg2,
				color: C.textSoft,
				padding: '5px 12px',
				borderRadius: '4px',
				fontSize: '20px',
				fontWeight: 400
			},
			children: label
		}
	};
}

function tree() {
	return {
		type: 'div',
		props: {
			style: {
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				backgroundColor: C.bg,
				backgroundImage: `radial-gradient(circle at 92% 8%, rgba(232,185,56,0.10), transparent 55%), radial-gradient(circle at 0% 100%, rgba(232,185,56,0.04), transparent 55%)`,
				fontFamily: 'JetBrains Mono',
				color: C.text,
				padding: '56px 64px',
				position: 'relative'
			},
			children: [
				// header
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between'
						},
						children: [
							{
								type: 'div',
								props: {
									style: { display: 'flex', alignItems: 'center', gap: '16px' },
									children: [
										{
											type: 'div',
											props: {
												style: {
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													width: '52px',
													height: '52px',
													backgroundColor: '#141310',
													border: `1px solid ${C.rule}`,
													borderRadius: '10px',
													color: C.mark,
													fontSize: '32px',
													fontWeight: 700,
													fontFamily: 'JetBrains Mono',
													lineHeight: 1
												},
												children: '›'
											}
										},
										{
											type: 'div',
											props: {
												style: {
													fontSize: '24px',
													fontWeight: 600,
													letterSpacing: '-0.005em',
													color: C.text
												},
												children: 'write my app'
											}
										}
									]
								}
							},
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										alignItems: 'center',
										gap: '10px',
										fontSize: '18px',
										color: C.muted,
										border: `1px solid ${C.rule}`,
										borderRadius: '4px',
										padding: '6px 14px',
										backgroundColor: C.bg1
									},
									children: [
										{
											type: 'div',
											props: {
												style: {
													width: '7px',
													height: '7px',
													borderRadius: '999px',
													backgroundColor: C.mark,
													display: 'flex'
												}
											}
										},
										'spec generator for ai coding agents'
									]
								}
							}
						]
					}
				},

				// hero block — vertically centered
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexDirection: 'column',
							flex: 1,
							justifyContent: 'center',
							gap: '28px'
						},
						children: [
							{
								type: 'div',
								props: {
									style: { display: 'flex', alignItems: 'flex-start', gap: '28px' },
									children: [
										{
											type: 'div',
											props: {
												style: {
													fontSize: '92px',
													fontWeight: 700,
													lineHeight: 0.95,
													color: C.mark,
													fontFamily: 'JetBrains Mono'
												},
												children: '›'
											}
										},
										{
											type: 'div',
											props: {
												style: {
													display: 'flex',
													flexDirection: 'column',
													gap: '8px'
												},
												children: [
													{
														type: 'div',
														props: {
															style: {
																fontSize: '64px',
																fontWeight: 700,
																lineHeight: 1.05,
																letterSpacing: '-0.022em',
																color: C.text,
																maxWidth: '900px'
															},
															children: 'describe an app.'
														}
													},
													{
														type: 'div',
														props: {
															style: {
																fontSize: '64px',
																fontWeight: 500,
																lineHeight: 1.05,
																letterSpacing: '-0.022em',
																color: C.mark,
																maxWidth: '900px'
															},
															children: 'get a build-ready prompt.'
														}
													}
												]
											}
										}
									]
								}
							},

							// pills row
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										flexWrap: 'wrap',
										gap: '8px',
										marginTop: '24px',
										maxWidth: '1000px'
									},
									children: [
										pill('claude code'),
										pill('codex'),
										pill('cursor'),
										pill('copilot'),
										pill('opencode'),
										{
											type: 'div',
											props: {
												style: {
													display: 'flex',
													alignItems: 'center',
													fontSize: '20px',
													color: C.dim,
													padding: '5px 4px'
												},
												children: 'etc.'
											}
										}
									]
								}
							}
						]
					}
				},

				// footer
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							borderTop: `1px solid ${C.ruleSoft}`,
							paddingTop: '24px'
						},
						children: [
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										fontSize: '18px',
										color: C.muted
									},
									children: '// local-only · iterate by chat · paste into your agent'
								}
							},
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										fontSize: '18px',
										color: C.dim,
										fontWeight: 500
									},
									children: 'writemyapp'
								}
							}
						]
					}
				}
			]
		}
	};
}

export async function GET() {
	const fonts = await loadFonts();
	return new ImageResponse(tree(), {
		width: 1200,
		height: 630,
		fonts,
		headers: {
			'cache-control': 'public, max-age=3600, s-maxage=86400'
		}
	});
}
