const express = require('express');
const router = express.Router();
const { pdfUpload } = require('../middlewares/pdfUpload');
const { listTaskPdfs, addTaskPdfs, deleteTaskPdf } = require('../controllers/taskPdfController');
const { isAuthenticated } = require('../middlewares/auth');

router.get('/:resourceType/:resourceId', listTaskPdfs);
router.post('/:resourceType/:resourceId', isAuthenticated, pdfUpload, addTaskPdfs);
router.delete('/:resourceType/:resourceId/:id', isAuthenticated, deleteTaskPdf);

module.exports = router;

