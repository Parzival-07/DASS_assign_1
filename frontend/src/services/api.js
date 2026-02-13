const API_URL = 'http://localhost:5000/api';

export const register = async (email, password, role, firstName, lastName, collegeName, contactNumber) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role, firstName, lastName, collegeName, contactNumber })
  });
  return response.json();
};

export const login = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

export const verifyToken = async (token) => {
  const response = await fetch(`${API_URL}/auth/verify`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const getUserProfile = async (token) => {
  const response = await fetch(`${API_URL}/user/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const updateProfile = async (token, profileData) => {
  const response = await fetch(`${API_URL}/user/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  });
  return response.json();
};

export const setPreferences = async (token, areasOfInterest, followingClubs) => {
  const response = await fetch(`${API_URL}/user/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ areasOfInterest, followingClubs })
  });
  return response.json();
};

export const skipOnboarding = async (token) => {
  const response = await fetch(`${API_URL}/user/skip-onboarding`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const getOrganizersToFollow = async (token) => {
  const response = await fetch(`${API_URL}/user/organizers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const getInterestAreas = async () => {
  const response = await fetch(`${API_URL}/user/interest-areas`);
  return response.json();
};

export const createOrganizer = async (token, email, password, organizationName, category, description) => {
  const response = await fetch(`${API_URL}/admin/create-organizer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ email, password, organizationName, category, description })
  });
  return response.json();
};

export const getOrganizers = async (token) => {
  const response = await fetch(`${API_URL}/admin/organizers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const deleteOrganizer = async (token, id) => {
  const response = await fetch(`${API_URL}/admin/organizer/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const createEvent = async (token, eventData) => {
  const response = await fetch(`${API_URL}/events/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(eventData)
  });
  return response.json();
};

export const getAllEvents = async (token) => {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}/events/all`, { headers });
  return response.json();
};

export const getMyEvents = async (token) => {
  const response = await fetch(`${API_URL}/events/my-events`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const getEvent = async (id) => {
  const response = await fetch(`${API_URL}/events/${id}`);
  return response.json();
};

export const updateEvent = async (token, id, eventData) => {
  const response = await fetch(`${API_URL}/events/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(eventData)
  });
  return response.json();
};

export const deleteEvent = async (token, id) => {
  const response = await fetch(`${API_URL}/events/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
