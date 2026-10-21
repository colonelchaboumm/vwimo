import { invoke, isTauri } from "@tauri-apps/api/core";
const webOrigin = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
let nativeConnection: Promise<{ origin: string; key: string }> | undefined;
async function connection() {
  if (!isTauri()) return { origin: webOrigin, key: "" };
  return (nativeConnection ??= invoke("backend_connection"));
}
let token = "";
let sessionGeneration = 0;
export const getSessionGeneration = () => sessionGeneration;
export function setToken(value: string) {
  token = value;
  sessionGeneration++;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const requestToken = token;
  const generation = sessionGeneration;
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (requestToken) headers.set("Authorization", `Bearer ${requestToken}`);
  try {
    const { origin, key } = await connection();
    if (key) headers.set("X-Immo-Desktop-Key", key);
    const request = () =>
      fetch(origin + "/api" + path, {
        ...options,
        signal: options.signal
          ? AbortSignal.any([controller.signal, options.signal])
          : controller.signal,
        headers,
      });
    let response: Response | undefined;
    for (let attempt = 0; !response; attempt++) {
      try {
        response = await request();
      } catch (error) {
        if (
          !isTauri() ||
          path !== "/health" ||
          attempt >= 39 ||
          controller.signal.aborted
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (generation !== sessionGeneration)
      throw new ApiError("Cette réponse appartient à une ancienne session.");
    if (!response.ok) {
      if (response.status === 401 && requestToken && requestToken === token)
        window.dispatchEvent(new Event("session-expired"));
      const error = await response.json().catch(() => ({
        detail: "Le service a rencontré une erreur. Réessayez dans un instant.",
      }));
      throw new ApiError(
        Array.isArray(error.detail)
          ? error.detail
              .map((e: { msg: string }) => e.msg.replace(/^Value error, /, ""))
              .join("\n")
          : typeof error.detail === "string"
            ? error.detail
            : "Opération impossible.",
        response.status,
      );
    }
    const result =
      response.status === 204
        ? undefined
        : path.split("?")[0].endsWith("/download")
          ? await response.blob()
          : await response.json();
    if (generation !== sessionGeneration)
      throw new ApiError("Cette réponse appartient à une ancienne session.");
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const write = options.method && !["GET", "HEAD"].includes(options.method);
    throw new ApiError(
      write
        ? "La confirmation du serveur n’a pas été reçue. Vérifiez la liste des dossiers avant de recommencer pour éviter un doublon."
        : "Le service est injoignable. Vérifiez que le backend est lancé, puis réessayez.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
