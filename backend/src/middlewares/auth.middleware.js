const jwt = require("jsonwebtoken")
const Blacklist = require("../models/blacklist.model")


async function authUser(req,res,next){
    const token = req.cookies.token
    if(!token){
        return res.status(401).json({
            message:"Unauthorized"
        })
    }
    
    const isBlacklisted = await Blacklist.findOne({token})
    if(isBlacklisted){
        return res.status(401).json({
            message:"Token is blacklisted "
        })
    }
    try{
        const decoded = jwt.verify(token,process.env.JWT_SECRET)
        req.user = decoded
        next()  
    }catch(error){
        return res.status(401).json({
            message:"Unauthorized"
        })
    }
}
 module.exports = {authUser}
