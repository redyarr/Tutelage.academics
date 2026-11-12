// ============================================================================
// ADMIN QUIZ CONTROLLER
// ============================================================================
// Handles admin CRUD operations for quiz config, sections, and questions

const { QuizConfiguration, QuizSection, QuizQuestion, User } = require('../models');
const { Op } = require('sequelize');
const { LEVELS, normalizeDistribution, distributionError } = require('../utils/quizLevels');

/** { A1: n, ..., C2: n } active questions per level — the admin form warns when a split asks for more. */
const countByLevel = (questions = []) =>
  Object.fromEntries(LEVELS.map((level) => [level, questions.filter((q) => q.level === level).length]));

// The slug (unique) is derived from the name, so a clash means the name is taken.
const DUPLICATE_SECTION = 'A section with this name already exists.';

/** Parses and checks a section's level split against its question count; returns { dist } or { error }. */
function readDistribution(body, questionCount) {
  try {
    const dist = normalizeDistribution(body.levelDistribution);
    const error = distributionError(dist, questionCount);
    return error ? { error } : { dist };
  } catch (e) {
    return { error: e.message };
  }
}

// ============================================================================
// QUIZ CONFIGURATION
// ============================================================================

/**
 * GET /api/admin/quiz/config
 * Fetch current quiz configuration
 */
exports.getQuizConfig = async (req, res) => {
  try {
    let config = await QuizConfiguration.findOne();
    if (!config) {
      config = await QuizConfiguration.create({ totalQuestions: 30, timeLimitMinutes: 20, isActive: true });
    }
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching quiz config:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * PUT /api/admin/quiz/config
 * Update quiz configuration (validates constraints)
 */
exports.updateQuizConfig = async (req, res) => {
  try {
    const { totalQuestions, timeLimitMinutes, isActive } = req.body;

    if (totalQuestions !== undefined && totalQuestions < 1) {
      return res.status(400).json({ success: false, message: 'Total questions must be at least 1' });
    }
    if (timeLimitMinutes !== undefined && timeLimitMinutes < 1) {
      return res.status(400).json({ success: false, message: 'Time limit must be at least 1 minute' });
    }

    let config = await QuizConfiguration.findOne();
    if (!config) {
      config = await QuizConfiguration.create({ totalQuestions: 30, timeLimitMinutes: 20, isActive: true });
    }

    // Validate: sum of section questionCounts must not exceed new totalQuestions
    if (totalQuestions !== undefined && totalQuestions < config.totalQuestions) {
      const sections = await QuizSection.findAll({ where: { isActive: true } });
      const currentSum = sections.reduce((sum, s) => sum + (s.questionCount || 0), 0);
      if (currentSum > totalQuestions) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce total questions to ${totalQuestions}. Current section allocation is ${currentSum}. Please adjust section question counts first.`
        });
      }
    }

    await config.update({ 
      totalQuestions: totalQuestions !== undefined ? totalQuestions : config.totalQuestions,
      timeLimitMinutes: timeLimitMinutes !== undefined ? timeLimitMinutes : config.timeLimitMinutes,
      isActive: isActive !== undefined ? isActive : config.isActive
    });
    
    res.status(200).json({ success: true, message: 'Quiz configuration updated', data: config });
  } catch (error) {
    console.error('Error updating quiz config:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ============================================================================
// SECTIONS
// ============================================================================

/**
 * GET /api/admin/quiz/sections
 * Fetch all sections with their question counts
 */
exports.getAllSections = async (req, res) => {
  try {
    const sections = await QuizSection.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuizQuestion, as: 'questions', attributes: ['id', 'level'], where: { isActive: true }, required: false }
      ],
      order: [['displayOrder', 'ASC']]
    });

    const enriched = sections.map(s => {
      const { questions, ...section } = s.toJSON();
      return {
        ...section,
        currentQuestionCount: questions ? questions.length : 0,
        availableByLevel: countByLevel(questions)
      };
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /api/admin/quiz/sections/:id
 * Fetch a specific section with its questions
 */
exports.getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const section = await QuizSection.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuizQuestion, as: 'questions', where: { isActive: true }, required: false }
      ]
    });

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    res.status(200).json({ success: true, data: { ...section.toJSON(), availableByLevel: countByLevel(section.questions) } });
  } catch (error) {
    console.error('Error fetching section:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /api/admin/quiz/sections
 * Create a new section (validates total allocation)
 */
exports.createSection = async (req, res) => {
  try {
    const { name, slug, description, displayOrder, questionCount } = req.body;
    const createdBy = req.user.id;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'Name and slug are required' });
    }

    // Validate: sum of all section questionCounts + new questionCount must not exceed totalQuestions
    const config = await QuizConfiguration.findOne();
    const sections = await QuizSection.findAll({ where: { isActive: true } });
    const currentSum = sections.reduce((sum, s) => sum + (s.questionCount || 0), 0);
    const newCount = questionCount || 10;

    if (currentSum + newCount > config.totalQuestions) {
      return res.status(400).json({
        success: false,
        message: `Cannot create section. Total allocation would be ${currentSum + newCount}, exceeding global limit of ${config.totalQuestions}. Current allocation: ${currentSum}.`
      });
    }

    const { dist, error: distError } = readDistribution(req.body, newCount);
    if (distError) return res.status(400).json({ success: false, message: distError });

    const section = await QuizSection.create({
      name,
      slug,
      description,
      displayOrder: displayOrder || 0,
      questionCount: newCount,
      levelDistribution: dist,
      createdBy
    });

    const sectionWithCreator = await QuizSection.findByPk(section.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }]
    });

    res.status(201).json({ success: true, message: 'Section created', data: sectionWithCreator });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ success: false, message: DUPLICATE_SECTION });
    console.error('Error creating section:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * PUT /api/admin/quiz/sections/:id
 * Update a section (validates question count constraints)
 */
exports.updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, displayOrder, questionCount, isActive } = req.body;

    const section = await QuizSection.findByPk(id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    // Validate questionCount change: sum of all sections must not exceed totalQuestions
    if (questionCount !== undefined && questionCount !== section.questionCount) {
      const config = await QuizConfiguration.findOne();
      const allSections = await QuizSection.findAll({ where: { isActive: true, id: { [Op.ne]: id } } });
      const otherSum = allSections.reduce((sum, s) => sum + (s.questionCount || 0), 0);
      const newSum = otherSum + questionCount;

      if (newSum > config.totalQuestions) {
        return res.status(400).json({
          success: false,
          message: `Cannot update section. New total allocation would be ${newSum}, exceeding global limit of ${config.totalQuestions}. Other sections total: ${otherSum}.`
        });
      }

      // // Also check: current question count in this section must not exceed new questionCount
      // const currentQuestionCount = await QuizQuestion.count({ where: { sectionId: id, isActive: true } });
      // if (currentQuestionCount > questionCount) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Section currently has ${currentQuestionCount} active questions. Cannot reduce limit to ${questionCount}. Please delete or deactivate questions first.`
      //   });
      // }
    }

    // A split must match the (possibly new) count; omitting levelDistribution leaves it unchanged.
    const patch = { name, slug, description, displayOrder, questionCount, isActive };
    if (req.body.levelDistribution !== undefined) {
      const { dist, error: distError } = readDistribution(req.body, questionCount ?? section.questionCount);
      if (distError) return res.status(400).json({ success: false, message: distError });
      patch.levelDistribution = dist;
    } else if (questionCount !== undefined) {
      const distError = distributionError(section.levelDistribution, questionCount);
      if (distError) return res.status(400).json({ success: false, message: distError });
    }

    await section.update(patch);

    const updated = await QuizSection.findByPk(id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }]
    });

    res.status(200).json({ success: true, message: 'Section updated', data: updated });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ success: false, message: DUPLICATE_SECTION });
    console.error('Error updating section:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * DELETE /api/admin/quiz/sections/:id
 * Delete a section (blocks if it has active questions)
 */
exports.deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const section = await QuizSection.findByPk(id);

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const questionCount = await QuizQuestion.count({ where: { sectionId: id, isActive: true } });
    if (questionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete section "${section.name}". It contains ${questionCount} active question(s). Please delete or move questions first.`
      });
    }

    await section.destroy();
    res.status(200).json({ success: true, message: 'Section deleted' });
  } catch (error) {
    console.error('Error deleting section:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ============================================================================
// QUESTIONS
// ============================================================================

/**
 * GET /api/admin/quiz/questions
 * Fetch all questions with optional filters (sectionId, level)
 */
exports.getAllQuestions = async (req, res) => {
  try {
    const { sectionId, level, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (sectionId) where.sectionId = sectionId;
    if (level) where.level = level;

    const { count, rows } = await QuizQuestion.findAndCountAll({
      where,
      include: [
        { model: QuizSection, as: 'section', attributes: ['id', 'name', 'slug'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['sectionId', 'ASC'], ['level', 'ASC'], ['id', 'ASC']]
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: {
        questions: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /api/admin/quiz/questions/:id
 * Fetch a specific question by ID
 */
exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await QuizQuestion.findByPk(id, {
      include: [
        { model: QuizSection, as: 'section', attributes: ['id', 'name', 'slug'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    res.status(200).json({ success: true, data: question });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /api/admin/quiz/questions
 * Create a new question
 * NO STORAGE LIMIT - questionCount is only for quiz sampling
 */
exports.createQuestion = async (req, res) => {
  try {
    const { sectionId, level, text, optionA, optionB, optionC, optionD, correctAnswer, displayOrder } = req.body;
    const createdBy = req.user.id;

    // Validate required fields
    if (!sectionId || !level || !text || !optionA || !optionB || !optionC || !optionD || correctAnswer === undefined) {
      return res.status(400).json({ success: false, message: 'All question fields are required' });
    }

    // Validate correct answer is 0-3
    if (correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({ success: false, message: 'correctAnswer must be 0 (A), 1 (B), 2 (C), or 3 (D)' });
    }

    // Validate section exists
    const section = await QuizSection.findByPk(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    // ✅ NO STORAGE LIMIT CHECK
    // The questionCount field in QuizSection is ONLY used to determine
    // how many questions to randomly sample for the quiz.
    // Admins can add unlimited questions to any section.

    const question = await QuizQuestion.create({
      sectionId,
      level,
      text,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      displayOrder: displayOrder || 0,
      createdBy
    });

    res.status(201).json({ success: true, message: 'Question created successfully', data: question });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * PUT /api/admin/quiz/questions/:id
 * Update a question
 */
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, level, text, optionA, optionB, optionC, optionD, correctAnswer, displayOrder, isActive } = req.body;

    const question = await QuizQuestion.findByPk(id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Validate correctAnswer if provided
    if (correctAnswer !== undefined && (correctAnswer < 0 || correctAnswer > 3)) {
      return res.status(400).json({ success: false, message: 'correctAnswer must be 0-3' });
    }

    // If changing section, validate new section limit
    if (sectionId !== undefined && sectionId !== question.sectionId) {
      const newSection = await QuizSection.findByPk(sectionId);
      if (!newSection) {
        return res.status(404).json({ success: false, message: 'New section not found' });
      }
    }

    await question.update({ sectionId, level, text, optionA, optionB, optionC, optionD, correctAnswer, displayOrder, isActive });

    const updated = await QuizQuestion.findByPk(id, {
      include: [
        { model: QuizSection, as: 'section', attributes: ['id', 'name', 'slug'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(200).json({ success: true, message: 'Question updated', data: updated });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * DELETE /api/admin/quiz/questions/:id
 * Delete a question
 */
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await QuizQuestion.findByPk(id);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await question.destroy();
    res.status(200).json({ success: true, message: 'Question deleted' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};
