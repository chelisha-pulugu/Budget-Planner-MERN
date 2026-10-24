const mongoose = require('mongoose')

const loanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, required: true, trim: true, maxlength: 50 },
    lender: { type: String, trim: true, maxlength: 100 },
    principal: { type: Number, required: true, min: 0 },
    outstandingPrincipal: { type: Number, required: true, min: 0 },
    interestRate: { type: Number, min: 0, default: 0 },
    emiAmount: { type: Number, required: true, min: 0 },
    nextDueDate: { type: Date, required: true },
    dueDay: { type: Number, min: 1, max: 31 },
    remainingInstallments: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['active', 'closed', 'overdue'], default: 'active' },
    payments: [{
        amount: { type: Number, required: true, min: 0.01 },
        principalPaid: { type: Number, required: true, min: 0 },
        paymentDate: { type: Date, required: true },
        notes: { type: String, trim: true, maxlength: 300 }
    }]
}, { timestamps: true })

module.exports = mongoose.model('Loan', loanSchema)
