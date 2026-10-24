const { Router } = require('express')
const authController = require('../controllers/auth.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const authRouter = Router()

authRouter.post('/register', authController.registerUserController)

authRouter.post('/login', authController.loginUserController)

authRouter.get('/logout', authMiddleware.authUser, authController.logoutUserController)
authRouter.post('/logout', authMiddleware.authUser, authController.logoutUserController)

authRouter.get('/get-me', authMiddleware.authUser, authController.getMeController)
authRouter.get('/profile', authMiddleware.authUser, authController.getProfileController)
authRouter.put('/profile', authMiddleware.authUser, authController.updateProfileController)


module.exports = authRouter
