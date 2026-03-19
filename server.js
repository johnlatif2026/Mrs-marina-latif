import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g,'\n');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

export default async function handler(req, res) {
  const url = req.url;

  // LOGIN
  if(url==="/api/login" && req.method==="POST"){
    let body=""; for await(const c of req) body+=c;
    const { user, pass } = JSON.parse(body);

    if(user===process.env.ADMIN_USER && pass===process.env.ADMIN_PASS){
      const token = jwt.sign({user}, process.env.JWT, {expiresIn:"2h"});
      return res.end(JSON.stringify({token}));
    }
    res.statusCode=401; return res.end();
  }

  // VERIFY
  if(url==="/api/verify"){
    const token = req.headers.authorization?.split(" ")[1];
    try { jwt.verify(token, process.env.JWT); return res.end(JSON.stringify({ok:true})); }
    catch{ res.statusCode=401; return res.end(); }
  }

  // CONTACT FORM
  if(url==="/api/contact" && req.method==="POST"){
    let body=""; for await(const c of req) body+=c;
    const data=JSON.parse(body);
    await db.collection("messages").add({...data,date:new Date()});

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN_ID}/sendMessage`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:`📩 رسالة جديدة:\n${data.name}\n${data.phone}\n${data.message}`})
    });
    return res.end(JSON.stringify({ok:true}));
  }

  // GET MESSAGES
  if(url==="/api/messages"){
    const snapshot = await db.collection("messages").get();
    const messages = snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    return res.end(JSON.stringify(messages));
  }

  // DELETE MESSAGE
  if(url.startsWith("/api/delete")){
    const id=url.split("=")[1];
    await db.collection("messages").doc(id).delete();
    return res.end(JSON.stringify({deleted:true}));
  }

  res.statusCode=404; res.end("Not Found");
}
