import express from "express";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(express.static('.'));
app.use(cookieParser());

const FIREBASE_CONFIG = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({ credential: admin.credential.cert(FIREBASE_CONFIG) });
const db = admin.firestore();
const JWT_SECRET = process.env.JWT;

// Middleware JWT
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if(err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
}

// API
app.post('/api/login', (req,res) => {
  const { username, password } = req.body;
  if(username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/posts', async (req,res) => {
  const posts = [];
  const snapshot = await db.collection('posts').get();
  snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  res.json(posts);
});

app.post('/api/posts', authenticateToken, async (req,res) => {
  const { title, description } = req.body;
  const docRef = await db.collection('posts').add({ title, description, createdAt: new Date() });
  
  // Telegram notification
  fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`, {
    method:'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `درس جديد: ${title}` })
  });
  
  res.json({ id: docRef.id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
