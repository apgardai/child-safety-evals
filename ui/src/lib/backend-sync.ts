const DEFAULT_INTERNAL_URL = "http://127.0.0.1:8100";

export type SyncedUserPayload = {
  user: {
    id: string;
    email: string;
    name: string;
    firebase_uid: string | null;
    account_id: string;
  };
  account: {
    id: string;
    name: string;
    domain: string | null;
  };
};

function internalBaseUrl(): string {
  return (process.env.INTERNAL_API_URL ?? DEFAULT_INTERNAL_URL).replace(/\/$/, "");
}

function internalSecret(): string {
  const s = process.env.INTERNAL_API_SECRET;
  if (!s) {
    throw new Error("INTERNAL_API_SECRET is not set");
  }
  return s;
}

export async function syncUserToBackend(body: {
  firebase_uid: string;
  email: string;
  name: string;
}): Promise<SyncedUserPayload> {
  const res = await fetch(`${internalBaseUrl()}/internal/sync-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": internalSecret(),
    },
    body: JSON.stringify({
      firebase_uid: body.firebase_uid,
      email: body.email,
      name: body.name,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`User sync failed (${res.status}): ${text}`);
  }
  return (await res.json()) as SyncedUserPayload;
}

export async function fetchUserFromBackend(
  email: string
): Promise<SyncedUserPayload> {
  const u = new URL(`${internalBaseUrl()}/internal/users/me`);
  u.searchParams.set("email", email);
  const res = await fetch(u.toString(), {
    headers: { "X-Internal-Secret": internalSecret() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Load user failed (${res.status}): ${text}`);
  }
  return (await res.json()) as SyncedUserPayload;
}
