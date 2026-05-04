const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Load environment variables immediately
dotenv.config();

const connectDB = require('./config/db');
const itemRoutes = require('./routes/itemRoutes');
const authRoutes = require('./routes/authRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');

// Connect to Database
connectDB();

const app = express();
const httpServer = http.createServer(app);

const corsOptions = {
    origin: true,
    credentials: true
};

const io = new Server(httpServer, { cors: corsOptions });

app.set('io', io);

// Security Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());

// Global Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Auth Rate Limiter (More strict)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 auth requests per 15 mins for testing
    message: { success: false, message: 'Too many attempts, please try again in 15 minutes.' }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url}`);
    next();
});

io.on('connection', (socket) => {
    socket.on('join', ({ role }) => {
        if (role === 'admin' || role === 'staff') {
            socket.join('personnel');
        }
    });
});

// Serve static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// Routes
app.use('/api', itemRoutes);
app.use('/api/auth', authLimiter, authRoutes); // Apply strict limiter to auth routes
app.use('/api', feedbackRoutes);
app.use('/api', notificationRoutes);
app.use('/api', adminUserRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🔥 Global Error Handler:', err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running.' });
});

// Root route
app.get('/', (req, res) => {
    res.status(200).send('<h1>RECLAIM HUB API is Running</h1><p>Frontend is on port 5173</p>');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error(`🔥 Unhandled Rejection: ${err.message}`);
    // We don't necessarily want to exit, but we want to log it
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error(`🔥 Uncaught Exception: ${err.message}`);
    console.error(err.stack);
    // Graceful shutdown on uncaught exception
    process.exit(1);
});

const PORT = process.env.PORT || 5000;

// Admin Seeding & Background Tasks
const User = require('./models/User');
const LostItem = require('./models/LostItem');

const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@reunitely.com';
        const adminExists = await User.findOne({ email: adminEmail });
        if (!adminExists) {
            await User.create({
                fullName: 'System Administrator',
                email: adminEmail,
                password: 'admin123', // User can change this later
                role: 'admin',
                isVerified: true
            });
            console.log('✅ Permanent Admin Account Created: admin@reunitely.com');
        }
    } catch (err) {
        console.error('❌ Admin Seeding Failed:', err.message);
    }
};

const runRetentionPolicy = async () => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await LostItem.updateMany(
            { 
                createdAt: { $lt: thirtyDaysAgo }, 
                status: { $ne: 'Returned' },
                status: { $ne: 'Archived' }
            },
            { 
                $set: { status: 'Archived' },
                $push: { 
                    timeline: { status: 'Archived', message: 'Item archived due to 30-day retention policy.' },
                    auditLogs: { action: 'Auto-Archived', performedBy: 'System' }
                }
            }
        );
        if (result.modifiedCount > 0) {
            console.log(`📦 Retention Policy: ${result.modifiedCount} items archived.`);
        }
    } catch (err) {
        console.error('❌ Retention Policy Error:', err.message);
    }
};

const runEscalationSystem = async () => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const result = await LostItem.updateMany(
            { 
                status: 'Reported',
                createdAt: { $lt: sevenDaysAgo }
            },
            { 
                $set: { status: 'Under Review' },
                $push: { 
                    timeline: { status: 'Escalated', message: 'Case escalated for priority review.' },
                    auditLogs: { action: 'Escalated', performedBy: 'System' }
                }
            }
        );
        if (result.modifiedCount > 0) {
            console.log(`🚀 Escalation System: ${result.modifiedCount} cases escalated.`);
        }
    } catch (err) {
        console.error('❌ Escalation Error:', err.message);
    }
};

const seedInitialData = async () => {
    try {
        const itemExists = await LostItem.findOne();
        if (!itemExists) {
            await LostItem.create({
                trackingId: 'TR-SAMPLE123',
                caseId: 'CASE-000001',
                fullName: 'Sample User',
                email: 'sample@example.com',
                phoneNumber: '03001234567',
                category: 'Electronics',
                description: 'Sample item to initialize database',
                dateLost: new Date(),
                locationLost: 'Jinnah International (KHI)',
                type: 'Airport',
                status: 'Reported',
                timeline: [{ status: 'Reported', message: 'System Initialized' }],
                auditLogs: [{ action: 'System Seeding', performedBy: 'System' }]
            });
            console.log('📦 Sample Data Created to initialize MongoDB');
        }
    } catch (err) {
        console.error('❌ Initial Seeding Failed:', err.message);
    }
};

const server = httpServer.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await seedAdmin();
    await seedInitialData();
    // Run background tasks every hour
    setInterval(() => {
        runRetentionPolicy();
        runEscalationSystem();
    }, 60 * 60 * 1000);
    // Run immediately on start
    runRetentionPolicy();
    runEscalationSystem();
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please kill the process or use a different port.`);
        process.exit(1);
    } else {
        console.error(`🔥 Server Error: ${err.message}`);
    }
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Process terminated!');
        mongoose.connection.close(false, () => {
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Process terminated!');
        mongoose.connection.close(false, () => {
            process.exit(0);
        });
    });
});