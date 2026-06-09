/**
 * database.js
 * 
 * Handles the connection to the MySQL database.
 * If the database 'offboardly_db' doesn't exist, it will create it.
 * It also automatically creates the required tables ('users', 'leave_requests', 'simulated_emails')
 * and seeds a default Manager account so you can log in right away.
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuration from the .env file
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'offboardly_db',
};

let pool;

async function initializeDatabase() {
  try {
    // 1. First, connect to MySQL WITHOUT specifying a database to ensure we can create it
    console.log('Connecting to MySQL server...');
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    // 2. Create the database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    console.log(`Database "${dbConfig.database}" verified/created successfully.`);
    await connection.end();

    // 3. Now, create a Connection Pool connected to our database
    // A connection pool manages multiple database connections efficiently.
    pool = mysql.createPool(dbConfig);

    // 4. Create "users" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('employee', 'manager') DEFAULT 'employee',
        total_leaves INT DEFAULT 24
      );
    `);
    console.log('Table "users" verified/created.');

    // 5. Create "leave_requests" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('Table "leave_requests" verified/created.');

    // 6. Create "simulated_emails" table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS simulated_emails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "simulated_emails" verified/created.');

    // 7. Seed a default Manager account if there are no users, so the app is ready to use
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      console.log('No users found in database. Seeding default accounts...');
      
      // Seed a default Manager
      const managerPasswordHash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (name, email, password, role, total_leaves) VALUES (?, ?, ?, ?, ?)',
        ['System Manager', 'manager@offboardly.com', managerPasswordHash, 'manager', 24]
      );
      
      // Seed a default Employee
      const employeePasswordHash = await bcrypt.hash('employee123', 10);
      await pool.query(
        'INSERT INTO users (name, email, password, role, total_leaves) VALUES (?, ?, ?, ?, ?)',
        ['Alice Smith', 'alice@offboardly.com', employeePasswordHash, 'employee', 24]
      );

      console.log('Default accounts seeded:');
      console.log(' - Manager: manager@offboardly.com (password: admin123)');
      console.log(' - Employee: alice@offboardly.com (password: employee123)');
    }

  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    console.error('Please check that your MySQL service is running and credentials in backend/.env are correct.');
    process.exit(1); // Stop the application if database cannot be reached
  }
}

// Helper function to query database (uses connection pool automatically)
async function query(sql, params) {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase first.');
  }
  const [results] = await pool.execute(sql, params);
  return results;
}

module.exports = {
  initializeDatabase,
  query,
};
