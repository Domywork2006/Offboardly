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

## ✨ Key Features

### User Authentication
- **Secure Register & Login**: Employee registration with secure password hashing (`bcryptjs`).
- **JWT Protection**: Secured session tokens that persist state across page reloads using browser `localStorage`.
- **Role-Based Routing**: Dynamically displays the appropriate dashboard features based on whether the logged-in user is an Employee or a Manager.

### Employee Features
- **Leave Balance Dashboard**: Displays Total, Taken, and Remaining leaves computed automatically from approved requests.
- **Leave Request Form**: Simple form to submit leaves with selection of Leave Types (Casual, Sick, Earned, Maternity/Paternity) and reasons.
- **Form Validation**: Blocks submissions if the End Date is before the Start Date, or if the requested days exceed the employee's remaining balance.
- **History Logs**: Shows table layout of recent and full history with status badges (Pending, Approved, Rejected).

### Manager Features
- **Pending Review Queue**: An incoming queue showing employee names, leave dates, reasons, durations, and action triggers (Approve / Reject).
- **Status Distribution Charts**: Beautiful, animated donut chart built with **Chart.js** displaying real-time proportions of Approved, Pending, and Rejected leaves.
- **Leave Calendar Grid**: Interactive, custom monthly calendar overlaying color-coded bars indicating team members on approved leaves.

### Developer Features
- **Simulated Email Inbox Drawer**: A collapsible drawer widget in the bottom-right corner that polls and lists all notification emails locally in real-time, making it easy to test notifications without configuring SMTP.

---

## 🧠 Challenges Faced & Solutions

### 1. Separate Folder CORS Block
- **Challenge**: Separating the frontend and backend into two isolated folders caused cross-origin request blocks in the browser when the frontend attempted to connect to the backend server running on port `5000`.
- **Solution**: Enabled Cross-Origin Resource Sharing on the Express backend using the `cors` package (`app.use(cors())`). This allows the frontend to run from file paths or local servers and talk to the backend seamlessly.

### 2. Timezone Offsets Skewing Calendar Days
- **Challenge**: Standard Date construction in JavaScript (`new Date("YYYY-MM-DD")`) parses values in UTC, which often shifts the calendar day backwards or forwards by one day depending on the user's local timezone.
- **Solution**: Parsed dates by splitting strings into segments (`[year, month, day]`) and creating local Dates using `new Date(year, month - 1, day)`. This locks dates to local time, preventing any timezone shift.

### 3. Native Database Driver Compilation Issues
- **Challenge**: Traditional SQLite native node bindings (`sqlite3` / `better-sqlite3`) frequently fail to compile on Windows environments without heavy C++ build tools installed.
- **Solution**: Migrated database connectivity to **MySQL** using the native JS driver `mysql2/promise`. It connects to the MySQL service out-of-the-box without requiring compilation.

### 4. Testing Email Notifications Locally
- **Challenge**: Triggering actual emails on leave submission, approval, or rejection requires valid SMTP relay credentials, which can be hard to configure and test in a local development environment.
- **Solution**: Implemented a mock database fallback in `emailService.js`. If SMTP configurations are missing, emails are logged to a database table `simulated_emails` and rendered inside a collapsible "Simulated Email Inbox" drawer in the frontend.

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
