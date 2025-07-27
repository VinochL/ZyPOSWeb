// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'hREEfoFy0hFKO93J2tMvOxW0t56IlmNwdYkR2iTN',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL: 'https://nativepos-2192c-default-rtdb.firebaseio.com/',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'SENDER_ID',
  appId: 'nativepos-2192c'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
