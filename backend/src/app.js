const express = require('express');
const cookieParser = require('cookie-parser')
const path = require('path')


const app = express()

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' })
})


const authRouter = require('./routes/auth.routes')
const financeRouter = require('./routes/finance.routes')

app.use('/api/auth',authRouter)
app.use('/api', financeRouter)

if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.resolve(__dirname, '../../dist')
    app.use(express.static(frontendDist, { index: false }))
    app.get('/{*path}', (req, res, next) => {
        if (req.path === '/health' || req.path === '/api' || req.path.startsWith('/api/')) return next()
        res.sendFile(path.join(frontendDist, 'index.html'), error => {
            if (error) next(error)
        })
    })
}

app.use((error, req, res, next) => {
    console.error(error)
    if (res.headersSent) return next(error)
    const status = error.statusCode || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : error.code === 11000 ? 409 : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500)
    const message = status < 500
        ? (error.name === 'ValidationError' ? 'One or more fields are invalid' : error.code === 11000 ? 'A record with these details already exists' : error.message)
        : 'Internal server error'
    res.status(status).json({ message })
})




module.exports = app
