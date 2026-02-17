import React, { useState, useEffect } from 'react';
import CreateEventForm from './CreateEventForm';
import OrganizerEventDetail from './OrganizerEventDetail';
import OrganizerProfile from './OrganizerProfile';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function OrganizerDashboard({ user, token, logout }) {
  const [page, setPage] = useState('dashboard');
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [ongoingEvents, setOngoingEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [resetReason, setResetReason] = useState('');
  const [resetRequests, setResetRequests] = useState([]);
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    if (page === 'dashboard') loadDashboard();
    if (page === 'ongoing') loadOngoing();
    if (page === 'password-reset') loadResetRequests();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadResetRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/reset-request/my-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setResetRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading reset requests');
    }
  };

  const handleResetRequest = async () => {
    setResetMessage('');
    try {
      const res = await fetch(`${API_URL}/reset-request/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason: resetReason })
      });
      const data = await res.json();
      if (res.ok) {
        setResetMessage(data.message);
        setResetReason('');
        loadResetRequests();
      } else {
        setResetMessage(data.message || 'Failed to submit request');
      }
    } catch (err) {
      setResetMessage('Error submitting request');
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/organizer/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEvents(data.events || []);
      setAnalytics(data.analytics || {});
    } catch (err) {
      console.error('Error loading dashboard');
    }
    setLoading(false);
  };

  const loadOngoing = async () => {
    try {
      const res = await fetch(`${API_URL}/organizer/ongoing`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setOngoingEvents(data);
    } catch (err) {
      console.error('Error loading ongoing events');
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await fetch(`${API_URL}/events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadDashboard();
    } catch (err) {
      alert('Error deleting event');
    }
  };

  const getStatusClass = (status) => {
    const classes = { draft: 'bg-gray-500', published: 'bg-green-600', ongoing: 'bg-blue-600', completed: 'bg-teal-500', closed: 'bg-red-600' };
    return classes[status] || 'bg-gray-500';
  };

  const getComputedStatus = (ev) => {
    if (!ev) return 'draft';
    const stored = ev.status;
    if (stored === 'draft' || stored === 'closed' || stored === 'completed') return stored;
    const now = new Date();
    const start = new Date(ev.eventStartDate);
    const end = new Date(ev.eventEndDate);
    if (now > end) return 'completed';
    if (now >= start && now <= end) return 'ongoing';
    return stored;
  };

  const openEventDetail = (eventId) => {
    setSelectedEventId(eventId);
    setPage('event-detail');
  };

  const Navbar = () => (
    <div className="flex items-center gap-2 flex-wrap bg-white border-b border-gray-200 px-4 py-3 mb-5 rounded-lg">
      <strong className="mr-5">{user.organizationName}</strong>
      <button onClick={() => setPage('dashboard')} className={page === 'dashboard' ? 'btn-primary' : 'btn-secondary'}>Dashboard</button>
      <button onClick={() => setPage('create')} className={page === 'create' ? 'btn-primary' : 'btn-secondary'}>Create Event</button>
      <button onClick={() => setPage('ongoing')} className={page === 'ongoing' ? 'btn-primary' : 'btn-secondary'}>Ongoing Events</button>
      <button onClick={() => setPage('password-reset')} className={page === 'password-reset' ? 'btn-primary' : 'btn-secondary'}>Password Reset</button>
      <button onClick={() => setPage('profile')} className={page === 'profile' ? 'btn-primary' : 'btn-secondary'}>Profile</button>
      <button onClick={logout} className="btn-danger ml-auto">Logout</button>
    </div>
  );

  if (page === 'event-detail' && selectedEventId) {
    return (
      <div className="container">
        <Navbar />
        <OrganizerEventDetail
          token={token}
          eventId={selectedEventId}
          onBack={() => { setPage('dashboard'); setSelectedEventId(null); loadDashboard(); }}
        />
      </div>
    );
  }

  if (page === 'password-reset') {
    return (
      <div className="container">
        <Navbar />
        <h2>Request Password Reset</h2>
        <p className="text-gray-500">Submit a request to the admin to reset your password.</p>

        {resetRequests.some(r => r.status === 'pending') ? (
          <div className="bg-yellow-100 p-4 border border-yellow-500 rounded-md my-4">
            <strong>⏳ You have a pending request.</strong>
            <p className="mt-1 text-yellow-800">Please wait for the admin to review it.</p>
          </div>
        ) : (
          <div className="bg-gray-100 p-4 rounded-md my-4">
            <textarea
              placeholder="Reason for password reset (e.g., forgot password, security concern)..."
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              rows="3"
              className="text-gray-800 bg-white border border-gray-300"
            />
            <button onClick={handleResetRequest} className="btn-success" disabled={resetReason.trim().length < 5}>
              Submit Reset Request
            </button>
          </div>
        )}

        {resetMessage && (
          <div className={`p-2 my-2 rounded ${resetMessage.includes('submitted') || resetMessage.includes('success') ? 'bg-green-100' : 'bg-red-100'}`}>{resetMessage}</div>
        )}


        <h3 className="mt-6">Request History</h3>
        {resetRequests.length === 0 ? (
          <p className="text-gray-500">No password reset requests yet.</p>
        ) : (
          resetRequests.map((r, i) => (
            <div key={i} className={`border border-gray-300 p-3 my-2 rounded-md border-l-4 ${r.status === 'approved' ? 'border-l-green-600' : r.status === 'rejected' ? 'border-l-red-600' : 'border-l-yellow-500'}`}>
              <div className="flex justify-between items-center">
                <strong className={`uppercase ${r.status === 'approved' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-600' : 'text-yellow-500'}`}>{r.status}</strong>
                <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="my-1"><strong>Reason:</strong> {r.reason}</p>
              {r.adminComment && <p className="my-1 text-gray-600"><strong>Admin Comment:</strong> {r.adminComment}</p>}
              {r.reviewedAt && <p className="my-1 text-xs text-gray-400">Reviewed: {new Date(r.reviewedAt).toLocaleString()}</p>}
            </div>
          ))
        )}
      </div>
    );
  }

  if (page === 'profile') {
    return (
      <div className="container">
        <Navbar />
        <OrganizerProfile token={token} />
      </div>
    );
  }

  if (page === 'create') {
    return (
      <div className="container">
        <Navbar />
        <CreateEventForm token={token} onSuccess={() => { setPage('dashboard'); loadDashboard(); }} />
      </div>
    );
  }

  if (page === 'ongoing') {
    return (
      <div className="container">
        <Navbar />
        <h2>Ongoing Events</h2>
        {ongoingEvents.length === 0 ? (
          <p>No ongoing events</p>
        ) : (
          ongoingEvents.map(event => (
            <div key={event._id} onClick={() => openEventDetail(event._id)} className="border border-gray-300 p-4 my-2 cursor-pointer rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="m-0">{event.eventName}</h4>
                  <span className="text-gray-500">{event.eventType}</span>
                </div>
                <span className={`${getStatusClass(getComputedStatus(event))} text-white px-2 py-0.5 rounded text-xs`}>
                  {getComputedStatus(event).toUpperCase()}
                </span>
              </div>
              <p className="mt-2"><strong>Registrations:</strong> {event.currentRegistrations}/{event.registrationLimit}</p>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <Navbar />

      <h2>Dashboard</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="stat-card bg-blue-100">
          <h3 className="m-0">{analytics.totalEvents || 0}</h3>
          <p className="m-0">Total Events</p>
        </div>
        <div className="stat-card bg-green-100">
          <h3 className="m-0">{analytics.totalRegistrations || 0}</h3>
          <p className="m-0">Registrations</p>
        </div>
        <div className="stat-card bg-orange-100">
          <h3 className="m-0">₹{analytics.totalRevenue || 0}</h3>
          <p className="m-0">Revenue</p>
        </div>
        <div className="stat-card bg-pink-100">
          <h3 className="m-0">{analytics.totalAttendance || 0}</h3>
          <p className="m-0">Attendance</p>
        </div>
      </div>

      <h3>My Events</h3>
      {loading ? (
        <p>Loading...</p>
      ) : events.length === 0 ? (
        <p>No events created yet. <button onClick={() => setPage('create')} className="btn-primary">Create your first event</button></p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(event => (
            <div key={event._id} className="border border-gray-300 p-4 bg-white rounded-md">
              <div className="flex justify-between items-start mb-2">
                <h4 className="m-0">{event.eventName}</h4>
                <span className={`${getStatusClass(getComputedStatus(event))} text-white px-2 py-0.5 rounded text-xs`}>
                  {getComputedStatus(event)?.toUpperCase() || 'DRAFT'}
                </span>
              </div>
              <p className="text-gray-500 my-1">{event.eventType}</p>
              <p className="my-1"><strong>Registrations:</strong> {event.currentRegistrations}/{event.registrationLimit}</p>
              <p className="my-1"><strong>Fee:</strong> ₹{event.registrationFee}</p>
              <p className="text-gray-500 text-xs">{new Date(event.eventStartDate).toLocaleDateString()}</p>
              <div className="flex gap-1 mt-2">
                <button onClick={() => openEventDetail(event._id)} className="btn-primary flex-1">Manage</button>
                {event.status === 'draft' && (
                  <button onClick={() => handleDeleteEvent(event._id)} className="btn-danger">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrganizerDashboard;
