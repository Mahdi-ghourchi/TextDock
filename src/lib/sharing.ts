export interface CreatedShare {
  id: string;
  access_token: string;
  revoke_capability: string;
  expires_at: string;
  url: string;
}

export interface PublicSnapshot {
  id: string;
  title: string;
  content: string;
  format: "markdown" | "text";
  created_at: string;
  expires_at: string;
}

const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function createShare(
  title: string,
  content: string,
  format: "markdown" | "text",
  expiresInHours: number,
): Promise<CreatedShare> {
  const response = await fetch(`${apiBase}/api/v1/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, format, expires_in_hours: expiresInHours }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const result = (await response.json()) as Omit<CreatedShare, "url">;
  return {
    ...result,
    url: `${window.location.origin}/s/${encodeURIComponent(result.id)}#access=${encodeURIComponent(result.access_token)}`,
  };
}

export async function revokeShare(id: string, capability: string): Promise<void> {
  const response = await fetch(`${apiBase}/api/v1/shares/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-Revoke-Capability": capability },
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function fetchSnapshot(id: string, token: string): Promise<PublicSnapshot> {
  const response = await fetch(`${apiBase}/api/v1/shares/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as PublicSnapshot;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload: { detail?: string } = await response.json();
    return payload.detail ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}
