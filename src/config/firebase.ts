import admin from 'firebase-admin';

let firebaseReady = false;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseReady = true;
    console.info('[SkillHub] Firebase Admin token verification enabled.');
  }
} catch (error) {
  console.error('[SkillHub] Firebase service account configuration is invalid.', error instanceof Error ? error.message : error);
}

export const firebaseAdminEnabled = firebaseReady;
export async function verifyFirebaseToken(token: string) {
  if (!firebaseReady) throw new Error('Firebase Admin is not configured.');
  return admin.auth().verifyIdToken(token, true);
}
