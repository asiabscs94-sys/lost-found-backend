const mongoose = require('mongoose');

const claimRequestSchema = new mongoose.Schema({
    trackingId: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    identityProof: {
        type: String, // Path to the uploaded identity proof image
        required: true
    },
    matchingDescription: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ClaimRequest', claimRequestSchema);
