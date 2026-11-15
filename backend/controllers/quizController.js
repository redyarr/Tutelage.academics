// ============================================================================
// PUBLIC QUIZ CONTROLLER
// ============================================================================
// Handles public read-only endpoints for frontend quiz display

const { QuizConfiguration, QuizSection, QuizQuestion, QuizPassage } = require('../models');
const { sendTestResultEmail } = require('../config/email');
const { arrangeSection } = require('../utils/quizLevels');

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

      // shortcut: loads the section's whole active bank and lays it out in JS (passages sit on fixed
      // numbers); fine for hundreds of questions, move to SQL if a section grows to many thousands.
      const [bank, passages] = await Promise.all([
        QuizQuestion.findAll({
          where: { sectionId: section.id, isActive: true },
          attributes: ['id', 'sectionId', 'passageId', 'level', 'text', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'displayOrder']
        }),
        QuizPassage.findAll({
          where: { sectionId: section.id, isActive: true },
          attributes: ['id', 'title', 'text', 'startPosition', 'endPosition']
        })
      ]);
      const passageById = new Map(passages.map((p) => [p.id, p]));
      const questions = arrangeSection({
        questionCount: limit,
        levelDistribution: section.levelDistribution,
        passages,
        // questions of an inactive passage are out, like inactive questions
        questions: bank.filter((q) => !q.passageId || passageById.has(q.passageId))
      });

      // Log warning if not enough questions
      if (questions.length < limit) {
        console.warn(`⚠️  Section "${section.name}" has only ${questions.length}/${limit} questions`);
      }

      // Add section info to each question
      questions.forEach(q => {
        const passage = passageById.get(q.passageId);
        selectedQuestions.push({
          id: q.id,
          sectionId: q.sectionId,
          sectionName: section.name,
          level: q.level,
          text: q.text,
          options: [q.optionA, q.optionB, q.optionC, q.optionD],
          correctAnswer: q.correctAnswer,
          passage: passage ? { id: passage.id, title: passage.title, text: passage.text } : null
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
