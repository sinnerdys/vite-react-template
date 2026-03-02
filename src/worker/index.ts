import { Hono } from "hono";

type Bindings = Env & {
	AI: Ai;
};

const app = new Hono<{ Bindings: Bindings }>();

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

app.options("/api/generate", (c) => c.body(null, 204, corsHeaders));

app.post("/api/generate", async (c) => {
	let payload: { prompt?: string } | null = null;

	try {
		payload = await c.req.json<{ prompt?: string }>();
	} catch {
		return c.text("Invalid JSON body", 400, corsHeaders);
	}

	const prompt = payload?.prompt?.trim();

	if (!prompt) {
		return c.text("Prompt required", 400, corsHeaders);
	}

	const instruction = [
		"You are a Prompt Generator.",
		"Convert user's rough idea into a high-quality prompt.",
		"Preserve user language.",
		"Add structure: role, goal, context, constraints, output format.",
		"Return only the final prompt without extra comments.",
	].join(" ");

	const result = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
		prompt: `${instruction}\n\nUser request:\n${prompt}`,
		max_tokens: 900,
		temperature: 0.6,
	});

	const generatedPrompt = String(result.response ?? result.result ?? "").trim();

	if (!generatedPrompt) {
		return c.json({ error: "AI returned empty response" }, 502, corsHeaders);
	}

	return c.json(
		{
			prompt: generatedPrompt,
			model: "@cf/meta/llama-3.1-8b-instruct",
			usage: (result as { usage?: unknown }).usage ?? null,
		},
		200,
		corsHeaders,
	);
});

export default app;
