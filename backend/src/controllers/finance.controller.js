const Transaction = require('../models/transaction.model')
const Budget = require('../models/budget.model')
const Loan = require('../models/loan.model')
const User = require('../models/user.model')
const mongoose = require('mongoose')
const { buildForecast, previousPeriods } = require('../services/forecast.service')
const { round } = require('../services/forecast.service')

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

function periodOrCurrent(value) {
    if (value === undefined) return new Date().toISOString().slice(0, 7)
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value
    throw Object.assign(new Error('period must be a valid YYYY-MM value'), { statusCode: 400 })
}

function periodBounds(period) {
    const [year, month] = period.split('-').map(Number)
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) }
}

function userObjectId(userId) {
    return new mongoose.Types.ObjectId(userId)
}

function validateTransaction(body) {
    body = body || {}
    const { type, amount, category, description, date } = body
    const parsedDate = new Date(date)
    if (!['income', 'expense', 'refund', 'transfer'].includes(type) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 ||
        Math.round(Number(amount) * 100) !== Number(amount) * 100 || !String(category || '').trim() ||
        !String(description || '').trim() || !date || Number.isNaN(parsedDate.getTime()) ||
        String(category).trim().length > 60 || String(description).trim().length > 200 ||
        (body.notes !== undefined && String(body.notes).length > 500)) {
        return 'type, positive amount with up to two decimals, category, description and valid date are required'
    }
}

function transactionFields(body, userId) {
    return {
        type: body.type,
        amount: round(Number(body.amount)),
        category: String(body.category).trim(),
        description: String(body.description).trim(),
        date: new Date(body.date),
        notes: body.notes === undefined ? '' : String(body.notes).trim(),
        userId
    }
}

function loanDueInPeriod(loan, period) {
    if (!loan.remainingInstallments || loan.status !== 'active') return false
    const [year, month] = period.split('-').map(Number)
    const nextDue = loan.nextDueDate
    const difference = (year - nextDue.getUTCFullYear()) * 12 + month - 1 - nextDue.getUTCMonth()
    return difference >= 0 && difference < loan.remainingInstallments
}

const listTransactions = asyncHandler(async (req, res) => {
    const query = { userId: req.user.id }
    if (req.query.type && !['income', 'expense', 'refund', 'transfer'].includes(req.query.type)) return res.status(400).json({ message: 'type must be income, expense, refund, or transfer' })
    if (['income', 'expense', 'refund', 'transfer'].includes(req.query.type)) query.type = req.query.type
    if (req.query.category) query.category = req.query.category
    if (req.query.search) {
        const search = String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        query.description = { $regex: search, $options: 'i' }
    }
    if (req.query.from || req.query.to) {
        query.date = {}
        if (req.query.from) {
            const from = new Date(req.query.from)
            if (Number.isNaN(from.getTime())) return res.status(400).json({ message: 'from must be a valid date' })
            query.date.$gte = from
        }
        if (req.query.to) {
            const to = new Date(req.query.to)
            if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'to must be a valid date' })
            if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) to.setUTCHours(23, 59, 59, 999)
            query.date.$lte = to
        }
        if (query.date.$gte && query.date.$lte && query.date.$gte > query.date.$lte) return res.status(400).json({ message: 'from must be on or before to' })
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(Math.max(1, Number.parseInt(req.query.limit, 10) || 50), 200)
    const [transactions, total] = await Promise.all([
        Transaction.find(query).sort({ date: req.query.sort === 'oldest' ? 1 : -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
        Transaction.countDocuments(query)
    ])
    res.json({ transactions, page, limit, total, pages: Math.ceil(total / limit) })
})

const createTransaction = asyncHandler(async (req, res) => {
    const error = validateTransaction(req.body)
    if (error) return res.status(400).json({ message: error })
    const transaction = await Transaction.create(transactionFields(req.body, req.user.id))
    res.status(201).json({ transaction })
})

const updateTransaction = asyncHandler(async (req, res) => {
    const error = validateTransaction(req.body)
    if (error) return res.status(400).json({ message: error })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Transaction not found' })
    const transaction = await Transaction.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, transactionFields(req.body, req.user.id), { returnDocument: 'after', runValidators: true })
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' })
    res.json({ transaction })
})

const deleteTransaction = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Transaction not found' })
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id })
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' })
    res.status(204).end()
})

const listBudgets = asyncHandler(async (req, res) => {
    const period = periodOrCurrent(req.query.period)
    const budgets = await Budget.find({ userId: req.user.id, period }).sort({ category: 1 })
    const { start, end } = periodBounds(period)
    const spending = await Transaction.aggregate([
        { $match: { userId: userObjectId(req.user.id), type: { $in: ['expense', 'refund'] }, date: { $gte: start, $lt: end } } },
        { $group: { _id: '$category', spent: { $sum: { $cond: [{ $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount'] } } } }
    ])
    const spent = new Map(spending.map(item => [item._id, round(item.spent)]))
    const { forecast } = await getForecastData(req.user.id, period)
    res.json({ budgets: budgets.map(budget => {
        const actual = spent.get(budget.category) || 0
        const predicted = forecast.categories.find(item => item.category === budget.category)?.predicted ?? actual
        return { ...budget.toObject(), spent: actual, remaining: round(Math.max(0, budget.limit - actual)), percentageUsed: budget.limit ? round(actual / budget.limit * 100) : (actual ? 100 : 0), predicted }
    }) })
})

const saveBudget = asyncHandler(async (req, res) => {
    const { category, limit, period } = req.body || {}
    if (typeof category !== 'string' || !category.trim() || category.trim().length > 60 || limit === undefined || limit === '' || !Number.isFinite(Number(limit)) || Number(limit) < 0 ||
        Math.round(Number(limit) * 100) !== Number(limit) * 100 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) return res.status(400).json({ message: 'category, non-negative limit with up to two decimals and a valid YYYY-MM period are required' })
    if (req.params.id && !mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Budget not found' })
    const normalizedCategory = category.trim()
    const selector = req.params.id ? { _id: req.params.id, userId: req.user.id } : { userId: req.user.id, category: normalizedCategory, period }
    let budget
    try {
        budget = await Budget.findOneAndUpdate(selector, { category: normalizedCategory, limit: round(Number(limit)), period, userId: req.user.id }, { returnDocument: 'after', upsert: !req.params.id, runValidators: true })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'A budget for this category and month already exists' })
        throw error
    }
    res.status(200).json({ budget })
})

const deleteBudget = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Budget not found' })
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.id })
    if (!budget) return res.status(404).json({ message: 'Budget not found' })
    res.status(204).end()
})

const listLoans = asyncHandler(async (req, res) => {
    const loans = await Loan.find({ userId: req.user.id }).sort({ nextDueDate: 1 })
    const today = new Date()
    res.json({ loans: loans.map(loan => ({
        ...loan.toObject(),
        status: loan.status === 'active' && loan.nextDueDate < today ? 'overdue' : loan.status
    })) })
})

const saveLoan = asyncHandler(async (req, res) => {
    req.body = req.body || {}
    const required = ['name', 'type', 'principal', 'outstandingPrincipal', 'emiAmount', 'nextDueDate']
    const dueDate = new Date(req.body.nextDueDate)
    const numericFields = ['principal', 'outstandingPrincipal', 'emiAmount']
    if (required.some(field => req.body[field] === undefined || req.body[field] === '') || (req.body.status !== 'closed' && req.body.remainingInstallments === undefined) || !numericFields.every(field => Number.isFinite(Number(req.body[field])) && Number(req.body[field]) >= 0 && Math.round(Number(req.body[field]) * 100) === Number(req.body[field]) * 100) ||
        typeof req.body.name !== 'string' || !req.body.name.trim() || typeof req.body.type !== 'string' || !req.body.type.trim() || Number.isNaN(dueDate.getTime()) ||
        (req.body.status !== undefined && !['active', 'closed'].includes(req.body.status)) ||
        (req.body.interestRate !== undefined && (!Number.isFinite(Number(req.body.interestRate)) || Number(req.body.interestRate) < 0)) ||
        (req.body.remainingInstallments !== undefined && (req.body.remainingInstallments === '' || !Number.isInteger(Number(req.body.remainingInstallments)) || Number(req.body.remainingInstallments) < 0))) return res.status(400).json({ message: 'Loan details are incomplete or invalid' })
    if (req.params.id && !mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Loan not found' })
    if (req.body.status === 'closed' && Number(req.body.outstandingPrincipal) > 0) return res.status(400).json({ message: 'Set the outstanding balance to zero before closing the loan' })
    const data = {
        name: String(req.body.name).trim(),
        type: String(req.body.type).trim(),
        lender: req.body.lender,
        principal: Number(req.body.principal),
        outstandingPrincipal: Number(req.body.outstandingPrincipal),
        interestRate: req.body.interestRate === undefined ? 0 : Number(req.body.interestRate),
        emiAmount: Number(req.body.emiAmount),
        nextDueDate: dueDate,
        dueDay: Number(req.body.dueDay) || dueDate.getUTCDate(),
        remainingInstallments: req.body.remainingInstallments === undefined ? 0 : Number(req.body.remainingInstallments),
        status: req.body.status || 'active',
        userId: req.user.id
    }
    for (const field of ['principal', 'outstandingPrincipal', 'emiAmount', 'interestRate', 'remainingInstallments']) if (data[field] !== undefined) data[field] = Number(data[field])
    for (const field of ['principal', 'outstandingPrincipal', 'emiAmount']) data[field] = round(data[field])
    if (data.status === 'closed') data.remainingInstallments = 0
    if (data.status === 'active' && data.outstandingPrincipal === 0) {
        data.status = 'closed'
        data.remainingInstallments = 0
    }
    if (data.status === 'active' && data.remainingInstallments === 0) return res.status(400).json({ message: 'An active loan with an outstanding balance needs at least one remaining installment' })
    const loan = req.params.id ? await Loan.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, data, { returnDocument: 'after', runValidators: true }) : await Loan.create(data)
    if (!loan) return res.status(404).json({ message: 'Loan not found' })
    res.status(req.params.id ? 200 : 201).json({ loan })
})

const deleteLoan = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Loan not found' })
    const loan = await Loan.findOneAndDelete({ _id: req.params.id, userId: req.user.id })
    if (!loan) return res.status(404).json({ message: 'Loan not found' })
    res.status(204).end()
})

const dashboard = asyncHandler(async (req, res) => {
    const period = periodOrCurrent(req.query.period)
    const { start, end } = periodBounds(period)
    const [summary, categories, recentTransactions, loans, allLoans, budgets, user, allTimeTransactions] = await Promise.all([
        Transaction.aggregate([{ $match: { userId: userObjectId(req.user.id), date: { $gte: start, $lt: end } } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
        Transaction.aggregate([
            { $match: { userId: userObjectId(req.user.id), type: { $in: ['expense', 'refund'] }, date: { $gte: start, $lt: end } } },
            { $group: { _id: '$category', total: { $sum: { $cond: [{ $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount'] } } } },
            { $sort: { total: -1 } }
        ]),
        Transaction.find({ userId: req.user.id }).sort({ date: -1 }).limit(5),
        Loan.find({ userId: req.user.id, status: 'active' }).sort({ nextDueDate: 1 }),
        Loan.find({ userId: req.user.id }).select('payments'),
        Budget.find({ userId: req.user.id, period }),
        User.findById(req.user.id).select('financialProfile'),
        Transaction.aggregate([
            { $match: { userId: userObjectId(req.user.id) } },
            { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ])
    ])
    const income = summary.find(item => item._id === 'income')?.total || 0
    const expenses = (summary.find(item => item._id === 'expense')?.total || 0) - (summary.find(item => item._id === 'refund')?.total || 0)
    const scheduledEmis = loans.filter(loan => loanDueInPeriod(loan, period)).reduce((total, loan) => total + loan.emiAmount, 0)
    const paymentTotal = allLoans.flatMap(loan => loan.payments || []).filter(payment => payment.paymentDate >= start && payment.paymentDate < end).reduce((total, payment) => total + payment.amount, 0)
    const actualExpenses = round(expenses + paymentTotal)
    const startingCash = user?.financialProfile?.startingCash
    const lifetimeNet = allTimeTransactions.reduce((total, item) => total + (item._id === 'income' ? item.total : item._id === 'refund' ? item.total : item._id === 'expense' ? -item.total : 0), 0)
    const lifetimePayments = allLoans.flatMap(loan => loan.payments || []).reduce((total, payment) => total + payment.amount, 0)
    const cashBalance = startingCash === undefined ? null : round(startingCash + lifetimeNet - lifetimePayments)
    res.json({ period, summary: { income: round(income), expenses: actualExpenses, transactionExpenses: round(expenses), emiPayments: round(paymentTotal), scheduledEmis: round(scheduledEmis), projectedSavings: round(income - expenses - scheduledEmis - paymentTotal), cashBalance }, categories, recentTransactions, loans, budgets })
})

async function getForecastData(userId, targetPeriod) {
    const periods = previousPeriods(targetPeriod)
    const { start } = periodBounds(periods[0])
    const { start: targetStart, end: targetEnd } = periodBounds(targetPeriod)
    const end = targetEnd
    const id = userObjectId(userId)
    const [transactions, budgets, loans, user] = await Promise.all([
        Transaction.find({ userId: id, date: { $gte: start, $lt: end } }).select('type amount category date'),
        Budget.find({ userId: id, period: targetPeriod }).select('category limit'),
        Loan.find({ userId: id }).select('emiAmount nextDueDate remainingInstallments status payments dueDay'),
        User.findById(id).select('financialProfile')
    ])
    const expensesByPeriod = {}
    const incomeByPeriod = {}
    const expensePeriods = new Set()
    const incomePeriods = new Set()
    const currentExpenses = {}
    let currentIncome = 0
    for (const period of [...periods, targetPeriod]) { expensesByPeriod[period] = {}; incomeByPeriod[period] = 0 }
    for (const transaction of transactions) {
        const period = transaction.date.toISOString().slice(0, 7)
        if (period === targetPeriod) {
            if (transaction.type === 'expense') currentExpenses[transaction.category] = (currentExpenses[transaction.category] || 0) + transaction.amount
            if (transaction.type === 'income') currentIncome += transaction.amount
            if (transaction.type === 'refund') currentExpenses[transaction.category] = (currentExpenses[transaction.category] || 0) - transaction.amount
            } else if (expensesByPeriod[period]) {
                if (transaction.type === 'expense') {
                    expensePeriods.add(period)
                    expensesByPeriod[period][transaction.category] = (expensesByPeriod[period][transaction.category] || 0) + transaction.amount
                }
                if (transaction.type === 'refund') {
                    expensePeriods.add(period)
                    expensesByPeriod[period][transaction.category] = (expensesByPeriod[period][transaction.category] || 0) - transaction.amount
                }
            if (transaction.type === 'income') {
                incomePeriods.add(period)
                incomeByPeriod[period] += transaction.amount
            }
        }
    }
    const scheduledEmis = loans.filter(loan => loanDueInPeriod(loan, targetPeriod)).reduce((total, loan) => total + loan.emiAmount, 0)
    const paidEmis = loans.flatMap(loan => loan.payments || [])
        .filter(payment => payment.paymentDate >= targetStart && payment.paymentDate < targetEnd)
        .reduce((total, payment) => total + payment.amount, 0)
    const forecast = buildForecast({
        targetPeriod,
        expensesByPeriod,
        incomeByPeriod,
        budgets,
        scheduledEmis,
        paidEmis,
        fallbackIncome: user?.financialProfile?.expectedMonthlyIncome || 0,
        currentExpenses,
        currentIncome,
        startingCash: user?.financialProfile?.startingCash,
        completePeriods: periods.filter(period => expensePeriods.has(period)),
        completeIncomePeriods: periods.filter(period => incomePeriods.has(period))
    })
    return { forecast, assumptions: { method: '0.2 × third-most-recent + 0.3 × previous + 0.5 × most-recent month', source: 'your transaction history and profile', note: forecast.hasHistory ? 'Current-period actuals are included; past expenses are estimated from the three previous calendar months.' : 'No historical records are fabricated. Estimates use your expected income and known loan commitments.', startingCash: forecast.projectedEndingCash === null ? 'Unknown; projected ending cash is not shown.' : 'Uses the starting cash value in your profile.' } }
}

const forecasts = asyncHandler(async (req, res) => {
    const targetPeriod = periodOrCurrent(req.query.period)
    res.json(await getForecastData(req.user.id, targetPeriod))
})

const recordLoanPayment = asyncHandler(async (req, res) => {
    const { amount, principalPaid = amount, paymentDate = new Date(), notes = '' } = req.body || {}
    const date = new Date(paymentDate)
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Loan not found' })
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Math.round(Number(amount) * 100) !== Number(amount) * 100 ||
        !Number.isFinite(Number(principalPaid)) || Number(principalPaid) < 0 || Number(principalPaid) > Number(amount) ||
        Math.round(Number(principalPaid) * 100) !== Number(principalPaid) * 100 || Number.isNaN(date.getTime()) || String(notes).length > 300) {
        return res.status(400).json({ message: 'Enter a valid payment amount, principal paid, date and optional note' })
    }
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.id })
    if (!loan) return res.status(404).json({ message: 'Loan not found' })
    if (loan.status !== 'active') return res.status(409).json({ message: 'A closed loan cannot accept payments' })
    if (date > new Date()) return res.status(400).json({ message: 'A payment date cannot be in the future' })
    if (loan.remainingInstallments > 1 && Number(amount) < loan.emiAmount) return res.status(400).json({ message: 'The payment must cover at least one scheduled EMI installment' })
    if (Number(principalPaid) > loan.outstandingPrincipal) return res.status(400).json({ message: 'Principal paid cannot exceed the outstanding balance' })
    if (loan.remainingInstallments <= 1 && Number(principalPaid) < loan.outstandingPrincipal) return res.status(400).json({ message: 'The final installment must settle the remaining principal; update the installment count if needed' })
    loan.payments.push({ amount: round(Number(amount)), principalPaid: round(Number(principalPaid)), paymentDate: date, notes })
    loan.outstandingPrincipal = round(loan.outstandingPrincipal - Number(principalPaid))
    loan.remainingInstallments = Math.max(0, loan.remainingInstallments - 1)
    if (!loan.remainingInstallments || !loan.outstandingPrincipal) {
        loan.remainingInstallments = 0
        loan.status = 'closed'
    } else {
        const due = new Date(loan.nextDueDate)
        const nextYear = due.getUTCFullYear()
        const nextMonth = due.getUTCMonth() + 1
        const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate()
        loan.nextDueDate = new Date(Date.UTC(nextYear, nextMonth, Math.min(loan.dueDay || due.getUTCDate(), lastDay)))
    }
    await loan.save()
    res.status(201).json({ loan })
})

const reports = asyncHandler(async (req, res) => {
    if (req.query.period !== undefined) {
        const period = periodOrCurrent(req.query.period)
        const { start, end } = periodBounds(period)
        const id = userObjectId(req.user.id)
        const [transactions, loans, budgets, prediction] = await Promise.all([
            Transaction.find({ userId: id, date: { $gte: start, $lt: end } }).select('type amount category date description'),
            Loan.find({ userId: id }).select('payments'),
            Budget.find({ userId: id, period }),
            getForecastData(req.user.id, period)
        ])
        let income = 0
        let expenses = 0
        const categories = {}
        for (const transaction of transactions) {
            if (transaction.type === 'income') income += transaction.amount
            else if (transaction.type === 'expense' || transaction.type === 'refund') {
                const signedAmount = transaction.type === 'refund' ? -transaction.amount : transaction.amount
                expenses += signedAmount
                categories[transaction.category] = (categories[transaction.category] || 0) + signedAmount
            }
        }
        const emiPayments = loans.flatMap(loan => loan.payments || [])
            .filter(payment => payment.paymentDate >= start && payment.paymentDate < end)
            .reduce((total, payment) => total + payment.amount, 0)
        const budgetAdherence = budgets.map(budget => {
            const actual = round(categories[budget.category] || 0)
            return {
                category: budget.category,
                budget: budget.limit,
                actual,
                remaining: round(budget.limit - actual),
                predicted: prediction.forecast.categories.find(item => item.category === budget.category)?.predicted ?? actual
            }
        })
        const actualVsPredicted = Object.entries(categories).map(([category, actual]) => ({
            category,
            actual: round(actual),
            predicted: prediction.forecast.categories.find(item => item.category === category)?.predicted ?? round(actual)
        }))
        res.json({
            period,
            totals: { income: round(income), expenses: round(expenses), emiPayments: round(emiPayments), netSavings: round(income - expenses - emiPayments) },
            categories: Object.entries(categories).map(([category, total]) => ({ category, total: round(total) })).sort((a, b) => b.total - a.total),
            budgetAdherence,
            actualVsPredicted,
            transactions
        })
        return
    }
    const year = Number(req.query.year) || new Date().getFullYear()
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ message: 'A valid report year is required' })
    const start = new Date(Date.UTC(year, 0, 1))
    const end = new Date(Date.UTC(year + 1, 0, 1))
    const id = userObjectId(req.user.id)
    const [transactions, loans, budgets] = await Promise.all([
        Transaction.find({ userId: id, date: { $gte: start, $lt: end } }).select('type amount category date'),
        Loan.find({ userId: id }).select('payments'),
        Budget.find({ userId: id, period: new RegExp(`^${year}-`) })
    ])
    const months = Array.from({ length: 12 }, (_, month) => ({ month: `${year}-${String(month + 1).padStart(2, '0')}`, income: 0, expenses: 0, emiPayments: 0, categories: {} }))
    const monthMap = new Map(months.map(item => [item.month, item]))
    for (const transaction of transactions) {
        const entry = monthMap.get(transaction.date.toISOString().slice(0, 7))
        if (!entry) continue
        if (transaction.type === 'income') entry.income += transaction.amount
        else if (transaction.type === 'expense' || transaction.type === 'refund') {
            const signedAmount = transaction.type === 'refund' ? -transaction.amount : transaction.amount
            entry.expenses += signedAmount
            entry.categories[transaction.category] = (entry.categories[transaction.category] || 0) + signedAmount
        }
    }
    for (const loan of loans) for (const payment of loan.payments || []) {
        const entry = monthMap.get(payment.paymentDate.toISOString().slice(0, 7))
        if (entry) entry.emiPayments += payment.amount
    }
    for (const entry of months) {
        entry.income = round(entry.income)
        entry.expenses = round(entry.expenses)
        entry.emiPayments = round(entry.emiPayments)
        entry.netSavings = round(entry.income - entry.expenses - entry.emiPayments)
        for (const category of Object.keys(entry.categories)) entry.categories[category] = round(entry.categories[category])
    }
    const categoriesByPeriod = new Map(months.map(entry => [entry.month, entry.categories]))
    const budgetAdherence = budgets.map(budget => {
        const actual = round(categoriesByPeriod.get(budget.period)?.[budget.category] || 0)
        return { month: budget.period, category: budget.category, actual, budget: budget.limit, variance: round(budget.limit - actual) }
    })
    res.json({ year, months, totals: months.reduce((total, item) => ({
        income: round(total.income + item.income),
        expenses: round(total.expenses + item.expenses),
        emiPayments: round(total.emiPayments + item.emiPayments),
        netSavings: round(total.netSavings + item.netSavings)
    }), { income: 0, expenses: 0, emiPayments: 0, netSavings: 0 }), budgetAdherence })
})

module.exports = { listTransactions, createTransaction, updateTransaction, deleteTransaction, listBudgets, saveBudget, deleteBudget, listLoans, saveLoan, deleteLoan, recordLoanPayment, dashboard, forecasts, reports }
