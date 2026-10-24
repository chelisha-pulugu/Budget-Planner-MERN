require('dotenv').config()
const app = require('./backend/src/app')
const connectToDB = require('./backend/src/config/database')

const PORT = Number(process.env.PORT) || 3000

async function startServer(){
    await connectToDB()
    app.listen(PORT,() =>{
        console.log(`Server is running on port ${PORT}`)
    })
}

startServer().catch((error) => {
    console.error("Failed to start server:", error)
    process.exitCode = 1
})
