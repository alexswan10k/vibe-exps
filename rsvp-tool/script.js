/**
 * @typedef {Object} Event
 * @property {string} eventId - Unique identifier for the event
 * @property {string} title - Event title
 * @property {string} date - Event date
 * @property {string} [time] - Event time (optional)
 * @property {string} [location] - Event location (optional)
 * @property {string} [description] - Event description (optional)
 */

/**
 * @typedef {Object} RSVP
 * @property {string} name - Name of the person RSVPing
 * @property {string} response - Response: "Attending", "Not Attending", or "Maybe"
 * @property {string} [message] - Optional message
 * @property {string} timestamp - Timestamp of the RSVP
 */

/**
 * Generates a UUID v4
 * @returns {string} A UUID string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Saves an event to localStorage
 * @param {Event} event - The event object to save
 */
function saveEvent(event) {
  const events = JSON.parse(localStorage.getItem('events') || '{}');
  events[event.eventId] = event;
  localStorage.setItem('events', JSON.stringify(events));
}

/**
 * Loads all events from localStorage
 * @returns {Object.<string, Event>} Object with eventId as keys and Event objects as values
 */
function loadEvents() {
  return JSON.parse(localStorage.getItem('events') || '{}');
}

/**
 * Saves an RSVP to localStorage
 * @param {string} eventId - The event ID
 * @param {RSVP} rsvp - The RSVP object to save
 */
function saveRSVP(eventId, rsvp) {
  const rsvps = JSON.parse(localStorage.getItem('rsvps') || '{}');
  if (!rsvps[eventId]) rsvps[eventId] = [];
  rsvps[eventId].push(rsvp);
  localStorage.setItem('rsvps', JSON.stringify(rsvps));
}

/**
 * Loads RSVPs for a specific event from localStorage
 * @param {string} eventId - The event ID
 * @returns {RSVP[]} Array of RSVP objects
 */
function loadRSVPs(eventId) {
  const rsvps = JSON.parse(localStorage.getItem('rsvps') || '{}');
  return rsvps[eventId] || [];
}

/**
 * Deletes an event and its RSVPs from localStorage
 * @param {string} eventId - The event ID to delete
 */
function deleteEvent(eventId) {
  const events = loadEvents();
  const rsvps = JSON.parse(localStorage.getItem('rsvps') || '{}');
  delete events[eventId];
  delete rsvps[eventId];
  localStorage.setItem('events', JSON.stringify(events));
  localStorage.setItem('rsvps', JSON.stringify(rsvps));
}

/**
 * Shows a message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('error' or 'success')
 */
function showMessage(message, type) {
  const messageDiv = document.getElementById('message') || document.getElementById('errorMessage');
  if (messageDiv) {
    messageDiv.innerHTML = `<p class="${type}">${message}</p>`;
    setTimeout(() => {
      messageDiv.innerHTML = '';
    }, 3000);
  }
}

/**
 * Handles creating a new event
 * @param {Event} e - The form submit event
 */
function handleCreateEvent(e) {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const location = document.getElementById('location').value;
  const description = document.getElementById('description').value;

  if (!title || !date) {
    showMessage('Title and Date are required.', 'error');
    return;
  }

  const eventId = generateUUID();
  const event = { eventId, title, date, time, location, description };
  saveEvent(event);

  // Generate invitation link
  const link = `${window.location.href.replace('create-event.html', 'rsvp.html')}?eventId=${eventId}`;
  document.getElementById('invitationLink').value = link;
  document.getElementById('linkDisplay').style.display = 'block';
  showMessage('Event created successfully!', 'success');
}

/**
 * Loads the dashboard with list of events
 */
function loadDashboard() {
  const events = loadEvents();
  const eventList = document.getElementById('eventList');
  eventList.innerHTML = '';

  for (const eventId in events) {
    const event = events[eventId];
    const rsvps = loadRSVPs(eventId);
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.innerHTML = `
      <h3>${event.title}</h3>
      <p>Date: ${event.date}</p>
      <p>RSVPs: ${rsvps.length}</p>
      <button onclick="viewEventDetails('${eventId}')">View Details</button>
    `;
    eventList.appendChild(eventItem);
  }
}

/**
 * Navigates to event details page
 * @param {string} eventId - The event ID
 */
function viewEventDetails(eventId) {
  window.location.href = `event-details.html?eventId=${eventId}`;
}

/**
 * Loads the RSVP page for a specific event
 */
function loadRSVPPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');
  if (!eventId) {
    showMessage('Invalid invitation link.', 'error');
    return;
  }

  const events = loadEvents();
  const event = events[eventId];
  if (!event) {
    showMessage('Event not found.', 'error');
    return;
  }

  document.getElementById('eventTitle').textContent = `RSVP to ${event.title}`;
  const eventDetails = document.getElementById('eventDetails');
  eventDetails.innerHTML = `
    <p><strong>Date:</strong> ${event.date}</p>
    ${event.time ? `<p><strong>Time:</strong> ${event.time}</p>` : ''}
    ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
    ${event.description ? `<p><strong>Description:</strong> ${event.description}</p>` : ''}
  `;
}

/**
 * Handles RSVP form submission
 * @param {Event} e - The form submit event
 */
function handleRSVPSubmit(e) {
  e.preventDefault();
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');
  const name = document.getElementById('name').value;
  const response = document.getElementById('response').value;
  const message = document.getElementById('message').value;

  if (!name || !response) {
    showMessage('Name and Response are required.', 'error');
    return;
  }

  const rsvp = {
    name,
    response,
    message,
    timestamp: new Date().toISOString()
  };
  saveRSVP(eventId, rsvp);

  document.getElementById('rsvpForm').style.display = 'none';
  document.getElementById('confirmation').style.display = 'block';
}

/**
 * Loads event details and RSVPs
 */
function loadEventDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');
  if (!eventId) {
    showMessage('Invalid event ID.', 'error');
    return;
  }

  const events = loadEvents();
  const event = events[eventId];
  if (!event) {
    showMessage('Event not found.', 'error');
    return;
  }

  document.getElementById('eventTitle').textContent = event.title;
  const eventInfo = document.getElementById('eventInfo');
  eventInfo.innerHTML = `
    <p><strong>Date:</strong> ${event.date}</p>
    ${event.time ? `<p><strong>Time:</strong> ${event.time}</p>` : ''}
    ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
    ${event.description ? `<p><strong>Description:</strong> ${event.description}</p>` : ''}
  `;

  const rsvps = loadRSVPs(eventId);
  const rsvpList = document.getElementById('rsvpList');
  rsvpList.innerHTML = '';
  rsvps.forEach(rsvp => {
    const rsvpItem = document.createElement('div');
    rsvpItem.className = 'rsvp-item';
    rsvpItem.innerHTML = `
      <p><strong>${rsvp.name}:</strong> ${rsvp.response}</p>
      ${rsvp.message ? `<p>Message: ${rsvp.message}</p>` : ''}
      <p><small>${new Date(rsvp.timestamp).toLocaleString()}</small></p>
    `;
    rsvpList.appendChild(rsvpItem);
  });
}

/**
 * Handles deleting an event
 */
function handleDeleteEvent() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');
  if (confirm('Are you sure you want to delete this event?')) {
    deleteEvent(eventId);
    showMessage('Event deleted successfully!', 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  }
}
