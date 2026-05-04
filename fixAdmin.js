const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const fixAdminAccount = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lost-and-found');
        
        const email = 'asia68751@gmail.com';
        const password = 'AAaa12@#';
        
        let user = await User.findOne({ email });
        
        if (user) {
            // Update existing user
            user.password = password; // Will be hashed by pre-save middleware
            user.role = 'admin';
            user.isVerified = true;
            await user.save();
            console.log('✅ Admin account updated successfully!');
        } else {
            // Create new admin
            await User.create({
                fullName: 'Asia Admin',
                email,
                password,
                role: 'admin',
                isVerified: true
            });
            console.log('✅ Admin account created successfully!');
        }
        
        process.exit();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

fixAdminAccount();
