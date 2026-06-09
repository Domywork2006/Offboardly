/**
 * server.js
 * 
 * The main Express server file. 
 * Defines all API endpoints, sets up JSON parsing, configures CORS,
 * verifies JWT authorization tokens, and connects everything to the database.
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
const emailService = require('./emailService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'offboardly_super_secret_key_1234567890';

// ==========================================
// MIDDLEWARES
// ==========================================

// Enable CORS (Cross-Origin Resource Sharing)
// This allows your frontend (which runs on a separate port/server) to connect to this API.
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// JWT Authentication Middleware
// Verifies the "Authorization" header token on protected routes.
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // The token is usually sent as "Bearer <TOKEN>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
    // Attach user payload to the request object so subsequent routes can use it
    req.user = user;
    next();
  });
}

// Middleware to restrict access to Managers only
function requireManager(req, res, next) {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }
  next();
}

// Helper: Calculate duration of leave in days (inclusive)
function calculateLeaveDays(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

// Helper: Get user's remaining leave balance
async function getRemainingLeaves(userId) {
  // 1. Get total leaves allowed for user
  const users = await db.query('SELECT total_leaves FROM users WHERE id = ?', [userId]);
  if (users.length === 0) return 0;
  const totalLeaves = users[0].total_leaves;

  // 2. Fetch all approved leave requests
  const approvedLeaves = await db.query(
    'SELECT start_date, end_date FROM leave_requests WHERE user_id = ? AND status = "Approved"',
    [userId]
  );

  // 3. Sum up the days of all approved leaves
  let leavesTaken = 0;
  approvedLeaves.forEach(leave => {
    leavesTaken += calculateLeaveDays(leave.start_date, leave.end_date);
  });

  return {
    totalLeaves,
    leavesTaken,
    remainingLeaves: totalLeaves - leavesTaken,
  };
}

// ==========================================
// ROUTES - AUTHENTICATION
// ==========================================

// POST /api/register
// Registers a new user. Default role is 'employee'.
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  // Validate inputs
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password.' });
  }

  // Ensure role is valid
  const userRole = (role === 'manager') ? 'manager' : 'employee';

  try {
    // Check if email already exists
    const existingUsers = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password securely with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into DB (Default total_leaves is 24)
    const result = await db.query(
      'INSERT INTO users (name, email, password, role, total_leaves) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, userRole, 24]
    );

    const userId = result.insertId;

    // Generate a JWT token for the user so they are immediately logged in
    const token = jwt.sign(
      { id: userId, name, email, role: userRole },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: { id: userId, name, email, role: userRole }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Internal Server Error. Registration failed.' });
  }
});

// POST /api/login
// Validates credentials and returns JWT token
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    // Find user by email
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Verify hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal Server Error. Login failed.' });
  }
});

// GET /api/me
// Returns current logged-in user data (useful for verifying token on page reload)
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const balances = await getRemainingLeaves(req.user.id);
    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        ...balances
      }
    });
  } catch (err) {
    console.error('GET /api/me error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve profile data.' });
  }
});

// ==========================================
// ROUTES - LEAVE MANAGEMENT (EMPLOYEE)
// ==========================================

// POST /api/leave
// Apply for leave. Validates start/end dates and remaining balance.
app.post('/api/leave', authenticateToken, async (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body;

  // Basic validation
  if (!leave_type || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'All fields (leave type, start date, end date, reason) are required.' });
  }

  // 1. Validation: End Date cannot be before Start Date
  const start = new Date(start_date);
  const end = new Date(end_date);
  if (end < start) {
    return res.status(400).json({ error: 'End Date cannot be before Start Date.' });
  }

  try {
    const requestedDays = calculateLeaveDays(start_date, end_date);
    const balance = await getRemainingLeaves(req.user.id);

    // 2. Validation: Leave balance should be available
    if (requestedDays > balance.remainingLeaves) {
      return res.status(400).json({
        error: `Insufficient leave balance. You requested ${requestedDays} day(s), but only have ${balance.remainingLeaves} day(s) remaining.`
      });
    }

    // Insert leave request
    const result = await db.query(
      'INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, leave_type, start_date, end_date, reason, 'Pending']
    );

    // Trigger Email Notification (simulated/real) to managers
    // We mock finding the manager email (since we have manager@offboardly.com)
    await emailService.sendEmail(
      emailService.templates.leaveSubmitted(
        req.user.name,
        leave_type,
        start_date,
        end_date,
        reason
      )
    );

    res.status(201).json({
      message: 'Leave application submitted successfully.',
      leaveId: result.insertId,
      requestedDays
    });
  } catch (err) {
    console.error('Apply leave error:', err.message);
    res.status(500).json({ error: 'Failed to submit leave application.' });
  }
});

// GET /api/leave
// Retrieves leave history of the logged-in employee
app.get('/api/leave', authenticateToken, async (req, res) => {
  try {
    const leaves = await db.query(
      'SELECT id, leave_type, DATE_FORMAT(start_date, "%Y-%m-%d") as start_date, DATE_FORMAT(end_date, "%Y-%m-%d") as end_date, reason, status, DATE_FORMAT(created_at, "%Y-%m-%d") as created_at FROM leave_requests WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    res.json(leaves);
  } catch (err) {
    console.error('Fetch leave history error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve leave history.' });
  }
});

// GET /api/leave/:id
// Get details of a specific leave request
app.get('/api/leave/:id', authenticateToken, async (req, res) => {
  const leaveId = req.params.id;

  try {
    const leaves = await db.query(
      'SELECT * FROM leave_requests WHERE id = ?',
      [leaveId]
    );

    if (leaves.length === 0) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    const leave = leaves[0];

    // Ensure users can only see their own requests, unless they are a manager
    if (leave.user_id !== req.user.id && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied. You do not own this leave request.' });
    }

    res.json(leave);
  } catch (err) {
    console.error('Fetch leave detail error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve leave request details.' });
  }
});

// PUT /api/leave/:id
// Update/edit a pending leave request
app.put('/api/leave/:id', authenticateToken, async (req, res) => {
  const leaveId = req.params.id;
  const { leave_type, start_date, end_date, reason } = req.body;

  try {
    const leaves = await db.query('SELECT * FROM leave_requests WHERE id = ?', [leaveId]);
    if (leaves.length === 0) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    const leave = leaves[0];

    // Check ownership
    if (leave.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot edit this request.' });
    }

    // Check status is still pending
    if (leave.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending leave requests can be modified.' });
    }

    // Validate dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end < start) {
      return res.status(400).json({ error: 'End Date cannot be before Start Date.' });
    }

    // Validate balance (excluding this request's original approved count, which is 0 anyway since it's Pending)
    const requestedDays = calculateLeaveDays(start_date, end_date);
    const balance = await getRemainingLeaves(req.user.id);
    if (requestedDays > balance.remainingLeaves) {
      return res.status(400).json({
        error: `Insufficient leave balance. You requested ${requestedDays} day(s), but only have ${balance.remainingLeaves} day(s) remaining.`
      });
    }

    await db.query(
      'UPDATE leave_requests SET leave_type = ?, start_date = ?, end_date = ?, reason = ? WHERE id = ?',
      [leave_type, start_date, end_date, reason, leaveId]
    );

    res.json({ message: 'Leave request updated successfully.' });
  } catch (err) {
    console.error('Update leave error:', err.message);
    res.status(500).json({ error: 'Failed to update leave request.' });
  }
});

// ==========================================
// ROUTES - MANAGER FEATURES
// ==========================================

// GET /api/leave/pending
// Retrieve all pending leave requests across all employees
app.get('/api/leave/pending', authenticateToken, requireManager, async (req, res) => {
  try {
    const pendingRequests = await db.query(`
      SELECT lr.id, lr.leave_type, 
             DATE_FORMAT(lr.start_date, "%Y-%m-%d") as start_date, 
             DATE_FORMAT(lr.end_date, "%Y-%m-%d") as end_date, 
             lr.reason, lr.status, 
             DATE_FORMAT(lr.created_at, "%Y-%m-%d") as created_at,
             u.name as employee_name, u.email as employee_email
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.status = 'Pending'
      ORDER BY lr.created_at DESC
    `);
    res.json(pendingRequests);
  } catch (err) {
    console.error('Fetch pending requests error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve pending leave requests.' });
  }
});

// PUT /api/leave/approve/:id
// Approve a leave request
app.put('/api/leave/approve/:id', authenticateToken, requireManager, async (req, res) => {
  const leaveId = req.params.id;

  try {
    // 1. Fetch leave request details and user email
    const leaves = await db.query(`
      SELECT lr.*, u.name as employee_name, u.email as employee_email 
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = ?
    `, [leaveId]);

    if (leaves.length === 0) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    const leave = leaves[0];

    if (leave.status !== 'Pending') {
      return res.status(400).json({ error: `Request has already been processed (current status: ${leave.status}).` });
    }

    // 2. Validate leave balance once more before final approval
    const requestedDays = calculateLeaveDays(leave.start_date, leave.end_date);
    const balance = await getRemainingLeaves(leave.user_id);
    if (requestedDays > balance.remainingLeaves) {
      return res.status(400).json({
        error: `Cannot approve. Employee has insufficient leave balance (${balance.remainingLeaves} remaining, requested ${requestedDays}).`
      });
    }

    // 3. Update status to Approved
    await db.query('UPDATE leave_requests SET status = "Approved" WHERE id = ?', [leaveId]);

    // 4. Send Email Notification
    await emailService.sendEmail({
      to: leave.employee_email,
      ...emailService.templates.leaveApproved(
        leave.employee_name,
        leave.leave_type,
        leave.start_date.toISOString().split('T')[0],
        leave.end_date.toISOString().split('T')[0]
      )
    });

    res.json({ message: 'Leave request approved successfully.' });
  } catch (err) {
    console.error('Approve leave error:', err.message);
    res.status(500).json({ error: 'Failed to approve leave request.' });
  }
});

// PUT /api/leave/reject/:id
// Reject a leave request
app.put('/api/leave/reject/:id', authenticateToken, requireManager, async (req, res) => {
  const leaveId = req.params.id;

  try {
    // Fetch leave details
    const leaves = await db.query(`
      SELECT lr.*, u.name as employee_name, u.email as employee_email 
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = ?
    `, [leaveId]);

    if (leaves.length === 0) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    const leave = leaves[0];

    if (leave.status !== 'Pending') {
      return res.status(400).json({ error: `Request has already been processed (current status: ${leave.status}).` });
    }

    // Update status to Rejected
    await db.query('UPDATE leave_requests SET status = "Rejected" WHERE id = ?', [leaveId]);

    // Send Email Notification
    await emailService.sendEmail({
      to: leave.employee_email,
      ...emailService.templates.leaveRejected(
        leave.employee_name,
        leave.leave_type,
        leave.start_date.toISOString().split('T')[0],
        leave.end_date.toISOString().split('T')[0]
      )
    });

    res.json({ message: 'Leave request rejected successfully.' });
  } catch (err) {
    console.error('Reject leave error:', err.message);
    res.status(500).json({ error: 'Failed to reject leave request.' });
  }
});

// GET /api/leave/all-approved
// Retrieves all approved leaves for calendar visualization
app.get('/api/leave/all-approved', authenticateToken, async (req, res) => {
  try {
    const approvedLeaves = await db.query(`
      SELECT lr.id, lr.leave_type, 
             DATE_FORMAT(lr.start_date, "%Y-%m-%d") as start_date, 
             DATE_FORMAT(lr.end_date, "%Y-%m-%d") as end_date, 
             lr.reason, u.name as employee_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.status = 'Approved'
      ORDER BY lr.start_date ASC
    `);
    res.json(approvedLeaves);
  } catch (err) {
    console.error('Fetch approved leaves error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve calendar leaves.' });
  }
});

// GET /api/manager/stats
// Retrieves counts for approved, rejected, and pending leaves for Chart.js
app.get('/api/manager/stats', authenticateToken, requireManager, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM leave_requests 
      GROUP BY status
    `);
    
    // Format response as an object
    const result = { Pending: 0, Approved: 0, Rejected: 0 };
    stats.forEach(row => {
      result[row.status] = row.count;
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch stats error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve metrics.' });
  }
});

// ==========================================
// ROUTES - DEVELOPER PORTAL
// ==========================================

// GET /api/dev/emails
// Fetches list of all simulated emails sent
app.get('/api/dev/emails', authenticateToken, async (req, res) => {
  try {
    const emails = await db.query(
      'SELECT id, to_email, subject, body, DATE_FORMAT(sent_at, "%Y-%m-%d %H:%i:%s") as sent_at FROM simulated_emails ORDER BY id DESC LIMIT 50'
    );
    res.json(emails);
  } catch (err) {
    console.error('Fetch simulated emails error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve email logs.' });
  }
});

// ==========================================
// SERVER STARTUP
// ==========================================

// Initialize the database tables and start the HTTP server
db.initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\nOffboardly API Server is running on port ${PORT}`);
    console.log(`Open API endpoint at: http://localhost:${PORT}/api/me`);
    console.log('Ensure frontend files (frontend/index.html) point to this port.\n');
  });
});
