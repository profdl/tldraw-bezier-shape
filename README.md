# tldraw-bezier-shape

Fast Vite + React playground preloaded with the latest [`@tldraw/tldraw`](https://www.npmjs.com/package/@tldraw/tldraw) SDK. Launch it locally to start experimenting with custom tools, shapes, and persistence.

## Prerequisites

- Node.js 18+ (Vite 7 requires at least Node 18.0.0)
- npm 9+ (ships with current Node releases)

## Getting started

```bash
npm install
npm run dev
```

The dev server opens automatically at `http://localhost:5173` with a fully interactive tldraw canvas. Changes under `src/` hot‑reload instantly.

## Build for production

```bash
npm run build
npm run preview # optional: serve the production bundle locally
```

The output is emitted to `dist/`, ready to deploy on any static host (Netlify, Vercel, GitHub Pages, etc.).
