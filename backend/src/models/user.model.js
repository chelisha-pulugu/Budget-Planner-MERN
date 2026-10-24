const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username:{
       type:String,
       required:true,
       trim: true,
       maxlength: 80,
       unique:[true,"Username already exists"], 
    },
    email:{
         type:String,   
         unique:[true,"Email already exists"],
         required:true,
         lowercase:true,
         trim:true,
    },
    password:{
        type:String,
        required:true,
    },
    financialProfile: {
        currency: { type: String, default: 'INR', trim: true, maxlength: 5 },
        incomeType: { type: String, enum: ['fixed', 'variable', 'mixed'], default: 'fixed' },
        expectedMonthlyIncome: { type: Number, min: 0 },
        savingsTarget: { type: Number, min: 0 },
        householdSize: { type: Number, min: 1, max: 100 },
        startingCash: { type: Number, min: 0 },
        householdType: { type: String, trim: true, maxlength: 60 },
        planningPreferences: { type: String, trim: true, maxlength: 500 }
    }
}, { timestamps: true })
const userModel = mongoose.model('User',userSchema)
module.exports = userModel
