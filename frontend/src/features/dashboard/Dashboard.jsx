import React from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function Dashboard() {
  const [data, setData] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard', { credentials: 'include' }),
      fetch('/api/forecasts', { credentials: 'include' }),
    ]).then(async ([dashboardResponse, forecastResponse]) => {
      const result = await dashboardResponse.json()
      const forecastResult = await forecastResponse.json()
      if (!dashboardResponse.ok) throw new Error(result.message || 'Unable to load dashboard')
      if (!forecastResponse.ok) throw new Error(forecastResult.message || 'Unable to load forecast')
      return { dashboard: result, forecast: forecastResult.forecast }
    }).then(({ dashboard, forecast: nextForecast }) => {
      setData(dashboard)
      setForecast(nextForecast)
    }).catch((requestError) => { setError(requestError.message); if (requestError.message === 'Unauthorized') navigate('/login') })
  }, [navigate])
  if (error) return <main><h1>Dashboard</h1><p role="alert">{error}</p><Link to="/login">Sign in</Link></main>
  if (!data || !forecast) return <main><h1>Dashboard</h1><p>Loading your financial overview…</p></main>
  const { summary } = data
  return <main><h1>Good to see you</h1><p>{data.period} overview</p><section aria-label="Financial summary">
    <article><h2>Income</h2><p>{summary.income.toFixed(2)}</p></article><article><h2>Expenses</h2><p>{summary.expenses.toFixed(2)}</p></article>
    <article><h2>Scheduled EMIs</h2><p>{summary.scheduledEmis.toFixed(2)}</p></article><article><h2>Projected savings</h2><p>{summary.projectedSavings.toFixed(2)}</p></article>
  </section><h2>Expense forecast</h2><p>{forecast.hasHistory ? `Based on ${forecast.historicalPeriods.join(', ')}` : 'Add three months of past expenses to personalize this forecast.'}</p><p>Predicted expenses: {forecast.predictedExpenses.toFixed(2)}</p><p>Predicted savings: {forecast.predictedNetSavings.toFixed(2)}</p><h2>Expense categories</h2>{data.categories.length ? <ul>{data.categories.map((category) => <li key={category._id}>{category._id}: {category.total.toFixed(2)}</li>)}</ul> : <p>No expenses recorded this month.</p>}</main>
}
export default Dashboard
