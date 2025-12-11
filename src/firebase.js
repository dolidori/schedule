import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCVcI8zox_jrb54-r0NNRsa0vk-9iHS4fI",
  authDomain: "my-calendar-6fcb9.firebaseapp.com",
  projectId: "my-calendar-6fcb9",
  storageBucket: "my-calendar-6fcb9.firebasestorage.app",
  messagingSenderId: "730019060338",
  appId: "1:730019060338:web:d70f191b2fb94411d4c0eb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);