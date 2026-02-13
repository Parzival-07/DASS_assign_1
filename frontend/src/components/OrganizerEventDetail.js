import React, { useState, useEffect } from 'react';
import QRScanner from './QRScanner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function OrganizerEventDetail({ token, eventId, onBack }) {
  const [event, setEvent] = useState(null);
  const [analytics, setAnalytics] = useState({});
  const [participants, setParticipants] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAttendance, setFilterAttendance] = useState('');
  
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  
  const [customForm, setCustomForm] = useState([]);
  
  const [attendanceStats, setAttendanceStats] = useState(null);

  useEffect(() => {
    loadEventDetail();
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEventDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/organizer/event/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEvent(data.event);
      setAnalytics(data.analytics);
      setParticipants(data.participants);
      setEditData({
        eventName: data.event?.eventName || '',
        eventDescription: data.event?.eventDescription || '',
        eligibility: data.event?.eligibility || '',
        registrationDeadline: data.event?.registrationDeadline?.slice(0, 16) || '',
        eventStartDate: data.event?.eventStartDate?.slice(0, 16) || '',
        eventEndDate: data.event?.eventEndDate?.slice(0, 16) || '',
        registrationLimit: data.event?.registrationLimit || 0,
        registrationFee: data.event?.registrationFee || 0,
        eventTags: data.event?.eventTags?.join(', ') || '',
        sizes: data.event?.itemDetails?.sizes?.join(', ') || '',
        colors: data.event?.itemDetails?.colors?.join(', ') || '',
        variants: data.event?.itemDetails?.variants?.join(', ') || '',
        stockQuantity: data.event?.itemDetails?.stockQuantity || 0,
        purchaseLimitPerParticipant: data.event?.itemDetails?.purchaseLimitPerParticipant || 1,
      });
      setCustomForm(data.event?.customForm || []);
    } catch (err) {
      console.error('Error loading event');
    }
    setLoading(false);
  };

  const loadParticipants = async () => {
    try {
      let url = `${API_URL}/organizer/event/${eventId}/participants?`;
      if (search) url += `search=${search}&`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterAttendance) url += `attendance=${filterAttendance}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setParticipants(data);
    } catch (err) {
      console.error('Error loading participants');
    }
  };

  useEffect(() => {
    if (tab === 'participants') loadParticipants();
    if (tab === 'scanner') loadAttendanceStats();
  }, [search, filterStatus, filterAttendance, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttendanceStats = async () => {
    try {
      const res = await fetch(`${API_URL}/organizer/event/${eventId}/attendance-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAttendanceStats(data);
    } catch (err) {
      console.error('Error loading attendance stats');
    }
  };

  const updateStatus = async (newStatus) => {
    if (!window.confirm(`Change status to ${newStatus}?`)) return;
    try {
      const res = await fetch(`${API_URL}/organizer/event/${eventId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      setMessage(data.message);
      loadEventDetail();
    } catch (err) {
      setMessage('Error updating status');
    }
  };

  const saveEdit = async () => {
    try {
      let payload = { ...editData };
      // For draft events, convert comma-separated strings to arrays and build itemDetails
      if (event.status === 'draft') {
        payload.eventTags = editData.eventTags ? editData.eventTags.split(',').map(t => t.trim()).filter(t => t) : [];
        if (event.eventType === 'merchandise') {
          payload.itemDetails = {
            sizes: editData.sizes ? editData.sizes.split(',').map(s => s.trim()).filter(s => s) : [],
            colors: editData.colors ? editData.colors.split(',').map(c => c.trim()).filter(c => c) : [],
            variants: editData.variants ? editData.variants.split(',').map(v => v.trim()).filter(v => v) : [],
            stockQuantity: parseInt(editData.stockQuantity) || 0,
            purchaseLimitPerParticipant: parseInt(editData.purchaseLimitPerParticipant) || 1,
          };
          delete payload.sizes;
          delete payload.colors;
          delete payload.variants;
          delete payload.stockQuantity;
          delete payload.purchaseLimitPerParticipant;
        }
      }
      const res = await fetch(`${API_URL}/organizer/event/${eventId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setMessage(data.message);
      setEditMode(false);
      loadEventDetail();
    } catch (err) {
      setMessage('Error saving changes');
    }
  };

  const toggleAttendance = async (regId, current) => {
    try {
      await fetch(`${API_URL}/organizer/event/${eventId}/attendance/${regId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ attendance: !current })
      });
      // Refresh both participants list and analytics counts
      await Promise.all([
        loadParticipants(),
        loadEventDetail()
      ]);
    } catch (err) {
      console.error('Error updating attendance');
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Registration Date', 'Payment', 'Team', 'Attendance', 'Attendance Time', 'Attendance Method', 'Status'];
    const rows = participants.map(p => [
      `${p.userId?.firstName || ''} ${p.userId?.lastName || ''}`,
      p.userId?.email || '',
      new Date(p.registeredAt).toLocaleDateString(),
      `₹${event?.registrationFee || 0}`,
      p.teamName || '-',
      p.attendance ? 'Yes' : 'No',
      p.attendanceMarkedAt ? new Date(p.attendanceMarkedAt).toLocaleString() : '-',
      p.attendanceMethod || '-',
      p.status
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.eventName || 'event'}_participants.csv`;
    a.click();
  };

  const exportAttendanceCSV = () => {
    if (!attendanceStats) return;
    const headers = ['Name', 'Email', 'Ticket ID', 'Team', 'Attendance', 'Marked At', 'Method'];
    const allRows = [
      ...attendanceStats.scannedList.map(p => [p.name, p.email, p.ticketId, p.teamName || '-', 'Yes', new Date(p.markedAt).toLocaleString(), p.method]),
      ...attendanceStats.notScannedList.map(p => [p.name, p.email, p.ticketId, p.teamName || '-', 'No', '-', '-'])
    ];
    const csv = [headers.join(','), ...allRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.eventName || 'event'}_attendance.csv`;
    a.click();
  };

  const handleManualOverride = async (registrationId) => {
    const reason = window.prompt('Reason for manual attendance override:');
    if (reason === null) return;
    try {
      const res = await fetch(`${API_URL}/organizer/event/${eventId}/manual-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ registrationId, reason })
      });
      const data = await res.json();
      setMessage(data.message);
      loadAttendanceStats();
    } catch (err) {
      setMessage('Error marking attendance');
    }
  };

  const addFormField = () => {
    setCustomForm([...customForm, { fieldName: '', fieldType: 'text', required: false, options: [] }]);
  };

  const updateFormField = (index, key, value) => {
    const updated = [...customForm];
    updated[index][key] = value;
    setCustomForm(updated);
  };

  const removeFormField = (index) => {
    setCustomForm(customForm.filter((_, i) => i !== index));
  };

  const moveField = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= customForm.length) return;
    const updated = [...customForm];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setCustomForm(updated);
  };

  const saveForm = async () => {
    try {
      const res = await fetch(`${API_URL}/organizer/event/${eventId}/form`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ customForm })
      });
      const data = await res.json();
      setMessage(data.message);
      loadEventDetail();
    } catch (err) {
      setMessage('Error saving form');
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!event) return <p>Event not found</p>;

  const getStatusClass = (status) => {
    const classes = { draft: 'bg-gray-500', published: 'bg-green-600', ongoing: 'bg-blue-600', completed: 'bg-teal-500', closed: 'bg-red-600' };
    return classes[status] || 'bg-gray-500';
  };

  const canEdit = event.status === 'draft' || event.status === 'published';

  return (
    <div>
      <button onClick={onBack} className="btn-secondary mb-4">← Back</button>
      
      {message && <div className={message.includes('Error') ? 'error' : 'success'}>{message}</div>}
      
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="m-0">{event.eventName}</h2>
          <span className="text-gray-500">{event.eventType}</span>
        </div>
        <span className={`${getStatusClass(event.status)} text-white px-3 py-1.5 rounded`}>
          {event.status?.toUpperCase()}
        </span>
      </div>

      <div className="mb-5 flex gap-2.5 flex-wrap">
        {event.status === 'draft' && <button onClick={() => updateStatus('published')} className="btn-success">Publish</button>}
        {event.status === 'published' && (
          <>
            <button onClick={() => updateStatus('ongoing')} className="btn-primary">Mark Ongoing</button>
            <button onClick={() => updateStatus('closed')} className="btn-danger">Close Registrations</button>
          </>
        )}
        {event.status === 'closed' && (
          <>
            <button onClick={() => updateStatus('ongoing')} className="btn-primary">Mark Ongoing</button>
            <button onClick={() => updateStatus('completed')} className="btn-success">Mark Completed</button>
          </>
        )}
        {event.status === 'ongoing' && (
          <>
            <button onClick={() => updateStatus('completed')} className="btn-success">Mark Completed</button>
            <button onClick={() => updateStatus('closed')} className="btn-danger">Close Event</button>
          </>
        )}
      </div>

      <div className="mb-5 border-b border-gray-300 flex">
        {['overview', 'analytics', 'participants', 'scanner', 'form'].filter(t => t !== 'scanner' || event.status === 'ongoing').map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2.5 border-none cursor-pointer text-sm ${tab === t ? 'bg-blue-600 text-white border-b-2 border-blue-600' : 'bg-transparent text-gray-800'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          {!editMode ? (
            <>
              <p><strong>Description:</strong> {event.eventDescription}</p>
              <p><strong>Eligibility:</strong> {event.eligibility}</p>
              <p><strong>Registration Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}</p>
              <p><strong>Event Start:</strong> {new Date(event.eventStartDate).toLocaleString()}</p>
              <p><strong>Event End:</strong> {new Date(event.eventEndDate).toLocaleString()}</p>
              <p><strong>Registration Limit:</strong> {event.registrationLimit}</p>
              <p><strong>Fee:</strong> ₹{event.registrationFee}</p>
              <p><strong>Tags:</strong> {event.eventTags?.join(', ') || 'None'}</p>
              {canEdit && <button onClick={() => setEditMode(true)} className="btn-primary">Edit</button>}
            </>
          ) : (
            <>
              {event.status === 'draft' && (
                <>
                  <label>Event Name</label>
                  <input type="text" value={editData.eventName} onChange={e => setEditData({...editData, eventName: e.target.value})} />
                </>
              )}
              <label>Description</label>
              <textarea value={editData.eventDescription} onChange={e => setEditData({...editData, eventDescription: e.target.value})} rows="3" />
              {event.status === 'draft' && (
                <>
                  <label>Eligibility</label>
                  <select value={editData.eligibility} onChange={e => setEditData({...editData, eligibility: e.target.value})}>
                    <option value="">Select Eligibility</option>
                    <option value="All Students">All Students</option>
                    <option value="IIIT Students">IIIT Students</option>
                    <option value="Non-IIIT Students">Non-IIIT Students</option>
                  </select>
                  <label>Registration Deadline</label>
                  <input type="datetime-local" value={editData.registrationDeadline} onChange={e => setEditData({...editData, registrationDeadline: e.target.value})} />
                  <label>Event Start Date</label>
                  <input type="datetime-local" value={editData.eventStartDate} onChange={e => setEditData({...editData, eventStartDate: e.target.value})} />
                  <label>Event End Date</label>
                  <input type="datetime-local" value={editData.eventEndDate} onChange={e => setEditData({...editData, eventEndDate: e.target.value})} />
                  <label>Registration Limit</label>
                  <input type="number" value={editData.registrationLimit} onChange={e => setEditData({...editData, registrationLimit: parseInt(e.target.value)})} />
                  <label>Registration Fee</label>
                  <input type="number" value={editData.registrationFee} onChange={e => setEditData({...editData, registrationFee: parseFloat(e.target.value)})} />
                  <label>Event Tags (comma-separated)</label>
                  <input type="text" value={editData.eventTags} onChange={e => setEditData({...editData, eventTags: e.target.value})} />
                  {event.eventType === 'merchandise' && (
                    <>
                      <h4>Merchandise Details</h4>
                      <label>Sizes (comma-separated)</label>
                      <input type="text" value={editData.sizes} onChange={e => setEditData({...editData, sizes: e.target.value})} />
                      <label>Colors (comma-separated)</label>
                      <input type="text" value={editData.colors} onChange={e => setEditData({...editData, colors: e.target.value})} />
                      <label>Variants (comma-separated)</label>
                      <input type="text" value={editData.variants} onChange={e => setEditData({...editData, variants: e.target.value})} />
                      <label>Stock Quantity</label>
                      <input type="number" value={editData.stockQuantity} onChange={e => setEditData({...editData, stockQuantity: parseInt(e.target.value)})} />
                      <label>Purchase Limit Per Participant</label>
                      <input type="number" value={editData.purchaseLimitPerParticipant} onChange={e => setEditData({...editData, purchaseLimitPerParticipant: parseInt(e.target.value)})} />
                    </>
                  )}
                </>
              )}
              {event.status === 'published' && (
                <>
                  <label>Registration Deadline (can only extend)</label>
                  <input type="datetime-local" value={editData.registrationDeadline} onChange={e => setEditData({...editData, registrationDeadline: e.target.value})} />
                  <label>Registration Limit (can only increase)</label>
                  <input type="number" value={editData.registrationLimit} onChange={e => setEditData({...editData, registrationLimit: parseInt(e.target.value)})} />
                </>
              )}
              <div className="mt-2.5">
                <button onClick={saveEdit} className="btn-success">Save</button>
                <button onClick={() => setEditMode(false)} className="btn-secondary ml-2.5">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="stat-card bg-blue-100">
            <h3 className="m-0">{analytics.totalRegistrations || 0}</h3>
            <p className="m-0">Registrations</p>
          </div>
          <div className="stat-card bg-green-100">
            <h3 className="m-0">{analytics.attendance || 0}</h3>
            <p className="m-0">Attendance</p>
          </div>
          <div className="stat-card bg-orange-100">
            <h3 className="m-0">₹{analytics.revenue || 0}</h3>
            <p className="m-0">Revenue</p>
          </div>
          {event?.teamBased && (
            <div className="stat-card bg-pink-100">
              <h3 className="m-0">{analytics.teamsComplete || 0}/{analytics.totalTeams || 0}</h3>
              <p className="m-0">Teams Complete</p>
            </div>
          )}
          <div className="stat-card bg-purple-100">
            <h3 className="m-0">{analytics.cancelled || 0}</h3>
            <p className="m-0">Cancelled</p>
          </div>
        </div>
      )}

      {tab === 'participants' && (
        <div>
          <div className="flex gap-2.5 mb-4 flex-wrap">
            <input type="text" placeholder="Search name/email..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={filterAttendance} onChange={e => setFilterAttendance(e.target.value)}>
              <option value="">All Attendance</option>
              <option value="true">Present</option>
              <option value="false">Absent</option>
            </select>
            <button onClick={exportCSV} className="btn-secondary">Export CSV</button>
          </div>

          {participants.length === 0 ? (
            <p>No participants found</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2.5 text-left border-b border-gray-300">Name</th>
                  <th className="p-2.5 text-left border-b border-gray-300">Email</th>
                  <th className="p-2.5 text-left border-b border-gray-300">Reg Date</th>
                  <th className="p-2.5 text-left border-b border-gray-300">Payment</th>
                  <th className="p-2.5 text-left border-b border-gray-300">Team</th>
                  <th className="p-2.5 text-left border-b border-gray-300">Status</th>
                  <th className="p-2.5 text-left border-b border-gray-300">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(p => (
                  <tr key={p._id}>
                    <td className="p-2.5 border-b border-gray-200">{p.userId?.firstName} {p.userId?.lastName}</td>
                    <td className="p-2.5 border-b border-gray-200">{p.userId?.email}</td>
                    <td className="p-2.5 border-b border-gray-200">{new Date(p.registeredAt).toLocaleDateString()}</td>
                    <td className="p-2.5 border-b border-gray-200">₹{(event?.registrationFee || 0) * (p.quantity || 1)}</td>
                    <td className="p-2.5 border-b border-gray-200">{p.teamName || '-'}</td>
                    <td className="p-2.5 border-b border-gray-200">{p.status}</td>
                    <td className="p-2.5 border-b border-gray-200">
                      <input type="checkbox" checked={p.attendance} onChange={() => toggleAttendance(p._id, p.attendance)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'scanner' && (
        <div>
          {attendanceStats && (
            <div className="mb-5">
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="stat-card bg-blue-100">
                  <h3 className="m-0">{attendanceStats.total}</h3>
                  <p className="m-0">Total Registered</p>
                </div>
                <div className="stat-card bg-green-100">
                  <h3 className="m-0 text-green-600">{attendanceStats.scanned}</h3>
                  <p className="m-0">Checked In</p>
                </div>
                <div className="stat-card bg-orange-100">
                  <h3 className="m-0 text-orange-500">{attendanceStats.notScanned}</h3>
                  <p className="m-0">Not Yet</p>
                </div>
              </div>
              
              <div className="bg-gray-200 rounded h-6 mb-5">
                <div
                  className="bg-green-600 h-full rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${attendanceStats.total > 0 ? (attendanceStats.scanned / attendanceStats.total * 100) : 0}%` }}
                >
                  {attendanceStats.total > 0 ? Math.round(attendanceStats.scanned / attendanceStats.total * 100) : 0}%
                </div>
              </div>
              
              <button onClick={exportAttendanceCSV} className="btn-secondary mb-4">Export Attendance CSV</button>
              <button onClick={loadAttendanceStats} className="btn-secondary mb-4 ml-2.5">Refresh Stats</button>
            </div>
          )}

          <QRScanner token={token} eventId={eventId} onScanComplete={loadAttendanceStats} />

          {attendanceStats?.notScannedList?.length > 0 && (
            <div className="mt-5">
              <h4>⏳ Not Yet Checked In ({attendanceStats.notScannedList.length})</h4>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2.5 text-left border-b border-gray-300">Name</th>
                    <th className="p-2.5 text-left border-b border-gray-300">Email</th>
                    <th className="p-2.5 text-left border-b border-gray-300">Ticket</th>
                    <th className="p-2.5 text-left border-b border-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceStats.notScannedList.map(p => (
                    <tr key={p._id}>
                      <td className="p-2.5 border-b border-gray-200">{p.name}</td>
                      <td className="p-2.5 border-b border-gray-200">{p.email}</td>
                      <td className="p-2.5 border-b border-gray-200">{p.ticketId}</td>
                      <td className="p-2.5 border-b border-gray-200">
                        <button onClick={() => handleManualOverride(p._id)} className="btn-primary px-2.5 py-1 text-xs">
                          Manual Check-in
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {attendanceStats?.scannedList?.length > 0 && (
            <div className="mt-5">
              <h4>Checked In ({attendanceStats.scannedList.length})</h4>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2.5 text-left border-b border-gray-300">Name</th>
                    <th className="p-2.5 text-left border-b border-gray-300">Email</th>
                    <th className="p-2.5 text-left border-b border-gray-300">Method</th>
                    <th className="p-2.5 text-left border-b border-gray-300">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceStats.scannedList.map(p => (
                    <tr key={p._id}>
                      <td className="p-2.5 border-b border-gray-200">{p.name}</td>
                      <td className="p-2.5 border-b border-gray-200">{p.email}</td>
                      <td className="p-2.5 border-b border-gray-200">
                        <span className={`${p.method === 'qr-scan' ? 'bg-teal-500' : 'bg-gray-500'} text-white px-1.5 py-0.5 rounded text-xs`}>
                          {p.method === 'qr-scan' ? 'QR Scan' : 'Manual'}
                        </span>
                      </td>
                      <td className="p-2.5 border-b border-gray-200">{new Date(p.markedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'form' && (
        <div>
          <h4>Custom Registration Form</h4>
          {event.formLocked ? (
            <p className="text-red-600">Form is locked after first registration</p>
          ) : (
            <>
              {customForm.map((field, index) => (
                <div key={index} className="border border-gray-300 p-2.5 my-2.5">
                  <div className="flex gap-2.5 items-center flex-wrap">
                    <input type="text" placeholder="Field Name" value={field.fieldName} onChange={e => updateFormField(index, 'fieldName', e.target.value)} />
                    <select value={field.fieldType} onChange={e => updateFormField(index, 'fieldType', e.target.value)}>
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="file">File Upload</option>
                    </select>
                    <label><input type="checkbox" checked={field.required} onChange={e => updateFormField(index, 'required', e.target.checked)} /> Required</label>
                    <button onClick={() => moveField(index, -1)} className="btn-secondary" disabled={index === 0}>↑</button>
                    <button onClick={() => moveField(index, 1)} className="btn-secondary" disabled={index === customForm.length - 1}>↓</button>
                    <button onClick={() => removeFormField(index)} className="btn-danger">Remove</button>
                  </div>
                  {(field.fieldType === 'select' || field.fieldType === 'checkbox') && (
                    <input type="text" placeholder="Options (comma-separated)" value={field.options?.join(',') || ''} 
                      onChange={e => updateFormField(index, 'options', e.target.value.split(',').map(o => o.trim()))} 
                      className="mt-2.5" />
                  )}
                </div>
              ))}
              <button onClick={addFormField} className="btn-secondary">+ Add Field</button>
              <button onClick={saveForm} className="btn-success ml-2.5">Save Form</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default OrganizerEventDetail;
