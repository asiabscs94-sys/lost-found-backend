const express = require('express');
const router = express.Router();
const { protect, admin } = require('../config/authMiddleware');
const {
    submitFeedback,
    getPublicFeedback,
    getAllFeedback,
    updateFeedback,
    deleteFeedback
} = require('../controllers/feedbackController');

// Public
// POST /api/feedback
router.post('/feedback', submitFeedback);
// GET /api/feedback/public
router.get('/feedback/public', getPublicFeedback);

// Admin (protected)
// GET /api/admin/feedback
router.get('/admin/feedback', protect, admin, getAllFeedback);

// PATCH /api/admin/feedback/:id
router.patch('/admin/feedback/:id', protect, admin, updateFeedback);
// DELETE /api/admin/feedback/:id
router.delete('/admin/feedback/:id', protect, admin, deleteFeedback);

module.exports = router;
