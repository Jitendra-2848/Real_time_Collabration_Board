import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/google', authController.googleLogin);
router.get('/google/callback', authController.googleCallback);

export default router;
