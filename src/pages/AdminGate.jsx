// AdminGate.jsx
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { isAdminUserDoc } from "./firestoreutils"; // ✅ make sure this path matches your file

export default function AdminGate({ children, fallback = null }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setOk(false);
          setReady(true);
          return;
        }

        const emailLc = (u.email || "").toLowerCase();

        // 🔑 Match your users doc strategy (try both uid & email for robustness)
        const guesses = [u.uid, emailLc].filter(Boolean);

        let merged = {};
        for (const id of guesses) {
          const snap = await getDoc(doc(db, "users", id));
          if (snap.exists()) merged = { ...merged, ...snap.data() };
        }
        // ensure email present for isEmailAdmin() path inside isAdminUserDoc()
        if (u.email && !merged.email) merged.email = u.email;

        const allowed = await isAdminUserDoc(emailLc || u.uid, merged);
        setOk(allowed);
        setReady(true);
      } catch (err) {
        console.error("AdminGate error:", err);
        setOk(false);
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  if (!ready) return null; // or a spinner/placeholder
  return ok ? children : (fallback ?? <div>Not authorized</div>);
}
