// ============================================================================
// ESL AUDIO ROUTES
// ============================================================================
// Public listing and detail; admin-protected create/update/delete.

const express = require('express');
const { validateTags } = require('../middlewares/validateTags');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const { pdfUpload } = require('../middlewares/pdfUpload');
const {
  createEslAudio,
  getAllEslAudios,
  getEslAudioById,
  updateEslAudio,
  deleteEslAudio,
  searchEslAudioByTranscript
} = require('../controllers/eslAudioController');

// Public endpoints
router.get('/', getAllEslAudios);
router.get('/:id', getEslAudioById);
router.post('/search-transcript', searchEslAudioByTranscript);

// Admin endpoints
router.use(isAuthenticated);
router.post('/', isAdmin, pdfUpload, validateTags, createEslAudio);
router.put('/:id', isAdmin, pdfUpload, validateTags, updateEslAudio);
router.delete('/:id', isAdmin, deleteEslAudio);

module.exports = router;