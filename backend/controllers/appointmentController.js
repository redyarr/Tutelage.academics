// ============================================================================
// APPOINTMENT CONTROLLER
// ============================================================================
// This controller handles all CRUD operations for appointments with proper
// validation, pagination, filtering, and status management.
// ============================================================================

const { Appointment } = require('../models');
const { Op } = require('sequelize');

// ============================================================================
// CREATE APPOINTMENT
// ============================================================================
/**
 * Create a new appointment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createAppointment = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      age,
      country,
      jobTitle,
      purpose,
      status = 'PENDING'
    } = req.body;

    // Validation
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }

    // Validate status if provided
    const validStatuses = ['PENDING', 'CONTACTED', 'SCHEDULED', 'DONE'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: PENDING, CONTACTED, SCHEDULED, DONE'
      });
    }

    const appointment = await Appointment.create({
      firstName,
      lastName,
      age,
      country,
      jobTitle,
      purpose,
      status
    });

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message
    });
  }
};

// ============================================================================
// GET ALL APPOINTMENTS
// ============================================================================
/**
 * Get all appointments with infinite scroll pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllAppointments = async (req, res) => {
  try {
    const {
      cursor, // For cursor-based pagination (ID of last item)
      limit = 10,
      search,
      status,
      country,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const whereClause = {};

    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { jobTitle: { [Op.like]: `%${search}%` } },
        { purpose: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    // Filter by country
    if (country) {
      whereClause.country = { [Op.like]: `%${country}%` };
    }

    // Add cursor condition for infinite scroll
    if (cursor) {
      if (sortOrder.toUpperCase() === 'DESC') {
        whereClause.id = { [Op.lt]: parseInt(cursor) };
      } else {
        whereClause.id = { [Op.gt]: parseInt(cursor) };
      }
    }

    // Fetch one extra item to check if there are more items
    const fetchLimit = parseInt(limit) + 1;

    const appointments = await Appointment.findAll({
      where: whereClause,
      limit: fetchLimit,
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()] // Secondary sort by ID for consistent pagination
      ],
      distinct: true
    });

    // Check if there are more items
    const hasMore = appointments.length > parseInt(limit);
    
    // Remove the extra item if it exists
    const items = hasMore ? appointments.slice(0, parseInt(limit)) : appointments;
    
    // Get the cursor for the next request (ID of the last item)
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        nextCursor,
        hasMore,
        itemsPerPage: parseInt(limit),
        totalItemsReturned: items.length
      }
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

// ============================================================================
// GET APPOINTMENT BY ID
// ============================================================================
/**
 * Get a specific appointment by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment',
      error: error.message
    });
  }
};

// ============================================================================
// UPDATE APPOINTMENT
// ============================================================================
/**
 * Update an appointment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      age,
      country,
      jobTitle,
      purpose,
      status
    } = req.body;

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['PENDING', 'CONTACTED', 'SCHEDULED', 'DONE'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: PENDING, CONTACTED, SCHEDULED, DONE'
        });
      }
    }

    const updatedAppointment = await appointment.update({
      firstName: firstName || appointment.firstName,
      lastName: lastName || appointment.lastName,
      age: age !== undefined ? age : appointment.age,
      country: country !== undefined ? country : appointment.country,
      jobTitle: jobTitle !== undefined ? jobTitle : appointment.jobTitle,
      purpose: purpose !== undefined ? purpose : appointment.purpose,
      status: status || appointment.status
    });

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message
    });
  }
};

// ============================================================================
// DELETE APPOINTMENT
// ============================================================================
/**
 * Delete an appointment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    await appointment.destroy();

    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointment',
      error: error.message
    });
  }
};

// ============================================================================
// GET APPOINTMENTS BY STATUS
// ============================================================================
/**
 * Get appointments by status with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAppointmentsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const validStatuses = ['PENDING', 'CONTACTED', 'SCHEDULED', 'DONE'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: PENDING, CONTACTED, SCHEDULED, DONE'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: { status: status.toUpperCase() },
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]], // id breaks createdAt ties so pages never overlap
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching appointments by status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments by status',
      error: error.message
    });
  }
};

// ============================================================================
// SEARCH APPOINTMENTS BY NAME
// ============================================================================
/**
 * Search appointments by first name or last name
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const searchAppointmentsByName = async (req, res) => {
  try {
    const {
      query,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: {
        [Op.or]: [
          { firstName: { [Op.like]: `%${query}%` } },
          { lastName: { [Op.like]: `%${query}%` } }
        ]
      },
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]], // id breaks createdAt ties so pages never overlap
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error searching appointments by name:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search appointments by name',
      error: error.message
    });
  }
};

// ============================================================================
// GET APPOINTMENT STATISTICS
// ============================================================================
/**
 * Get appointment statistics (count by status)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAppointmentStats = async (req, res) => {
  try {
    const stats = await Appointment.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const formattedStats = {
      PENDING: 0,
      CONTACTED: 0,
      SCHEDULED: 0,
      DONE: 0
    };

    stats.forEach(stat => {
      formattedStats[stat.status] = parseInt(stat.count);
    });

    const totalAppointments = Object.values(formattedStats).reduce((sum, count) => sum + count, 0);

    res.status(200).json({
      success: true,
      data: {
        statusCounts: formattedStats,
        totalAppointments
      }
    });
  } catch (error) {
    console.error('Error fetching appointment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment statistics',
      error: error.message
    });
  }
};

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByStatus,
  searchAppointmentsByName,
  getAppointmentStats
};