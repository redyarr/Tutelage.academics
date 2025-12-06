// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================
// Nodemailer setup for sending enrollment and notification emails

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = process.env.FRONTEND_URL

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, 
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Test the connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

/**
 * Send enrollment application email to admin
 * @param {Object} enrollmentData - The enrollment form data
 */
async function sendEnrollmentApplicationEmail(enrollmentData) {
  const {
    name,
    email,
    phone,
    age,
    profession,
    course
  } = enrollmentData;
  
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `New Course Enrollment Application: ${course}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
           <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
              <h1 style=" color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                 TUTELAGE
              </h1>
            </div>
              <p style=" color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                 English Learning Platform
              </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            New Course Enrollment Application
          </h2>
          
          <!-- Application details -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">Application Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333; width: 140px;">Date Submitted:</td>
                <td style="padding: 8px 0; color: #666;">${currentDate} at ${currentTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Student Name:</td>
                <td style="padding: 8px 0; color: #666;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Email:</td>
                <td style="padding: 8px 0; color: #666;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Phone:</td>
                <td style="padding: 8px 0; color: #666;">${phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Age:</td>
                <td style="padding: 8px 0; color: #666;">${age} years</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Profession:</td>
                <td style="padding: 8px 0; color: #666;">${profession}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Course Applied:</td>
                <td style="padding: 8px 0; color: #f59e0b; font-weight: bold;">${course}</td>
              </tr>
            </table>
          </div>
          
          <!-- Action required section -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-top: 30px;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">
              📋 Action Required
            </h3>
            <p style="color: #856404; margin-bottom: 0; line-height: 1.5;">
              Please review this enrollment application and contact the student to discuss their learning goals, schedule availability, and proceed with the enrollment process.
            </p>
          </div>
          
          <!-- Contact info -->
          <div style="margin-top: 25px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Quick Contact:</strong> You can reply directly to this email to reach ${name} at ${email}
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage English Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve English fluency
          </p>
        </div>
      </div>
    `,
    replyTo: email,
  });
}

/**
 * Send enrollment confirmation email to the student
 * @param {Object} enrollmentData - The enrollment form data
 */
async function sendEnrollmentConfirmationEmail(enrollmentData) {
  const { name, email, course } = enrollmentData;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Enrollment Application Received - Welcome to Tutelage!',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
           <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
              <h1 style=" color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                 TUTELAGE
              </h1>
            </div>
              <p style=" color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                 English Learning Platform
              </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            Thank You for Your Application!
          </h2>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear <strong>${name}</strong>,</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thank you for applying to enroll in <strong style="color: #f59e0b;">${course}</strong> at Tutelage! 
            We're excited about the opportunity to help you achieve your English learning goals.
          </p>
          
          <!-- What happens next -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">📚 What Happens Next?</h3>
            <ol style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li><strong>Application Review:</strong> Our team will review your application within 24-48 hours</li>
              <li><strong>Contact & Assessment:</strong> We'll contact you via phone or email to discuss your learning goals and assess your current level</li>
              <li><strong>Course Scheduling:</strong> Once approved, we'll help you choose the best schedule that fits your availability</li>
              <li><strong>Welcome Package:</strong> You'll receive course materials and access to our learning platform</li>
            </ol>
          </div>
          
          <!-- Course benefits -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">
              🌟 Why You Chose Tutelage
            </h3>
            <ul style="color: #856404; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Expert native English instructors</li>
              <li>Personalized learning approach</li>
              <li>Small class sizes for maximum attention</li>
              <li>Flexible scheduling options</li>
              <li>Interactive and engaging curriculum</li>
            </ul>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            If you have any questions while we process your application, please don't hesitate to reply to this email or contact us directly.
          </p>
          
          <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
            <p style="color: #333; margin: 0; font-size: 16px;">
              <strong>Ready to start your English journey?</strong>
            </p>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">
              We look forward to welcoming you to the Tutelage family!
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage English Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve English fluency
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Send pricing information email to the student for English for Kids and Teens
 * @param {Object} pricingData - The pricing request data
 */
async function sendPricingRequestEmail(pricingData) {
  const { firstName, lastName, email, course } = pricingData;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: `${course} - Course Information & Pricing`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%;">
            <h1 style="width: 100%; color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              TUTELAGE
            </h1>
          </div>
          <p style="width: 100%; color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
            English Learning Platform
          </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            ${course} - Course Information
          </h2>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear <strong>${firstName} ${lastName}</strong>,</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thank you for your interest in our <strong style="color: #f59e0b;">${course}</strong> program! 
            We're excited to share detailed information about our course options.
          </p>

          <!-- Public Classes Section -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 20px; margin-bottom: 15px;">📚 Public Classes</h3>
            <ul style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li><strong>Live Online classes</strong></li>
              <li>For ages <strong>5-17</strong></li>
              <li>Small groups (<strong>3-5 learners only</strong>)</li>
              <li>Practice with AI companion</li>
              <li>Fun games and interactive lessons backed by Tutelage Method</li>
              <li>Age-specific for top results</li>
              <li>Certificate of completion</li>
              <li><strong>32 lessons per course</strong></li>
            </ul>
            <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 6px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                💰 <strong>Pricing:</strong> Contact us for current rates and available discounts
              </p>
            </div>
          </div>

          <!-- Private Classes Section -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 20px; margin-bottom: 15px;">👤 Private Classes</h3>
            <ul style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li><strong>Live Online classes</strong></li>
              <li>For ages <strong>5-17</strong></li>
              <li>One-on-one lessons (<strong>1 learner only</strong>)</li>
              <li>Designed course for each learner</li>
              <li>Practice with AI companion</li>
              <li>Fun games and interactive lessons backed by Tutelage Method</li>
              <li>Certificate of completion</li>
              <li>Flexibility in time and schedule</li>
              <li><strong>16 lessons</strong></li>
            </ul>
            <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 6px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                💰 <strong>Pricing:</strong> Contact us for personalized pricing based on your schedule
              </p>
            </div>
          </div>

          <!-- Why Choose Tutelage -->
          <div style="background-color: #e0f2fe; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #0369a1; margin-top: 0; font-size: 18px;">
              🌟 Why Choose Tutelage?
            </h3>
            <ul style="color: #0369a1; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Expert native English instructors</li>
              <li>Proven Tutelage Method for effective learning</li>
              <li>Small class sizes for personalized attention</li>
              <li>AI companion for extra practice</li>
              <li>Certificate of completion</li>
              <li>Flexible scheduling options</li>
            </ul>
          </div>

          <!-- Next Steps -->
          <div style="background-color: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #166534; margin-top: 0; font-size: 16px;">
              📞 Ready to Get Started?
            </h3>
            <p style="color: #166534; margin: 0; line-height: 1.6; font-size: 14px;">
              <strong>Contact our enrollment team:</strong><br>
              📧 Email: Info@tutelage.krd<br>
              📱 Phone: (+964) 07501534240 or (+964) 07701946364<br>
              <br>
              Our team will be happy to discuss pricing details, payment plans, and help you choose the best option for your child!
            </p>
          </div>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            We look forward to helping your child master English in a fun and engaging way!
          </p>

          <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
            <p style="color: #333; margin: 0; font-size: 16px;">
              <strong>Have questions?</strong>
            </p>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">
              Reply to this email or contact us directly for personalized assistance!
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage English Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve English fluency
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Send test result email to the student
 * @param {Object} resultData - The test result data
 */
async function sendTestResultEmail(resultData) {
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
  } = resultData;
  
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();
  
  // ✅ Calculate dynamic level ranges based on totalQuestions
  const ranges = [
    { level: 'A1 Beginner', min: 0, max: Math.floor(totalQuestions * 0.10), scoreMin: '0%', scoreMax: '10%' },
    { level: 'A2 Pre-intermediate', min: Math.floor(totalQuestions * 0.10) + 1, max: Math.floor(totalQuestions * 0.30), scoreMin: '13%', scoreMax: '30%' },
    { level: 'B1 Intermediate', min: Math.floor(totalQuestions * 0.30) + 1, max: Math.floor(totalQuestions * 0.53), scoreMin: '33%', scoreMax: '53%' },
    { level: 'B2 Upper-Intermediate', min: Math.floor(totalQuestions * 0.53) + 1, max: Math.floor(totalQuestions * 0.77), scoreMin: '57%', scoreMax: '77%' },
    { level: 'C1 Advanced', min: Math.floor(totalQuestions * 0.77) + 1, max: Math.floor(totalQuestions * 0.90), scoreMin: '80%', scoreMax: '90%' },
    { level: 'C2 Proficient', min: Math.floor(totalQuestions * 0.90) + 1, max: totalQuestions, scoreMin: '93%', scoreMax: '100%' }
  ];

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Your English Placement Test Results - ${level}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #fec016;
            margin-bottom: 30px;
          }
          .title {
            color: #111111;
            font-size: 28px;
            font-weight: bold;
            margin: 10px 0;
          }
          .subtitle {
            color: #666;
            font-size: 16px;
          }
          .score-box {
            background: linear-gradient(135deg, #fec016 0%, #f59e0b 100%);
            border-radius: 10px;
            padding: 25px;
            text-align: center;
            margin: 25px 0;
            color: white;
          }
          .score-number {
            font-size: 48px;
            font-weight: bold;
            margin: 10px 0;
          }
          .level-badge {
            background-color: rgba(255,255,255,0.2);
            padding: 10px 20px;
            border-radius: 25px;
            display: inline-block;
            font-size: 18px;
            font-weight: bold;
            margin-top: 10px;
          }
          .details-section {
            margin: 25px 0;
            padding: 20px;
            background-color: #f9f9f9;
            border-radius: 8px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #555;
          }
          .detail-value {
            color: #333;
          }
          .level-explanation {
            margin: 25px 0;
            padding: 20px;
            background-color: #fff8e1;
            border-left: 4px solid #fec016;
            border-radius: 5px;
          }
          .level-explanation h3 {
            color: #f59e0b;
            margin-top: 0;
          }
          .cta-button {
            display: inline-block;
            background-color: #fec016;
            color: #111111;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #777;
            font-size: 14px;
          }
          .footer a {
            color: #f59e0b;
            text-decoration: none;
          }
          .level-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .level-table th, .level-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
          }
          .level-table th {
            background-color: #f9f9f9;
            color: #333;
            font-weight: bold;
          }
          .highlight-row {
            background-color: #e0f7fa;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="title">Your Test Results</div>
            <div class="subtitle">English Placement Test - ${currentDate}</div>
          </div>

          <p>Dear ${firstName} ${lastName},</p>
          
          <p>Thank you for completing the Tutelage English Placement Test! We're pleased to share your results with you.</p>

          <div class="score-box">
            <div>Your Score</div>
            <div class="score-number">${score}%</div>
            <div class="level-badge">${level}</div>
            <div style="margin-top: 15px; font-size: 14px;">
              ${correctAnswers} out of ${totalQuestions} correct answers
            </div>
          </div>

          <div class="details-section">
            <h3 style="margin-top: 0; color: #111;">Test Summary</h3>
            <div class="detail-row">
              <span class="detail-label">Total Questions:</span>
              <span class="detail-value">${totalQuestions}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Correct Answers:</span>
              <span class="detail-value">${correctAnswers}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Score Percentage:</span>
              <span class="detail-value">${score}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Assessed Level:</span>
              <span class="detail-value"><strong>${level}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Test Date:</span>
              <span class="detail-value">${currentDate} at ${currentTime}</span>
            </div>
          </div>

          <div class="level-explanation">
            <h3>What does this mean?</h3>
            <p>Based on your performance, you have been assessed at the <strong>${level}</strong> level. This means you have ${score < 40 ? 'basic' : score < 60 ? 'intermediate' : 'advanced'} proficiency in English.</p>
            <p>Continue practicing to improve your skills and reach the next level!</p>
          </div>

          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/courses" class="cta-button">
              Explore Our Courses
            </a>
          </div>

          <h3 style="color: #1f2937;">Score Comparison Table</h3>
          <table class="level-table">
            <thead>
              <tr>
                <th>CEFR Level</th>
                <th>Correct Answers (out of ${totalQuestions})</th>
                <th>Score Range</th>
              </tr>
            </thead>
            <tbody>
              ${ranges.map(range => `
                <tr ${level === range.level ? 'class="highlight-row"' : ''}>
                  <td><strong>${range.level}</strong></td>
                  <td>${range.min} - ${range.max}</td>
                  <td>${range.scoreMin} - ${range.scoreMax}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <p style="margin-top: 30px;">We recommend reviewing the following areas to continue your English learning journey:</p>
          <ul>
            <li>Grammar fundamentals and sentence structure</li>
            <li>Vocabulary expansion through context-based learning</li>
            <li>Reading comprehension practice</li>
            <li>Speaking and listening skills development</li>
          </ul>

          <p>If you have any questions about your results or would like to discuss personalized learning options, please don't hesitate to contact us.</p>

          <div class="footer">
            <p><strong>Tutelage - Your Partner in English Learning</strong></p>
            <p>
              <a href="${FRONTEND_URL}">Visit Our Website</a> | 
              <a href="${FRONTEND_URL}/contact">Contact Us</a>
            </p>
            <p style="margin-top: 15px; font-size: 12px;">
              This email was sent to ${email} because you completed an English placement test on our platform.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Test result email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending test result email:', error);
    throw error;
  }
}

/**
 * Send placement test booking notification to admin
 */
const sendPlacementTestBookingEmail = async (bookingData) => {
  const {
    firstName,
    lastName,
    name,
    email,
    phone,
    country,
    city,
    referralSource
  } = bookingData;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 3px solid #fec016;
          margin-bottom: 30px;
        }
        .title {
          color: #1f2937;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .info-section {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #6b7280;
        }
        .info-value {
          color: #1f2937;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">🎯 New Placement Test Booking</div>
          <p style="color: #6b7280; margin: 5px 0;">A new student has requested a placement test</p>
        </div>

        <div class="info-section">
          <h3 style="margin-top: 0; color: #1f2937;">Student Information</h3>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${phone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Location:</span>
            <span class="info-value">${city}, ${country}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Referral Source:</span>
            <span class="info-value">${referralSource}</span>
          </div>
        </div>

        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #fec016;">
          <p style="margin: 0; color: #92400e;">
            <strong>⏰ Action Required:</strong> Please contact this student to schedule their placement test.
          </p>
        </div>

        <div class="footer">
          <p><strong>Tutelage Language Center</strong></p>
          <p>📧 Email: info@tutelage.com | 📱 Phone: +964 750 153 4240</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
            © ${new Date().getFullYear()} Tutelage. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Tutelage Bookings" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // Send to admin
    subject: `🎯 New Placement Test Booking - ${name}`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Placement test booking notification sent to admin:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending placement test booking email:', error);
    throw error;
  }
};

/**
 * Send placement test booking confirmation to student
 */
const sendPlacementTestConfirmationEmail = async (bookingData) => {
  const {
    firstName,
    lastName,
    name,
    email,
    phone,
    country,
    city
  } = bookingData;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 3px solid #fec016;
          margin-bottom: 30px;
        }
        .title {
          color: #1f2937;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .success-box {
          background: linear-gradient(135deg, #fec016 0%, #f59e0b 100%);
          color: white;
          padding: 30px;
          border-radius: 10px;
          text-align: center;
          margin: 20px 0;
        }
        .info-section {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .next-steps {
          background-color: #fef3c7;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #fec016;
        }
        .next-steps h3 {
          color: #92400e;
          margin-top: 0;
        }
        .next-steps ul {
          color: #78350f;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
        .social-links {
          margin: 15px 0;
        }
        .social-links a {
          color: #fec016;
          text-decoration: none;
          margin: 0 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">📝 Placement Test Booking Confirmed</div>
        </div>

        <p>Dear ${firstName} ${lastName},</p>
        <p>Thank you for booking your English placement test with Tutelage Language Center!</p>

        <div class="success-box">
          <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
          <div style="font-size: 20px; font-weight: 600;">Booking Received!</div>
          <p style="margin: 10px 0; font-size: 14px;">
            We have received your placement test booking request
          </p>
        </div>

        <div class="info-section">
          <h3 style="margin-top: 0; color: #1f2937;">Your Booking Details</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${city}, ${country}</p>
        </div>

        <div class="next-steps">
          <h3>What Happens Next?</h3>
          <ul>
            <li>Our team will review your booking request</li>
            <li>We will contact you within 24-48 hours to schedule your test</li>
            <li>You will receive test instructions and access details via email</li>
            <li>The placement test takes approximately 30 minutes</li>
            <li>After completion, you'll receive your results and course recommendations</li>
          </ul>
        </div>

        <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #1e40af;">
            <strong>💡 Need Help?</strong> If you have any questions or need to reschedule, please contact us at info@tutelage.com or call +964 750 153 4240
          </p>
        </div>

        <div class="footer">
          <p><strong>Tutelage Language Center</strong></p>
          <p>📧 Email: info@tutelage.com | 📱 Phone: +964 750 153 4240</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
            This email was sent because you requested a placement test booking.
            <br>© ${new Date().getFullYear()} Tutelage. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Tutelage Language Center" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `✓ Your Placement Test Booking Confirmed - Tutelage`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Placement test confirmation sent to student:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending placement test confirmation:', error);
    throw error;
  }
};

/**
 * Send mock test booking notification to admin
 */
const sendMockTestBookingEmail = async (bookingData) => {
  const {
    firstName,
    lastName,
    name,
    email,
    phone,
    country,
    city,
    testType,
    referralSource
  } = bookingData;

  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 3px solid #fec016;
          margin-bottom: 30px;
        }
        .title {
          color: #1f2937;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .info-section {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #6b7280;
        }
        .info-value {
          color: #1f2937;
        }
        .highlight {
          background-color: #fef3c7;
          color: #92400e;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 600;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">🎯 New Mock Test Booking Application</div>
          <p style="color: #6b7280; margin: 5px 0;">A new student has applied for a mock test</p>
        </div>

        <div class="info-section">
          <h3 style="margin-top: 0; color: #1f2937;">Student Information</h3>
          <div class="info-row">
            <span class="info-label">Date Submitted:</span>
            <span class="info-value">${currentDate} at ${currentTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${phone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Location:</span>
            <span class="info-value">${city}, ${country}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Test Type:</span>
            <span class="info-value"><span class="highlight">${testType}</span></span>
          </div>
          <div class="info-row">
            <span class="info-label">Referral Source:</span>
            <span class="info-value">${referralSource}</span>
          </div>
        </div>

        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #fec016;">
          <p style="margin: 0; color: #92400e;">
            <strong>⏰ Action Required:</strong> Please contact this student to schedule their ${testType} session.
          </p>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Quick Contact:</strong> You can reply directly to this email to reach ${name} at ${email}
          </p>
        </div>

        <div class="footer">
          <p><strong>Tutelage Language Center</strong></p>
          <p>📧 Email: info@tutelage.com | 📱 Phone: +964 750 153 4240</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
            © ${new Date().getFullYear()} Tutelage. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Tutelage Mock Test Bookings" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `🎯 New ${testType} Booking - ${name}`,
    html: htmlContent,
    replyTo: email
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Mock test booking notification sent to admin:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending mock test booking email:', error);
    throw error;
  }
};

/**
 * Send mock test booking confirmation to student
 */
const sendMockTestConfirmationEmail = async (bookingData) => {
  const {
    firstName,
    lastName,
    name,
    email,
    phone,
    country,
    city,
    testType
  } = bookingData;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 3px solid #fec016;
          margin-bottom: 30px;
        }
        .title {
          color: #1f2937;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .success-box {
          background: linear-gradient(135deg, #fec016 0%, #f59e0b 100%);
          color: white;
          padding: 30px;
          border-radius: 10px;
          text-align: center;
          margin: 20px 0;
        }
        .info-section {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .next-steps {
          background-color: #fef3c7;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #fec016;
        }
        .next-steps h3 {
          color: #92400e;
          margin-top: 0;
        }
        .next-steps ul {
          color: #78350f;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">🎉 ${testType} Booking Confirmed!</div>
        </div>

        <p>Dear ${firstName} ${lastName},</p>
        <p>Thank you for booking your <strong>${testType}</strong> with Tutelage Language Center! We're excited to help you prepare for your English speaking assessment.</p>

        <div class="success-box">
          <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
          <div style="font-size: 20px; font-weight: 600;">Booking Received!</div>
          <p style="margin: 10px 0; font-size: 14px;">
            We have received your ${testType} booking request
          </p>
        </div>

        <div class="info-section">
          <h3 style="margin-top: 0; color: #1f2937;">Your Booking Details</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${city}, ${country}</p>
          <p style="margin: 5px 0;"><strong>Test Type:</strong> <span style="color: #f59e0b; font-weight: 600;">${testType}</span></p>
        </div>

        <div class="next-steps">
          <h3>What Happens Next?</h3>
          <ul>
            <li>Our team will review your booking request</li>
            <li>We will contact you within 24-48 hours to schedule your test session</li>
            <li>You will receive detailed test instructions and access information</li>
            <li>The ${testType} session takes approximately 15-20 minutes</li>
            <li>After completion, you'll receive detailed feedback on your performance</li>
          </ul>
        </div>

        ${testType === 'Mock Test' ? `
        <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #1e40af;">
            <strong>💡 Mock Test Tips:</strong>
          </p>
          <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
            <li>Ensure you have a quiet environment</li>
            <li>Test your microphone and camera beforehand</li>
            <li>Have a stable internet connection</li>
            <li>Be ready 5 minutes before your scheduled time</li>
          </ul>
        </div>
        ` : `
        <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #1e40af;">
            <strong>💡 Test Preparation:</strong>
          </p>
          <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
            <li>No preparation needed - we assess your current level</li>
            <li>Ensure you have a quiet environment</li>
            <li>Test your microphone and camera beforehand</li>
            <li>Have a stable internet connection</li>
          </ul>
        </div>
        `}

        <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
          <p style="margin: 0; color: #166534;">
            <strong>📞 Need Help?</strong> If you have any questions or need to reschedule, please contact us at info@tutelage.com or call +964 750 153 4240
          </p>
        </div>

        <p>We look forward to working with you and helping you achieve your English learning goals!</p>

        <div class="footer">
          <p><strong>Tutelage Language Center</strong></p>
          <p>📧 Email: info@tutelage.com | 📱 Phone: +964 750 153 4240</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
            This email was sent because you requested a ${testType} booking.
            <br>© ${new Date().getFullYear()} Tutelage. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Tutelage Language Center" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `✓ Your ${testType} Booking Confirmed - Tutelage`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Mock test confirmation sent to student:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending mock test confirmation:', error);
    throw error;
  }
};

/**
 * Notify admins that a content change was queued for approval.
 * payload: { resourceType, resourceId, action, requestedByName, requestedByEmail, changesSummary }
 */
const sendApprovalRequestNotification = async (payload) => {
  const {
    resourceType,
    resourceId,
    action,
    requestedByName,
    requestedByEmail,
    changesSummary
  } = payload;

  const adminEmail = process.env.EMAIL_USER;
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Approval Request: ${action} on ${resourceType}</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: #fec016; color: #ffffff; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px; color: #333333; line-height: 1.6; }
        .content h2 { color: #f59e0b; margin-top: 0; }
        .footer { background-color: #111111; color: #ffffff; padding: 15px; text-align: center; font-size: 12px; }
        .button { display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Tutelage</h1>
        </div>
        <div class="content">
          <h2>Approval Request Notification</h2>
          <p>A new approval request has been submitted for review.</p>
          <p><strong>Resource Type:</strong> ${resourceType}</p>
          <p><strong>Action:</strong> ${action}</p>
          <p><strong>Requested By:</strong> ${requestedByEmail}</p>
          ${changesSummary ? `<p><strong>Changes Summary:</strong> ${changesSummary}</p>` : ''}
          <p>Please review and approve or reject this request in the admin dashboard.</p>
          <a href="${FRONTEND_URL}/admin-dashboard/approvals" class="button">Review Request</a>
        </div>
        <div class="footer">
          <p>&copy; 2024 Tutelage. All rights reserved.</p>
          <p>Contact us at support@tutelage.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Tutelage Admin" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `[Approval] ${action} ${resourceType} #${resourceId} queued`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Approval request notification sent to admin:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending approval request notification:', error);
    // Do not throw to avoid blocking business flow; return failure
    return { success: false, error };
  }
};

/**
 * Notify requester about approval decision.
 * payload: { resourceType, resourceId, action, status, requesterEmail, approverName, reason }
 */


/**
 * Send contact form email to admin
 * @param {Object} contactData - The contact form data
 */
async function sendContactEmail(contactData) {
  const {
    name,
    email,
    country,
    topic,
    message
  } = contactData;
  
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `New Contact Form Submission: ${topic}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
           <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
              TUTELAGE
           </h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; text-align: center;">
                 English Learning Platform
              </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            New Contact Form Submission
          </h2>
          
          <!-- Contact details -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">Contact Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333; width: 140px;">Date Submitted:</td>
                <td style="padding: 8px 0; color: #666;">${currentDate} at ${currentTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Name:</td>
                <td style="padding: 8px 0; color: #666;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Email:</td>
                <td style="padding: 8px 0; color: #666;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Country:</td>
                <td style="padding: 8px 0; color: #666;">${country}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Topic:</td>
                <td style="padding: 8px 0; color: #f59e0b; font-weight: bold;">${topic}</td>
              </tr>
            </table>
          </div>
          
          <!-- Message -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">Message</h3>
            <p style="color: #333; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          
          <!-- Action required section -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-top: 30px;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">
              📋 Action Required
            </h3>
            <p style="color: #856404; margin-bottom: 0; line-height: 1.5;">
              Please review this contact form submission and respond to the user as soon as possible.
            </p>
          </div>
          
          <!-- Contact info -->
          <div style="margin-top: 25px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Quick Reply:</strong> You can reply directly to this email to reach ${name} at ${email}
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage English Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve English fluency
          </p>
        </div>
      </div>
    `,
    replyTo: email,
  });
}

/**
 * Send Arabic enrollment application email to admin
 * @param {Object} enrollmentData - The Arabic enrollment form data
 */
async function sendArabicEnrollmentApplicationEmail(enrollmentData) {
  const {
    firstName,
    lastName,
    age,
    country,
    classType,
    phone,
    email,
    interestedIn
  } = enrollmentData;
  
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `New Arabic Course Enrollment Application: ${firstName} ${lastName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
           <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
              TUTELAGE
           </h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; text-align: center;">
                 Language Learning Platform
              </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            New Arabic Course Enrollment Application
          </h2>
          
          <!-- Application details -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">Application Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333; width: 140px;">Date Submitted:</td>
                <td style="padding: 8px 0; color: #666;">${currentDate} at ${currentTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">First Name:</td>
                <td style="padding: 8px 0; color: #666;">${firstName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Last Name:</td>
                <td style="padding: 8px 0; color: #666;">${lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Email:</td>
                <td style="padding: 8px 0; color: #666;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Phone:</td>
                <td style="padding: 8px 0; color: #666;">${phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Age:</td>
                <td style="padding: 8px 0; color: #666;">${age} years</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Country:</td>
                <td style="padding: 8px 0; color: #666;">${country}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Class Type:</td>
                <td style="padding: 8px 0; color: #f59e0b; font-weight: bold;">${classType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Interested In:</td>
                <td style="padding: 8px 0; color: #666;">${interestedIn}</td>
              </tr>
            </table>
          </div>
          
          <!-- Action required section -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-top: 30px;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">
              📋 Action Required
            </h3>
            <p style="color: #856404; margin-bottom: 0; line-height: 1.5;">
              Please review this Arabic course enrollment application and contact the student to discuss their learning goals, schedule availability, and proceed with the enrollment process.
            </p>
          </div>
          
          <!-- Contact info -->
          <div style="margin-top: 25px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Quick Contact:</strong> You can reply directly to this email to reach ${firstName} ${lastName} at ${email}
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage Language Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve language fluency
          </p>
        </div>
      </div>
    `,
    replyTo: email,
  });
}

/**
 * Send Arabic enrollment confirmation email to the student
 * @param {Object} enrollmentData - The Arabic enrollment form data
 */
async function sendArabicEnrollmentConfirmationEmail(enrollmentData) {
  const { firstName, lastName, email, classType } = enrollmentData;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Arabic Course Enrollment Application Received - Welcome to Tutelage!',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
           <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
              TUTELAGE
           </h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; text-align: center;">
                 Language Learning Platform
              </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            Thank You for Your Arabic Course Application!
          </h2>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear <strong>${firstName} ${lastName}</strong>,</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thank you for applying to enroll in our <strong style="color: #f59e0b;">Arabic Language Course</strong> at Tutelage! 
            We're excited about the opportunity to help you achieve your Arabic learning goals.
          </p>
          
          <!-- What happens next -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">📚 What Happens Next?</h3>
            <ol style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li><strong>Application Review:</strong> Our team will review your application within 24-48 hours</li>
              <li><strong>Contact & Assessment:</strong> We'll contact you via phone or email to discuss your learning goals and assess your current level</li>
              <li><strong>Course Scheduling:</strong> Once approved, we'll help you choose the best schedule that fits your availability</li>
              <li><strong>Welcome Package:</strong> You'll receive course materials and access to our learning platform</li>
            </ol>
          </div>
          
          <!-- Course benefits -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">
              🌟 Why You Chose Tutelage Arabic Course
            </h3>
            <ul style="color: #856404; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Expert native Arabic instructors</li>
              <li>Personalized learning approach tailored to your goals</li>
              <li>Small class sizes for maximum attention</li>
              <li>Interactive and engaging curriculum</li>
              <li>Flexible scheduling options</li>
              <li>Cultural insights and real-world application</li>
            </ul>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            If you have any questions while we process your application, please don't hesitate to reply to this email or contact us directly.
          </p>
          
          <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
            <p style="color: #333; margin: 0; font-size: 16px;">
              <strong>Ready to start your Arabic journey?</strong>
            </p>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">
              We look forward to welcoming you to the Tutelage family!
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage Language Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve language fluency
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Send Kurdish enrollment application email to admin
 * @param {Object} enrollmentData - The Kurdish enrollment form data
 */
async function sendKurdishEnrollmentApplicationEmail(enrollmentData) {
  const {
    firstName,
    lastName,
    age,
    country,
    classType,
    phone,
    email,
    interestedIn
  } = enrollmentData;
  
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `New Kurdish Course Enrollment Application: ${firstName} ${lastName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
           <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
              TUTELAGE
           </h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; text-align: center;">
                 Language Learning Platform
              </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            New Kurdish Course Enrollment Application
          </h2>
          
          <!-- Application details -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">Application Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333; width: 140px;">Date Submitted:</td>
                <td style="padding: 8px 0; color: #666;">${currentDate} at ${currentTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">First Name:</td>
                <td style="padding: 8px 0; color: #666;">${firstName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Last Name:</td>
                <td style="padding: 8px 0; color: #666;">${lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Email:</td>
                <td style="padding: 8px 0; color: #666;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Phone:</td>
                <td style="padding: 8px 0; color: #666;">${phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Age:</td>
                <td style="padding: 8px 0; color: #666;">${age} years</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Country:</td>
                <td style="padding: 8px 0; color: #666;">${country}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Class Type:</td>
                <td style="padding: 8px 0; color: #f59e0b; font-weight: bold;">${classType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">Interested In:</td>
                <td style="padding: 8px 0; color: #666;">${interestedIn}</td>
              </tr>
            </table>
          </div>
          
          <!-- Action required section -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-top: 30px;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">
              📋 Action Required
            </h3>
            <p style="color: #856404; margin-bottom: 0; line-height: 1.5;">
              Please review this Kurdish course enrollment application and contact the student to discuss their learning goals, schedule availability, and proceed with the enrollment process.
            </p>
          </div>
          
          <!-- Contact info -->
          <div style="margin-top: 25px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Quick Contact:</strong> You can reply directly to this email to reach ${firstName} ${lastName} at ${email}
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage Language Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve language fluency
          </p>
        </div>
      </div>
    `,
    replyTo: email,
  });
}

/**
 * Send Kurdish enrollment confirmation email to the student
 * @param {Object} enrollmentData - The Kurdish enrollment form data
 */
async function sendKurdishEnrollmentConfirmationEmail(enrollmentData) {
  const { firstName, lastName, email, classType } = enrollmentData;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Kurdish Course Enrollment Application Received - Welcome to Tutelage!',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header with Tutelage branding -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fec016 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
           <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
              TUTELAGE
           </h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; text-align: center;">
                 Language Learning Platform
              </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 30px 20px; background-color: #ffffff;">
          <h2 style="color: #111111; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; font-size: 24px;">
            Thank You for Your Kurdish Course Application!
          </h2>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear <strong>${firstName} ${lastName}</strong>,</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thank you for applying to enroll in our <strong style="color: #f59e0b;">Kurdish Language Course</strong> at Tutelage! 
            We're excited about the opportunity to help you achieve your Kurdish learning goals.
          </p>
          
          <!-- What happens next -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">📚 What Happens Next?</h3>
            <ol style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li><strong>Application Review:</strong> Our team will review your application within 24-48 hours</li>
              <li><strong>Contact & Assessment:</strong> We'll contact you via phone or email to discuss your learning goals and assess your current level</li>
              <li><strong>Course Scheduling:</strong> Once approved, we'll help you choose the best schedule that fits your availability</li>
              <li><strong>Welcome Package:</strong> You'll receive course materials and access to our learning platform</li>
            </ol>
          </div>
          
          <!-- Course benefits -->
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">
              🌟 Why You Chose Tutelage Kurdish Course
            </h3>
            <ul style="color: #856404; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Expert native Kurdish instructors</li>
              <li>Personalized learning approach tailored to your goals</li>
              <li>Small class sizes for maximum attention</li>
              <li>Interactive and engaging curriculum</li>
              <li>Flexible scheduling options</li>
              <li>Cultural insights and real-world application</li>
            </ul>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            If you have any questions while we process your application, please don't hesitate to reply to this email or contact us directly.
          </p>
          
          <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
            <p style="color: #333; margin: 0; font-size: 16px;">
              <strong>Ready to start your Kurdish journey?</strong>
            </p>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">
              We look forward to welcoming you to the Tutelage family!
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #111111; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #ffffff; margin: 0; font-size: 14px;">
            <strong>Tutelage Language Learning Platform</strong>
          </p>
          <p style="color: #a1a1aa; margin: 5px 0 0 0; font-size: 12px;">
            Empowering students to achieve language fluency
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  transporter,
  sendEnrollmentApplicationEmail,
  sendEnrollmentConfirmationEmail,
  sendPricingRequestEmail,
  sendTestResultEmail,
  sendPlacementTestBookingEmail,
  sendPlacementTestConfirmationEmail,
  sendMockTestBookingEmail,
  sendMockTestConfirmationEmail,
  sendApprovalRequestNotification,
  sendContactEmail,
  sendArabicEnrollmentApplicationEmail,
  sendArabicEnrollmentConfirmationEmail,
  sendKurdishEnrollmentApplicationEmail,
  sendKurdishEnrollmentConfirmationEmail
};


// <div class="social-links">
//             <a href="https://facebook.com/tutelage">Facebook</a> |
//             <a href="https://instagram.com/tutelage">Instagram</a> |
//             <a href="https://tutelage.com">Website</a>
//           </div>