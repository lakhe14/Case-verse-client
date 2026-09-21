# CaseVerse Client

The React + Vite storefront for CaseVerse, an iPhone-cover ecommerce application.
It consumes the API provided by the sibling `../server` project.

## Requirements

- Node.js 18 or newer
- A running CaseVerse server API

## Setup

```bash
cd client
copy .env.example .env
npm install
```

`VITE_*` values are public browser configuration. Never place passwords, JWT
secrets, database credentials, SMTP credentials, or private API keys in this file.

## Development

```bash
npm run dev
```

The Vite development server runs on `http://localhost:5173` and proxies `/api` to
the local server when `VITE_API_URL` is blank.

## Production build

```bash
npm run build
```

The generated `dist/` directory is intentionally not versioned.

## Local development accounts

Development accounts are created only from the server project. Configure the
local-only `DEV_*` values in `server/.env`, then run:

```bash
cd ../server
npm run dev:reset-accounts
```

Do not put development passwords in client code, browser environment variables,
or public documentation.
