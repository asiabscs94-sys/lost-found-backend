const mongoose = require('mongoose');
const LostItem = require('./models/LostItem');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lost-and-found');
        console.log('Connected to DB');
        
        const itemCount = await LostItem.countDocuments();
        const userCount = await User.countDocuments();
        
        console.log(`Total Items: ${itemCount}`);
        console.log(`Total Users: ${userCount}`);
        
        if (itemCount > 0) {
            const lastItem = await LostItem.findOne().sort({ createdAt: -1 });
            console.log('Last Item:', JSON.stringify(lastItem, null, 2));
        }
        
        process.exit();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

checkDB();