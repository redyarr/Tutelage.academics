// ============================================================================
// QUIZ SECTION MODEL
// ============================================================================
// Dynamic sections for the quiz (admin can add/remove/reorder)

module.exports = (sequelize, DataTypes) => {
  const QuizSection = sequelize.define('QuizSection', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Unique identifier for quiz section'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Section name (e.g., "Grammar", "Vocabulary")'
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'URL-friendly identifier (e.g., "grammar", "vocabulary")'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional section description'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Order in which sections appear (lower = first)'
    },
    questionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      comment: 'Number of questions this section should contain (admin-controlled)'
    },
    levelDistribution: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Questions per CEFR level, e.g. {"A1":3,"A2":3,"B1":4}; must sum to questionCount. Null = any level'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether section is currently active'
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Foreign key to User who created this section'
    }
  }, {
    tableName: 'quiz_sections',
    comment: 'Quiz sections (Grammar, Vocabulary, etc.) - dynamically managed'
  });

  QuizSection.associate = (models) => {
    QuizSection.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    QuizSection.hasMany(models.QuizQuestion, { foreignKey: 'sectionId', as: 'questions' });
  };

  return QuizSection;
};
