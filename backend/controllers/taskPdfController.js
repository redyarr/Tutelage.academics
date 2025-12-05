const { TaskPdf, Video, Audio, Speaking, Writing, Reading, Story, Blog, EslVideo, EslAudio } = require('../models');

const VALID_TYPES = new Set(['video','audio','speaking','writing','reading','story','blog','esl_video','esl_audio']);

async function resolveResource(resourceType, resourceId) {
  if (!VALID_TYPES.has(resourceType)) return null;
  const id = parseInt(resourceId);
  if (Number.isNaN(id)) return null;
  const map = {
    video: Video,
    audio: Audio,
    speaking: Speaking,
    writing: Writing,
    reading: Reading,
    story: Story,
    blog: Blog,
    esl_video: EslVideo,
    esl_audio: EslAudio,
  };
  const Model = map[resourceType];
  return Model.findByPk(id);
}

exports.listTaskPdfs = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const resource = await resolveResource(resourceType, resourceId);
    if (!resource) return res.status(404).json({ success: false });
    const items = await TaskPdf.findAll({ where: { resourceType, resourceId: parseInt(resourceId) }, order: [['id','DESC']] });
    res.status(200).json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.addTaskPdfs = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const resource = await resolveResource(resourceType, resourceId);
    if (!resource) return res.status(404).json({ success: false });
    const incoming = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    const rows = incoming
      .filter(p => p && p.filePath && p.fileName)
      .map(p => ({ resourceType, resourceId: parseInt(resourceId), filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
    if (!rows.length) return res.status(400).json({ success: false, message: 'No valid PDFs' });
    const created = await TaskPdf.bulkCreate(rows, { returning: true });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.deleteTaskPdf = async (req, res) => {
  try {
    const { resourceType, resourceId, id } = req.params;
    const resource = await resolveResource(resourceType, resourceId);
    if (!resource) return res.status(404).json({ success: false });
    const row = await TaskPdf.findOne({ where: { id: parseInt(id), resourceType, resourceId: parseInt(resourceId) } });
    if (!row) return res.status(404).json({ success: false });
    await row.destroy();
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

