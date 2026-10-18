// Firebase wrapper: Google sign-in + per-user Firestore collections. The SDK is loaded lazily so
// it costs nothing until the user opens the app configured for the cloud.
//
// Layout: /users/{uid}/{sheets|systems}/{id} = { updatedAt, data: <JSON string> }.
// The payload is a JSON string because Firestore rejects nested arrays and undefined values.
import { getCloudConfig } from './config';

export interface CloudUser { uid: string; email: string | null; name: string | null; photo: string | null }
export type Collection = 'sheets' | 'systems';
export interface RemoteDoc { id: string; updatedAt: number; data: unknown }

type Services = { auth: import('firebase/auth').Auth; db: import('firebase/firestore').Firestore };
let servicesPromise: Promise<Services> | null = null;

function services(): Promise<Services> {
  servicesPromise ??= (async () => {
    const cfg = getCloudConfig();
    if (!cfg) throw new Error('Cloud is not configured');
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { initializeFirestore, persistentLocalCache, getFirestore } = await import('firebase/firestore');
    const app = getApps()[0] ?? initializeApp(cfg);
    let db: import('firebase/firestore').Firestore;
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache() });
    } catch {
      db = getFirestore(app);
    }
    return { auth: getAuth(app), db };
  })();
  return servicesPromise;
}

const toUser = (u: import('firebase/auth').User | null): CloudUser | null =>
  u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null;

export async function signInWithGoogle(): Promise<void> {
  const { auth } = await services();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutCloud(): Promise<void> {
  const { auth } = await services();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

export async function onAuthChange(cb: (user: CloudUser | null) => void): Promise<() => void> {
  const { auth } = await services();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, (u) => cb(toUser(u)));
}

export async function putRemote(uid: string, col: Collection, id: string, updatedAt: number, data: unknown): Promise<void> {
  const { db } = await services();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid, col, id), { updatedAt, data: JSON.stringify(data) });
}

export async function deleteRemote(uid: string, col: Collection, id: string): Promise<void> {
  const { db } = await services();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'users', uid, col, id));
}

/** Live view of a collection. `fromCache` is true until the server has answered (or while offline). */
export async function watchRemote(
  uid: string,
  col: Collection,
  cb: (docs: RemoteDoc[], fromCache: boolean) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const { db } = await services();
  const { collection, onSnapshot } = await import('firebase/firestore');
  return onSnapshot(
    collection(db, 'users', uid, col),
    (snap) => {
      const docs: RemoteDoc[] = [];
      for (const d of snap.docs) {
        try {
          const v = d.data() as { updatedAt?: number; data?: string };
          docs.push({ id: d.id, updatedAt: v.updatedAt ?? 0, data: JSON.parse(v.data ?? 'null') });
        } catch { /* skip malformed doc */ }
      }
      cb(docs, snap.metadata.fromCache);
    },
    onError,
  );
}
