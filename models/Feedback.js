const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: true
    },
    email: {
        type: String,
        trim: true,
        default: null
    },
    type: {
        type: String,
        enum: ['Bug Report', 'Suggestion', 'Complaint', 'General Feedback'],
        required: true
    },
    message: {
        type: String,
        trim: true,
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'resolved'],
        default: 'pending'
    },
    adminReply: {
        type: String,
        trim: true,
        default: null
    },
    isPublic: {
        type: Boolean,
        default: false,
        index: true
    },
    isSpam: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Feedback', feedbackSchema);
