// ============================================================================
// APPROVAL CONTROLLER
// ============================================================================
// Admin-only endpoints to list, approve, and reject queued content changes
// requested by MAIN_MANAGER users. Applies updates/deletes across resources
// and keeps tag associations in sync via ResourceTag.
// ============================================================================

const { ApprovalRequest, Blog, Video, Audio, Reading, Writing, Speaking, Story, EslAudio, EslVideo, Tag, ResourceTag, User, LandingSection } = require('../models');
const { Op } = require('sequelize');
const { TAG_TYPES, setResourceTags, getResourceTags } = require('../utils/resourceTags');

// ApprovalRequest.resourceType ('Blog', 'EslAudio', ...) -> that table's own key in resource_tags
const joinTypeMap = TAG_TYPES;

// Choose model by resourceType
function getModelByType(type) {
  switch (type) {
    case 'Blog': return Blog;
    case 'Video': return Video;
    case 'Audio': return Audio;
    case 'Reading': return Reading;
    case 'Writing': return Writing;
    case 'Speaking': return Speaking;
    case 'Story': return Story;
    case 'EslAudio': return EslAudio;
    case 'EslVideo': return EslVideo;
    case 'LandingSection': return LandingSection;
    default: return null;
  }
}

// Fetch tags for a resource
async function getTagsForResource(resourceType, resourceId) {
  const type = TAG_TYPES[resourceType];
  return type ? (await getResourceTags(type, resourceId)).sort() : [];
}

// Create missing tags by name under appropriate namespace and then
// replace ResourceTag mappings for the resource.
async function applyTags(resourceType, resourceId, tagNames) {
  const type = TAG_TYPES[resourceType];
  if (type) await setResourceTags(type, resourceId, tagNames); // an empty list clears them
}

// Filter payload to known fields per model
function pickUpdateFields(resourceType, payload) {
  const ALLOWED = {
    Blog: ['title', 'content', 'imageRef', 'category', 'description', 'level', 'pdf', 'taskPdf'],
    Video: ['title', 'videoRef', 'description', 'pdf', 'taskPdf', 'level'],
    Audio: ['title', 'description', 'transcript', 'audioRef', 'pdf', 'taskPdf', 'imageUrl', 'level'],
    Reading: ['title', 'content', 'description', 'pdf', 'taskPdf', 'imageUrl', 'level', 'tags'],
    Writing: ['title', 'content', 'description', 'pdf', 'taskPdf', 'imageUrl', 'contentImageUrl', 'level', 'tags'],
    Speaking: ['title', 'imageUrl', 'description', 'content', 'transcript', 'videoRef', 'pdf', 'taskPdf', 'level', 'tags'],
    Story: ['title', 'imageUrl', 'description', 'contentText', 'audioRef', 'pdf', 'taskPdf', 'wordCount', 'level', 'tags'],
    EslAudio: ['title', 'imageUrl', 'description', 'transcript', 'audioRef', 'pdf', 'taskPdf', 'level'],
    EslVideo: ['title', 'videoRef', 'description', 'pdf', 'taskPdf', 'thumbnailUrl', 'level', 'tags'],
    LandingSection: ['title', 'subtitle', 'imageUrl']
  };
  const allowed = ALLOWED[resourceType] || [];
  const out = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) out[key] = payload[key];
  }
  return out;
}

// ============================================================================
// LIST APPROVALS (Admin)
// ============================================================================
exports.listApprovals = async (req, res) => {
  try {
    const { status = 'PENDING', resourceType } = req.query;
    const where = {};
    if (status && status !== 'ALL') where.status = status.toUpperCase();
    if (resourceType) where.resourceType = resourceType;

    const approvals = await ApprovalRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { association: 'requester', attributes: ['id', 'name', 'email', 'role'] },
        { association: 'approver', attributes: ['id', 'name', 'email', 'role'] }
      ]
    });

    // Enhance approval data for better frontend display
    const enhancedApprovals = await Promise.all(approvals.map(async (approval) => {
      const approvalData = approval.toJSON();

      try {
        if (approval.action === 'UPDATE' && approval.resourceId) {
          // For updates, compare current data with requested changes
          const Model = getModelByType(approval.resourceType);
          if (Model) {
            const currentRecord = await Model.findByPk(approval.resourceId);
            if (currentRecord) {
              let currentData = currentRecord.toJSON();
              
              // Fetch tags for resources that support them
              if (joinTypeMap[approval.resourceType]) {
                currentData.tags = await getTagsForResource(approval.resourceType, approval.resourceId);
              }
              
              const changes = {};

              // Compare each field in the payload with current data
              // Only show actual changes, not fields that were included but not modified
              Object.keys(approval.payload).forEach(key => {
                const payloadValue = approval.payload[key];
                const currentValue = currentData[key];

                // Skip if payload value is undefined (field wasn't actually changed)
                if (payloadValue === undefined) return;

                // For arrays (like tags), compare sorted versions
                let payloadStr, currentStr;
                if (Array.isArray(payloadValue) && Array.isArray(currentValue)) {
                  payloadStr = JSON.stringify([...payloadValue].sort());
                  currentStr = JSON.stringify([...currentValue].sort());
                } else {
                  payloadStr = JSON.stringify(payloadValue);
                  currentStr = JSON.stringify(currentValue);
                }

                if (payloadStr !== currentStr) {
                  changes[key] = {
                    from: currentValue,
                    to: payloadValue
                  };
                }
              });

              approvalData.enhancedPayload = {
                type: 'UPDATE',
                changes: changes,
                summary: `Update ${Object.keys(changes).length} field(s) in ${approval.resourceType}`
              };
            } else {
              // Record not found, show what would be updated
              approvalData.enhancedPayload = {
                type: 'UPDATE',
                changes: Object.keys(approval.payload).reduce((acc, key) => {
                  acc[key] = { from: 'N/A', to: approval.payload[key] };
                  return acc;
                }, {}),
                summary: `Update ${Object.keys(approval.payload).length} field(s) in ${approval.resourceType} (record not found)`
              };
            }
          } else {
            // Model not found, fallback to showing payload
            approvalData.enhancedPayload = {
              type: 'UPDATE',
              changes: Object.keys(approval.payload).reduce((acc, key) => {
                acc[key] = { from: 'N/A', to: approval.payload[key] };
                return acc;
              }, {}),
              summary: `Update ${Object.keys(approval.payload).length} field(s) in ${approval.resourceType}`
            };
          }
        } else if (approval.action === 'DELETE' && approval.resourceId) {
          // For deletes, fetch current data to show what will be deleted
          const Model = getModelByType(approval.resourceType);
          if (Model) {
            const currentRecord = await Model.findByPk(approval.resourceId);
            if (currentRecord) {
              const currentData = currentRecord.toJSON();
              approvalData.enhancedPayload = {
                type: 'DELETE',
                currentData: currentData,
                summary: `Delete ${approval.resourceType}: "${currentData.title || currentData.name || `ID: ${approval.resourceId}`}"`
              };
            } else {
              // Record not found to delete
              approvalData.enhancedPayload = {
                type: 'DELETE',
                currentData: { id: approval.resourceId, note: 'Record not found - may have been already deleted' },
                summary: `Delete ${approval.resourceType} with ID: ${approval.resourceId} (record not found)`
              };
            }
          } else {
            // Model not found
            approvalData.enhancedPayload = {
              type: 'DELETE',
              currentData: { id: approval.resourceId, resourceType: approval.resourceType },
              summary: `Delete ${approval.resourceType} with ID: ${approval.resourceId}`
            };
          }
        } else if (approval.action === 'CREATE') {
          // For creates, show what will be created
          approvalData.enhancedPayload = {
            type: 'CREATE',
            newData: approval.payload,
            summary: `Create new ${approval.resourceType}: "${approval.payload.title || approval.payload.name || 'Untitled'}"`
          };
        } else {
          // Fallback for unknown actions
          approvalData.enhancedPayload = {
            type: approval.action || 'UNKNOWN',
            rawData: approval.payload,
            summary: `${approval.action || 'Unknown action'} on ${approval.resourceType}`
          };
        }
      } catch (error) {
        console.error('Error enhancing approval payload:', error);
        // Fallback to basic enhanced payload
        approvalData.enhancedPayload = {
          type: approval.action || 'UNKNOWN',
          rawData: approval.payload,
          summary: `${approval.action || 'Unknown action'} on ${approval.resourceType} (error processing details)`
        };
      }

      return approvalData;
    }));

    return res.status(200).json({ success: true, approvals: enhancedApprovals });
  } catch (error) {
    console.error('❌ listApprovals error:', error);
    return res.status(500).json({ success: false, message: 'Server error listing approvals', error: error.message });
  }
};

// ============================================================================
// GET APPROVAL BY ID (Admin)
// ============================================================================
exports.getApprovalById = async (req, res) => {
  try {
    const { id } = req.params;
    const approval = await ApprovalRequest.findByPk(id, {
      include: [
        { association: 'requester', attributes: ['id', 'name', 'email', 'role'] },
        { association: 'approver', attributes: ['id', 'name', 'email', 'role'] }
      ]
    });
    if (!approval) return res.status(404).json({ success: false, message: 'Approval request not found' });
    return res.status(200).json({ success: true, approval });
  } catch (error) {
    console.error('❌ getApprovalById error:', error);
    return res.status(500).json({ success: false, message: 'Server error getting approval', error: error.message });
  }
};

// ============================================================================
// APPROVE REQUEST (Admin)
// ============================================================================
exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const approval = await ApprovalRequest.findByPk(id);
    if (!approval) return res.status(404).json({ success: false, message: 'Approval request not found' });
    if (approval.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Request already ${approval.status.toLowerCase()}` });
    }

    const Model = getModelByType(approval.resourceType);
    if (!Model) return res.status(400).json({ success: false, message: 'Unsupported resource type' });

    if (approval.action === 'DELETE') {
      // Clean up tags (only for resources that use tags) and delete resource
      const ns = joinTypeMap[approval.resourceType];
      if (ns) {
        await setResourceTags(ns, approval.resourceId, []);
      }
      const row = await Model.findByPk(approval.resourceId);
      if (row) await row.destroy();
    } else if (approval.action === 'UPDATE') {
      const payload = approval.payload || {};
      const fields = pickUpdateFields(approval.resourceType, payload);
      const row = await Model.findByPk(approval.resourceId);
      if (!row) {
        return res.status(404).json({ success: false, message: 'Target resource not found' });
      }
      await row.update(fields);
      if (Array.isArray(payload.tags)) {
        await applyTags(approval.resourceType, approval.resourceId, payload.tags);
      }
    } else if (approval.action === 'CREATE') {
      const payload = approval.payload || {};
      const fields = pickUpdateFields(approval.resourceType, payload);
      // Compute wordCount for Story if missing
      if (approval.resourceType === 'Story' && fields.wordCount == null && typeof fields.contentText === 'string') {
        fields.wordCount = fields.contentText.split(/\s+/).filter(Boolean).length;
      }
      // Ensure createdBy is set to requester
      fields.createdBy = fields.createdBy || approval.requestedBy;
      const created = await Model.create(fields);
      // Persist tags association if provided
      if (Array.isArray(payload.tags)) {
        await applyTags(approval.resourceType, created.id, payload.tags);
      }
      // Backfill resourceId on approval
      approval.resourceId = created.id;
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported action' });
    }

    approval.status = 'APPROVED';
    approval.approvedBy = req.user.id;
    await approval.save();

    

    return res.status(200).json({ success: true, message: 'Approval applied successfully', approvalId: approval.id });
  } catch (error) {
    console.error('❌ approve error:', error);
    return res.status(500).json({ success: false, message: 'Server error approving request', error: error.message });
  }
};

// ============================================================================
// REJECT REQUEST (Admin)
// ============================================================================
exports.reject = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const approval = await ApprovalRequest.findByPk(id);
    if (!approval) return res.status(404).json({ success: false, message: 'Approval request not found' });
    if (approval.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Request already ${approval.status.toLowerCase()}` });
    }

    approval.status = 'REJECTED';
    approval.approvedBy = req.user.id;
    approval.reason = reason || null;
    await approval.save();

    

    return res.status(200).json({ success: true, message: 'Request rejected', approvalId: approval.id });
  } catch (error) {
    console.error('❌ reject error:', error);
    return res.status(500).json({ success: false, message: 'Server error rejecting request', error: error.message });
  }
};