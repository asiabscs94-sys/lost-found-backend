const User = require('../models/User');

const normalizeString = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());

const allowedRoles = ['admin', 'staff'];

// @desc    Create admin/staff user
// @route   POST /api/admin/users
// @access  Admin only
exports.createPersonnelUser = async (req, res) => {
    try {
        const fullName = normalizeString(req.body?.fullName);
        const email = normalizeString(req.body?.email).toLowerCase();
        const password = normalizeString(req.body?.password);
        const role = normalizeString(req.body?.role);

        if (!fullName || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'fullName, email, password, role are required' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email' });
        }
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Role must be admin or staff' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const user = await User.create({
            fullName,
            email,
            password,
            role,
            isVerified: true
        });

        res.status(201).json({
            success: true,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    List admin/staff users
// @route   GET /api/admin/users
// @access  Admin only
exports.listPersonnelUsers = async (req, res) => {
    try {
        const users = await User.find({ role: { $in: allowedRoles } })
            .select('_id fullName email role isVerified createdAt')
            .sort({ createdAt: -1 })
            .limit(200);

        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update admin/staff user role or verification
// @route   PATCH /api/admin/users/:id
// @access  Admin only
exports.updatePersonnelUser = async (req, res) => {
    try {
        const { id } = req.params;
        const role = normalizeString(req.body?.role);
        const fullName = normalizeString(req.body?.fullName);
        const isVerifiedRaw = req.body?.isVerified;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!allowedRoles.includes(user.role)) {
            return res.status(400).json({ success: false, message: 'Only admin/staff users can be managed here' });
        }

        if (role) {
            if (!allowedRoles.includes(role)) {
                return res.status(400).json({ success: false, message: 'Role must be admin or staff' });
            }
            user.role = role;
        }

        if (fullName) {
            user.fullName = fullName;
        }

        if (isVerifiedRaw !== undefined) {
            user.isVerified = String(isVerifiedRaw) === 'true' || isVerifiedRaw === true;
        }

        await user.save();

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete admin/staff user
// @route   DELETE /api/admin/users/:id
// @access  Admin only
exports.deletePersonnelUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (String(req.user?._id) === String(id)) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!allowedRoles.includes(user.role)) {
            return res.status(400).json({ success: false, message: 'Only admin/staff users can be deleted here' });
        }

        await User.deleteOne({ _id: id });
        res.status(200).json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

