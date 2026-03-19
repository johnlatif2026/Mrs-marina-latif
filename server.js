// server.js
import express from "express";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import path from "path";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

// Firebase setup
const FIREBASE_CONFIG = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({ credential: admin.credential.cert(FIREBASE_CONFIG) });
const db = admin.firestore();

// JWT secret
const JWT_SECRET = process.env.JWT;

// Middleware للتحقق من توكن JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
}

// API: إرسال رسالة
app.post('/api/messages', async (req, res) => {
  try {
    const { name, phone, message } = req.body;
    if (!name || !phone || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const now = new Date();
    await db.collection('messages').add({
      name,
      phone,
      message,
      createdAt: admin.firestore.Timestamp.fromDate(now)
    });

    // إرسال رسالة على Telegram باستخدام dynamic import
    if (process.env.TELEGRAM_TOKEN_ID && process.env.TELEGRAM_CHAT_ID) {
      const fetch = (await import("node-fetch")).default;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `رسالة جديدة من ${name} (${phone}):\n${message}`
        })
      });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).json({ error: err.message });
  }
});

// API: تسجيل الدخول
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// API: الحصول على الرسائل (محمي)
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const messages = [];
    const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').get();
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve ملفات HTML ثابتة
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// مهم جدًا: لا تستخدم app.listen على Vercel
export default app;
