# Offboardly - Employee Leave Management System

Offboardly is a modern, professional, and lightweight Employee Leave Management System designed to allow employees to submit leave requests and managers to review, approve, or decline them. 

The application features a clean, responsive single-page architecture built with plain frontend languages (HTML, CSS, Bootstrap) and a robust Node.js Express backend using MySQL for database storage.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, Bootstrap 5.3 (CDN), Chart.js (CDN)
- **Backend**: Node.js, Express.js
- **Database**: MySQL (using `mysql2` connection pools)
- **Authentication**: JSON Web Token (JWT) & `bcryptjs` password hashing
- **Notifications**: Nodemailer (with an automatic visual email simulator fallback)

---

## 📂 Project Directory Structure

```
Offboardly/
├── README.md             <-- You are here
├── .gitignore            <-- Excludes Node dependencies and secret files
└── backend/
│   ├── .env.example      <-- Template configuration for database credentials
│   ├── package.json      <-- Backend package specifications
│   ├── server.js         <-- Express server APIs and JWT verification
│   ├── database.js       <-- Automatically creates database and schema tables
│   ├── emailService.js   <-- Coordinates mail dispatches and fallback logging
│   └── test-connection.js<-- Database connection check tool
└── frontend/
    ├── index.html        <-- Main client view (forms, dashboards, calendar)
    ├── css/
    │   └── style.css     <-- Custom corporate design styles (Cobalt theme)
    └── js/
        ├── auth.js       <-- Client auth requests & dashboard routing
        ├── dashboard.js  <-- Employee logic, balance calculations, histories
        ├── manager.js    <-- Manager operations, approvals, Chart.js views
        ├── calendar.js   <-- CSS Grid monthly calendar overlay
        └── emailBox.js   <-- Developer inbox console drawer
```

---

## 🚀 Quick Start Guide

### 1. Database Configuration
1. Make sure your local **MySQL** service is running.
2. In the `backend/` folder, copy `.env.example` to `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Open `backend/.env` and edit your MySQL root credentials:
   ```env
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   ```

### 2. Verify Database Connection
Run the connection utility to test that your Node environment can talk to your MySQL service:
```bash
cd backend
node test-connection.js
```
*If you see "Success! Successfully connected to MySQL server.", you are ready to start.*

### 3. Run the Backend API Server
Start the server in development mode (using nodemon for automatic restarts when files change):
```bash
npm run dev
```
*(Or use `npm start` to run with standard Node).*

On startup, the backend automatically creates the `offboardly_db` database and seeds default credentials:
- **Manager**: `manager@offboardly.com` (password: `admin123`)
- **Employee**: `alice@offboardly.com` (password: `employee123`)

### 4. Launch the Frontend
Because Cross-Origin Resource Sharing (CORS) is enabled on the backend, you can open the frontend page directly:
- Open `frontend/index.html` in your browser (double-click the file), OR
- Right-click `frontend/index.html` in VS Code and select **Open with Live Server**.

---

## 💡 Key Features & Code Logic

1. **Automatic Database Provisioning**: No need to manually import `.sql` files. The backend checks for tables on startup and creates them automatically.
2. **Strict Client-Side & Server-Side Validation**:
   - Blocks applying for a leave when the end date is prior to the start date.
   - Computes leave request durations and checks remaining balances, blocking requests that exceed available leave days.
3. **Simulated Email Console Widget**: If you do not configure SMTP credentials in `.env`, the system saves all email notification layouts inside the database. A collapsible drawer in the bottom right of the frontend screen polls these logs and displays them, allowing you to test submission, approval, and rejection alerts locally.
4. **Custom CSS Grid Calendar**: Displays a clean month grid overlaying colored strips of team members on approved leaves.
