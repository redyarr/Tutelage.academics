// ============================================================================
// MODELS INDEX - Database Connection and Model Registration
// ============================================================================
// This file initializes the Sequelize database connection and automatically
// loads all model files from the models directory, setting up associations
// between models and exporting the complete database object.
// ============================================================================

// ============================================================================
// DEPENDENCIES
// ============================================================================
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

// ============================================================================
// CONFIGURATION
// ============================================================================
const currentFileName = path.basename(__filename);
const environment = process.env.NODE_ENV || 'development';

// ============================================================================
// DATABASE CONNECTION
// ============================================================================
// Initialize Sequelize with PostgreSQL database connection (Neon.tech).
// DATABASE_URL wins; the discrete DB_* vars are the legacy fallback.
const connectionOptions = {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false, // Disable SQL query logging
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

const sequelizeConnection = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, connectionOptions)
  : new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      ...connectionOptions,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT)
    });

// ============================================================================
// MODEL REGISTRATION
// ============================================================================
// Database object to store all models
const databaseModels = {};

// Automatically load all model files from the current directory
fs.readdirSync(__dirname)
  .filter((fileName) => {
    // Filter out non-JS files, hidden files, and this index file
    return (
      fileName.indexOf('.') !== 0 && 
      fileName !== currentFileName && 
      fileName.slice(-3) === '.js'
    );
  })
  .forEach((fileName) => {
    // Import each model file and initialize it with Sequelize
    const modelDefinition = require(path.join(__dirname, fileName));
    const modelInstance = modelDefinition(sequelizeConnection, Sequelize.DataTypes);
    databaseModels[modelInstance.name] = modelInstance;
  });

// ============================================================================
// MODEL ASSOCIATIONS
// ============================================================================
// Set up associations between models (if defined)
Object.keys(databaseModels).forEach((modelName) => {
  if (databaseModels[modelName].associate) {
    databaseModels[modelName].associate(databaseModels);
  }
});

// ============================================================================
// EXPORTS
// ============================================================================
// Attach Sequelize instance and constructor to the database object
databaseModels.sequelize = sequelizeConnection;
databaseModels.Sequelize = Sequelize;

// Export the complete database object with all models and connections
module.exports = databaseModels;