const WEIGHTS = [0.2, 0.3, 0.5]

function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

function money(value) {
    return Number.isFinite(Number(value)) ? round(Number(value)) : 0
}

function previousPeriods(targetPeriod) {
    const [year, month] = targetPeriod.split('-').map(Number)
    return [3, 2, 1].map(offset => {
        const date = new Date(Date.UTC(year, month - 1 - offset, 1))
        return date.toISOString().slice(0, 7)
    })
}

function weightedTotal(values) {
    return round(values.reduce((total, value, index) => total + (Number(value) || 0) * WEIGHTS[index], 0))
}

function buildForecast({
    targetPeriod,
    expensesByPeriod,
    incomeByPeriod,
    budgets = [],
    scheduledEmis = 0,
    paidEmis = 0,
    fallbackIncome = 0,
    currentExpenses = {},
    currentIncome = 0,
    startingCash,
    completePeriods,
    completeIncomePeriods
}) {
    const periods = previousPeriods(targetPeriod)
    const historyComplete = completePeriods
        ? periods.every(period => completePeriods.includes(period))
        : periods.every(period => Object.keys(expensesByPeriod[period] || {}).length > 0)
    const incomeHistoryComplete = completeIncomePeriods
        ? periods.every(period => completeIncomePeriods.includes(period))
        : periods.every(period => Number(incomeByPeriod[period]) > 0)
    const categories = new Set(Object.values(expensesByPeriod).flatMap(period => Object.keys(period)))
    for (const category of Object.keys(currentExpenses)) categories.add(category)
    const categoryForecasts = [...categories].map(category => {
        const values = periods.map(period => expensesByPeriod[period]?.[category] || 0)
        const baseline = historyComplete ? weightedTotal(values) : money(values[2] || values[1] || values[0])
        const predicted = money(Math.max(0, money(currentExpenses[category]), baseline))
        const budget = budgets.find(item => item.category === category)
        return {
            category,
            historical: values,
            predicted,
            method: historyComplete ? 'three-month weighted estimate' : 'limited-history estimate',
            budget: budget?.limit ?? null,
            overrun: budget ? round(Math.max(0, predicted - budget.limit)) : 0
        }
    }).sort((a, b) => b.predicted - a.predicted)
    const incomeValues = periods.map(period => incomeByPeriod[period] || 0)
    const latestRecordedIncome = [...incomeValues].reverse().find(value => value > 0) || 0
    const incomeEstimate = incomeHistoryComplete
        ? weightedTotal(incomeValues)
        : money(fallbackIncome || latestRecordedIncome)
    const expectedIncome = money(Math.max(money(currentIncome), incomeEstimate))
    const predictedExpenses = money(categoryForecasts.reduce((total, item) => total + item.predicted, 0))
    const netSavings = money(expectedIncome - predictedExpenses - money(scheduledEmis) - money(paidEmis))
    return {
        targetPeriod,
        historicalPeriods: periods,
        hasHistory: categoryForecasts.length > 0 || incomeValues.some(Boolean),
        completeHistory: historyComplete,
        completeIncomeHistory: incomeHistoryComplete,
        expectedIncome,
        predictedExpenses,
        scheduledEmis: money(scheduledEmis),
        paidEmis: money(paidEmis),
        predictedNetSavings: netSavings,
        projectedEndingCash: Number.isFinite(Number(startingCash)) ? money(Number(startingCash) + netSavings) : null,
        categories: categoryForecasts,
        warnings: categoryForecasts.filter(item => item.overrun > 0).map(item => ({ category: item.category, overrun: item.overrun })),
        limitations: historyComplete
            ? []
            : ['Some historical months have little or no expense data; forecasts are estimates, not guarantees.']
    }
}

module.exports = { previousPeriods, weightedTotal, buildForecast, round }
