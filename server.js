const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config();
const app = express();
app.use(bodyParser.json());

// Serve static files (index.html, dashboard.html, profile images, etc.)
app.use(express.static(path.join(__dirname, '/')));

// Firebase setup
const FIREBASE_CONFIG = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({ credential: admin.credential.cert(FIREBASE_CONFIG) });
const db = admin.firestore();

const JWT_SECRET = process.env.JWT;

// Middleware to protect dashboard (optional JWT)
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
}

// API to submit messages from contact form
app.post('/api/messages', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const docRef = await db.collection('messages').add({
      name,
      email,
      message,
      createdAt: new Date()
    });

    // Telegram notification
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `رسالة جديدة من ${name} (${email}):\n${message}`
      })
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Optional: Login API for the school to access dashboard
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Dashboard API: get all messages (protected)
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

// Serve dashboard HTML (can be protected via JWT in frontend fetch)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Serve login.html
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Fallback: serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
