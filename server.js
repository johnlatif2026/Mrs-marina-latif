import express from "express";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("view engine", "ejs");

const FIREBASE_CONFIG = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_CONFIG)
});
const db = admin.firestore();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT;

// Middleware للتحقق من JWT
function authenticateToken(req, res, next) {
  const token = req.cookies?.token || req.headers['authorization'];
  if (!token) return res.redirect("/login");
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.redirect("/login");
    req.user = user;
    next();
  });
}

// Routes
app.get("/", (req, res) => {
  res.render("index"); // الصفحة الرئيسية
});

app.get("/login", (req, res) => {
  res.render("login"); // صفحة تسجيل الدخول
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "2h" });
    res.cookie("token", token);
    return res.redirect("/dashboard");
  }
  res.send("Invalid credentials");
});

app.get("/dashboard", authenticateToken, async (req, res) => {
  const posts = [];
  const snapshot = await db.collection("posts").get();
  snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  res.render("dashboard", { posts });
});

// Telegram notification function
async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message })
  });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
