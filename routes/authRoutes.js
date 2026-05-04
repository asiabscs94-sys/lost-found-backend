const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../config/authMiddleware');
const {
    signup,
    verifySignupOTP,
    completeSignup,
    login,
    googleLogin,
    forgotPassword,
    resetPassword,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    setPassword,
    updateAvatar,
    removeAvatar
} = require('../controllers/authController');

// Multer configuration for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `avatar-${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Error: Images Only!');
        }
    }
});

// Signup flow
router.post('/signup', signup);
router.post('/verify-signup-otp', verifySignupOTP);
router.post('/complete-signup', completeSignup);

// Login flow
router.post('/login', login);
router.post('/google-login', googleLogin);

// Password recovery
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Session management
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);

// Profile management
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.put('/set-password', protect, setPassword);
router.put('/update-avatar', protect, upload.single('avatar'), updateAvatar);
router.delete('/remove-avatar', protect, removeAvatar);

module.exports = router;