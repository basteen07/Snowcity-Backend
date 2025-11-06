# SnowCity Backend

Tech: Node.js + Express, PostgreSQL (pg), Axios, Razorpay/PhonePe, Twilio, Nodemailer, AWS S3/Cloudinary.

## Quick start
1) Install deps
   npm install

2) Copy env
   cp .env.example .env
   # fill values

3) Run dev
   npm run dev

API health:
GET /health → { status: 'ok' }

## Structure (excerpt)
- server.js: bootstrap + graceful shutdown
- app.js: express app, middleware, routes
- config/: db, logger, axios, cors, mail, payments, storage

## Database
Use PostgreSQL. The pool auto-sets UTC and ensures citext extension on connect.

## Payments
- Razorpay: orders + signature verification
- PhonePe: helper for x-VERIFY header and initiate/status calls

## Storage
- S3 v3 SDK
- Cloudinary upload helpers