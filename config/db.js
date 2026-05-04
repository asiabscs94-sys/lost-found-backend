const mongoose = require('mongoose');

const connectDB = async () => {
    const connOptions = {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    };

    const connectWithRetry = async () => {
        try {
            const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lost-and-found', connOptions);
            console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        } catch (error) {
            console.error(`❌ MongoDB Connection Error: ${error.message}`);
            console.log('🔄 Retrying in 5 seconds...');
            setTimeout(connectWithRetry, 5000);
        }
    };

    await connectWithRetry();

    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected! Attempting to reconnect...');
        connectWithRetry();
    });

    mongoose.connection.on('error', (err) => {
        console.error(`🔥 MongoDB connection error: ${err}`);
    });
};

module.exports = connectDB;
