const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const authRoutes = require('./routes/authRoutes');
const cafeRoutes = require('./routes/cafeRoutes');
const couponRoutes = require('./routes/couponRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const initDatabase = require('./config/initDb');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing
app.use('/api/auth', authRoutes);
app.use('/api/cafe', cafeRoutes);
app.use('/api/coupon', couponRoutes);
app.use('/api/transaction', transactionRoutes);

// Health check and root route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Cafe Loyalty PWA API Server',
        status: 'running',
        version: '1.0.0'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
        success: false,
        message: 'An internal server error occurred'
    });
});

// Start the server
(async () => {
    try {
        await initDatabase();
    } catch (e) {
        console.error('Failed to run schema init:', e);
    }

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
})();

module.exports = app;
