require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.js');
const debtRoutes = require('./routes/debts.js');
const userRoutes = require('./routes/users.js');

const { errorHandler } = require('./middleware/errorHandler.js');
const notFound = require('./middleware/notFound.js');

const { initializeDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT;

// Global middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/users', userRoutes);

// Health route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
    try {
        await initializeDatabase();
        console.log('Database initialized successfully');

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;