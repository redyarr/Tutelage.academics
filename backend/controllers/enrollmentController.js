// ============================================================================
// ENROLLMENT CONTROLLER
// ============================================================================
// Handles course enrollment form submissions and email notifications

const { sendEnrollmentApplicationEmail, sendEnrollmentConfirmationEmail, sendPricingRequestEmail, sendTestResultEmail, sendPlacementTestBookingEmail, sendPlacementTestConfirmationEmail, sendMockTestBookingEmail, sendMockTestConfirmationEmail, sendContactEmail, sendArabicEnrollmentApplicationEmail, sendArabicEnrollmentConfirmationEmail, sendKurdishEnrollmentApplicationEmail, sendKurdishEnrollmentConfirmationEmail } = require('../config/email');

/**
 * Process course enrollment form submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processEnrollment = async (req, res) => {
  try {
    console.log('📝 Processing course enrollment application');
    
    const { name, email, phone, age, profession, course, proficiencyType } = req.body;
    
    // Validate required fields
    if (!name || !email || !phone || !age || !profession || !course || !proficiencyType) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Validate phone number (basic validation)
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
    
    const enrollmentData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      age: age,
      profession: profession.trim(),
      course: course.trim(),
      proficiencyType: proficiencyType.trim()
    };
    
    console.log('📧 Sending enrollment emails...');
    
    // Send emails concurrently with better error handling
    try {
      await Promise.all([
        sendEnrollmentApplicationEmail(enrollmentData),
        sendEnrollmentConfirmationEmail(enrollmentData)
      ]);
      
      console.log('✅ Enrollment emails sent successfully');
      console.log(`📋 New enrollment: ${name} applied for ${course}`);
      
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      return res.status(200).json({
        success: true,
        message: 'Enrollment application submitted successfully! However, there was an issue sending confirmation emails. Our team will contact you directly.',
        data: {
          name: enrollmentData.name,
          course: enrollmentData.course,
          email: enrollmentData.email
        },
        warning: 'Email notification issue - team will contact you directly'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Enrollment application submitted successfully! Check your email for confirmation.',
      data: {
        name: enrollmentData.name,
        course: enrollmentData.course,
        email: enrollmentData.email
      }
    });
    
  } catch (error) {
    console.error('❌ Enrollment processing error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process enrollment application. Please try again or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Process pricing request for courses
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processPricingRequest = async (req, res) => {
  try {
    console.log('💰 Processing pricing request');
    
    const { firstName, lastName, email, course } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !course) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    const pricingData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      course: course.trim()
    };
    
    console.log('📧 Sending pricing information email...');
    
    // Send pricing email to user
    try {
      //add some condition to send different emails based on course 
      await sendPricingRequestEmail(pricingData);
      
      console.log('✅ Pricing email sent successfully');
      console.log(`📋 Pricing request: ${pricingData.name} for ${course}`);
      
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      return res.status(200).json({
        success: true,
        message: 'Pricing request submitted successfully! However, there was an issue sending the email. Our team will contact you directly.',
        data: {
          name: pricingData.name,
          course: pricingData.course,
          email: pricingData.email
        },
        warning: 'Email notification issue - team will contact you directly'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Pricing information sent successfully! Check your email.',
      data: {
        name: pricingData.name,
        course: pricingData.course,
        email: pricingData.email
      }
    });
    
  } catch (error) {
    console.error('❌ Pricing request processing error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process pricing request. Please try again or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Process test result submission and send email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processTestResult = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      country,
      yearOfBirth,
      score,
      level,
      totalQuestions,
      correctAnswers
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || score === undefined || !level) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, score, and level are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Prepare result data for email
    const resultData = {
      firstName,
      lastName,
      email,
      phone: phone || 'Not provided',
      country: country || 'Not provided',
      yearOfBirth: yearOfBirth || 'Not provided',
      score,
      level,
      totalQuestions: totalQuestions || 10,
      correctAnswers: correctAnswers || Math.round((score / 100) * (totalQuestions || 10))
    };

    // Send test result email to student
    await sendTestResultEmail(resultData);

    res.status(200).json({
      success: true,
      message: 'Test result email sent successfully'
    });

  } catch (error) {
    console.error('Error processing test result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test result email. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Process placement test booking form submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processPlacementTestBooking = async (req, res) => {
  try {
    console.log('📝 Processing placement test booking');
    
    const { firstName, lastName, email, phone, country, city, referralSource } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !country || !city || !referralSource) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Validate phone number (basic validation)
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
    
    const bookingData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      country: country.trim(),
      city: city.trim(),
      referralSource: referralSource.trim()
    };
    
    console.log('📧 Sending placement test booking emails...');
    
    // Send emails concurrently with better error handling
    try {
      await Promise.all([
        sendPlacementTestBookingEmail(bookingData),
        sendPlacementTestConfirmationEmail(bookingData)
      ]);
      
      console.log('✅ Placement test booking emails sent successfully');
      console.log(`📋 New booking: ${bookingData.name} from ${city}, ${country}`);
      
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      return res.status(200).json({
        success: true,
        message: 'Booking submitted successfully! However, there was an issue sending confirmation emails. Our team will contact you directly.',
        data: {
          name: bookingData.name,
          email: bookingData.email
        },
        warning: 'Email notification issue - team will contact you directly'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Placement test booking submitted successfully! Check your email for confirmation.',
      data: {
        name: bookingData.name,
        email: bookingData.email
      }
    });
    
  } catch (error) {
    console.error('❌ Placement test booking processing error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process booking. Please try again or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Process mock test booking form submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processMockTestBooking = async (req, res) => {
  try {
    console.log('📝 Processing mock test booking');
    
    const { firstName, lastName, email, phone, country, city, testType, referralSource } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !country || !city || !testType || !referralSource) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Validate phone number (basic validation)
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
    
    const bookingData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      country: country.trim(),
      city: city.trim(),
      testType: testType.trim(),
      referralSource: referralSource.trim()
    };
    
    console.log('📧 Sending mock test booking emails...');
    
    // Send emails concurrently with better error handling
    try {
      await Promise.all([
        sendMockTestBookingEmail(bookingData),
        sendMockTestConfirmationEmail(bookingData)
      ]);
      
      console.log('✅ Mock test booking emails sent successfully');
      console.log(`📋 New booking: ${bookingData.name} - ${testType} from ${city}, ${country}`);
      
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      return res.status(200).json({
        success: true,
        message: 'Booking submitted successfully! However, there was an issue sending confirmation emails. Our team will contact you directly.',
        data: {
          name: bookingData.name,
          email: bookingData.email,
          testType: bookingData.testType
        },
        warning: 'Email notification issue - team will contact you directly'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Mock test booking submitted successfully! Check your email for confirmation.',
      data: {
        name: bookingData.name,
        email: bookingData.email,
        testType: bookingData.testType
      }
    });
    
  } catch (error) {
    console.error('❌ Mock test booking processing error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process booking. Please try again or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Process contact form submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processContact = async (req, res) => {
  try {
    console.log('📝 Processing contact form');
    
    const { firstName, lastName, email, country, topic, message } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !country || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    const contactData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      country: country.trim(),
      topic: topic.trim(),
      message: message.trim()
    };
    
    console.log('📧 Sending contact email...');
    
    // Send contact email to admin
    try {
      await sendContactEmail(contactData);
      
      console.log('✅ Contact email sent successfully');
      console.log(`📋 Contact from: ${contactData.name} - ${topic}`);
      
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      return res.status(200).json({
        success: true,
        message: 'Contact form submitted successfully! However, there was an issue sending the email. Our team will contact you directly.',
        data: {
          name: contactData.name,
          email: contactData.email
        },
        warning: 'Email notification issue - team will contact you directly'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully! We will get back to you soon.',
      data: {
        name: contactData.name,
        email: contactData.email
      }
    });
    
  } catch (error) {
    console.error('❌ Contact processing error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process contact form. Please try again or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Process Arabic course enrollment form submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processArabicEnrollment = async (req, res) => {
  try {
    console.log('📝 Processing Arabic course enrollment application');
    
    const { firstName, lastName, age, country, classType, phone, email, interestedIn } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !age || !country || !classType || !phone || !email || !interestedIn) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Validate phone number (basic validation)
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
    
    const enrollmentData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      age: age,
      country: country.trim(),
      classType: classType.trim(),
      interestedIn: interestedIn.trim()
    };
    
    console.log('📧 Sending Arabic enrollment emails...');
    
    // Send emails concurrently with better error handling
    try {
      await Promise.all([
        sendArabicEnrollmentApplicationEmail(enrollmentData),
        sendArabicEnrollmentConfirmationEmail(enrollmentData)
      ]);
      
      console.log('✅ Arabic enrollment emails sent successfully');
      console.log(`📋 New Arabic enrollment: ${enrollmentData.name} applied for ${classType}`);
      
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      return res.status(200).json({
        success: true,
        message: 'Arabic enrollment application submitted successfully! However, there was an issue sending confirmation emails. Our team will contact you directly.',
        data: {
          name: enrollmentData.name,
          classType: enrollmentData.classType,
          email: enrollmentData.email
        },
        warning: 'Email notification issue - team will contact you directly'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Arabic enrollment application submitted successfully! Check your email for confirmation.',
      data: {
        name: enrollmentData.name,
        classType: enrollmentData.classType,
        email: enrollmentData.email
      }
    });
    
  } catch (error) {
    console.error('❌ Arabic enrollment processing error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process Arabic enrollment application. Please try again or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Process Kurdish course enrollment form submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processKurdishEnrollment = async (req, res) => {
  try {
    console.log('📝 Processing Kurdish course enrollment application');
    
    const { firstName, lastName, age, country, classType, phone, email, interestedIn } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !age || !country || !classType || !phone || !email || !interestedIn) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Validate phone number (basic validation)
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
    
    const enrollmentData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      age: age,
      country: country.trim(),
      classType: classType.trim(),
      interestedIn: interestedIn.trim()
    };
    
    console.log('📧 Sending Kurdish enrollment emails...');
    
    // Send emails concurrently with better error handling
    try {
      await Promise.all([
        sendKurdishEnrollmentApplicationEmail(enrollmentData),
        sendKurdishEnrollmentConfirmationEmail(enrollmentData)
      ]);
      
      console.log('✅ Kurdish enrollment emails sent successfully');
      console.log(`📋 New Kurdish enrollment: ${enrollmentData.name} applied for ${classType}`);
      
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      return res.status(200).json({
        success: true,
        message: 'Kurdish enrollment application submitted successfully! However, there was an issue sending confirmation emails. Our team will contact you directly.',
        data: {
          name: enrollmentData.name,
          classType: enrollmentData.classType,
          email: enrollmentData.email
        },
        warning: 'Email notification issue - team will contact you directly'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Kurdish enrollment application submitted successfully! Check your email for confirmation.',
      data: {
        name: enrollmentData.name,
        classType: enrollmentData.classType,
        email: enrollmentData.email
      }
    });
    
  } catch (error) {
    console.error('❌ Kurdish enrollment processing error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process Kurdish enrollment application. Please try again or contact support.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  processEnrollment,
  processPricingRequest,
  processTestResult,
  processPlacementTestBooking,
  processMockTestBooking,
  processContact,
  processArabicEnrollment,
  processKurdishEnrollment
};