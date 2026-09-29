// Initialization is complete. Schema changes are applied through reviewed migrations.
export async function POST() { return Response.json({ error: 'This setup endpoint has been retired.' }, { status: 410 }) }
