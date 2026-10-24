const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['income', 'expense', 'refund', 'transfer'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500 },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' }
}, { timestamps: true })

transactionSchema.index({ userId: 1, date: -1 })

module.exports = mongoose.model('Transaction', transactionSchema)
