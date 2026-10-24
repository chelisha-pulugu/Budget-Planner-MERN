import React, { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { api, currentPeriod, displayError, formatMoney } from './api'

const navigation = [
  ['Dashboard', '/dashboard', '◫'],
  ['Transactions', '/transactions', '↕'],
  ['Budgets', '/budgets', '▤'],
  ['Loans & EMIs', '/loans', '◷'],
  ['Reports', '/reports', '▥'],
  ['Profile', '/profile', '○'],
]

function useFinanceData(load, dependencies = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const refresh = useCallback(() => setReload((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    load().then((result) => {
      if (active) setData(result)
    }).catch((requestError) => {
      if (active) setError(displayError(requestError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  // The caller controls reloads and explicitly supplies request filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...dependencies])

  return { data, error, loading, refresh, setError }
}

function LoadingError({ loading, error, onRetry, children }) {
  if (loading) return <div className="state-card" role="status">Loading your data…</div>
  if (error) return <div className="state-card error-card" role="alert"><p>{error}</p>{onRetry && <button className="button button-secondary" onClick={onRetry}>Try again</button>}</div>
  return children
}

function Money({ value, currency }) {
  return <>{formatMoney(value, currency)}</>
}

function ProtectedLayout() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    api('/auth/get-me').then(({ user: nextUser }) => {
      if (active) setUser(nextUser)
    }).catch((requestError) => {
      if (requestError.status === 401) navigate('/login', { replace: true })
      else if (active) setError(displayError(requestError))
    })
    return () => { active = false }
  }, [navigate])

  async function logout() {
    setError('')
    try {
      await api('/auth/logout', { method: 'POST' })
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(displayError(requestError))
    }
  }

  if (error) return <main className="auth-screen"><div className="state-card error-card" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div></main>
  if (!user) return <main className="auth-screen"><div className="state-card" role="status">Checking your secure session…</div></main>

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/dashboard"><span className="brand-mark">B</span><span>Balance<span className="brand-light">wise</span></span></Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(([label, path, icon]) => (
            <NavLink key={path} to={path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span aria-hidden="true" className="nav-icon">{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="avatar">{(user.username || 'U').slice(0, 1).toUpperCase()}</div><div className="user-label"><strong>{user.username}</strong><span>Personal account</span></div><button className="icon-button logout-button" onClick={logout} aria-label="Log out" title="Log out">↪</button></div>
      </aside>
      <main className="main-panel">
        <header className="topbar"><div><span className="eyebrow">PERSONAL FINANCE</span><h1>Make every month count.</h1></div><div className="topbar-actions"><span className="secure-badge">● Secure account</span><button className="button button-secondary mobile-logout" onClick={logout}>Log out</button></div></header>
        <Outlet context={{ user, updateUser: setUser, currency: user.financialProfile?.currency || 'INR' }} />
      </main>
    </div>
  )
}

function DashboardPage() {
  const [period, setPeriod] = useState(currentPeriod)
  const { data, error, loading, refresh } = useFinanceData(
    () => Promise.all([
      api(`/dashboard?period=${period}`),
      api(`/forecasts?period=${period}`),
    ]).then(([dashboard, forecast]) => ({ dashboard, forecast })),
    [period],
  )
  const { currency } = useOutletContext()

  return <section className="page-content">
    <div className="page-heading"><div><h2>Dashboard</h2><p>Your financial picture, all in one place.</p></div><label className="period-control">Month <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label></div>
    <LoadingError loading={loading} error={error} onRetry={refresh}>
      {data && <>
        <div className="metric-grid">
          <Metric label="Income" value={data.dashboard.summary.income} tone="positive" currency={currency} hint="Recorded this month" />
          <Metric label="Expenses" value={data.dashboard.summary.expenses} tone="negative" currency={currency} hint="Transactions + EMI payments" />
          <Metric label="EMIs scheduled" value={data.dashboard.summary.scheduledEmis} tone="warning" currency={currency} hint="Due this month" />
          <Metric label="Projected savings" value={data.forecast.forecast.predictedNetSavings} tone={data.forecast.forecast.predictedNetSavings < 0 ? 'negative' : 'positive'} currency={currency} hint="Forecast estimate" />
        </div>
        {data.dashboard.summary.cashBalance !== null && <div className="cash-note">Estimated cash balance <strong><Money value={data.dashboard.summary.cashBalance} currency={currency} /></strong><span>Based on your profile starting cash and recorded activity.</span></div>}
        <div className="dashboard-grid">
          <section className="panel"><div className="panel-heading"><div><h3>Income & spending</h3><p>{data.dashboard.period}</p></div></div>
            <div className="comparison-chart" aria-label="Income and expenses comparison">
              <div className="bar-group"><span>Income</span><div className="bar-track"><div className="bar income-bar" style={{ width: `${barWidth(data.dashboard.summary.income, data.dashboard.summary.expenses)}%` }} /></div><strong><Money value={data.dashboard.summary.income} currency={currency} /></strong></div>
              <div className="bar-group"><span>Expenses</span><div className="bar-track"><div className="bar expense-bar" style={{ width: `${barWidth(data.dashboard.summary.expenses, data.dashboard.summary.income)}%` }} /></div><strong><Money value={data.dashboard.summary.expenses} currency={currency} /></strong></div>
            </div>
            <div className="legend"><span><i className="legend-income" />Income</span><span><i className="legend-expense" />Expenses incl. payments</span></div>
          </section>
          <section className="panel"><div className="panel-heading"><div><h3>Expense categories</h3><p>Recorded spending for this month</p></div></div>
            {data.dashboard.categories.length ? <div className="category-list">{data.dashboard.categories.map((category) => <div className="category-row" key={category._id}><div><span>{category._id}</span><strong><Money value={category.total} currency={currency} /></strong></div><div className="bar-track"><div className="bar category-bar" style={{ width: `${barWidth(category.total, data.dashboard.summary.expenses)}%` }} /></div></div>)}</div> : <EmptyState message="No expenses recorded for this month yet." link="/transactions" action="Add a transaction" />}
          </section>
        </div>
        <div className="dashboard-grid">
          <section className="panel"><div className="panel-heading"><div><h3>Recent transactions</h3><p>Your latest activity</p></div><Link className="text-link" to="/transactions">View all →</Link></div>
            {data.dashboard.recentTransactions.length ? <div className="table-wrap"><table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th className="align-right">Amount</th></tr></thead><tbody>{data.dashboard.recentTransactions.map((item) => <tr key={item._id}><td><span className="transaction-name">{item.description}</span><span className={`type-dot ${item.type}`} /></td><td>{item.category}</td><td>{new Date(item.date).toLocaleDateString()}</td><td className={`align-right amount-${item.type}`}>{item.type === 'expense' ? '−' : item.type === 'refund' ? '↩ ' : item.type === 'transfer' ? '↔ ' : '+'}<Money value={item.amount} currency={currency} /></td></tr>)}</tbody></table></div> : <EmptyState message="Your activity will show here once you add a transaction." link="/transactions" action="Add your first transaction" />}
          </section>
          <section className="panel"><div className="panel-heading"><div><h3>Forecast snapshot</h3><p>Personalized estimate · {data.forecast.forecast.targetPeriod}</p></div></div>
            <div className="forecast-numbers"><div><span>Expected income</span><strong><Money value={data.forecast.forecast.expectedIncome} currency={currency} /></strong></div><div><span>Predicted expenses</span><strong><Money value={data.forecast.forecast.predictedExpenses} currency={currency} /></strong></div><div><span>EMIs already paid</span><strong><Money value={data.forecast.forecast.paidEmis} currency={currency} /></strong></div><div><span>Scheduled EMIs</span><strong><Money value={data.forecast.forecast.scheduledEmis} currency={currency} /></strong></div></div>
            {data.forecast.forecast.warnings.length > 0 && <div className="warning-box" role="status"><strong>Budget watch</strong><p>{data.forecast.forecast.warnings.map((item) => `${item.category} is forecast over by ${formatMoney(item.overrun, currency)}`).join(' · ')}</p></div>}
            {data.forecast.assumptions.note && <p className="assumption">{data.forecast.assumptions.note}</p>}
            {data.forecast.forecast.projectedEndingCash !== null && <p className="assumption">Projected ending cash: <strong><Money value={data.forecast.forecast.projectedEndingCash} currency={currency} /></strong></p>}
          </section>
        </div>
        <section className="panel upcoming-panel"><div className="panel-heading"><div><h3>Upcoming EMI payments</h3><p>Active loans and their next due date</p></div><Link className="text-link" to="/loans">Manage loans →</Link></div>
          {data.dashboard.loans.length ? <div className="loan-strip">{data.dashboard.loans.map((loan) => <div className="loan-chip" key={loan._id}><span className="loan-icon">↗</span><div><strong>{loan.name}</strong><span>{new Date(loan.nextDueDate).toLocaleDateString()}</span></div><b><Money value={loan.emiAmount} currency={currency} /></b></div>)}</div> : <EmptyState message="No active loan payments are scheduled." link="/loans" action="Add a loan" />}
        </section>
      </>}
    </LoadingError>
  </section>
}

function barWidth(value, maximum) {
  return maximum > 0 ? `${Math.max(value > 0 ? 4 : 0, Math.min(100, value / maximum * 100))}` : '0'
}

function Metric({ label, value, tone, currency, hint }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><i className={`metric-indicator ${tone}`} /></div><strong className={`metric-value ${tone}`}><Money value={value} currency={currency} /></strong><span className="metric-hint">{hint}</span></article>
}

function EmptyState({ message, link, action }) {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">＋</span><p>{message}</p>{link && <Link className="text-link" to={link}>{action} →</Link>}</div>
}

export { ProtectedLayout, DashboardPage, LoadingError, EmptyState, Metric, useFinanceData }
