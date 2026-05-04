const Notification = require('../models/Notification');

const normalizeString = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

// @desc    Get notifications for admin/staff
// @route   GET /api/admin/notifications
// @access  Admin/Staff
exports.getNotifications = async (req, res) => {
    try {
        const limitRaw = req.query?.limit;
        const onlyUnreadRaw = req.query?.unread;

        const limit = Math.min(Math.max(Number(limitRaw) || 25, 1), 200);
        const onlyUnread = String(onlyUnreadRaw) === 'true';

        const audience = req.user?.role === 'admin' ? ['admin', 'personnel'] : ['personnel'];
        const filter = { audience: { $in: audience } };
        if (onlyUnread) filter.isRead = false;

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit);

        const unreadCount = await Notification.countDocuments({
            ...filter,
            isRead: false
        });

        res.status(200).json({ success: true, notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark a notification read/unread
// @route   PATCH /api/admin/notifications/:id
// @access  Admin/Staff
exports.updateNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const isReadRaw = req.body?.isRead;

        if (isReadRaw === undefined) {
            return res.status(400).json({ success: false, message: 'isRead is required' });
        }

        const isRead = String(isReadRaw) === 'true' || isReadRaw === true;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        const allowedAudience = req.user?.role === 'admin' ? ['admin', 'personnel'] : ['personnel'];
        if (!allowedAudience.includes(notification.audience)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        notification.isRead = isRead;
        notification.readAt = isRead ? new Date() : null;
        await notification.save();

        res.status(200).json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/admin/notifications/mark-all-read
// @access  Admin/Staff
exports.markAllRead = async (req, res) => {
    try {
        const audience = req.user?.role === 'admin' ? ['admin', 'personnel'] : ['personnel'];
        const result = await Notification.updateMany(
            { audience: { $in: audience }, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );
        res.status(200).json({ success: true, modifiedCount: result.modifiedCount || 0 });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

