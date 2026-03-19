import jwt from "jsonwebtoken";

export default async function handler(req, res) {

  // LOGIN
  if (req.url === "/api/login" && req.method === "POST") {
    let body = '';

    for await (const chunk of req) {
      body += chunk;
    }

    const { email, password } = JSON.parse(body);

    if (
      email === process.env.ADMIN_USER
password === process.env.ADMIN_PASS
    ) {
      const token = jwt.sign(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      return res.end(JSON.stringify({ token }));
    }

    res.statusCode = 401;
    return res.end(JSON.stringify({ error: "Invalid" }));
  }

  // VERIFY
  if (req.url === "/api/verify") {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.statusCode = 401;
      return res.end();
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return res.end(JSON.stringify({ ok: true }));
    } catch {
      res.statusCode = 401;
      return res.end();
    }
  }

  res.statusCode = 404;
  res.end("Not Found");
}
