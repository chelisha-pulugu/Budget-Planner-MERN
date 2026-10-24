import React, { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, currentPeriod, displayError, formatMoney } from './api'
import { EmptyState, LoadingError, Metric, useFinanceData } from './FinanceApp'

function Money({ value, currency }) {
  return <>{formatMoney(value, currency)}</>
}

function FormField({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>
}

function ErrorNotice({ message }) {
  return message ? <p className="inline-error" role="alert">{message}</p> : null
}

function TransactionsPage() {
  const { currency } = useOutletContext()
  const [filters, setFilters] = useState({ type: '', category: '', search: '', from: '', to: '' })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('newest')
  const params = new URLSearchParams({ page: String(page), limit: '20', sort })
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
  const { data, error, loading, refresh } = useFinanceData(() => api(`/transactions?${params}`), [page, sort, filters.type, filters.category, filters.search, filters.from, filters.to])

  function startEdit(transaction) {
    setForm({ ...transaction, date: new Date(transaction.date).toISOString().slice(0, 10) })
    setFormError('')
  }
  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const editing = Boolean(form._id)
      await api(`/transactions${editing ? `/${form._id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: form })
      setForm(null)
      refresh()
    } catch (requestError) { setFormError(displayError(requestError)) }
    finally { setSaving(false) }
  }
  async function remove(transaction) {
    if (!window.confirm(`Delete "${transaction.description}"? This cannot be undone.`)) return
    try { await api(`/transactions/${transaction._id}`, { method: 'DELETE' }); refresh() }
    catch (requestError) { window.alert(displayError(requestError)) }
  }

  return <section className="page-content">
    <div className="page-heading"><div><h2>Transactions</h2><p>Record and review your income and expenses.</p></div><button className="button button-primary" onClick={() => { setForm({ type: 'expense', amount: '', category: '', description: '', date: new Date().toISOString().slice(0, 10), notes: '' }); setFormError('') }}>＋ Add transaction</button></div>
    {form && <section className="panel editor-panel"><div className="panel-heading"><div><h3>{form._id ? 'Edit transaction' : 'New transaction'}</h3><p>Changes are saved to your account.</p></div><button className="icon-button" onClick={() => setForm(null)} aria-label="Close form">×</button></div>
      <form className="form-grid" onSubmit={save}>
        <FormField label="Type"><select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="expense">Expense</option><option value="income">Income</option><option value="refund">Refund (reduces expenses)</option><option value="transfer">Transfer (excluded from totals)</option></select><small>Use Transfer for account moves and card bill settlements; it is excluded from income and spending.</small></FormField>
        <FormField label="Amount"><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></FormField>
        <FormField label="Category"><input required maxLength="60" value={form.category} placeholder="e.g. Groceries" onChange={(event) => setForm({ ...form, category: event.target.value })} /></FormField>
        <FormField label="Date"><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></FormField>
        <FormField label="Description"><input required maxLength="200" value={form.description} placeholder="What was this for?" onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
        <FormField label="Note (optional)"><input maxLength="500" value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></FormField>
        <div className="form-actions"><ErrorNotice message={formError} /><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save transaction'}</button><button className="button button-secondary" type="button" onClick={() => setForm(null)}>Cancel</button></div>
      </form>
    </section>}
    <section className="panel">
      <div className="filter-row"><label className="search-field"><span className="sr-only">Search description</span><input type="search" placeholder="Search descriptions…" value={filters.search} onChange={(event) => { setPage(1); setFilters({ ...filters, search: event.target.value }) }} /></label>
        <select aria-label="Filter transaction type" value={filters.type} onChange={(event) => { setPage(1); setFilters({ ...filters, type: event.target.value }) }}><option value="">All types</option><option value="income">Income</option><option value="expense">Expenses</option><option value="refund">Refunds</option><option value="transfer">Transfers</option></select>
        <input aria-label="Filter by category" placeholder="Category" value={filters.category} onChange={(event) => { setPage(1); setFilters({ ...filters, category: event.target.value }) }} />
        <input aria-label="Start date" type="date" value={filters.from} onChange={(event) => { setPage(1); setFilters({ ...filters, from: event.target.value }) }} />
        <input aria-label="End date" type="date" value={filters.to} onChange={(event) => { setPage(1); setFilters({ ...filters, to: event.target.value }) }} />
        <select aria-label="Sort transactions" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
      </div>
      <LoadingError loading={loading} error={error} onRetry={refresh}>{data && (data.transactions.length ? <>
        <div className="table-wrap"><table><thead><tr><th>Description</th><th>Type</th><th>Category</th><th>Date</th><th className="align-right">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.transactions.map((item) => <tr key={item._id}><td><span className="transaction-name">{item.description}</span>{item.notes && <small className="table-note">{item.notes}</small>}</td><td><span className={`pill ${item.type}`}>{item.type}</span></td><td>{item.category}</td><td>{new Date(item.date).toLocaleDateString()}</td><td className={`align-right amount-${item.type}`}>{item.type === 'income' ? '+' : item.type === 'refund' ? '↩ ' : item.type === 'transfer' ? '↔ ' : '−'}{formatMoney(item.amount, currency)}</td><td className="row-actions"><button className="text-button" onClick={() => startEdit(item)}>Edit</button><button className="text-button danger-text" onClick={() => remove(item)}>Delete</button></td></tr>)}</tbody></table></div>
        <div className="pagination"><span>{data.total} transaction{data.total === 1 ? '' : 's'}</span><div><button className="button button-secondary" disabled={data.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {data.page} of {Math.max(1, data.pages)}</span><button className="button button-secondary" disabled={data.page >= data.pages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </> : <EmptyState message="No transactions match yet. Add one to start tracking." />)}</LoadingError>
    </section>
  </section>
}

function BudgetsPage() {
  const { currency } = useOutletContext()
  const [period, setPeriod] = useState(currentPeriod)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { data, error, loading, refresh } = useFinanceData(() => api(`/budgets?period=${period}`), [period])

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await api(`/budgets${form._id ? `/${form._id}` : ''}`, { method: form._id ? 'PUT' : 'POST', body: { category: form.category, limit: form.limit, period } })
      setForm(null); refresh()
    } catch (requestError) { setFormError(displayError(requestError)) }
    finally { setSaving(false) }
  }
  async function remove(budget) {
    if (!window.confirm(`Delete the ${budget.category} budget for ${period}?`)) return
    try { await api(`/budgets/${budget._id}`, { method: 'DELETE' }); refresh() }
    catch (requestError) { window.alert(displayError(requestError)) }
  }

  return <section className="page-content">
    <div className="page-heading"><div><h2>Monthly budgets</h2><p>Set category limits and keep an eye on progress.</p></div><div className="heading-actions"><label className="period-control">Month <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label><button className="button button-primary" onClick={() => { setForm({ category: '', limit: '' }); setFormError('') }}>＋ Add budget</button></div></div>
    {form && <section className="panel editor-panel"><div className="panel-heading"><h3>{form._id ? 'Edit budget' : 'New category budget'}</h3><button className="icon-button" onClick={() => setForm(null)} aria-label="Close form">×</button></div><form className="form-grid compact-form" onSubmit={save}><FormField label="Category"><input required maxLength="60" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></FormField><FormField label="Monthly limit"><input required type="number" min="0" step="0.01" value={form.limit} onChange={(event) => setForm({ ...form, limit: event.target.value })} /></FormField><div className="form-actions"><ErrorNotice message={formError} /><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save budget'}</button><button type="button" className="button button-secondary" onClick={() => setForm(null)}>Cancel</button></div></form></section>}
    <LoadingError loading={loading} error={error} onRetry={refresh}>{data && (data.budgets.length ? <div className="budget-grid">{data.budgets.map((budget) => {
      const percent = budget.limit > 0 ? Math.max(0, Math.min(100, budget.spent / budget.limit * 100)) : budget.spent > 0 ? 100 : 0
      const over = budget.spent > budget.limit
      return <article className="panel budget-card" key={budget._id}><div className="budget-card-heading"><div><h3>{budget.category}</h3><span>{period}</span></div><div className="row-actions"><button className="text-button" onClick={() => { setForm({ ...budget }); setFormError('') }}>Edit</button><button className="text-button danger-text" onClick={() => remove(budget)}>Delete</button></div></div>
        <div className="budget-figures"><strong><Money value={budget.spent} currency={currency} /></strong><span>of <Money value={budget.limit} currency={currency} /></span></div>
        <div className="budget-progress" role="progressbar" aria-label={`${budget.category} budget used`} aria-valuenow={Math.round(percent)} aria-valuemin="0" aria-valuemax="100"><div className={over ? 'over' : ''} style={{ width: `${percent}%` }} /></div>
        <div className="budget-details"><span className={over ? 'danger-text' : ''}>{over ? `${formatMoney(budget.spent - budget.limit, currency)} over limit` : `${formatMoney(budget.remaining, currency)} remaining`}</span><span>{Math.round(budget.percentageUsed)}% used</span></div>
        <p className="budget-prediction">Predicted: <strong>{formatMoney(budget.predicted, currency)}</strong>{budget.predicted > budget.limit && <span className="warning-label">Potential overrun</span>}</p>
      </article>
    })}</div> : <section className="panel"><EmptyState message="No budgets for this month. Set category limits to track your spending." /></section>)}</LoadingError>
  </section>
}

function LoansPage() {
  const { currency } = useOutletContext()
  const [form, setForm] = useState(null)
  const [paymentFor, setPaymentFor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { data, error, loading, refresh } = useFinanceData(() => api('/loans'))

  function editLoan(loan) {
    setForm({ ...loan, status: loan.status === 'closed' ? 'closed' : 'active', nextDueDate: new Date(loan.nextDueDate).toISOString().slice(0, 10) })
    setFormError('')
  }
  async function save(event) {
    event.preventDefault()
    setSaving(true); setFormError('')
    try {
      const editing = Boolean(form._id)
      await api(`/loans${editing ? `/${form._id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: form })
      setForm(null); refresh()
    } catch (requestError) { setFormError(displayError(requestError)) }
    finally { setSaving(false) }
  }
  async function pay(event) {
    event.preventDefault()
    setSaving(true); setFormError('')
    try {
      await api(`/loans/${paymentFor._id}/payments`, { method: 'POST', body: paymentFor.payment })
      setPaymentFor(null); refresh()
    } catch (requestError) { setFormError(displayError(requestError)) }
    finally { setSaving(false) }
  }
  async function remove(loan) {
    if (!window.confirm(`Delete ${loan.name} and its payment history?`)) return
    try { await api(`/loans/${loan._id}`, { method: 'DELETE' }); refresh() }
    catch (requestError) { window.alert(displayError(requestError)) }
  }
  const defaults = { name: '', type: '', lender: '', principal: '', outstandingPrincipal: '', interestRate: '', emiAmount: '', nextDueDate: new Date().toISOString().slice(0, 10), remainingInstallments: '', status: 'active' }

  return <section className="page-content">
    <div className="page-heading"><div><h2>Loans & EMIs</h2><p>Manage outstanding balances, schedules, and actual payments.</p></div><button className="button button-primary" onClick={() => { setForm({ ...defaults }); setFormError('') }}>＋ Add loan</button></div>
    {form && <section className="panel editor-panel"><div className="panel-heading"><div><h3>{form._id ? 'Edit loan' : 'New loan'}</h3><p>Installments are not marked paid automatically.</p></div><button className="icon-button" onClick={() => setForm(null)} aria-label="Close form">×</button></div><form className="form-grid" onSubmit={save}>
      <FormField label="Loan name"><input required maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
      <FormField label="Loan type"><input required maxLength="50" placeholder="e.g. Home loan" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} /></FormField>
      <FormField label="Lender (optional)"><input maxLength="100" value={form.lender || ''} onChange={(event) => setForm({ ...form, lender: event.target.value })} /></FormField>
      <FormField label="Principal"><input required type="number" min="0" step="0.01" value={form.principal} onChange={(event) => setForm({ ...form, principal: event.target.value })} /></FormField>
      <FormField label="Outstanding balance"><input required type="number" min="0" step="0.01" value={form.outstandingPrincipal} onChange={(event) => setForm({ ...form, outstandingPrincipal: event.target.value })} /></FormField>
      <FormField label="Annual interest (%)"><input type="number" min="0" step="0.01" value={form.interestRate ?? ''} onChange={(event) => setForm({ ...form, interestRate: event.target.value })} /></FormField>
      <FormField label="EMI amount"><input required type="number" min="0" step="0.01" value={form.emiAmount} onChange={(event) => setForm({ ...form, emiAmount: event.target.value })} /></FormField>
      <FormField label="Next due date"><input required type="date" value={form.nextDueDate} onChange={(event) => setForm({ ...form, nextDueDate: event.target.value })} /></FormField>
      <FormField label="Installments remaining"><input required type="number" min="0" step="1" value={form.remainingInstallments ?? ''} onChange={(event) => setForm({ ...form, remainingInstallments: event.target.value })} /></FormField>
      <FormField label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="closed">Closed</option></select></FormField>
      <div className="form-actions"><ErrorNotice message={formError} /><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save loan'}</button><button type="button" className="button button-secondary" onClick={() => setForm(null)}>Cancel</button></div>
    </form></section>}
    {paymentFor && <section className="panel editor-panel"><div className="panel-heading"><div><h3>Record payment · {paymentFor.name}</h3><p>Do not add this EMI again as an ordinary transaction; payment history is included separately in outflows.</p></div><button className="icon-button" onClick={() => setPaymentFor(null)} aria-label="Close form">×</button></div><form className="form-grid compact-form" onSubmit={pay}>
      <FormField label="Payment amount"><input required type="number" min="0.01" step="0.01" value={paymentFor.payment.amount} onChange={(event) => setPaymentFor({ ...paymentFor, payment: { ...paymentFor.payment, amount: event.target.value } })} /></FormField>
      <FormField label="Principal paid"><input required type="number" min="0" step="0.01" value={paymentFor.payment.principalPaid} onChange={(event) => setPaymentFor({ ...paymentFor, payment: { ...paymentFor.payment, principalPaid: event.target.value } })} /></FormField>
      <FormField label="Payment date"><input required type="date" value={paymentFor.payment.paymentDate} onChange={(event) => setPaymentFor({ ...paymentFor, payment: { ...paymentFor.payment, paymentDate: event.target.value } })} /></FormField>
      <FormField label="Note (optional)"><input maxLength="300" value={paymentFor.payment.notes} onChange={(event) => setPaymentFor({ ...paymentFor, payment: { ...paymentFor.payment, notes: event.target.value } })} /></FormField>
      <div className="form-actions"><ErrorNotice message={formError} /><button className="button button-primary" disabled={saving}>{saving ? 'Recording…' : 'Record payment'}</button><button type="button" className="button button-secondary" onClick={() => setPaymentFor(null)}>Cancel</button></div>
    </form></section>}
    <LoadingError loading={loading} error={error} onRetry={refresh}>{data && (data.loans.length ? <div className="loan-grid">{data.loans.map((loan) => <article className="panel loan-card" key={loan._id}>
      <div className="loan-card-title"><div className="loan-icon">↗</div><div><h3>{loan.name}</h3><span>{loan.type}{loan.lender ? ` · ${loan.lender}` : ''}</span></div><span className={`pill ${loan.status}`}>{loan.status}</span></div>
      <div className="loan-balance"><span>Outstanding</span><strong>{formatMoney(loan.outstandingPrincipal, currency)}</strong></div>
      <div className="loan-stats"><div><span>Monthly EMI</span><strong>{formatMoney(loan.emiAmount, currency)}</strong></div><div><span>Next due</span><strong>{new Date(loan.nextDueDate).toLocaleDateString()}</strong></div><div><span>Installments left</span><strong>{loan.remainingInstallments}</strong></div></div>
      <div className="loan-actions"><button className="button button-primary" disabled={loan.status !== 'active'} onClick={() => { setFormError(''); setPaymentFor({ ...loan, payment: { amount: loan.emiAmount, principalPaid: Math.min(loan.emiAmount, loan.outstandingPrincipal), paymentDate: new Date().toISOString().slice(0, 10), notes: '' } }) }}>Record payment</button><button className="button button-secondary" onClick={() => editLoan(loan)}>Edit</button><button className="button button-secondary" onClick={() => remove(loan)}>Delete</button></div>
      {loan.payments?.length > 0 && <details className="payment-history"><summary>Payment history ({loan.payments.length})</summary><ul>{[...loan.payments].reverse().map((payment) => <li key={payment._id}><span>{new Date(payment.paymentDate).toLocaleDateString()}</span><strong>{formatMoney(payment.amount, currency)}</strong></li>)}</ul></details>}
    </article>)}</div> : <section className="panel"><EmptyState message="No loans yet. Add a loan to track its balance and installments." /></section>)}</LoadingError>
  </section>
}

function ReportsPage() {
  const { currency } = useOutletContext()
  const [year, setYear] = useState(new Date().getFullYear())
  const [mode, setMode] = useState('year')
  const [period, setPeriod] = useState(currentPeriod)
  const { data, error, loading, refresh } = useFinanceData(
    () => api(mode === 'year' ? `/reports?year=${year}` : `/reports?period=${period}`),
    [year, mode, period],
  )
  return <section className="page-content">
    <div className="page-heading"><div><h2>Reports</h2><p>Income, spending, savings and EMI payments from your records.</p></div><div className="heading-actions"><select aria-label="Report period" value={mode} onChange={(event) => setMode(event.target.value)}><option value="year">Yearly</option><option value="month">Monthly</option></select>{mode === 'year' ? <label className="period-control">Year <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label> : <label className="period-control">Month <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>}</div></div>
    <LoadingError loading={loading} error={error} onRetry={refresh}>{data && <>
      <div className="metric-grid report-metrics"><Metric label={`${mode === 'year' ? 'Year' : 'Month'} income`} value={data.totals.income} tone="positive" currency={currency} /><Metric label={`${mode === 'year' ? 'Year' : 'Month'} expenses`} value={data.totals.expenses} tone="negative" currency={currency} /><Metric label="EMI payments" value={data.totals.emiPayments} tone="warning" currency={currency} /><Metric label="Net savings" value={data.totals.netSavings} tone={data.totals.netSavings < 0 ? 'negative' : 'positive'} currency={currency} /></div>
      {mode === 'month' && <div className="monthly-report-grid"><section className="panel"><div className="panel-heading"><div><h3>Spending by category</h3><p>Actual and predicted spending for {data.period}</p></div></div>{data.actualVsPredicted.length ? <div className="table-wrap"><table><thead><tr><th>Category</th><th className="align-right">Actual</th><th className="align-right">Predicted</th><th className="align-right">Difference</th></tr></thead><tbody>{data.actualVsPredicted.map((item) => <tr key={item.category}><td>{item.category}</td><td className="align-right">{formatMoney(item.actual, currency)}</td><td className="align-right">{formatMoney(item.predicted, currency)}</td><td className={`align-right ${item.actual > item.predicted ? 'amount-expense' : 'amount-income'}`}>{formatMoney(item.actual - item.predicted, currency)}</td></tr>)}</tbody></table></div> : <EmptyState message="No category expenses have been recorded for this month." />}</section>
        <section className="panel"><div className="panel-heading"><div><h3>Budget adherence</h3><p>Actual and forecast spending against your limits</p></div></div>{data.budgetAdherence.length ? <div className="table-wrap"><table><thead><tr><th>Category</th><th className="align-right">Limit</th><th className="align-right">Actual</th><th className="align-right">Remaining</th><th className="align-right">Predicted</th></tr></thead><tbody>{data.budgetAdherence.map((item) => <tr key={item.category}><td>{item.category}</td><td className="align-right">{formatMoney(item.budget, currency)}</td><td className="align-right">{formatMoney(item.actual, currency)}</td><td className={`align-right ${item.remaining < 0 ? 'amount-expense' : ''}`}>{formatMoney(item.remaining, currency)}</td><td className="align-right">{formatMoney(item.predicted, currency)}</td></tr>)}</tbody></table></div> : <EmptyState message="No budgets are set for this month." link="/budgets" action="Create a budget" />}</section></div>}
      {mode === 'year' && <>
      <section className="panel"><div className="panel-heading"><div><h3>Monthly comparison</h3><p>Actual income, expenses and recorded EMI payments</p></div></div><div className="report-chart" role="img" aria-label={`Monthly income and expenses comparison for ${year}`}>{data.months.map((item) => {
        const max = Math.max(1, ...data.months.map((month) => Math.max(month.income, month.expenses + month.emiPayments)))
        return <div className="report-month" key={item.month} title={`${item.month}: income ${formatMoney(item.income, currency)}, outflow ${formatMoney(item.expenses + item.emiPayments, currency)}`}><div className="report-bars"><div className="report-bar-income" style={{ height: `${item.income / max * 100}%` }} /><div className="report-bar-expense" style={{ height: `${(item.expenses + item.emiPayments) / max * 100}%` }} /></div><span>{new Date(`${item.month}-02T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span></div>
      })}</div><div className="legend"><span><i className="legend-income" />Income</span><span><i className="legend-expense" />Expenses + EMI</span></div></section>
      <section className="panel"><div className="panel-heading"><div><h3>Monthly details</h3><p>Every month in {data.year}</p></div></div><div className="table-wrap"><table><thead><tr><th>Month</th><th className="align-right">Income</th><th className="align-right">Expenses</th><th className="align-right">EMI payments</th><th className="align-right">Net savings</th></tr></thead><tbody>{data.months.map((item) => <tr key={item.month}><td>{new Date(`${item.month}-02T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td><td className="align-right amount-income">{formatMoney(item.income, currency)}</td><td className="align-right">{formatMoney(item.expenses, currency)}</td><td className="align-right">{formatMoney(item.emiPayments, currency)}</td><td className={`align-right ${item.netSavings < 0 ? 'amount-expense' : 'amount-income'}`}>{formatMoney(item.netSavings, currency)}</td></tr>)}</tbody></table></div></section>
      </>}
    </>}</LoadingError>
  </section>
}

function ProfilePage() {
  const { user, updateUser, currency: defaultCurrency } = useOutletContext()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    api('/auth/profile').then(({ user: profileUser }) => {
      if (active) setProfile({
        username: profileUser.username || '',
        financialProfile: {
          currency: profileUser.financialProfile?.currency || defaultCurrency,
          incomeType: profileUser.financialProfile?.incomeType || 'fixed',
          expectedMonthlyIncome: profileUser.financialProfile?.expectedMonthlyIncome ?? '',
          savingsTarget: profileUser.financialProfile?.savingsTarget ?? '',
          startingCash: profileUser.financialProfile?.startingCash ?? '',
          householdType: profileUser.financialProfile?.householdType || '',
          householdSize: profileUser.financialProfile?.householdSize ?? '',
          planningPreferences: profileUser.financialProfile?.planningPreferences || '',
        },
      })
    }).catch((requestError) => { if (active) setError(displayError(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [defaultCurrency])
  if (loading) return <section className="page-content"><div className="state-card" role="status">Loading profile…</div></section>
  if (!profile) return <section className="page-content"><div className="state-card error-card" role="alert">{error}<button className="button button-secondary" onClick={() => window.location.reload()}>Try again</button></div></section>
  const updateFinancial = (key, value) => setProfile({ ...profile, financialProfile: { ...profile.financialProfile, [key]: value } })
  async function save(event) {
    event.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const financialProfile = Object.fromEntries(Object.entries(profile.financialProfile).filter(([, value]) => value !== ''))
      for (const key of ['expectedMonthlyIncome', 'savingsTarget', 'startingCash', 'householdSize']) if (financialProfile[key] !== undefined) financialProfile[key] = Number(financialProfile[key])
      const response = await api('/auth/profile', { method: 'PUT', body: { username: profile.username, financialProfile } })
      updateUser({ ...user, ...response.user })
      setSaved(true)
    } catch (requestError) { setError(displayError(requestError)) }
    finally { setSaving(false) }
  }

  return <section className="page-content"><div className="page-heading"><div><h2>Profile & settings</h2><p>Personalize the assumptions behind your budget forecast.</p></div></div><section className="panel profile-panel">
    <div className="panel-heading"><div className="profile-identity"><div className="avatar large-avatar">{(user.username || 'U').slice(0, 1).toUpperCase()}</div><div><h3>Financial profile</h3><p>{user.email || 'Your account settings'}</p></div></div></div>
    <form className="form-grid" onSubmit={save}>
      <FormField label="Name"><input required maxLength="80" value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} /></FormField>
      <FormField label="Currency"><select value={profile.financialProfile.currency} onChange={(event) => updateFinancial('currency', event.target.value)}><option value="INR">INR · Indian Rupee</option><option value="USD">USD · US Dollar</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · Pound Sterling</option><option value="CAD">CAD · Canadian Dollar</option><option value="AUD">AUD · Australian Dollar</option></select></FormField>
      <FormField label="Income type"><select value={profile.financialProfile.incomeType} onChange={(event) => updateFinancial('incomeType', event.target.value)}><option value="fixed">Fixed</option><option value="variable">Variable</option><option value="mixed">Mixed</option></select></FormField>
      <FormField label="Expected monthly income"><input type="number" min="0" step="0.01" value={profile.financialProfile.expectedMonthlyIncome} onChange={(event) => updateFinancial('expectedMonthlyIncome', event.target.value)} /></FormField>
      <FormField label="Monthly savings target"><input type="number" min="0" step="0.01" value={profile.financialProfile.savingsTarget} onChange={(event) => updateFinancial('savingsTarget', event.target.value)} /></FormField>
      <FormField label="Starting cash (optional)"><input type="number" min="0" step="0.01" value={profile.financialProfile.startingCash} onChange={(event) => updateFinancial('startingCash', event.target.value)} /><small>Leave blank if you do not know your starting balance.</small></FormField>
      <FormField label="Household type (optional)"><input maxLength="60" value={profile.financialProfile.householdType} onChange={(event) => updateFinancial('householdType', event.target.value)} /></FormField>
      <FormField label="Household size / dependents"><input type="number" min="1" max="100" step="1" value={profile.financialProfile.householdSize} onChange={(event) => updateFinancial('householdSize', event.target.value)} /></FormField>
      <FormField label="Planning preferences"><textarea rows="3" maxLength="500" value={profile.financialProfile.planningPreferences} onChange={(event) => updateFinancial('planningPreferences', event.target.value)} placeholder="Optional notes to guide your planning." /></FormField>
      <div className="form-actions"><ErrorNotice message={error} />{saved && <span className="success-message" role="status">Profile saved.</span>}<button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  </section></section>
}

export { TransactionsPage, BudgetsPage, LoansPage, ReportsPage, ProfilePage }
