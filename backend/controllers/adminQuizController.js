// ============================================================================
// ADMIN QUIZ CONTROLLER
// ============================================================================
// Handles admin CRUD operations for quiz config, sections, and questions

const { sequelize, QuizConfiguration, QuizSection, QuizQuestion, QuizPassage, User } = require('../models');
const { Op } = require('sequelize');
const { LEVELS, normalizeDistribution, distributionError, passageRangeError } = require('../utils/quizLevels');

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

    // A smaller section must still hold every passage's numbers.
    if (questionCount !== undefined) {
      const lastPassage = await QuizPassage.findOne({ where: { sectionId: id, endPosition: { [Op.gt]: questionCount } }, order: [['endPosition', 'DESC']] });
      if (lastPassage) {
        return res.status(400).json({
          success: false,
          message: `The passage "${lastPassage.title}" uses questions ${lastPassage.startPosition}-${lastPassage.endPosition}. Keep at least ${lastPassage.endPosition} questions, or change the passage's questions first.`
        });
      }
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

    const passageCount = await QuizPassage.count({ where: { sectionId: id } });
    if (passageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete section "${section.name}". It has ${passageCount} passage(s). Please delete them first.`
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
    const { sectionId, level, search, freeFor, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (sectionId) where.sectionId = sectionId;
    if (level) where.level = level;
    // ?search= matches the question text (the passage editor's bank picker)
    if (search && String(search).trim()) where.text = { [Op.iLike]: `%${String(search).trim()}%` };
    // ?freeFor=<passageId|new>: only questions in no passage, or already in that passage
    if (freeFor) {
      where.passageId = freeFor === 'new' ? null : { [Op.or]: [null, Number(freeFor) || 0] };
    }

    const { count, rows } = await QuizQuestion.findAndCountAll({
      where,
      include: [
        { model: QuizSection, as: 'section', attributes: ['id', 'name', 'slug'] },
        { model: QuizPassage, as: 'passage', attributes: ['id', 'title'] },
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
        { model: QuizPassage, as: 'passage', attributes: ['id', 'title'] },
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

    // Passage questions are created through the passage endpoints, so they land on its numbers.
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

    // A passage question moves only with its passage (its number belongs to the passage's section)
    if (question.passageId && sectionId !== undefined && Number(sectionId) !== question.sectionId) {
      return res.status(400).json({ success: false, message: 'This question belongs to a reading passage. Move the passage instead, or remove the question from it first.' });
    }

    await question.update({
      sectionId, level, text, optionA, optionB, optionC, optionD, correctAnswer, isActive,
      // displayOrder is the question's place inside its passage; only the passage editor sets it
      ...(question.passageId ? {} : { displayOrder })
    });

    const updated = await QuizQuestion.findByPk(id, {
      include: [
        { model: QuizSection, as: 'section', attributes: ['id', 'name', 'slug'] },
        { model: QuizPassage, as: 'passage', attributes: ['id', 'title'] },
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

// ============================================================================
// PASSAGES
// ============================================================================
// A reading text covering a range of a section's question numbers (e.g. questions 1-4). It is
// saved together with exactly one question per number: new ones are created, picked bank
// questions are moved into it, and questions taken out are switched off (they were written
// for the text) but kept in the question list.

const QUESTION_FIELDS = ['level', 'text', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer'];

/** Error message for one passage question, or null. */
function passageQuestionError(q) {
  if (!q || typeof q !== 'object') return 'is missing';
  if (!LEVELS.includes(q.level)) return 'needs a level';
  if (!String(q.text ?? '').trim()) return 'needs the question text';
  if (String(q.text).length > 1000) return 'text is longer than 1000 characters';
  for (const letter of ['A', 'B', 'C', 'D']) {
    const value = String(q[`option${letter}`] ?? '');
    if (!value.trim()) return `needs option ${letter}`;
    if (value.length > 500) return `option ${letter} is longer than 500 characters`;
  }
  const answer = Number(q.correctAnswer);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return 'needs the correct answer';
  return null;
}

/** The passage with its questions in quiz order (the shape the editor loads). */
const loadPassage = (id) =>
  QuizPassage.findByPk(id, {
    include: [
      { model: QuizSection, as: 'section', attributes: ['id', 'name', 'questionCount'] },
      { model: QuizQuestion, as: 'questions', attributes: ['id', 'displayOrder', 'isActive', ...QUESTION_FIELDS] }
    ],
    order: [[{ model: QuizQuestion, as: 'questions' }, 'displayOrder', 'ASC'], [{ model: QuizQuestion, as: 'questions' }, 'id', 'ASC']]
  });

/** Validates and saves a passage (new when `passage` is null) with its questions; sends the response. */
async function savePassage(req, res, passage) {
  const { sectionId, title, text, isActive } = req.body;
  const start = Number(req.body.startPosition);
  const end = Number(req.body.endPosition);
  const items = Array.isArray(req.body.questions) ? req.body.questions : [];
  const fail = (message, status = 400) => res.status(status).json({ success: false, message });

  if (!String(title ?? '').trim() || String(title).length > 200) return fail('Give the passage a title (up to 200 characters).');
  if (!String(text ?? '').trim()) return fail('Write the passage text.');
  const section = await QuizSection.findByPk(sectionId);
  if (!section) return fail('Section not found', 404);

  const others = await QuizPassage.findAll({
    where: { sectionId: section.id, ...(passage && { id: { [Op.ne]: passage.id } }) },
    attributes: ['title', 'startPosition', 'endPosition']
  });
  const rangeError = passageRangeError(start, end, section.questionCount, others);
  if (rangeError) return fail(rangeError);
  if (items.length !== end - start + 1) {
    return fail(`Questions ${start}-${end} need ${end - start + 1} questions; ${items.length} were sent.`);
  }
  for (const [i, q] of items.entries()) {
    const error = passageQuestionError(q);
    if (error) return fail(`Question ${start + i} ${error}.`);
  }

  // Picked bank questions must sit in this section and not in another passage.
  const ids = items.filter((q) => q.id).map((q) => Number(q.id));
  if (new Set(ids).size !== ids.length) return fail('The same question is used twice.');
  const picked = ids.length ? await QuizQuestion.findAll({ where: { id: ids } }) : [];
  if (picked.length !== ids.length) return fail('A picked question no longer exists. Pick it again.');
  const taken = picked.find((q) => q.sectionId !== section.id || (q.passageId && q.passageId !== passage?.id));
  if (taken) return fail(`Question #${taken.id} is in another section or passage.`);

  const saved = await sequelize.transaction(async (transaction) => {
    const fields = { sectionId: section.id, title: String(title).trim(), text, startPosition: start, endPosition: end, isActive: isActive ?? true };
    const row = passage
      ? await passage.update(fields, { transaction })
      : await QuizPassage.create({ ...fields, createdBy: req.user.id }, { transaction });

    const keep = [];
    for (const [i, q] of items.entries()) {
      const values = {
        sectionId: section.id,
        passageId: row.id,
        displayOrder: i + 1,
        isActive: true, // a switched-off question would leave a hole in the passage's numbers
        level: q.level,
        text: String(q.text).trim(),
        optionA: String(q.optionA).trim(),
        optionB: String(q.optionB).trim(),
        optionC: String(q.optionC).trim(),
        optionD: String(q.optionD).trim(),
        correctAnswer: Number(q.correctAnswer)
      };
      if (q.id) {
        await QuizQuestion.update(values, { where: { id: q.id }, transaction });
        keep.push(Number(q.id));
      } else {
        keep.push((await QuizQuestion.create({ ...values, createdBy: req.user.id }, { transaction })).id);
      }
    }
    // keep is never empty: a range holds at least one question
    await QuizQuestion.update(
      { passageId: null, isActive: false },
      { where: { passageId: row.id, id: { [Op.notIn]: keep } }, transaction }
    );
    return row;
  });

  res.status(passage ? 200 : 201).json({ success: true, message: passage ? 'Passage saved' : 'Passage created', data: await loadPassage(saved.id) });
}

/**
 * GET /api/admin/quiz/passages?sectionId=
 * Passages (without their text) with their range and how many questions they hold
 */
exports.getAllPassages = async (req, res) => {
  try {
    const where = req.query.sectionId ? { sectionId: req.query.sectionId } : {};
    const passages = await QuizPassage.findAll({
      where,
      attributes: ['id', 'sectionId', 'title', 'startPosition', 'endPosition', 'isActive', 'updatedAt'],
      include: [{ model: QuizQuestion, as: 'questions', attributes: ['id'] }],
      order: [['sectionId', 'ASC'], ['startPosition', 'ASC']]
    });
    const data = passages.map((p) => {
      const { questions, ...passage } = p.toJSON();
      return { ...passage, questionCount: questions.length };
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching passages:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/** GET /api/admin/quiz/passages/:id — the passage with its questions in order */
exports.getPassageById = async (req, res) => {
  try {
    const passage = await loadPassage(req.params.id);
    if (!passage) return res.status(404).json({ success: false, message: 'Passage not found' });
    res.status(200).json({ success: true, data: passage });
  } catch (error) {
    console.error('Error fetching passage:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/** POST /api/admin/quiz/passages — { sectionId, title, text, startPosition, endPosition, isActive, questions[] } */
exports.createPassage = async (req, res) => {
  try {
    await savePassage(req, res, null);
  } catch (error) {
    console.error('Error creating passage:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/** PUT /api/admin/quiz/passages/:id — same body as POST; replaces the passage's questions */
exports.updatePassage = async (req, res) => {
  try {
    const passage = await QuizPassage.findByPk(req.params.id);
    if (!passage) return res.status(404).json({ success: false, message: 'Passage not found' });
    await savePassage(req, res, passage);
  } catch (error) {
    console.error('Error updating passage:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/** DELETE /api/admin/quiz/passages/:id — its questions stay in the list, switched off */
exports.deletePassage = async (req, res) => {
  try {
    const passage = await QuizPassage.findByPk(req.params.id);
    if (!passage) return res.status(404).json({ success: false, message: 'Passage not found' });
    await sequelize.transaction(async (transaction) => {
      await QuizQuestion.update({ passageId: null, isActive: false }, { where: { passageId: passage.id }, transaction });
      await passage.destroy({ transaction });
    });
    res.status(200).json({ success: true, message: 'Passage deleted' });
  } catch (error) {
    console.error('Error deleting passage:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};
