/**
 * POST a JSON body and consume a newline-delimited JSON (NDJSON) stream.
 * Calls onEvent for each parsed event: progress, result, error.
 * Returns the final result payload, or throws on error events / failures.
 */
export async function postNDJSON(url, body, onEvent) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("ndjson")) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (onEvent) onEvent(event);
      if (event.type === "result") finalResult = event;
      if (event.type === "error") {
        throw new Error(event.error || "Processing failed.");
      }
    }
  }

  if (!finalResult) throw new Error("The server closed the connection without a result.");
  return finalResult;
}
