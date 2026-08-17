import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyCDXkXbmEfd8aMlYdRLL-r5Pry67_mm4ss",
  authDomain: "alpha-wiem-game-2-preprod.firebaseapp.com",
  databaseURL: "https://alpha-wiem-game-2-preprod-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "alpha-wiem-game-2-preprod",
  storageBucket: "alpha-wiem-game-2-preprod.firebasestorage.app",
  messagingSenderId: "74104445165",
  appId: "1:74104445165:web:fff902c3d77c6586bc94e4"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const database = getDatabase(app)
