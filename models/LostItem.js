const mongoose = require('mongoose');

const lostItemSchema = new mongoose.Schema({
    trackingId: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional for legacy or guest reports
    },
    caseId: {
        type: String,
        unique: true
    },
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: false
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    dateLost: {
        type: Date,
        required: false,
        default: Date.now
    },
    locationLost: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['Airport', 'Airline'],
        required: true
    },
    airlineName: {
        type: String
    },
    image: {
        type: String
    },
    status: {
        type: String,
        enum: ['Reported', 'Under Review', 'Found', 'Ready for Claim', 'Returned', 'Archived'],
        default: 'Reported'
    },
    timeline: [
        {
            status: String,
            message: String,
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    internalNotes: [
        {
            note: String,
            author: String,
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    assignedStaff: {
        type: String
    },
    foundBy: {
        type: String
    },
    retentionDate: {
        type: Date,
        default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 days from now
    },
    auditLogs: [
        {
            action: String,
            performedBy: String,
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ]
}, {
    timestamps: true
});

module.exports = mongoose.model('LostItem', lostItemSchema);
