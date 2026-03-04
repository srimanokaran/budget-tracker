# Budget Tracker — Build & Docker Guide

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for containerised builds)

---

## Running Locally (No Docker)

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

---

## How the App Works

This is a **React** single-page application built with [Vite](https://vite.dev/).

- **React** is a JavaScript UI library. You write components in `.jsx` files which mix JavaScript and HTML-like syntax.
- **Vite** is the build tool. In development, it runs a local server with hot-reload. For production, it compiles everything into plain static files.

The app uses `recharts` for charts and `localStorage` for persistence — there is no backend or database.

---

## What Happens When You Build

```bash
npm run build
```

Vite takes all the source code (`.jsx`, `.css`, etc.) and:

1. **Bundles** — combines all modules into a few optimised `.js` files
2. **Transpiles** — converts JSX and modern JavaScript into browser-compatible code
3. **Minifies** — removes whitespace, shortens variable names, strips dead code
4. **Outputs** — writes the result to the `dist/` folder

The `dist/` folder contains only static files:

```
dist/
├── index.html        ← entry point
├── assets/
│   ├── index-xxxx.js  ← all your React code, bundled and minified
│   └── index-xxxx.css ← all styles, combined
```

These files can be served by **any** web server. No Node.js required at runtime — the browser runs the JavaScript directly.

---

## Docker

### Why Docker?

Docker packages your app into a **container** — a lightweight, isolated environment that runs the same way on any machine. No "it works on my machine" problems.

### The Dockerfile Explained

The Dockerfile uses a **multi-stage build**, which means it has two separate phases:

#### Stage 1: Build (the kitchen)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

| Line | What it does |
|---|---|
| `FROM node:20-alpine AS build` | Starts from a lightweight Linux image with Node.js pre-installed. Names this stage `build`. |
| `WORKDIR /app` | Sets `/app` as the working directory inside the container. |
| `COPY package.json package-lock.json ./` | Copies only the dependency files first. |
| `RUN npm ci` | Installs dependencies. This is a separate step so Docker can **cache** it — if your dependencies haven't changed, this step is skipped on rebuild. |
| `COPY . .` | Copies the rest of your source code into the container. |
| `RUN npm run build` | Runs the Vite build, producing the `dist/` folder with static files. |

After this stage, we have compiled static files. The Node.js runtime, `node_modules` (hundreds of MBs), and source code are no longer needed.

#### Stage 2: Serve (the waiter)

```dockerfile
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

| Line | What it does |
|---|---|
| `FROM nginx:alpine` | Starts a **brand new image** with only nginx (a fast, lightweight web server). Everything from stage 1 is discarded. |
| `COPY --from=build /app/dist /usr/share/nginx/html` | Reaches back into the `build` stage and copies just the `dist/` folder into nginx's default serving directory. |
| `EXPOSE 80` | Documents that the container listens on port 80. |
| `CMD ["nginx", "-g", "daemon off;"]` | Starts nginx in the foreground so Docker can manage the process. |

#### Why multi-stage?

| | With multi-stage | Without |
|---|---|---|
| Final image size | ~25 MB | ~500 MB+ |
| Contains Node.js? | No | Yes |
| Contains node_modules? | No | Yes |
| Contains source code? | No | Yes |
| Attack surface | Minimal | Large |

You're shipping the finished meal, not the entire kitchen.

### The .dockerignore File

```
node_modules
dist
.git
```

This tells Docker to skip these directories when copying files into the build. Without it, Docker would copy your local `node_modules` into the container and then install them again — wasting time and potentially causing platform mismatches.

### Build & Run

```bash
# Build the image
docker build -t budget-tracker .

# Run the container
docker run -p 8080:80 budget-tracker
```

Open `http://localhost:8080`.

The `-p 8080:80` flag maps port 8080 on your machine to port 80 inside the container. You can change `8080` to any port you like.

### Common Commands

```bash
# Rebuild after code changes
docker build -t budget-tracker .

# Run in the background
docker run -d -p 8080:80 budget-tracker

# Stop all running containers
docker stop $(docker ps -q)

# See running containers
docker ps

# See image size
docker images budget-tracker
```

---

## Project Structure

```
budget-tracker/
├── src/
│   ├── main.jsx           ← React entry point, mounts the app
│   ├── App.jsx            ← Wrapper that provides the storage polyfill
│   ├── BudgetTracker.jsx  ← The main app component
│   └── index.css          ← Global styles (minimal reset)
├── index.html             ← HTML shell that loads main.jsx
├── package.json           ← Dependencies and scripts
├── vite.config.js         ← Vite configuration
├── Dockerfile             ← Multi-stage container build
├── .dockerignore          ← Files excluded from Docker builds
└── build.md               ← This file
```
