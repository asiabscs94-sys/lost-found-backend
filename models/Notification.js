const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        audience: {
            type: String,
            enum: ['admin', 'personnel'],
            default: 'admin',
            index: true
        },
        type: {
            type: String,
            trim: true,
            default: 'report_created',
            index: true
        },
        title: {
            type: String,
            trim: true,
            required: true
        },
        message: {
            type: String,
            trim: true,
            required: true
        },
        data: {
            type: Object,
            default: {}
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true
        },
        readAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);

