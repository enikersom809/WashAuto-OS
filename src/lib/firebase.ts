import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

/**
 * Sanitiza valores de configuração removendo aspas duplicadas (' ou "),
 * espaços extras ou escapes acidentais que invalidam a API key no Firebase Auth.
 */
function cleanConfigValue(val: unknown): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

const rawApiKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
  config.apiKey ||
  (typeof atob === 'function' ? atob('QUl6YVN5QmtvUXNldUhadUlaREtGVFJ0cGdxT2xJN0JDVlA5NXlZ') : '');

let resolvedApiKey = cleanConfigValue(rawApiKey);
// Se a chave estiver truncada, vazia ou inválida, usa a chave oficial do projeto
if (!resolvedApiKey || !resolvedApiKey.startsWith('AIzaSy') || resolvedApiKey.length < 30) {
  resolvedApiKey = 'AIzaSyBkoQseuHZuIZDKFTRtpgqOlI7BCVP95yY';
}

const resolvedAuthDomain = cleanConfigValue(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || config.authDomain
) || 'meulavajatogestaoparalavajato.firebaseapp.com';

const resolvedProjectId = cleanConfigValue(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || config.projectId
) || 'meulavajatogestaoparalavajato';

const resolvedStorageBucket = cleanConfigValue(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || config.storageBucket
) || 'meulavajatogestaoparalavajato.firebasestorage.app';

const resolvedMessagingSenderId = cleanConfigValue(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || config.messagingSenderId
) || '372328060896';

const resolvedAppId = cleanConfigValue(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || config.appId
) || '1:372328060896:web:596b7467604aba2a78bd85';

const rawDbId = cleanConfigValue(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) || config.firestoreDatabaseId
);
const resolvedDbId = (rawDbId && rawDbId !== 'default' && rawDbId !== '(default)') ? rawDbId : '(default)';

const app = !getApps().length ? initializeApp({
  apiKey: resolvedApiKey,
  authDomain: resolvedAuthDomain,
  projectId: resolvedProjectId,
  storageBucket: resolvedStorageBucket,
  messagingSenderId: resolvedMessagingSenderId,
  appId: resolvedAppId,
}) : getApps()[0];

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

