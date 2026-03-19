const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
app.use(bodyParser.json());

// Serve static HTML
app.use(express.static(path.join(__dirname, '/')));

// Firebase
const FIREBASE_CONFIG = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({ credential: admin.credential.cert(FIREBASE_CONFIG) });
const db = admin.firestore();

// API لحفظ الرسائل من الموقع
app.post('/api/messages', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const docRef = await db.collection('messages').add({ name, email, message, createdAt: new Date() });

    // Telegram notification
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `رسالة جديدة من ${name} (${email}):\n${message}`
      })
    });

    res.status(200).json({ success:true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard (يمكن حمايته لاحقًا بـ JWT)
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
