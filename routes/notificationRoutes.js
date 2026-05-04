const express = require('express');
const router = express.Router();
const { protect, personnel } = require('../config/authMiddleware');
const {
    getNotifications,
    updateNotification,
    markAllRead
} = require('../controllers/notificationController');

// Admin & Staff (protected)
router.get('/admin/notifications', protect, personnel, getNotifications);
router.patch('/admin/notifications/mark-all-read', protect, personnel, markAllRead);
router.patch('/admin/notifications/:id', protect, personnel, updateNotification);

module.exports = router;

