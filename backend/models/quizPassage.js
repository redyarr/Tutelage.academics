// ============================================================================
// QUIZ PASSAGE MODEL
// ============================================================================
// A reading text that covers a range of a section's question numbers (e.g. questions 1-4).
// Its questions (QuizQuestion.passageId, ordered by displayOrder) fill exactly that range in the
// quiz; the section's other numbers get random questions as usual.

module.exports = (sequelize, DataTypes) => {
  const QuizPassage = sequelize.define('QuizPassage', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    sectionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Foreign key to QuizSection'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Admin label, also shown above the text'
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'The passage the student reads'
    },
    startPosition: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'First question number in the section this passage covers (1-based)'
    },
    endPosition: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Last question number it covers; the passage holds end - start + 1 questions'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    }
  }, {
    tableName: 'quiz_passages',
    comment: 'Reading passages shared by several quiz questions'
  });

  QuizPassage.associate = (models) => {
    QuizPassage.belongsTo(models.QuizSection, { foreignKey: 'sectionId', as: 'section' });
    QuizPassage.hasMany(models.QuizQuestion, { foreignKey: 'passageId', as: 'questions' });
  };

  return QuizPassage;
};
