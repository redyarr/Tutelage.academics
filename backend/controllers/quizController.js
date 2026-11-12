// ============================================================================
// PUBLIC QUIZ CONTROLLER
// ============================================================================
// Handles public read-only endpoints for frontend quiz display

const { QuizConfiguration, QuizSection, QuizQuestion } = require('../models');
const { sendTestResultEmail } = require('../config/email');
const { levelPlan } = require('../utils/quizLevels');

/**
 * GET /api/quiz/config
 * Fetch quiz configuration (totalQuestions, timeLimitMinutes)
 * Only returns active configuration
 */
exports.getPublicQuizConfig = async (req, res) => {
  try {
    let config = await QuizConfiguration.findOne({ where: { isActive: true } });
    if (!config) {
      // Fallback: if no active config, create default one
      config = await QuizConfiguration.create({ totalQuestions: 30, timeLimitMinutes: 20, isActive: true });
    }
    res.status(200).json({
      success: true,
      data: {
        totalQuestions: config.totalQuestions,
        timeLimitMinutes: config.timeLimitMinutes
      }
    });
  } catch (error) {
    console.error('Error fetching public quiz config:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/quiz/sections
 * Fetch all active sections with metadata (no questions)
 */
exports.getPublicSections = async (req, res) => {
  try {
    const sections = await QuizSection.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC']]
    });

    res.status(200).json({ success: true, data: sections });
  } catch (error) {
    console.error('Error fetching public sections:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/quiz/questions
 * Fetch questions distributed by sections based on their questionCount
 * Returns questions WITH correctAnswer (frontend scoring)
 */
exports.getPublicQuestions = async (req, res) => {
  try {
    // ✅ Fetch active sections with their question limits
    const sections = await QuizSection.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC']],
      attributes: ['id', 'name', 'slug', 'questionCount', 'levelDistribution']
    });

    if (!sections.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No active sections found'
      });
    }

    const selectedQuestions = [];

    // ✅ For each section, fetch random questions up to its questionCount
    for (const section of sections) {
      const limit = section.questionCount || 0;
      if (limit === 0) continue;

      const pick = (where, n) =>
        QuizQuestion.findAll({
          where: { sectionId: section.id, isActive: true, ...where },
          attributes: ['id', 'sectionId', 'level', 'text', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer'],
          order: [[QuizQuestion.sequelize.fn('RANDOM')]],
          limit: n
        });

      // A section with a level split gets exactly that many random questions per level, easy → hard;
      // without one it takes `questionCount` random questions of any level.
      const plan = levelPlan(section.levelDistribution);
      const questions = plan.length
        ? (await Promise.all(plan.map(([level, n]) => pick({ level }, n)))).flat()
        : await pick({}, limit);

      // Log warning if not enough questions
      if (questions.length < limit) {
        console.warn(`⚠️  Section "${section.name}" has only ${questions.length}/${limit} questions`);
      }

      // Add section info to each question
      questions.forEach(q => {
        selectedQuestions.push({
          id: q.id,
          sectionId: q.sectionId,
          sectionName: section.name,
          level: q.level,
          text: q.text,
          options: [q.optionA, q.optionB, q.optionC, q.optionD],
          correctAnswer: q.correctAnswer
        });
      });
    }

    console.log(`✅ Returning ${selectedQuestions.length} questions from ${sections.length} sections`);

    res.status(200).json({
      success: true,
      data: selectedQuestions
    });
  } catch (error) {
    console.error('❌ Error fetching public questions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
