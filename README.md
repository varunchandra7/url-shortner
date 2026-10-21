# Scalable URL Shortener Service

> A lightweight, high-performance URL shortener built with Node.js, Express, Prisma ORM, PostgreSQL, and Upstash Redis.

![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![Express](https://img.shields.io/badge/Express-v5-blue.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-NeonDB-blue.svg)
![Prisma](https://img.shields.io/badge/Prisma-v6-indigo.svg)
![Redis](https://img.shields.io/badge/Redis-Upstash-red.svg)

---

## 📐 Architecture & System Design

This service uses a high-throughput, low-latency architecture optimized for high-concurrency read workloads using the **Cache-Aside pattern**.

### Write Path (`POST /api/shorten`)
1. Client submits a long URL via API or Web Interface.
2. Server generates a unique 7-character Base62 short code.
3. Link mapping (`shortCode` $\rightarrow$ `originalUrl`) is persisted in **PostgreSQL** via Prisma.
4. The new mapping is pre-cached in **Redis** with a 24-hour TTL (86,400s).

### Read Path (`GET /:shortCode`)
1. Client requests a short code.
2. **Cache Hit:** Server queries **Redis** first (`await redis.get`). On hit, logs `Cache Hit` and issues an **HTTP 301 Permanent Redirect** to `originalUrl` with sub-2ms latency.
3. **Cache Miss:** On miss or cache fault, server logs `Cache Miss` and queries **PostgreSQL** via Prisma.
4. On DB match, repopulates **Redis** cache and returns **HTTP 301 Permanent Redirect**. If not found, returns **HTTP 404** JSON response.

### System Architecture Flowchart
```
  +--------+              +---------+               +-------------+
  | Client | -----------> | Express | ------------> | Upstash     |
  |        |              | Server  |  Cache Hit    | Redis Cache |
  +--------+              +---------+  (sub-2ms)    +-------------+
      ^                        |                           |
      |                        | Cache Miss                |
      | 301 Redirect           v                           |
      +-----------------  +------------+                   |
                          | PostgreSQL | <-----------------+
                          |  Neon DB   |    Repopulate Cache
                          +------------+
```

---

## ✨ Key Features

- **Unique Short Code Generation:** Generates unique 7-character Base62 codes (`[a-zA-Z0-9]`).
- **High-Performance Redirects:** Sub-2ms HTTP 301 permanent redirects via Upstash Redis.
- **Cache-Aside Pattern:** Optimized in-memory caching layer with 24-hour expiration TTL.
- **Graceful Failure Fallback:** Automatic fallback to PostgreSQL if Redis encounters latency or network faults.
- **Modern Responsive UI:** Clean card-based web layout with instant URL shortening and copyable link output.
- **Indexed Database Schema:** Unique database constraint and B-tree index on `shortCode` for O(1) database lookups.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** Neon PostgreSQL
- **ORM:** Prisma ORM
- **Cache:** Upstash Redis (`ioredis`)
- **Frontend:** HTML5, CSS3, JavaScript (ES6+ Fetch API)

---

## 🔑 Environment Variables

Create a `.env` file in the root directory containing:

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Neon DB pooled URL with SSL) |
| `REDIS_URL` | Upstash Redis connection string (`redis://` or `rediss://`) |
| `PORT` | *(Optional)* HTTP server port (defaults to `3000`) |

---

## 🚀 Local / Codespaces Setup Instructions

### Prerequisites
* Node.js (v18 or higher)
* npm

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/varunchandra7/url-shortner.git
   cd url-shortner
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://neondb_owner:npg_jQsmyzug0i6V@ep-morning-lab-b4gp3dw0-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   REDIS_URL="redis://default:gQAAAAAAASeAAAIgcDFhNzRhY2EyMThkOTk0NWNkOWRiYjE2NTk0MjcwYTJjNQ@subtle-ferret-75648.upstash.io:6379"
   ```

4. **Generate Prisma Client and push database schema:**
   ```bash
   npx prisma generate
   npm run build
   ```

5. **Start the server:**
   ```bash
   npm start
   ```
   The application will be accessible at `http://localhost:3000`.

---

## 📚 API Documentation

### 1. Shorten URL
Creates a shortened URL mapping for a given long URL.

* **Endpoint:** `POST /api/shorten`
* **Content-Type:** `application/json`

#### Request Body
```json
{
  "originalUrl": "https://example.com/very/long/url/path"
}
```

#### Response (`200 OK`)
```json
{
  "shortCode": "PJ4ZV1s",
  "originalUrl": "https://example.com/very/long/url/path"
}
```

---

### 2. Redirect Short Code
Redirects the client to the original URL associated with the short code.

* **Endpoint:** `GET /:shortCode`

#### Response (`301 Moved Permanently`)
* **Headers:** `Location: https://example.com/very/long/url/path`

#### Response (`404 Not Found`)
```json
{
  "error": "Short URL not found"
}
```
