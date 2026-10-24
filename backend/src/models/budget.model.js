const mongoose = require('mongoose')

const budgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    limit: { type: Number, required: true, min: 0 },
    period: { type: String, required: true, match: /^\d{4}-\d{2}$/ }
}, { timestamps: true })

budgetSchema.index({ userId: 1, category: 1, period: 1 }, { unique: true })

module.exports = mongoose.model('Budget', budgetSchema)
