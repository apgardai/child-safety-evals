import * as admin from "firebase-admin";
import { readFileSync } from "node:fs";
import path from "node:path";

function initAdmin(): void {
  if (admin.apps.length) return;

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    const json = JSON.parse(readFileSync(resolved, "utf-8")) as Record<string, unknown>;
    admin.initializeApp({ credential: admin.credential.cert(json as admin.ServiceAccount) });
    return;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return;
  }

  throw new Error(
    "Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH (recommended) or FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY."
  );
}

export function getFirebaseAdminAuth(): admin.auth.Auth {
  initAdmin();
  return admin.auth();
}
