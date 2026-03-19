const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// Serve static HTML files from project root
app.use(express.static(path.join(__dirname, '/')));

// Firebase setup
const FIREBASE_CONFIG = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_CONFIG)
});
const db = admin.firestore();

const JWT_SECRET = process.env.JWT;

// Middleware JWT
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
}

// API Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// API: Get posts
app.get('/api/posts', async (req, res) => {
  try {
    const posts = [];
    const snapshot = await db.collection('posts').orderBy('createdAt','desc').get();
    snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
    res.json(posts);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Add new post
app.post('/api/posts', authenticateToken, async (req,res) => {
  try {
    const { title, description } = req.body;
    const docRef = await db.collection('posts').add({ title, description, createdAt: new Date() });

    // Telegram notification
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`, {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `درس جديد: ${title}`
      })
    });

    res.json({ id: docRef.id });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback: serve index.html for unknown routes (useful for Vercel)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
