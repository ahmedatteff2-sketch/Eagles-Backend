# Eagle Gym — Backend API

Express.js + PostgreSQL + Drizzle ORM

## Setup

```bash
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run DB migrations
npm run db:push

# Development
npm run dev

# Production build
npm run build
npm run start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | `development` or `production` |
| `JWT_ACCESS_SECRET` | JWT access token secret |
| `JWT_REFRESH_SECRET` | JWT refresh token secret |
| `SESSION_SECRET` | Session secret |

## Render Deployment

1. Connect this repo to Render
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `node --enable-source-maps dist/index.mjs`
4. Add all environment variables from the table above
5. After first deploy, open Shell and run: `npm run db:push`

## Default Admin

Phone: `01025754947`  
Password: `admin123`
