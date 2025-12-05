// ============================================================================
// WRITING MODEL
// ============================================================================
// This model defines the Writing entity for writing practice content,
// including prompts, sample answers, rubrics, PDFs, levels, and author relation.
// ============================================================================

/**
 * Writing Model Definition
 * Defines the structure and relationships for writing content in the system
 * 
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Object} Writing model
 */
module.exports = (sequelize, DataTypes) => {
  // ==========================================================================
  // MODEL DEFINITION
  // ==========================================================================
  const Writing = sequelize.define(
    'Writing',
    {
      // Primary key field
      id: { 
        type: DataTypes.INTEGER.UNSIGNED, 
        autoIncrement: true, 
        primaryKey: true,
        comment: 'Unique identifier for the writing content'
      },

      // Content identification fields
      title: { 
        type: DataTypes.STRING(250), 
        allowNull: false,
        comment: 'Title of the writing activity'
      },

      // Featured image URL
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL or path to the featured image for this writing content'
      },

 // content image URL
      contentImageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL or path to the featured image for this writing content'
      },

      // Short description
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Short description or summary of the writing content'
      },


      // Optional content (guidance, notes)
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional guidance or descriptive content for the activity'
      },

      // PDF reference for downloadable worksheet
      pdf: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL or path to downloadable PDF for this writing content'
      },

      

      // Tags array for writing content (optional)
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'List of tags associated with the writing content'
      },

      // Language levels field (supports single or multiple CEFR-like levels)
      level: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'Language levels (e.g., ["B1 Intermediate"])'
      },

      // Author relationship field
      createdBy: { 
        type: DataTypes.INTEGER.UNSIGNED, 
        allowNull: false,
        comment: 'Foreign key reference to the user who created this writing content'
      }
    },
    {
      tableName: 'writings',
      comment: 'Writing practice activities and resources'
    }
  );

  // ==========================================================================
  // MODEL ASSOCIATIONS
  // ==========================================================================
  /**
   * Define relationships between Writing and other models
   * Each writing content belongs to a user (author)
   */
  Writing.associate = (models) => {
    Writing.belongsTo(models.User, { 
      foreignKey: 'createdBy', 
      as: 'author',
      onDelete: 'CASCADE'
    });
    Writing.hasMany(models.TaskPdf, { foreignKey: 'resourceId', constraints: false, scope: { resourceType: 'writing' }, as: 'taskPdfs' });
  };

  return Writing;
};
