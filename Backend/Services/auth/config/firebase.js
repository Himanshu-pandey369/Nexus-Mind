
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "node:fs";

let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
    if (!raw.startsWith("{") && !raw.startsWith("[")) {
      try {
        raw = Buffer.from(raw, "base64").toString("utf8").trim();
      } catch {
        // Not base64, proceed with raw string
      }
    }
    serviceAccount = JSON.parse(raw);
    if (serviceAccount && typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
  } catch (err) {
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
  }
} else {
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    "/etc/secrets/serviceAccountKey.json",
    "./serviceAccountKey.json",
    "../../serviceAccountKey.json"
  ].filter(Boolean);

  const foundPath = candidatePaths.find((p) => fs.existsSync(p));

  if (!foundPath) {
    throw new Error(
      "Firebase credentials not found. Provide FIREBASE_SERVICE_ACCOUNT_JSON environment variable or set FIREBASE_SERVICE_ACCOUNT_PATH pointing to serviceAccountKey.json"
    );
  }

  try {
    serviceAccount = JSON.parse(fs.readFileSync(foundPath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read Firebase credentials file at ${foundPath}: ${err.message}`);
  }
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount),
    });

const auth = getAuth(app);

export { app, auth };
export default app;
