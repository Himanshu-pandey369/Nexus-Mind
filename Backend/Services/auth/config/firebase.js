import { initializeApp, cert, getApps } from "firebase-admin/app";
import serviceAccount from "../serviceAccountKey.json" with { type: "json" };

export const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount),
    });
