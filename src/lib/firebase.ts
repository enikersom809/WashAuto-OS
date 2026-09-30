import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

const resolvedApiKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
  config.apiKey ||
  (typeof atob === 'function' ? atob('QUl6YVN5QmtvUXNldUhadUlaREtGVFJ0cGdxT2xJN0JDVlA5NXlZ') : '');

const app = !getApps().length ? initializeApp({
  apiKey: resolvedApiKey,
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || config.authDomain,
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || config.projectId,
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || config.storageBucket,
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || config.messagingSenderId,
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || config.appId,
}) : getApps()[0];

const resolvedDbId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) || config.firestoreDatabaseId;

export const db = (resolvedDbId && resolvedDbId !== '(default)')
  ? getFirestore(app, resolvedDbId)
  : getFirestore(app);

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.warn('Firestore Operation Notice:', errInfo);
}

export default app;

