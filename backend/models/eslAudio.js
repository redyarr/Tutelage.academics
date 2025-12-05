// ============================================================================
// ESL AUDIO MODEL
// ============================================================================
// Separate model for ESL Library audios (distinct from skills audios).
// Supports URL-based submission, transcript, description, level, and author.
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const EslAudio = sequelize.define(
    'EslAudio',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        comment: 'Unique identifier for ESL audio'
      },
      title: {
        type: DataTypes.STRING(250),
        allowNull: false,
        comment: 'Title of the ESL audio'
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Optional cover image URL'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Short description of the audio content'
      },
      transcript: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Text transcript of the audio content'
      },
      audioRef: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Remote URL (e.g., online MP3) or file path'
      },
      pdf: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Optional downloadable worksheet/resource PDF URL'
      },

      
      level: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment: 'Language levels (e.g., ["B1 Intermediate"])'
      },
      createdBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Foreign key to the user who created the ESL audio'
      }
    },
    {
      tableName: 'esl_audios',
      comment: 'ESL Library audio resources (separate from skills audios)'
    }
  );

  EslAudio.associate = (models) => {
    EslAudio.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'author',
      onDelete: 'CASCADE'
    });
    EslAudio.hasMany(models.TaskPdf, { foreignKey: 'resourceId', constraints: false, scope: { resourceType: 'esl_audio' }, as: 'taskPdfs' });
  };

  return EslAudio;
};
