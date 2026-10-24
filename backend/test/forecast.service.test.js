const test = require('node:test')
const assert = require('node:assert/strict')
const { buildForecast, previousPeriods } = require('../src/services/forecast.service')

test('uses the three previous calendar months and newest-weighted expenses', () => {
    assert.deepEqual(previousPeriods('2026-10'), ['2026-07', '2026-08', '2026-09'])
    const forecast = buildForecast({
        targetPeriod: '2026-11',
        expensesByPeriod: { '2026-08': { Food: 100 }, '2026-09': { Food: 200 }, '2026-10': { Food: 300 } },
        incomeByPeriod: { '2026-08': 1000, '2026-09': 1200, '2026-10': 1400 },
        budgets: [{ category: 'Food', limit: 250 }],
        scheduledEmis: 100
    })
    assert.equal(forecast.predictedExpenses, 230)
    assert.equal(forecast.expectedIncome, 1260)
    assert.equal(forecast.predictedNetSavings, 930)
    assert.equal(forecast.categories[0].overrun, 0)
})

test('does not invent spending when history is empty', () => {
    const forecast = buildForecast({ targetPeriod: '2026-11', expensesByPeriod: {}, incomeByPeriod: {}, fallbackIncome: 500 })
    assert.equal(forecast.hasHistory, false)
    assert.equal(forecast.predictedExpenses, 0)
    assert.equal(forecast.expectedIncome, 500)
})

test('preserves shortfalls and does not project ending cash without a known balance', () => {
    const forecast = buildForecast({
        targetPeriod: '2026-11',
        expensesByPeriod: { '2026-10': { Housing: 900 } },
        incomeByPeriod: { '2026-10': 500 },
        scheduledEmis: 100,
        completePeriods: [],
    })
    assert.equal(forecast.predictedNetSavings, -500)
    assert.equal(forecast.projectedEndingCash, null)
    assert.equal(forecast.categories[0].predicted, 900)
    assert.equal(forecast.categories[0].method, 'limited-history estimate')
})

test('uses current-period spending as a floor and includes a known starting cash balance', () => {
    const forecast = buildForecast({
        targetPeriod: '2026-11',
        expensesByPeriod: { '2026-08': { Food: 100 }, '2026-09': { Food: 200 }, '2026-10': { Food: 300 } },
        incomeByPeriod: { '2026-08': 1000, '2026-09': 1200, '2026-10': 1400 },
        currentExpenses: { Food: 400 },
        currentIncome: 1600,
        startingCash: 50,
        completePeriods: ['2026-08', '2026-09', '2026-10'],
    })
    assert.equal(forecast.predictedExpenses, 400)
    assert.equal(forecast.expectedIncome, 1600)
    assert.equal(forecast.projectedEndingCash, 1250)
})

test('subtracts recorded EMI payments separately from future scheduled EMIs', () => {
    const forecast = buildForecast({
        targetPeriod: '2026-11',
        expensesByPeriod: {},
        incomeByPeriod: {},
        fallbackIncome: 1000,
        paidEmis: 250,
        scheduledEmis: 300,
    })
    assert.equal(forecast.paidEmis, 250)
    assert.equal(forecast.scheduledEmis, 300)
    assert.equal(forecast.predictedNetSavings, 450)
})
