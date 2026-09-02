# ArtVault — MERN Stack Implementation

A real MongoDB + Express + React + Node.js build of ArtVault, matching the
architecture declared in the Checkpoint 1 proposal and the mandatory MERN
tech-stack requirement:

- **Frontend:** React (Vite, React Router)
- **Backend:** Node.js with Express.js
- **Database:** MongoDB (Mongoose)

Why MERN fits this project: JavaScript is used end-to-end (no context-switching
between languages), artwork documents vary by discipline so MongoDB's flexible,
JSON-native storage fits better than a rigid relational schema, the UI is built
from repeating pieces (art cards, exhibit rows, forms) that map naturally to
React components, and every interaction — browsing, uploading, curating —
goes through a RESTful, Express-routed API.

This replaces the earlier static HTML/CSS/JS prototype with a working system:
real accounts, real password hashing, a real database, and a real API — the
prototype was a clickable mockup of the UX; this is the actual implementation.

## Project structure

```
artvault-mern/
├── server/     Express + Mongoose API
└── client/     React (Vite) frontend
```

## Requirements

- Node.js 18+
- A MongoDB database — either:
  - a local MongoDB server (`mongod`), or
  - a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

## 1. Backend setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` and set `MONGO_URI` to your database connection string, and set
`JWT_SECRET` to any long random string.

Seed the database with demo artists, artworks, and exhibits:

```bash
npm run seed
```

Start the API:

```bash
npm run dev        # with auto-restart (nodemon)
# or
npm start
```

The API runs at `http://localhost:5000`. Check `http://localhost:5000/api/health`
to confirm it's up.

**Demo accounts created by the seed script:**

| Role   | Email                | Password    |
|--------|-----------------------|-------------|
| Artist | juan@artvault.com     | artist123   |
| Artist | rosario@artvault.com  | artist123   |
| Artist | miguel@artvault.com   | artist123   |
| Admin  | admin@artvault.com    | admin123    |

## 2. Frontend setup

In a second terminal:

```bash
cd client
npm install
npm run dev
```

The app runs at `http://localhost:5173` and proxies `/api/*` requests to the
backend at `http://localhost:5000` (configured in `vite.config.js`).

## What's implemented

- **Auth:** signup, login, JWT sessions, bcrypt password hashing, and the
  3-failed-attempt / 5-minute lockout from the login flowchart — all enforced
  server-side, not just in the UI.
- **Artworks:** the 5 core endpoints from the proposal — list/filter, create,
  view one (with the exhibits it appears in), update, delete — with
  owner-or-admin authorization checked before any write.
- **Artists:** public directory + profile pages, editable by the signed-in
  artist.
- **Exhibits:** public listing + detail pages; creation/editing/deleting
  restricted to administrators.
- **Guest browsing:** the gallery, artist directory, and exhibits are all
  public GET routes — no account needed to browse, matching the
  least-privilege behavior from the login flowchart.

## What's not implemented (left as a next step)

- Real image upload/storage (artworks currently store an `image_path` string
  field; wiring up actual file upload — e.g. Multer + S3/Cloudinary — is a
  reasonable next addition).
- Pagination controls in the UI (the API supports `page`/`limit`, the
  frontend doesn't have pager buttons yet).
- Automated tests.

## API reference

| Method | Route                  | Auth           | Description                          |
|--------|-------------------------|----------------|---------------------------------------|
| POST   | `/api/auth/signup`      | —              | Create an artist account              |
| POST   | `/api/auth/login`       | —              | Sign in, returns a JWT                |
| GET    | `/api/auth/me`          | Bearer token   | Current user                          |
| GET    | `/api/artworks`         | —              | List/filter artworks                  |
| POST   | `/api/artworks`         | Bearer token   | Upload a new artwork                  |
| GET    | `/api/artworks/:id`     | —              | Artwork detail + its exhibits         |
| PUT    | `/api/artworks/:id`     | Owner or admin | Update an artwork                     |
| DELETE | `/api/artworks/:id`     | Owner or admin | Remove an artwork                     |
| GET    | `/api/artists`          | —              | Artist directory                      |
| GET    | `/api/artists/:id`      | —              | Artist profile + their artworks       |
| PUT    | `/api/artists/me`       | Bearer token   | Update your own profile               |
| GET    | `/api/exhibits`         | —              | List exhibits                         |
| GET    | `/api/exhibits/:id`     | —              | Exhibit detail + its artworks         |
| POST   | `/api/exhibits`         | Admin          | Create an exhibit                     |
| PUT    | `/api/exhibits/:id`     | Admin          | Update an exhibit                     |
| DELETE | `/api/exhibits/:id`     | Admin          | Delete an exhibit                     |
