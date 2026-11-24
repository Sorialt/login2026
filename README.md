# Login server

An Express sign-up/sign-in example. Usernames and salted password hashes are saved in `data/users.json` on the server; passwords are never saved in plain text. Login sessions are kept on the server and the browser receives only an HTTP-only session cookie.

## Run

```sh
npm install
npm start
```

Open <http://localhost:3000>. Set `PORT` to use a different port. Set a long, random `SESSION_SECRET` in the environment for deployments; use HTTPS with `NODE_ENV=production` so session cookies are marked secure.

This example uses Express's in-memory session store, so sessions end when the server restarts and the store is intended for local demos, not production deployments. User accounts persist in `data/users.json`.
