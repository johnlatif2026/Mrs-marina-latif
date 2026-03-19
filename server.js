import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

export default async function handler(req, res) {

  // LOGIN
  if (req.url === "/api/login" && req.method === "POST") {
    let body = '';
    for await (const chunk of req) body += chunk;

    const { user, pass } = JSON.parse(body);

    if (
      user === process.env.ADMIN_USER &&
      pass === process.env.ADMIN_PASS
    ) {
      const token = jwt.sign({ user }, process.env.JWT, { expiresIn: "2h" });
      return res.end(JSON.stringify({ token }));
    }

    res.statusCode = 401;
    return res.end();
  }

  // VERIFY
  if (req.url === "/api/verify") {
    const token = req.headers.authorization?.split(" ")[1];

    try {
      jwt.verify(token, process.env.JWT);
      return res.end(JSON.stringify({ ok: true }));
    } catch {
      res.statusCode = 401;
      return res.end();
    }
  }

  // ADD MESSAGE
  if (req.url === "/api/contact" && req.method === "POST") {
    let body = '';
    for await (const chunk of req) body += chunk;

    const data = JSON.parse(body);

    const doc = await db.collection("messages").add(data);

    // Telegram
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `📩 رسالة جديدة:\n${data.name}\n${data.phone}\n${data.message}`
      })
    });

    return res.end(JSON.stringify({ ok: true }));
  }

  // GET MESSAGES
  if (req.url === "/api/messages") {
    const snapshot = await db.collection("messages").get();

    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.end(JSON.stringify(messages));
  }

  // DELETE
  if (req.url.startsWith("/api/delete")) {
    const id = req.url.split("=")[1];

    await db.collection("messages").doc(id).delete();

    return res.end(JSON.stringify({ deleted: true }));
  }

  res.statusCode = 404;
  res.end("Not Found");
}
