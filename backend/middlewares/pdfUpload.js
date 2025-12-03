// ============================================================================
// PDF Upload Middleware
// ============================================================================
// Accepts multipart/form-data with optional fields `pdfFile` and `taskPdfFile`.
// Uploads provided PDFs to the RestPDF service and injects resulting URLs
// into `req.body.pdf` and/or `req.body.taskPdf` for downstream controllers.
// ============================================================================

const multer = require('multer');
const { uploadPdfBuffer } = require('../utils/restPdfClient');

// Memory storage so files are available as buffers
const storage = multer.memoryStorage();

// Only accept PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Composite middleware: parse files then upload them
const pdfUpload = (req, res, next) => {
  const fields = upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'taskPdfFile', maxCount: 1 },
    { name: 'taskPdfFiles', maxCount: 10 },
  ]);

  fields(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Invalid upload' });
    }

    try {
      // If direct URLs are provided, leave them as-is. Otherwise, upload any files.
      const pdfFile = req.files?.pdfFile?.[0];
      const taskPdfFile = req.files?.taskPdfFile?.[0];
      const taskPdfFiles = req.files?.taskPdfFiles || [];

      if (pdfFile) {
        const url = await uploadPdfBuffer(pdfFile.buffer, pdfFile.originalname);
        req.body.pdf = url;
      }

      const collected = [];
      if (taskPdfFile) {
        const url = await uploadPdfBuffer(taskPdfFile.buffer, taskPdfFile.originalname);
        collected.push({ filePath: url, fileName: taskPdfFile.originalname, fileSize: taskPdfFile.size, uploadDate: new Date().toISOString() });
      }
      if (Array.isArray(taskPdfFiles) && taskPdfFiles.length) {
        for (const f of taskPdfFiles) {
          const url = await uploadPdfBuffer(f.buffer, f.originalname);
          collected.push({ filePath: url, fileName: f.originalname, fileSize: f.size, uploadDate: new Date().toISOString() });
        }
      }
      if (collected.length) {
        req.body.taskPdfs = collected;
      }

      next();
    } catch (e) {
      console.error('PDF upload failed:', e);
      return res.status(502).json({ success: false, message: 'PDF upload failed', error: e.message });
    }
  });
};

module.exports = {
  pdfUpload,
};
