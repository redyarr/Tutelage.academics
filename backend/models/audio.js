// ============================================================================
// AUDIO MODEL
// ============================================================================
// This model defines the Audio entity for audio content management,
// including audio files, transcripts, PDFs, and author relationships.
// ============================================================================

/**
 * Audio Model Definition
 * Defines the structure and relationships for audio content in the system
 * 
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Object} Audio model
 */
module.exports = (sequelize, DataTypes) => {
  // ============================================================================
  // MODEL DEFINITION
  // ============================================================================
  const Audio = sequelize.define(
    'Audio',
    {
      // Primary key field
      id: { 
        type: DataTypes.INTEGER.UNSIGNED, 
        autoIncrement: true, 
        primaryKey: true,
        comment: 'Unique identifier for the audio content'
      },
      
      // Content identification fields
      title: { 
        type: DataTypes.STRING(250), 
        allowNull: false,
        comment: 'Title of the audio content'
      },

      // Featured image URL
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL or path to the featured image for this audio content'
      },
      

      // Short description (in addition to content)
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Short description of the audio content'
      },
      
      // Transcript field
      transcript: { 
        type: DataTypes.TEXT, 
        allowNull: true,
        comment: 'Text transcript of the audio content'
      },
      
      // Media reference fields
      audioRef: { 
        type: DataTypes.STRING(500), 
        allowNull: false,
        comment: 'Reference URL or path to the audio file'
      },
      

      // PDF reference (canonical)
      pdf: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL or path to downloadable PDF for this audio content'
      },

      


      // Language levels field (supports single or multiple CEFR-like levels)
      level: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'Language levels for this audio (e.g., ["B1 Intermediate"])'
      },
      
      // Author relationship field
      createdBy: { 
        type: DataTypes.INTEGER.UNSIGNED, 
        allowNull: false,
        comment: 'Foreign key reference to the user who created this audio'
      }
    },
    {
      tableName: 'audios',
      comment: 'Audio content and multimedia resources'
    }
  );

  // ============================================================================
  // MODEL ASSOCIATIONS
  // ============================================================================
  /**
   * Define relationships between Audio and other models
   * Each audio belongs to a user (author)
   */
  Audio.associate = (models) => {
    Audio.belongsTo(models.User, { 
      foreignKey: 'createdBy', 
      as: 'author',
      onDelete: 'CASCADE'
    });
    Audio.hasMany(models.TaskPdf, { foreignKey: 'resourceId', constraints: false, scope: { resourceType: 'audio' }, as: 'taskPdfs' });
  };

  return Audio;
};
