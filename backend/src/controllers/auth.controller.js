const userModel = require('../models/user.model')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const Blacklist = require('../models/blacklist.model')  


async function registerUserController(req,res){
    const {username,email,password} = req.body || {}
    if(!String(username || '').trim() || !String(email || '').trim() || typeof password !== 'string' || password.length < 8 || password.length > 128){
        return res.status(400).json({
            message:"A name, valid email and password of at least 8 characters are required"
        })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ message: 'Enter a valid email address' })
    if (!process.env.JWT_SECRET) throw Object.assign(new Error('JWT_SECRET is not configured'), { statusCode: 500 })
    const normalizedUsername = username.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const isUserExists = await userModel.findOne({$or:[{username: normalizedUsername},{email: normalizedEmail}]})
    if(isUserExists){
        return res.status(400).json({
            message:"User already exists"
        })
    }
    const hash = await bcrypt.hash(password,10)
    const user = await userModel.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password:hash
    })
    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn:'1d'}
    )
    res.cookie("token",token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 })
    res.status(201).json({
        message:"User registered successfully",
        user:{
            id:user._id,
            username:user.username,
            email:user.email
        }
    })
}


async function loginUserController(req,res){
    const{email,password} = req.body || {};

    const user = await userModel.findOne({email: String(email || '').trim().toLowerCase()})
    if(!user){
        return res.status(400).json({
            message:"Invalid credentials"
        })
    }
    const isMatch = typeof password === 'string' && await bcrypt.compare(password,user.password)
    if(!isMatch){
        return res.status(400).json({
            message:"Invalid credentials"
        })
    }
    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn:'1d'}
    )
    res.cookie("token",token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 })
     return res.status(200).json({
        message:"User logged in successfully",
        user:{
            id:user._id,
            username:user.username,
            email:user.email
        }
    })
}

async function logoutUserController(req,res){
    const token = req.cookies.token
    if(token){
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        await Blacklist.create({token, expiresAt: new Date(decoded.exp * 1000)})
    }
    res.clearCookie("token", { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    res.status(200).json({
        message:"User logged out successfully"
    })
}

async function getMeController(req,res){
    const user = await userModel.findById(req.user.id)
    if (!user) {
        return res.status(404).json({ message: 'User not found' })
    }
    res.status(200).json({
        user:{
            id:user._id,
            username:user.username,
            email:user.email,
            financialProfile: user.financialProfile
        }
    })
}

async function getProfileController(req, res) {
    const user = await userModel.findById(req.user.id).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.status(200).json({ user })
}

async function updateProfileController(req, res) {
    const body = req.body || {}
    const updates = {}
    if (body.username !== undefined) {
        if (typeof body.username !== 'string' || !body.username.trim() || body.username.trim().length > 80) return res.status(400).json({ message: 'Name is invalid' })
        updates.username = body.username.trim()
    }
    if (body.financialProfile !== undefined) {
        const profile = body.financialProfile
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return res.status(400).json({ message: 'Financial profile is invalid' })
        const fields = ['currency', 'incomeType', 'expectedMonthlyIncome', 'savingsTarget', 'startingCash', 'householdType', 'householdSize', 'planningPreferences']
        const financialProfile = Object.fromEntries(Object.entries(profile).filter(([key]) => fields.includes(key)))
        for (const field of ['expectedMonthlyIncome', 'savingsTarget', 'startingCash']) {
            if (financialProfile[field] !== undefined && (!Number.isFinite(Number(financialProfile[field])) || Number(financialProfile[field]) < 0 || Math.round(Number(financialProfile[field]) * 100) !== Number(financialProfile[field]) * 100)) return res.status(400).json({ message: `${field} must be a non-negative amount with up to two decimals` })
        }
        if (financialProfile.householdSize !== undefined && (!Number.isInteger(Number(financialProfile.householdSize)) || Number(financialProfile.householdSize) < 1 || Number(financialProfile.householdSize) > 100)) return res.status(400).json({ message: 'householdSize must be a whole number from 1 to 100' })
        if (financialProfile.incomeType !== undefined && !['fixed', 'variable', 'mixed'].includes(financialProfile.incomeType)) return res.status(400).json({ message: 'incomeType is invalid' })
        for (const field of ['expectedMonthlyIncome', 'savingsTarget', 'startingCash', 'householdSize']) if (financialProfile[field] !== undefined) financialProfile[field] = Number(financialProfile[field])
        for (const field of fields) {
            if (financialProfile[field] !== undefined) updates[`financialProfile.${field}`] = financialProfile[field]
            else updates[`$unset`] = { ...(updates.$unset || {}), [`financialProfile.${field}`]: 1 }
        }
        if (financialProfile.currency !== undefined) {
            try { new Intl.NumberFormat('en', { style: 'currency', currency: financialProfile.currency }).format(0) }
            catch { return res.status(400).json({ message: 'currency must be a supported currency code' }) }
        }
    }
    const user = await userModel.findByIdAndUpdate(req.user.id, updates, { returnDocument: 'after', runValidators: true, context: 'query' }).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.status(200).json({ user })
}

module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController,
    getProfileController,
    updateProfileController
}
