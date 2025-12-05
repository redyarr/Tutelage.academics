// ============================================================================
// READING MODEL
// ============================================================================
// Defines the Reading entity for reading comprehension/content,
// including text/content, optional PDF, levels, tags, and author relation.
// ============================================================================

/**
 * Reading Model Definition
 * Mirrors Writing/Speaking patterns for consistency
 *
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Object} Reading model
 */
module.exports = (sequelize, DataTypes) => {
  // ==========================================================================
  // MODEL DEFINITION
  // ==========================================================================
  const Reading = sequelize.define(
    'Reading',
    {
      // Primary key
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        comment: 'Unique identifier for the reading content'
      },

      // Content identification
      title: {
        type: DataTypes.STRING(250),
        allowNull: false,
        comment: 'Title of the reading resource'
      },

      // Featured image URL
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL or path to a featured image for this reading content'
      },

      // Short description
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Short description or summary of the reading content'
      },

      // Main content (passage, article, notes, etc.)
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Core text/content of the reading resource'
      },

      // PDF reference for downloadable worksheet or passage
      pdf: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL or path to downloadable PDF for the reading content'
      },

      

      // Tags array for reading content (optional)
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'List of tags associated with the reading content'
      },

      // Language levels (supports multiple CEFR-like levels)
      level: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'Language levels (e.g., ["B1 Intermediate"])'
      },

      // Author relationship field
      createdBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Foreign key reference to the user who created this reading content'
      }
    },
    {
      tableName: 'readings',
      comment: 'Reading comprehension/resources and associated metadata'
    }
  );

  // ==========================================================================
  // MODEL ASSOCIATIONS
  // ==========================================================================
  Reading.associate = (models) => {
    Reading.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'author',
      onDelete: 'CASCADE'
    });
    Reading.hasMany(models.TaskPdf, { foreignKey: 'resourceId', constraints: false, scope: { resourceType: 'reading' }, as: 'taskPdfs' });
  };

  return Reading;
};
