const mongoose = require('mongoose')

const blacklistSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: [true, "Token is required"]
        },
        expiresAt: { type: Date, required: true }
    },
    {
        timestamps: true
    }
)

blacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const Blacklist = mongoose.model('Blacklist', blacklistSchema)
module.exports = Blacklist