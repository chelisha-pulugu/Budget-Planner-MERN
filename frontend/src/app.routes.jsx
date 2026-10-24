import React from 'react';
import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import { ProtectedLayout, DashboardPage } from "./features/finance/FinanceApp";
import { BudgetsPage, LoansPage, ProfilePage, ReportsPage, TransactionsPage } from "./features/finance/FinancePages";


export const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/register",
        element: <Register />
    },
    {
        path: "/",
        element: <ProtectedLayout />,
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: "dashboard", element: <DashboardPage /> },
            { path: "transactions", element: <TransactionsPage /> },
            { path: "budgets", element: <BudgetsPage /> },
            { path: "loans", element: <LoansPage /> },
            { path: "reports", element: <ReportsPage /> },
            { path: "profile", element: <ProfilePage /> },
            { path: "*", element: <Navigate to="/dashboard" replace /> }
        ]
    }
])
