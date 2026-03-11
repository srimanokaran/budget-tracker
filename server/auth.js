import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";

const oauthEnabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && ALLOWED_EMAIL);

function signCookie(value) {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
  return `${value}.${sig}`;
}

function verifyCookie(signed) {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return value;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map(c => c.trim().split("=")).filter(p => p.length === 2).map(([k, v]) => [k, decodeURIComponent(v)]));
}

function setupAuth(app) {
  if (oauthEnabled) {
    const REDIRECT_URI_PATH = "/auth/callback";

    function getRedirectUri(req) {
      const proto = req.protocol;
      const host = req.get("host");
      return `${proto}://${host}${REDIRECT_URI_PATH}`;
    }

    app.get("/login", (_req, res) => {
      res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login — Budget Tracker</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f7}
a{display:inline-block;padding:14px 32px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:1px}</style>
</head><body><div style="text-align:center"><h2 style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#999;margin-bottom:32px">Budget Tracker</h2>
<a href="/auth/google">Sign in with Google</a></div></body></html>`);
    });

    app.get("/auth/google", (req, res) => {
      const redirectUri = getRedirectUri(req);
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email");
      url.searchParams.set("access_type", "online");
      url.searchParams.set("prompt", "select_account");
      res.redirect(url.toString());
    });

    app.get("/auth/callback", async (req, res) => {
      const { code } = req.query;
      if (!code) return res.status(400).send("Missing code");

      try {
        const redirectUri = getRedirectUri(req);
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
        const tokens = await tokenRes.json();
        if (!tokens.access_token) return res.status(401).send("Token exchange failed");

        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const user = await userRes.json();

        if (user.email !== ALLOWED_EMAIL) {
          return res.status(403).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Access Denied</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f7}
a{color:#1a1a1a}</style></head>
<body><div style="text-align:center"><h2>Access Denied</h2><p>${user.email} is not authorized.</p><a href="/login">Try another account</a></div></body></html>`);
        }

        const sessionValue = JSON.stringify({ email: user.email, ts: Date.now() });
        const encoded = Buffer.from(sessionValue).toString("base64url");
        const signed = signCookie(encoded);
        res.setHeader("Set-Cookie", `session=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`);
        res.redirect("/");
      } catch (err) {
        console.error("OAuth callback error:", err);
        res.status(500).send("Authentication failed");
      }
    });

    app.get("/auth/logout", (_req, res) => {
      res.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0");
      res.redirect("/login");
    });

    // Auth middleware
    app.use((req, res, next) => {
      if (req.path === "/login" || req.path.startsWith("/auth/")) return next();

      const cookies = parseCookies(req);
      if (cookies.session) {
        const verified = verifyCookie(cookies.session);
        if (verified) {
          try {
            const session = JSON.parse(Buffer.from(verified, "base64url").toString());
            if (session.email === ALLOWED_EMAIL) return next();
          } catch {}
        }
      }

      if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Unauthorized" });
      res.redirect("/login");
    });
  } else if (process.env.PASSWORD) {
    app.use((req, res, next) => {
      const auth = req.headers.authorization;
      if (auth) {
        const [, encoded] = auth.split(" ");
        const [, pass] = Buffer.from(encoded, "base64").toString().split(":");
        if (pass === process.env.PASSWORD) return next();
      }
      res.set("WWW-Authenticate", 'Basic realm="Budget Tracker"');
      res.status(401).send("Unauthorized");
    });
  }
}

export { setupAuth };
