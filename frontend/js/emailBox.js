/**
 * emailBox.js
 * 
 * Simulates a mail reader inbox at the bottom-right corner of the screen.
 * Pulls mock mail notifications sent by Nodemailer / database logs fallback from the server.
 * Allows visual inspection of emails triggered by leave requests.
 */

// Wait for the DOM to load before setting up polling
document.addEventListener('DOMContentLoaded', () => {
  initEmailSimulator();
});

/**
 * Initializes the simulated email inbox widget.
 */
function initEmailSimulator() {
  // 1. Initial fetch of emails
  fetchSimulatedEmails();

  // 2. Set up automated polling every 8 seconds to capture new leave actions
  setInterval(fetchSimulatedEmails, 8000);
}

/**
 * Toggles the drawer expanded/minimized states.
 */
function toggleEmailDrawer() {
  const drawer = document.getElementById('emailSimDrawer');
  const chevron = document.getElementById('emailChevron');
  
  if (drawer && chevron) {
    drawer.classList.toggle('expanded');
    chevron.classList.toggle('rotate-180');
  }
}

// Bind drawer toggling globally
window.toggleEmailDrawer = toggleEmailDrawer;

/**
 * Calls API GET /api/dev/emails and renders email previews in the container.
 */
async function fetchSimulatedEmails() {
  const token = localStorage.getItem('offboardly_token');
  const bodyContainer = document.getElementById('emailSimBody');
  const badgeElement = document.getElementById('emailBadge');

  // If user is not authenticated yet, do not query
  if (!token) {
    if (bodyContainer) {
      bodyContainer.innerHTML = `
        <div class="text-center text-muted py-4 fs-8">
          <i class="bi bi-lock fs-3 mb-2 d-block"></i>
          Please log in to view the email simulator.
        </div>
      `;
    }
    if (badgeElement) badgeElement.textContent = '0';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/dev/emails`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const emails = await response.json();
      
      // Update badge counter
      if (badgeElement) {
        badgeElement.textContent = emails.length;
      }

      if (!bodyContainer) return;

      if (emails.length === 0) {
        bodyContainer.innerHTML = `
          <div class="text-center text-muted py-4 fs-8">
            <i class="bi bi-mailbox fs-3 mb-2 d-block text-muted-light"></i>
            No email alerts have been sent yet. Apply for leave or process request approvals to trigger emails.
          </div>
        `;
        return;
      }

      // Render list of emails
      bodyContainer.innerHTML = '';
      emails.forEach(email => {
        const emailCard = document.createElement('div');
        emailCard.className = 'email-item border rounded p-3 mb-3 bg-light shadow-sm fs-8';
        emailCard.innerHTML = `
          <div class="d-flex justify-content-between text-muted fs-9 mb-1 border-bottom pb-1">
            <span><strong>To:</strong> ${email.to_email}</span>
            <span>${email.sent_at}</span>
          </div>
          <div class="fw-bold text-cobalt mb-2 fs-7">${email.subject}</div>
          <div class="email-body-content text-secondary mt-1 p-2 bg-white rounded border fs-8" style="max-height: 120px; overflow-y: auto;">
            ${email.body}
          </div>
        `;
        bodyContainer.appendChild(emailCard);
      });
    }
  } catch (error) {
    console.error('Failed to poll simulated emails:', error.message);
  }
}

// Bind to window so other scripts (auth/dashboard/manager) can trigger email refreshes instantly
window.fetchSimulatedEmails = fetchSimulatedEmails;
