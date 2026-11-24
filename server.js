const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const session = require("express-session");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIRECTORY = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIRECTORY, "users.json");
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const isProduction = process.env.NODE_ENV === "production";

fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

let users = readUsers();

function saveUsers() {
  const temporaryFile = `${USERS_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, USERS_FILE);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function passwordsMatch(password, user) {
  const actualHash = crypto.scryptSync(password, user.salt, 64);
  const expectedHash = Buffer.from(user.passwordHash, "hex");
  return actualHash.length === expectedHash.length
    && crypto.timingSafeEqual(actualHash, expectedHash);
}

function publicUser(user) {
  return { id: user.id, username: user.username };
}

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(session({
  name: "login.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24
  }
}));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/signup", (req, res, next) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({
      error: "Username must be 3–24 characters (letters, numbers, or underscores)."
    });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be 8–128 characters." });
  }
  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username,
    salt,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  };
  users.push(user);

  try {
    saveUsers();
  } catch (error) {
    users.pop();
    return next(error);
  }

  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.userId = user.id;
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.status(201).json({ user: publicUser(user) });
    });
  });
});

app.post("/api/login", (req, res, next) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = users.find((item) => item.username.toLowerCase() === username.toLowerCase());

  if (!user || !passwordsMatch(password, user)) {
    return res.status(401).json({ error: "Username or password is incorrect." });
  }

  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.userId = user.id;
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.json({ user: publicUser(user) });
    });
  });
});

app.get("/api/me", (req, res) => {
  const user = users.find((item) => item.id === req.session.userId);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("login.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction
    });
    res.json({ message: "Signed out." });
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`Login server is running at http://localhost:${PORT}`);
});
