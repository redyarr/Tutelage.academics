// ============================================================================
// TUTELAGE ACADEMICS - BACKEND SERVER
// ============================================================================
// Main application server for the Tutelage Academics platform
// Handles authentication, content management, and API endpoints

// Core Dependencies
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
// const SequelizeStore = require('connect-session-sequelize')(session.Store);
const path = require('path');

// Environment Configuration
// Ensure we always load the backend/.env regardless of where the server starts
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Database Models
const { sequelize } = require('./models');

// Route modules
const videoRoutes = require('./routes/videos');
const blogRoutes = require('./routes/blogs');
const audioRoutes = require('./routes/audios');
const speakingRoutes = require('./routes/speakings');
const writingRoutes = require('./routes/writings');
const readingRoutes = require('./routes/readings');
const courseRoutes = require('./routes/courses');
const testRoutes = require('./routes/tests');
const faqRoutes = require('./routes/faqs');
const appointmentRoutes = require('./routes/appointments');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const enrollmentRoutes = require('./routes/enrollment');
const landingSectionRoutes = require('./routes/landingSections');
const storyRoutes = require('./routes/stories');
const tagRoutes = require('./routes/tags');
const analyticsRoutes = require('./routes/analytics');
const eslVideoRoutes = require('./routes/eslVideos');
const eslAudioRoutes = require('./routes/eslAudios');
const eslResourcesRoutes = require('./routes/eslResources');
const taskPdfRoutes = require('./routes/taskPdfs');
const adminQuizRoutes = require('./routes/adminQuiz');
const quizRoutes = require('./routes/quiz');
const searchRoutes = require('./routes/search');
const pdfProxyRoutes = require('./routes/pdfProxy');
const statsRoutes = require('./routes/stats');
const websiteAnalyticsRoutes = require('./routes/websiteAnalytics');
const approvalsRoutes = require('./routes/approvals');


// ============================================================================
// EXPRESS APPLICATION SETUP
// ============================================================================

const app = express();
// Trust first proxy (e.g., Nginx/Cloudflare) so secure cookies work
// when TLS terminates at the proxy and X-Forwarded-* headers are present.
app.set('trust proxy', 1);
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''); // Remove trailing slash
const SERVER_PORT = process.env.PORT || 3001;

// Toggle database initialization based on environment variables
// If critical DB envs are missing or SKIP_DB=true, we will still start the server
// so routes that don’t require the DB (e.g., YouTube resolve) can be tested.
const SHOULD_SKIP_DB = (
  String(process.env.SKIP_DB).toLowerCase() === 'true' ||
  !(
    process.env.DB_HOST &&
    process.env.DB_PORT &&
    process.env.DB_NAME &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD
  )
);

// ============================================================================
// CORS CONFIGURATION
// ============================================================================
// Configure Cross-Origin Resource Sharing for frontend communication

app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-Refresh-Token']
}));

// Additional CORS headers for complex requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', FRONTEND_URL);
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

app.use(cookieParser());

// Session store configuration - USING MEMORY STORE FOR NOW
// const sessionStore = new SequelizeStore({
//   db: sequelize,
//   tableName: 'Sessions',
//   checkExpirationInterval: 15 * 60 * 1000, // Check every 15 minutes
//   expiration: 24 * 60 * 60 * 1000 // 24 hours
// });

// Session configuration - USING MEMORY STORE
const SESSION_CONFIG = {
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  // store: sessionStore, // COMMENTED OUT - using default memory store
  resave: false,
  saveUninitialized: false,
  // Trust reverse proxy for secure cookie handling in production
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  },
  name: 'tutelage.sid' // Custom session identifier
};

app.use(session(SESSION_CONFIG));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' })); // JSON parser with size limit
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // URL-encoded parser

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/videos', videoRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/audios', audioRoutes);
app.use('/api/speakings', speakingRoutes);
app.use('/api/writings', writingRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/landing-sections', landingSectionRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/esl-videos', eslVideoRoutes);
app.use('/api/esl-audios', eslAudioRoutes);
app.use('/api/esl-resources', eslResourcesRoutes);  // Mixed ESL resources
app.use('/api/task-pdfs', taskPdfRoutes);
app.use('/api/admin/quiz', adminQuizRoutes);  // Admin quiz management
app.use('/api/quiz', quizRoutes);             // Public quiz endpoints (frontend)
app.use('/api/search', searchRoutes);
app.use('/api/pdf', pdfProxyRoutes);          // PDF proxy for inline viewing
app.use('/api/stats', statsRoutes);           // Dashboard statistics
app.use('/api/website-analytics', websiteAnalyticsRoutes); // Google Analytics data
app.use('/api/approvals', approvalsRoutes);               // Admin approvals workflow

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Tutelage Academics Backend Server is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  });
});

// Health check endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    database: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Global error handler (add this before server initialization)
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});



// ============================================================================
// SERVER INITIALIZATION - SIMPLIFIED WITHOUT DATABASE
// ============================================================================

/**
 * Initialize the server with database connection
 */
const initializeServer = async () => {
    try {
        console.log('🔄 Initializing Tutelage Academics Server...');
        
        if (!SHOULD_SKIP_DB) {
            // Test database connection
            console.log('🔗 Connecting to database...');
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully');

            // Sync database models (create tables if they don't exist)
            console.log('🔄 Synchronizing database models...');
            await sequelize.sync({ alter: false }); // Keep alter disabled; use migration script for schema changes
            console.log('✅ Database models synchronized successfully');
        } else {
            console.warn('⚠️  Skipping database initialization (dev mode). Some endpoints will be unavailable.');
        }
        
        // Start the Express server
        app.listen(SERVER_PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 TUTELAGE ACADEMICS SERVER STARTED SUCCESSFULLY!');
            console.log('='.repeat(60));
            console.log(`📡 Server running on: http://localhost:${SERVER_PORT}`);
            console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
            if (!SHOULD_SKIP_DB) {
                console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
            } else {
                console.log('🗄️  Database: SKIPPED (dev mode)');
            }
            console.log(`🔐 Session store: Memory (consider using database sessions for production)`);
            console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📧 Email service: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
            console.log('='.repeat(60) + '\n');
            
            console.log('✅ All systems operational - API endpoints ready to serve requests\n');
        });
        
    } catch (error) {
        console.error('\n' + '❌'.repeat(20));
        console.error('💥 FATAL ERROR: Failed to initialize server');
        console.error('❌'.repeat(20));
        console.error('Error details:', error);
        
        if (error.name === 'SequelizeConnectionError') {
            console.error('\n🔍 Database Connection Troubleshooting:');
            console.error('1. Check if your database server is running');
            console.error('2. Verify database credentials in .env file');
            console.error('3. Ensure network connectivity to database host');
            console.error('4. Check if SSL/TLS settings are correct');
        }
        
        console.error('❌'.repeat(20) + '\n');
        // In dev mode without DB, do not exit; attempt to start server without DB
        if (SHOULD_SKIP_DB) {
            console.warn('⚠️  Continuing without database due to SKIP_DB. Starting server...');
            app.listen(SERVER_PORT, () => {
                console.log('\n' + '='.repeat(60));
                console.log('🚀 TUTELAGE ACADEMICS SERVER STARTED WITH DB DISABLED');
                console.log('='.repeat(60));
                console.log(`📡 Server running on: http://localhost:${SERVER_PORT}`);
                console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
                console.log('🗄️  Database: SKIPPED (dev mode)');
                console.log('='.repeat(60) + '\n');
            });
        } else {
            process.exit(1);
        }
    }
};

// Start the server initialization process
initializeServer();
