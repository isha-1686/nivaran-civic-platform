import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config parsed from /firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBFxkQGBdfJqpZ7OrMnPYYXNa_ef3O8wmk",
  authDomain: "skilled-bindery-rcf5x.firebaseapp.com",
  projectId: "skilled-bindery-rcf5x",
  storageBucket: "skilled-bindery-rcf5x.firebasestorage.app",
  messagingSenderId: "780549661666",
  appId: "1:780549661666:web:55bdf9d6ef1339692b0fbb",
  firestoreDatabaseId: "ai-studio-6f624866-0fb1-4d96-9f1c-116ef836bbde"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (with explicit databaseId if needed, otherwise it falls back to firebaseConfig.firestoreDatabaseId)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "default");

// Initialize Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Auth Sign In Helper
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

// Auth Sign Out Helper
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

export type { User };
export { onAuthStateChanged };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errCode = (error as any)?.code || "unknown-code";
  const errMsg = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: `[${errCode}] ${errMsg}`,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  console.warn('Firestore Operation Notification: ', JSON.stringify(errInfo));
  console.error(`=== LITERALLY CAPTURED FIRESTORE ERROR ===\nCode: ${errCode}\nMessage: ${errMsg}\nPath: ${path}\nOperation: ${operationType}\n========================================`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-operation-error', {
      detail: { code: errCode, message: errMsg, path, operationType }
    }));
  }
}

