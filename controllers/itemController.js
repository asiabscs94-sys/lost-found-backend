const LostItem = require('../models/LostItem');
const ClaimRequest = require('../models/ClaimRequest');
const ContactMessage = require('../models/ContactMessage');
const sendEmail = require('../config/email');
const Notification = require('../models/Notification');
const crypto = require('crypto');

// Report a lost item
exports.reportItem = async (req, res) => {
    try {
        const { fullName, email, phone, category, type, locationLost, description, airlineName, foundBy } = req.body;
        const image = req.file ? req.file.path : null;

        // Generate tracking ID and Case ID
        const trackingId = `TR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const caseId = `CASE-${Date.now().toString().slice(-6)}`;

        const newItemData = {
            trackingId,
            caseId,
            fullName,
            email,
            phoneNumber: phone || 'N/A',
            category,
            type,
            locationLost,
            description,
            airlineName: airlineName || '',
            foundBy: foundBy || 'User',
            image,
            dateLost: new Date(),
            timeline: [{
                status: 'Reported',
                message: 'Your lost item report has been logged in the corporate system.'
            }],
            auditLogs: [{
                action: 'Item Reported',
                performedBy: 'System/User'
            }]
        };

        const newItem = await LostItem.create(newItemData);
        console.log('✅ Item Stored in DB Successfully. ID:', newItem._id);

        // Admin notification (DB + realtime)
        try {
            const notif = await Notification.create({
                audience: 'personnel',
                type: 'report_created',
                title: 'New Lost Item Report',
                message: `New report received: ${caseId} (${category || 'Uncategorized'})`,
                data: {
                    trackingId,
                    caseId,
                    category,
                    type,
                    email,
                    fullName
                }
            });

            const io = req.app?.get('io');
            if (io) {
                io.to('personnel').emit('notification:new', {
                    _id: notif._id,
                    title: notif.title,
                    message: notif.message,
                    type: notif.type,
                    data: notif.data,
                    isRead: notif.isRead,
                    createdAt: notif.createdAt
                });
            }
        } catch (e) {
            console.log('⚠️ Notification create/emit failed:', e.message);
        }

        // Email Notification
        try {
            await sendEmail({
                email: email,
                subject: `Lost Item Logged - Case ${caseId}`,
                html: `<h3>Case Confirmation: ${caseId}</h3><p>Dear ${fullName},</p><p>Your lost item report has been received. Our team will review the details shortly.</p><p><b>Tracking ID:</b> ${trackingId}</p><p><b>Service Type:</b> ${type} ${airlineName ? `(${airlineName})` : ''}</p>`
            });
        } catch (err) { console.log('📧 Email Notification Failed (but item was saved)'); }

        res.status(201).json({
            success: true,
            message: 'Report submitted successfully!',
            trackingId,
            caseId
        });
    } catch (error) {
        console.error('❌ Report Submission Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Track item
exports.trackItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await LostItem.findOne({ trackingId: id });

        if (!item) {
            return res.status(404).json({ success: false, message: 'Case not found.' });
        }

        // Check retention policy
        if (new Date() > item.retentionDate && item.status !== 'Returned') {
            item.status = 'Archived';
            await item.save();
        }

        res.status(200).json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Admin: Update status with notes & audit
exports.updateItemStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, message, internalNote, assignedStaff } = req.body;
        
        const item = await LostItem.findOne({ trackingId: id });
        if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

        item.status = status;
        item.timeline.push({ status, message: message || `Status updated to ${status}` });
        
        if (internalNote) {
            item.internalNotes.push({ note: internalNote, author: req.user?.fullName || 'Administrator' });
        }
        
        if (assignedStaff) item.assignedStaff = assignedStaff;

        item.auditLogs.push({
            action: `Status updated to ${status}`,
            performedBy: req.user?.fullName || 'Administrator'
        });

        await item.save();

        // Notification on critical status
        if (status === 'Found' || status === 'Ready for Claim') {
            try {
                await sendEmail({
                    email: item.email,
                    subject: `Update on your Lost Item - ${item.caseId}`,
                    html: `<h3>Status Update: ${status}</h3><p>Good news! Your item has been ${status.toLowerCase()}. Please visit the tracking page for next steps.</p><p><b>Case ID:</b> ${item.caseId}</p>`
                });
            } catch (err) { console.log('Email failed'); }
        }

        res.status(200).json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Update full item details
exports.updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const item = await LostItem.findOneAndUpdate(
            { trackingId: id },
            { $set: updateData },
            { new: true }
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        item.auditLogs.push({
            action: 'Item details updated',
            performedBy: req.user?.fullName || 'Administrator'
        });
        await item.save();

        res.status(200).json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Delete item
exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await LostItem.findOneAndDelete({ trackingId: id });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }
        res.status(200).json({ success: true, message: 'Item deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Public: Get all found items for gallery
exports.getPublicFoundItems = async (req, res) => {
    try {
        console.log('📡 Fetching public found items...');
        const items = await LostItem.find({ 
            status: { $in: ['Found', 'Ready for Claim'] },
            foundBy: { $ne: 'User' }
        }).sort({ createdAt: -1 });
        console.log(`✅ Found ${items.length} public items.`);
        res.status(200).json({ success: true, items });
    } catch (error) {
        console.error('❌ Error fetching public items:', error.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Admin: Get Analytics Dashboard
exports.getAnalytics = async (req, res) => {
    try {
        console.log('📡 Generating analytics data...');
        const { timeframe, start, end, date } = req.query;
        const now = new Date();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const stats = {
            total: await LostItem.countDocuments(),
            airport: await LostItem.countDocuments({ type: 'Airport' }),
            airline: await LostItem.countDocuments({ type: 'Airline' }),
            pending: await LostItem.countDocuments({ status: 'Reported' }),
            found: await LostItem.countDocuments({ status: 'Found' }),
            returned: await LostItem.countDocuments({ status: 'Returned' }),
            pendingClaims: await ClaimRequest.countDocuments({ status: 'pending' }),
            today: {
                reported: await LostItem.countDocuments({ createdAt: { $gte: startOfToday } }),
                found: await LostItem.countDocuments({ status: 'Found', updatedAt: { $gte: startOfToday } }),
                returned: await LostItem.countDocuments({ status: 'Returned', updatedAt: { $gte: startOfToday } })
            }
        };
        
        const categories = await LostItem.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        console.log(`✅ Analytics generated. Total items: ${stats.total}`);
        res.status(200).json({ success: true, stats, categories });
    } catch (error) {
        console.error('❌ Analytics Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Common exports
exports.getAllItems = async (req, res) => {
    try {
        console.log('📡 Fetching all items from DB...');
        const items = await LostItem.find().sort({ createdAt: -1 });
        console.log(`✅ Found ${items.length} items.`);
        res.status(200).json({ success: true, items });
    } catch (error) {
        console.error('❌ Error fetching items:', error.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.claimItem = async (req, res) => {
    try {
        const { trackingId, matchingDescription } = req.body;
        const identityProof = req.file ? req.file.path : null;

        await ClaimRequest.create({ 
            trackingId, 
            identityProof, 
            matchingDescription,
            user: req.user ? req.user._id : null 
        });
        const item = await LostItem.findOneAndUpdate(
            { trackingId },
            { 
                $push: { 
                    timeline: { status: 'Under Review', message: 'Corporate verification in progress.' },
                    auditLogs: { action: 'Claim Submitted', performedBy: 'User' }
                } 
            },
            { new: true }
        );

        // Email Notification for Claim Submission
        if (item) {
            try {
                await sendEmail({
                    email: item.email,
                    subject: `Claim Request Submitted - ${item.caseId}`,
                    html: `<h3>Claim Submission Received</h3><p>Dear ${item.fullName},</p><p>We have received your claim request for Case ID: <b>${item.caseId}</b>. Our verification team is currently reviewing your identity proof and description.</p><p>You will be notified once the review is complete.</p>`
                });
            } catch (err) { console.log('📧 Claim Email Notification Failed'); }
        }

        res.status(201).json({ success: true, message: 'Claim submitted for verification.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllClaims = async (req, res) => {
    try {
        const claims = await ClaimRequest.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, claims });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.deleteClaimCase = async (req, res) => {
    try {
        const { id } = req.params;
        const claim = await ClaimRequest.findById(id);

        if (!claim) {
            return res.status(404).json({ success: false, message: 'Claim not found.' });
        }

        const deletedItem = await LostItem.findOneAndDelete({ trackingId: claim.trackingId });
        await ClaimRequest.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: 'Claim case deleted successfully.',
            deletedItem: Boolean(deletedItem)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateClaimStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const claim = await ClaimRequest.findById(id);
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

        claim.status = status;
        await claim.save();

        const item = await LostItem.findOne({ trackingId: claim.trackingId });

        if (status === 'approved') {
            await LostItem.findOneAndUpdate(
                { trackingId: claim.trackingId },
                { 
                    status: 'Ready for Claim',
                    $push: { 
                        timeline: { status: 'Verified', message: 'Identity verified. Item ready for pickup.' },
                        auditLogs: { action: 'Claim Approved', performedBy: req.user?.fullName || 'Administrator' }
                    } 
                }
            );

            // Notification for approval
            if (item) {
                try {
                    await sendEmail({
                        email: item.email,
                        subject: `Claim Approved! - ${item.caseId}`,
                        html: `<h3>Claim Approved</h3><p>Dear ${item.fullName},</p><p>Great news! Your claim request for Case ID: <b>${item.caseId}</b> has been approved. You can now proceed to collect your item.</p><p>Please bring your original identity proof for final verification at the pickup point.</p>`
                    });
                } catch (err) { console.log('📧 Approval Email Failed'); }
            }
        } else if (status === 'rejected') {
            await LostItem.findOneAndUpdate(
                { trackingId: claim.trackingId },
                { 
                    $push: { 
                        timeline: { status: 'Claim Rejected', message: 'Verification failed. Please contact support.' },
                        auditLogs: { action: 'Claim Rejected', performedBy: req.user?.fullName || 'Administrator' }
                    } 
                }
            );

            // Notification for rejection
            if (item) {
                try {
                    await sendEmail({
                        email: item.email,
                        subject: `Claim Update - ${item.caseId}`,
                        html: `<h3>Claim Request Update</h3><p>Dear ${item.fullName},</p><p>We regret to inform you that your claim request for Case ID: <b>${item.caseId}</b> could not be verified with the information provided.</p><p>If you believe this is an error, please contact our support team with additional details.</p>`
                    });
                } catch (err) { console.log('📧 Rejection Email Failed'); }
            }
        }

        res.status(200).json({ success: true, message: `Claim ${status} successfully.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.submitContact = async (req, res) => {
    try {
        const { fullName, email, subject, message } = req.body;
        const contactData = { ...req.body, user: req.user ? req.user._id : null };
        await ContactMessage.create(contactData);

        // Email Notification for Support Ticket
        try {
            await sendEmail({
                email: email,
                subject: `Support Ticket Received - ${subject}`,
                html: `<h3>Support Request Received</h3><p>Dear ${fullName},</p><p>Thank you for contacting us. We have received your message regarding "<b>${subject}</b>".</p><p>Our team will review your request and get back to you as soon as possible.</p><p><b>Message Preview:</b><br/>${message}</p>`
            });
        } catch (err) { console.log('📧 Contact Email Notification Failed'); }

        res.status(201).json({ success: true, message: 'Support ticket created.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getUserHistory = async (req, res) => {
    try {
        const items = await LostItem.find({ email: req.user.email }).sort({ createdAt: -1 });
        const claims = await ClaimRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
        const messages = await ContactMessage.find({ email: req.user.email }).sort({ createdAt: -1 });
        
        res.status(200).json({ 
            success: true, 
            history: {
                reports: items,
                claims: claims,
                messages: messages
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.uploadFoundItem = async (req, res) => {
    try {
        const { category, locationLost, description, type, airlineName, foundBy } = req.body;
        const image = req.file ? req.file.path : null;

        const trackingId = `TR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const caseId = `CASE-${Date.now().toString().slice(-6)}`;

        const newItem = await LostItem.create({
            trackingId,
            caseId,
            category,
            locationLost,
            description,
            type,
            airlineName,
            foundBy: foundBy || 'Corporate Admin',
            fullName: 'Corporate Found',
            email: 'admin@reclaimhub.pk',
            status: 'Found',
            image,
            timeline: [{ status: 'Found', message: 'Item uploaded to public gallery.' }],
            auditLogs: [{ action: 'Direct Gallery Upload', performedBy: req.user?.fullName || 'Administrator' }]
        });

        res.status(201).json({ success: true, item: newItem });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
