// ============================================================================
// LANDING SECTION CONTROLLER
// ============================================================================
// CRUD operations for LandingSection model. Public reads, admin-protected writes.
// ============================================================================

const { Op } = require('sequelize');
const { LandingSection, User, ApprovalRequest } = require('../models');
const { sendApprovalRequestNotification } = require('../config/email');

/**
 * Create a new landing section entry (Admin only)
 */
const createLandingSection = async (req, res) => {
  try {
    const { title, subtitle, imageUrl } = req.body;

    if (!title || !subtitle || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'title, subtitle, and imageUrl are required'
      });
    }

    const createdBy = req.user?.id;
    const role = req.user?.role;
    if (!createdBy) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Queue for admin approval when MAIN_MANAGER requests creation
    if (role === 'MAIN_MANAGER') {
      const payload = { title, subtitle, imageUrl, createdBy };
      const approval = await ApprovalRequest.create({
        resourceType: 'LandingSection',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'LandingSection',
          resourceId: null,
          action: 'CREATE',
          requestedByEmail: req.user?.email,
          changesSummary: Object.keys(payload)
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send create approval email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        queuedForApproval: true,
        approvalRequestId: approval.id,
        message: 'Landing section creation queued for admin approval'
      });
    }

    const entry = await LandingSection.create({ title, subtitle, imageUrl, createdBy });
    const withAuthor = await LandingSection.findByPk(entry.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'role'] }]
    });

    return res.status(201).json({
      success: true,
      message: 'Landing section created successfully',
      landingSection: withAuthor
    });
  } catch (error) {
    console.error('❌ createLandingSection error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating landing section', error: error.message });
  }
};

/**
 * Get the latest landing section entry (Public)
 */
const getLatestLandingSection = async (req, res) => {
  try {
    const latest = await LandingSection.findOne({
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'role'] }]
    });

    return res.status(200).json({ success: true, landingSection: latest });
  } catch (error) {
    console.error('❌ getLatestLandingSection error:', error);
    return res.status(500).json({ success: false, message: 'Server error getting landing section', error: error.message });
  }
};

/**
 * Get all landing section entries with pagination (Public)
 */
const getAllLandingSections = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { rows, count } = await LandingSection.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'role'] }]
    });

    return res.status(200).json({
      success: true,
      landingSections: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('❌ getAllLandingSections error:', error);
    return res.status(500).json({ success: false, message: 'Server error getting landing sections', error: error.message });
  }
};

/**
 * Get a landing section by ID (Public)
 */
const getLandingSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Landing section ID is required' });
    }

    const entry = await LandingSection.findByPk(id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'role'] }]
    });

    if (!entry) {
      const entry = await LandingSection.create({ title: "Welcome to Our Platform", subtitle: "Empowering Your Learning Journey", imageUrl: "https://www.shutterstock.com/image-photo/introduction-presentation-concept-male-hand-260nw-2287141137.jpg", createdBy: 1 });
     return res.status(200).json({
      success: true,
      message: 'Landing section fetched successfully',
      landingSection: entry
    });
    }

    return res.status(200).json({
      success: true,
      message: 'Landing section fetched successfully',
      landingSection: entry
    });
  } catch (error) {
    console.error('❌ getLandingSectionById error:', error);
    return res.status(500).json({ success: false, message: 'Server error getting landing section', error: error.message });
  }
};

/**
 * Update a landing section entry by ID (Admin only)
 */
const updateLandingSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, imageUrl } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Landing section ID is required' });
    }

    const entry = await LandingSection.findByPk(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Landing section not found' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

    // Queue for admin approval when MAIN_MANAGER requests update
    if (req.user?.role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'LandingSection',
        resourceId: entry.id,
        action: 'UPDATE',
        payload: updateData,
        status: 'PENDING',
        requestedBy: req.user?.id
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'LandingSection',
          resourceId: entry.id,
          action: 'UPDATE',
          requestedByEmail: req.user?.email,
          changesSummary: Object.keys(updateData)
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send update approval email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        queuedForApproval: true,
        approvalRequestId: approval.id,
        message: 'Landing section update queued for admin approval'
      });
    }

    await entry.update(updateData);

    const updated = await LandingSection.findByPk(id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'role'] }]
    });

    return res.status(200).json({
      success: true,
      message: 'Landing section updated successfully',
      landingSection: updated
    });
  } catch (error) {
    console.error('❌ updateLandingSection error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating landing section', error: error.message });
  }
};

/**
 * Delete a landing section entry by ID (Admin only)
 */
const deleteLandingSection = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Landing section ID is required' });
    }

    const entry = await LandingSection.findByPk(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Landing section not found' });
    }

    // Queue for admin approval when MAIN_MANAGER requests deletion
    if (req.user?.role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'LandingSection',
        resourceId: entry.id,
        action: 'DELETE',
        payload: {},
        status: 'PENDING',
        requestedBy: req.user?.id
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'LandingSection',
          resourceId: entry.id,
          action: 'DELETE',
          requestedByEmail: req.user?.email,
          changesSummary: ['DELETE']
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send delete approval email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        queuedForApproval: true,
        approvalRequestId: approval.id,
        message: 'Landing section deletion queued for admin approval'
      });
    }

    await entry.destroy();

    return res.status(200).json({
      success: true,
      message: 'Landing section deleted successfully'
    });
  } catch (error) {
    console.error('❌ deleteLandingSection error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting landing section', error: error.message });
  }
};

module.exports = {
  createLandingSection,
  getLatestLandingSection,
  getAllLandingSections,
  getLandingSectionById,
  updateLandingSection,
  deleteLandingSection
};