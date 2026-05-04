const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../config/email');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

// Helper: Get Google Client
const getGoogleClient = () => {
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
};

// Helper: Generate Access Token
const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Helper: Generate Refresh Token
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

// Helper: Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper: Hash OTP
const hashOTP = (otp) => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};

// @desc    Signup Step 1: Send OTP
// @route   POST /api/auth/signup
exports.signup = async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`📡 Signup Step 1: Request for email ${email}`);

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const userExists = await User.findOne({ email });
        if (userExists && userExists.isVerified) {
            console.log(`⚠️ Signup: User ${email} already exists and is verified.`);
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const otp = generateOTP();
        const otpCodeHash = hashOTP(otp);
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins

        if (userExists) {
            console.log(`🔄 Signup: Updating OTP for unverified user ${email}`);
            userExists.otpCodeHash = otpCodeHash;
            userExists.otpExpiry = otpExpiry;
            await userExists.save();
        } else {
            console.log(`✨ Signup: Creating new unverified user ${email}`);
            await User.create({
                email,
                fullName: 'New User',
                password: crypto.randomBytes(20).toString('hex'),
                otpCodeHash,
                otpExpiry,
                isVerified: false
            });
        }

        console.log(`📧 Sending OTP ${otp} to ${email}`);
        
        // For development: Show OTP in console
        console.log('🔑 YOUR OTP CODE IS:', otp);
        
        let emailSent = true;
        try {
            await sendEmail({
                email,
                subject: 'Verify Your RECLAIM HUB Account',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; background-color: #ffffff;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="display: inline-block; padding: 12px; background-color: #002D56; border-radius: 12px;">
                                <span style="color: white; font-size: 24px; font-weight: bold;">RH</span>
                            </div>
                            <h1 style="color: #002D56; margin-top: 15px; font-size: 24px;">RECLAIM HUB</h1>
                        </div>
                        <h2 style="color: #1a202c; text-align: center; font-size: 20px;">Verify your identity</h2>
                        <p style="color: #4a5568; line-height: 1.6; text-align: center;">Welcome to the community! Use the code below to complete your registration. This code will expire in 10 minutes.</p>
                        <div style="background: #f7fafc; padding: 30px; text-align: center; border-radius: 12px; margin: 30px 0; border: 1px dashed #cbd5e0;">
                            <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #002D56; font-family: monospace;">${otp}</span>
                        </div>
                        <p style="color: #a0aec0; font-size: 13px; text-align: center;">If you didn't request this code, you can safely ignore this email.</p>
                        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;">
                        <p style="text-align: center; color: #718096; font-size: 12px;">© 2026 Reclaim Hub. Secure Recovery Network.</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.log('⚠️ Email send failed, but continuing for testing:', emailError.message);
            emailSent = false;
        }

        res.status(200).json({ success: true, message: 'Verification code sent to email' });
    } catch (error) {
        console.error(`🔥 Signup Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Signup Step 2: Verify OTP
// @route   POST /api/auth/verify-signup-otp
exports.verifySignupOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log(`📡 Signup Step 2: Verifying OTP for ${email}`);
        const hashedOtp = hashOTP(otp);

        const user = await User.findOne({ 
            email, 
            otpCodeHash: hashedOtp, 
            otpExpiry: { $gt: Date.now() } 
        });

        if (!user) {
            console.log(`❌ Signup Step 2: Invalid or expired OTP for ${email}`);
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        console.log(`✅ Signup Step 2: OTP verified for ${email}`);
        res.status(200).json({ success: true, message: 'OTP verified' });
    } catch (error) {
        console.error(`🔥 Verify OTP Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Signup Step 3: Complete Signup
// @route   POST /api/auth/complete-signup
exports.completeSignup = async (req, res) => {
    try {
        const { email, username, password, fullName } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
            return res.status(400).json({ success: false, message: 'Username already taken' });
        }

        user.username = username;
        user.password = password;
        user.fullName = fullName || username;
        user.isVerified = true;
        user.otpCodeHash = undefined;
        user.otpExpiry = undefined;
        
        const refreshToken = generateRefreshToken(user._id);
        
        // Manage refresh tokens (limit to 5 devices)
        if (!user.refreshTokens) user.refreshTokens = [];
        user.refreshTokens.push(refreshToken);
        if (user.refreshTokens.length > 5) user.refreshTokens.shift();
        
        await user.save();

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(201).json({
            success: true,
            token: generateAccessToken(user._id),
            user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login
// @route   POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            return res.status(401).json({ success: false, message: 'Please verify your email first', notVerified: true });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Manage refresh tokens (limit to 5 devices)
        if (!user.refreshTokens) user.refreshTokens = [];
        user.refreshTokens.push(refreshToken);
        if (user.refreshTokens.length > 5) user.refreshTokens.shift();
        
        await user.save();

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            token: accessToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Google Login/Signup
// @route   POST /api/auth/google-login
exports.googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        console.log('📡 Google Login: Received request with ID Token');
        
        if (!idToken) {
            console.log('❌ Google Login: No ID Token provided');
            return res.status(400).json({ success: false, message: 'Google ID Token is required' });
        }

        const googleClient = getGoogleClient();
        let ticket;
        try {
            ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });
        } catch (verifyError) {
            console.error('❌ Google Token Verification Failed:', verifyError.message);
            return res.status(401).json({ success: false, message: 'Invalid Google Token' });
        }

        const payload = ticket.getPayload();
        const { email, name, sub: googleId, picture } = payload;
        console.log(`✅ Google Auth: Verified email ${email}`);

        if (!email) {
            console.log('❌ Google Auth: No email in payload');
            return res.status(400).json({ success: false, message: 'Email not provided by Google' });
        }

        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        const isNewUser = !user;

        if (user) {
            console.log(`🔄 Google Auth: Found existing user ${email}. Updating info.`);
            if (!user.googleId) user.googleId = googleId;
            if (!user.authProvider || user.authProvider === 'local') user.authProvider = 'google';
            if (!user.avatar) user.avatar = picture;
            user.isVerified = true;
            await user.save();
            
            const accessToken = generateAccessToken(user._id);
            const refreshToken = generateRefreshToken(user._id);

            if (!user.refreshTokens) user.refreshTokens = [];
            user.refreshTokens.push(refreshToken);
            if (user.refreshTokens.length > 5) user.refreshTokens.shift();
            await user.save();

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            console.log(`🚀 Google Login Success for existing user ${email}`);
            res.status(200).json({
                success: true,
                needsProfileSetup: false,
                token: accessToken,
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                    isVerified: user.isVerified
                }
            });
        } else {
            console.log(`✨ Google Auth: New user ${email} - needs profile setup`);
            
            user = await User.create({
                email,
                fullName: '',
                username: '',
                googleId,
                authProvider: 'google',
                isVerified: true,
                avatar: picture,
                password: crypto.randomBytes(20).toString('hex')
            });

            const tempToken = generateAccessToken(user._id);
            
            res.status(200).json({
                success: true,
                needsProfileSetup: true,
                tempToken,
                user: {
                    id: user._id,
                    email: user.email,
                    avatar: user.avatar,
                    isVerified: user.isVerified
                }
            });
        }
    } catch (error) {
        console.error('🔥 Google Login Internal Error:', error.message);
        res.status(500).json({ success: false, message: 'Google authentication failed' });
    }
};

// @desc    Complete Google Profile Setup
// @route   POST /api/auth/complete-google-profile
exports.completeGoogleProfile = async (req, res) => {
    try {
        const { userId, username, fullName } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
            return res.status(400).json({ success: false, message: 'Username already taken' });
        }

        user.username = username;
        user.fullName = fullName || username;

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        if (!user.refreshTokens) user.refreshTokens = [];
        user.refreshTokens.push(refreshToken);
        if (user.refreshTokens.length > 5) user.refreshTokens.shift();

        await user.save();

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            token: accessToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const otp = generateOTP();
        user.otpCodeHash = hashOTP(otp);
        user.otpExpiry = Date.now() + 10 * 60 * 1000;
        await user.save();

        await sendEmail({
            email,
            subject: 'Reset Your RECLAIM HUB Password',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="display: inline-block; padding: 12px; background-color: #002D56; border-radius: 12px;">
                            <span style="color: white; font-size: 24px; font-weight: bold;">RH</span>
                        </div>
                        <h1 style="color: #002D56; margin-top: 15px; font-size: 24px;">RECLAIM HUB</h1>
                    </div>
                    <h2 style="color: #1a202c; text-align: center; font-size: 20px;">Password Reset Request</h2>
                    <p style="color: #4a5568; line-height: 1.6; text-align: center;">We received a request to reset your password. Use the verification code below to proceed.</p>
                    <div style="background: #fff5f5; padding: 30px; text-align: center; border-radius: 12px; margin: 30px 0; border: 1px solid #feb2b2;">
                        <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #c53030; font-family: monospace;">${otp}</span>
                    </div>
                    <p style="color: #a0aec0; font-size: 13px; text-align: center;">This code will expire in 10 minutes. If you did not request this, please change your password immediately.</p>
                    <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;">
                    <p style="text-align: center; color: #718096; font-size: 12px;">© 2026 Reclaim Hub. Secure Recovery Network.</p>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Reset code sent to email' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const hashedOtp = hashOTP(otp);

        const user = await User.findOne({ 
            email, 
            otpCodeHash: hashedOtp, 
            otpExpiry: { $gt: Date.now() } 
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });
        }

        user.password = newPassword;
        user.otpCodeHash = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Logout
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const user = await User.findOne({ refreshTokens: refreshToken });
            if (user) {
                user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
                await user.save();
            }
        }
        res.clearCookie('refreshToken');
        res.status(200).json({ success: true, message: 'Logged out' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh-token
exports.refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) return res.status(401).json({ success: false });

        const user = await User.findOne({ refreshTokens: refreshToken });
        if (!user) return res.status(403).json({ success: false });

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
            if (err || user._id.toString() !== decoded.id) return res.status(403).json({ success: false });

            const accessToken = generateAccessToken(user._id);
            res.json({ success: true, token: accessToken });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
    try {
        const { fullName } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (fullName) user.fullName = fullName;
        await user.save();
        
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Avatar
// @route   PUT /api/auth/update-avatar
exports.updateAvatar = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (req.file) {
            user.avatar = `/uploads/${req.file.filename}`;
            await user.save();
        }
        
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Change Password
// @route   PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // First try plain text match
        let isMatch = currentPassword === user.password;
        
        // If not, try bcrypt match
        if (!isMatch) {
            try {
                isMatch = await bcrypt.compare(currentPassword, user.password);
            } catch (e) {
                isMatch = false;
            }
        }
        
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Set Password (for Google users who don't have one yet)
// @route   PUT /api/auth/set-password
exports.setPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Set password
        user.password = newPassword;
        user.authProvider = 'local'; // Optional: switch to local auth
        await user.save();
        
        res.status(200).json({ success: true, message: 'Password set successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Remove Avatar
// @route   DELETE /api/auth/remove-avatar
exports.removeAvatar = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        user.avatar = null;
        await user.save();
        
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};