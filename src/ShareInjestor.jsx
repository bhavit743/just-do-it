// src/ShareIngestor.jsx
import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ingestSharedImages } from './share-ingest';

// Firebase SDKs (assumes you already initialize Firebase in AuthProvider or a bootstrap file)
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { getFirestore, addDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function ShareIngestor() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const auth = getAuth();
    const db = getFirestore();
    const storage = getStorage();

    async function uploadToFirebase(blob, name) {
      const user = auth.currentUser;
      if (!user) return; // skip until signed-in
      const path = `uploads/${user.uid}/${Date.now()}-${name}`;
      await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });
      await addDoc(collection(db, 'receipts'), {
        uid: user.uid,
        path,
        status: 'queued',
        createdAt: serverTimestamp(),
      });
    }

    // Ingest once after user is known (prevents anonymous uploads if you rely on auth)
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) ingestSharedImages(uploadToFirebase);
    });

    // Ingest whenever app comes to foreground
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) ingestSharedImages(uploadToFirebase);
    });

    // Also attempt once on mount
    ingestSharedImages(uploadToFirebase);

    return () => {
      unsubAuth && unsubAuth();
      sub && sub.remove();
    };
  }, []);

  return null; // headless
}
