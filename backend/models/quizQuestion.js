// ============================================================================
// QUIZ QUESTION MODEL
// ============================================================================
// Questions for the placement quiz with section and level assignment

module.exports = (sequelize, DataTypes) => {
  const QuizQuestion = sequelize.define('QuizQuestion', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Unique identifier for quiz question'
    },
    sectionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Foreign key to QuizSection (each question belongs to exactly one section)'
    },
    passageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Optional QuizPassage this question belongs to (same section); displayOrder is its place in the passage'
    },
    level: {
      type: DataTypes.ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2'),
      allowNull: false,
      comment: 'CEFR level of this question'
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Question text (may contain ______ blanks)'
    },
    optionA: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Option A text'
    },
    optionB: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Option B text'
    },
    optionC: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Option C text'
    },
    optionD: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Option D text'
    },
    correctAnswer: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 3 },
      comment: 'Correct option index: 0=A, 1=B, 2=C, 3=D'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Order within section'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether question is currently active'
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Foreign key to User who created this question'
    }
  }, {
    tableName: 'quiz_questions',
    comment: 'Quiz questions with section and level assignment'
  });

  QuizQuestion.associate = (models) => {
    QuizQuestion.belongsTo(models.QuizSection, { foreignKey: 'sectionId', as: 'section' });
    QuizQuestion.belongsTo(models.QuizPassage, { foreignKey: 'passageId', as: 'passage' });
    QuizQuestion.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
  };

  return QuizQuestion; 
};
