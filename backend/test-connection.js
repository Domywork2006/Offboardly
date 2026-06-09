/**
 * test-connection.js
 * 
 * A simple utility script to check if the database can be reached.
 * Run it using: node test-connection.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

async function test() {
  console.log('--- Testing MySQL Connection ---');
  console.log(`Host: ${dbConfig.host}`);
  console.log(`User: ${dbConfig.user}`);
  console.log(`Password: ${dbConfig.password ? '****' : '(none)'}`);

  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('\nSuccess! Successfully connected to MySQL server.');
    
    const [rows] = await connection.query('SELECT VERSION() as version');
    console.log(`MySQL Server Version: ${rows[0].version}`);
    
    await connection.end();
    console.log('Connection closed cleanly.');
  } catch (error) {
    console.error('\nERROR: Failed to connect to MySQL server.');
    console.error(error.message);
    console.error('\nTips to fix:');
    console.log('1. Make sure your MySQL server is running (check XAMPP, MySQL Workbench, or Services).');
    console.log('2. Verify that DB_USER and DB_PASSWORD in backend/.env match your credentials.');
  }
}

test();
