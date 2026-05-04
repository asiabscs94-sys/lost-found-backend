const Feedback = require('../models/Feedback');
const sendEmail = require('../config/email');

const FEEDBACK_TYPES = ['Bug Report', 'Suggestion', 'Complaint', 'General Feedback'];

const isValidEmail = (email) => {
    if (!email) return true;
    // pragmatic validation (avoids over-rejecting legitimate emails)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

const normalizeString = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const parseBoolean = (value) => {
    if (value === true || value === false) return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
};

// @desc    Submit feedback
// @route   POST /api/feedback
// @access  Public
exports.submitFeedback = async (req, res) => {
    try {
        const name = normalizeString(req.body?.name);
        const email = normalizeString(req.body?.email);
        const type = normalizeString(req.body?.type);
        const message = normalizeString(req.body?.message);
        const ratingRaw = req.body?.rating;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        if (!type || !message) {
            return res.status(400).json({ success: false, message: 'Feedback type and message are required' });
        }

        if (!FEEDBACK_TYPES.includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid feedback type' });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }

        let rating = null;
        if (ratingRaw !== undefined && ratingRaw !== null && ratingRaw !== '') {
            const parsed = Number(ratingRaw);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
                return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
            }
            rating = parsed;
        }

        const feedback = await Feedback.create({
            name,
            email: email || null,
            type,
            message,
            rating,
            isPublic: true
        });

        res.status(201).json({ success: true, message: 'Feedback submitted successfully', feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get public feedback (testimonials)
// @route   GET /api/feedback/public
// @access  Public
exports.getPublicFeedback = async (req, res) => {
    try {
        const type = normalizeString(req.query?.type);
        const sort = normalizeString(req.query?.sort) || 'latest';
        const minRatingRaw = req.query?.minRating;

        const filter = {
            isPublic: true,
            isSpam: { $ne: true }
        };

        if (type && FEEDBACK_TYPES.includes(type)) filter.type = type;

        if (minRatingRaw !== undefined && minRatingRaw !== null && minRatingRaw !== '') {
            const parsed = Number(minRatingRaw);
            if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
                return res.status(400).json({ success: false, message: 'minRating must be between 1 and 5' });
            }
            filter.rating = { $gte: parsed };
        }

        let sortObj = { createdAt: -1 };
        if (sort === 'highest') sortObj = { rating: -1, createdAt: -1 };

        const feedback = await Feedback.find(filter).sort(sortObj).limit(200);
        res.status(200).json({ success: true, feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all feedback
// @route   GET /api/admin/feedback
// @access  Admin only
exports.getAllFeedback = async (req, res) => {
    try {
        const { type, status, isPublic, isSpam } = req.query;
        let filter = {};

        if (type && FEEDBACK_TYPES.includes(String(type))) filter.type = String(type);
        if (status && ['pending', 'resolved'].includes(String(status))) filter.status = String(status);
        const isPublicBool = parseBoolean(isPublic);
        const isSpamBool = parseBoolean(isSpam);
        if (isPublicBool !== undefined) filter.isPublic = isPublicBool;
        if (isSpamBool !== undefined) filter.isSpam = isSpamBool;

        const feedback = await Feedback.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update feedback (status or reply)
// @route   PATCH /api/admin/feedback/:id
// @access  Admin only
exports.updateFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const status = normalizeString(req.body?.status);
        const adminReply = normalizeString(req.body?.adminReply);
        const isPublic = parseBoolean(req.body?.isPublic);
        const isSpam = parseBoolean(req.body?.isSpam);

        const feedback = await Feedback.findById(id);

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        if (status) {
            if (!['pending', 'resolved'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid status' });
            }
            feedback.status = status;
        }

        if (adminReply) {
            feedback.adminReply = adminReply;
            feedback.status = 'resolved';

            // Send email to user if email is provided
            if (feedback.email) {
                try {
                    await sendEmail({
                        email: feedback.email,
                        subject: 'Your Feedback Has Been Reviewed',
                        html: `
                            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; background-color: #ffffff;">
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <div style="display: inline-block; padding: 12px; background-color: #002D56; border-radius: 12px;">
                                        <span style="color: white; font-size: 24px; font-weight: bold;">RH</span>
                                    </div>
                                    <h1 style="color: #002D56; margin-top: 15px; font-size: 24px;">RECLAIM HUB</h1>
                                </div>
                                <h2 style="color: #1a202c; text-align: center; font-size: 20px;">Your Feedback Has Been Reviewed</h2>
                                <p style="color: #4a5568; line-height: 1.6; text-align: center;">Hello ${feedback.name || 'User'},</p>
                                <p style="color: #4a5568; line-height: 1.6; margin-top: 20px;">Thank you for your feedback! Our team has reviewed it and has the following reply:</p>
                                <div style="background: #f7fafc; padding: 30px; text-align: left; border-radius: 12px; margin: 30px 0; border: 1px dashed #cbd5e0;">
                                    <p style="color: #002D56; font-size: 16px; font-weight: 500; line-height: 1.8;">${adminReply}</p>
                                </div>
                                <p style="color: #a0aec0; font-size: 13px; text-align: center; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
                                <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;">
                                <p style="text-align: center; color: #718096; font-size: 12px;">© 2026 Reclaim Hub. Secure Recovery Network.</p>
                            </div>
                        `
                    });
                } catch (emailError) {
                    console.log('⚠️ Failed to send feedback reply email:', emailError.message);
                }
            }
        }

        if (isPublic !== undefined) feedback.isPublic = isPublic;
        if (isSpam !== undefined) feedback.isSpam = isSpam;

        await feedback.save();
        res.status(200).json({ success: true, message: 'Feedback updated successfully', feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete feedback
// @route   DELETE /api/admin/feedback/:id
// @access  Admin only
exports.deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await Feedback.findById(id);
        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }
        await Feedback.deleteOne({ _id: id });
        res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
