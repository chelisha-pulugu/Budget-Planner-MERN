# Balancewise Budget Planner

A full-stack personal finance app for tracking income, spending, savings goals, monthly budgets, loans, and financial forecasts.

## Overview

This project combines a Node.js/Express backend with a React + Vite frontend. Users can register and log in, manage transactions, set budgets by category and month, track active loans and EMI schedules, and review a dashboard with forecast insights.

## Features

- User authentication with JWT cookies
- Protected dashboard and finance pages
- Transaction management for income, expense, refund, and transfer entries
- Monthly budget tracking with remaining amount and usage percentage
- Loan and EMI tracking with payment history
- Forecast and reporting APIs for monthly analysis
- Responsive frontend with route-based navigation

## Tech Stack

- Backend: Node.js, Express, MongoDB, Mongoose
- Frontend: React, Vite, React Router, Sass
- Auth: JWT + cookie-based session handling
- Validation: Server-side request validation and MongoDB schema constraints

## Project Structure

```text
.
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   └── test/
├── frontend/
│   ├── index.html
│   └── src/
├── Dockerfile
├── server.js
├── package.json
├── vite.config.js
├── .env
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 18+
- MongoDB instance or MongoDB Atlas connection string
- npm

## Environment Variables

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/budget_planner
JWT_SECRET=your_super_secure_jwt_secret
PORT=3000
NODE_ENV=development
```

Notes:
- `MONGODB_URI` should point to your MongoDB database.
- `JWT_SECRET` must be a strong secret value and should not be committed to source control.
- `PORT` defaults to `3000` if not set.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the API server:

```bash
npm start
```

The backend runs on:
- http://localhost:3000
- Health check: http://localhost:3000/health

3. Start the frontend in a second terminal:

```bash
npm run dev
```

The frontend runs on:
- http://localhost:5173

4. Optional: build the frontend for production:

```bash
npm run build
```

5. Run the unit tests:

```bash
npm test
```

## Available Scripts

```bash
npm start        # start the Express backend
npm run dev      # start the Vite development server
npm run build    # build production frontend assets
npm test         # run the forecast service tests
npm run check    # basic syntax check for server.js
```

## Main API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/logout`
- `GET /api/auth/get-me`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`

### Finance

- `GET /api/dashboard`
- `GET /api/forecasts`
- `GET /api/reports`
- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `GET /api/budgets`
- `POST /api/budgets`
- `PUT /api/budgets/:id`
- `DELETE /api/budgets/:id`
- `GET /api/loans`
- `POST /api/loans`
- `PUT /api/loans/:id`
- `DELETE /api/loans/:id`
- `POST /api/loans/:id/payments`

## Production Deployment

The app includes a production-ready Express setup where the frontend build is served from the same origin and `/health` remains available for health checks.

### Docker

From the project root:

```bash
docker build -t balancewise .
```

Run locally with environment variables:

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URI="<your-mongodb-uri>" \
  -e JWT_SECRET="<your-secret>" \
  balancewise
```

Then open:
- http://localhost:3000
- http://localhost:3000/health

## Notes

- Financial values are rounded to two decimal places.
- Transfers do not count toward income or expense totals.
- Refunds reduce expense totals.
- Loan payment history is tracked separately from ordinary transactions.

This app is intended for a personal budgeting workflow and can be extended with more analytics, recurring entries, and richer reporting over time.
