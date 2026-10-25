export async function api(path, options = {}) {
  const response = await fetch("/api/" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const type = response.headers.get("Content-Type") || "";
  if (!type.includes("application/json"))
    throw Error("雲端登入或 API 設定尚未完成，請重新開啟遊戲。");
  const data = await response.json();
  if (!response.ok) {
    const error = Error(data.error || "服務暫時無法使用");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const post = (path, body) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
export async function cloudAvailable() {
  return (
    location.protocol !== "file:" && import.meta.env.VITE_CLOUD_MODE === "true"
  );
}
