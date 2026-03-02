import { FormEvent, useEffect, useRef, useState } from "react";
import "./App.css";

type Role = "user" | "assistant" | "status";

type ChatMessage = {
	id: string;
	role: Role;
	content: string;
};

type GenerateResponse = {
	prompt?: string;
	model?: string;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	} | null;
	error?: string;
};

const API_ENDPOINT = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "https://morning-flower-805c.ev-kurt.workers.dev/";

const PROMPT_PRESETS = [
	"Сделай промпт для ChatGPT: маркетинговая стратегия запуска нового мобильного приложения",
	"Сгенерируй промпт для Midjourney: кинематографичный постер sci-fi фильма",
	"Нужен промпт для Claude: техническое ТЗ на Telegram-бота с оплатой",
];

const EMPTY_RESULT =
	"Здесь появится готовый промпт. Отправь идею в чат слева.";

function App() {
	const [prompt, setPrompt] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([
		{
			id: crypto.randomUUID(),
			role: "status",
			content:
				"Опиши задачу коротко, а я превращу ее в сильный структурированный промпт.",
		},
	]);
	const [errorText, setErrorText] = useState("");
	const [latestPrompt, setLatestPrompt] = useState(EMPTY_RESULT);
	const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
	const [lastUsage, setLastUsage] = useState<GenerateResponse["usage"]>(null);
	const [isCopied, setIsCopied] = useState(false);

	const abortRef = useRef<AbortController | null>(null);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages, isLoading]);

	useEffect(() => {
		if (!isCopied) {
			return;
		}

		const timer = setTimeout(() => setIsCopied(false), 1400);
		return () => clearTimeout(timer);
	}, [isCopied]);

	useEffect(() => {
		return () => abortRef.current?.abort();
	}, []);

	const submitPrompt = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const cleanPrompt = prompt.trim();

		if (!cleanPrompt || isLoading) {
			return;
		}

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: cleanPrompt,
		};

		setPrompt("");
		setErrorText("");
		setMessages((prev) => [...prev, userMessage]);
		setIsLoading(true);

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const startedAt = performance.now();

		try {
			const response = await fetch(API_ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: cleanPrompt }),
				signal: controller.signal,
			});

			let payload: GenerateResponse;
			const contentType = response.headers.get("content-type") ?? "";

			if (contentType.includes("application/json")) {
				payload = (await response.json()) as GenerateResponse;
			} else {
				const text = await response.text();
				payload = { prompt: text };
			}

			if (!response.ok) {
				throw new Error(payload.error ?? payload.prompt ?? `HTTP ${response.status}`);
			}

			const generated = payload.prompt?.trim();

			if (!generated) {
				throw new Error("AI вернул пустой ответ");
			}

			setLastLatencyMs(Math.round(performance.now() - startedAt));
			setLastUsage(payload.usage ?? null);
			setLatestPrompt(generated);
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: "Готово. Промпт собран и доступен справа.",
				},
			]);
		} catch (error) {
			const isAbort = error instanceof DOMException && error.name === "AbortError";
			if (!isAbort) {
				const message = error instanceof Error ? error.message : "Unknown error";
				setErrorText(message);
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "status",
						content: `Ошибка запроса: ${message}`,
					},
				]);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const copyPrompt = async () => {
		if (!latestPrompt || latestPrompt === EMPTY_RESULT) {
			return;
		}

		try {
			await navigator.clipboard.writeText(latestPrompt);
			setIsCopied(true);
		} catch {
			setErrorText("Не удалось скопировать промпт");
		}
	};

	return (
		<div className="app-shell">
			<div className="ambient ambient-left" />
			<div className="ambient ambient-right" />

			<header className="workspace-header">
				<div>
					<p className="eyebrow">Prompt Generator</p>
					<h1>Chat + Pro Prompt Builder</h1>
				</div>
				<div className="header-badges">
					<span className="badge">Cloudflare Workers AI</span>
					<span className="badge">POST {API_ENDPOINT}</span>
				</div>
			</header>

			<div className="workspace-grid">
				<section className="chat-column">
					<div className="chat-log" aria-live="polite">
						{messages.map((message) => (
							<article key={message.id} className={`message ${message.role}`}>
								<div className="message-head">
									<span className="message-role">
										{message.role === "user" && "Ты"}
										{message.role === "assistant" && "AI"}
										{message.role === "status" && "Система"}
									</span>
								</div>
								<p className="message-text">{message.content}</p>
							</article>
						))}

						{isLoading && (
							<div className="loading-row">
								<span className="dot" />
								<span className="dot" />
								<span className="dot" />
								<span>Собираю промпт...</span>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					<form className="composer" onSubmit={submitPrompt}>
						<textarea
							value={prompt}
							onChange={(event) => setPrompt(event.target.value)}
							placeholder="Например: нужен промпт для GPT, чтобы написать бизнес-план для кофейни"
							rows={4}
							disabled={isLoading}
						/>

						<div className="preset-row">
							{PROMPT_PRESETS.map((preset) => (
								<button
									type="button"
									key={preset}
									className="preset-chip"
									onClick={() => setPrompt(preset)}
									disabled={isLoading}
								>
									{preset}
								</button>
							))}
						</div>

						<div className="composer-row">
							<p className={`error-text ${errorText ? "show" : ""}`}>
								{errorText || " "}
							</p>
							<button type="submit" disabled={!prompt.trim() || isLoading}>
								{isLoading ? "Генерация..." : "Сгенерировать промпт"}
							</button>
						</div>
					</form>
				</section>

				<section className="result-column">
					<header className="result-header">
						<div>
							<p className="eyebrow">Result</p>
							<h2>Готовый промпт</h2>
						</div>
						<div className="result-meta">
							{lastLatencyMs !== null ? `${lastLatencyMs} ms` : "Ожидание"}
						</div>
					</header>

					<div className="result-panel">
						<pre className={`result-output ${latestPrompt === EMPTY_RESULT ? "empty" : ""}`}>
							{latestPrompt}
						</pre>

						<div className="usage-grid">
							<div>
								<p>Prompt tokens</p>
								<strong>{lastUsage?.prompt_tokens ?? "-"}</strong>
							</div>
							<div>
								<p>Completion tokens</p>
								<strong>{lastUsage?.completion_tokens ?? "-"}</strong>
							</div>
							<div>
								<p>Total tokens</p>
								<strong>{lastUsage?.total_tokens ?? "-"}</strong>
							</div>
						</div>

						<div className="result-actions">
							<button
								type="button"
								className="result-button"
								onClick={copyPrompt}
								disabled={latestPrompt === EMPTY_RESULT}
							>
								{isCopied ? "Скопировано" : "Копировать"}
							</button>
							<button
								type="button"
								className="result-button ghost"
								onClick={() => setLatestPrompt(EMPTY_RESULT)}
							>
								Очистить
							</button>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

export default App;


