// event details page for viewing event info and registering
import React, { useState, useEffect } from 'react';
import TeamChat from './TeamChat';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function EventDetails({ token, eventId, onBack, user }) {
  // state for event data and registration status
  const [event, setEvent] = useState(null);
  const [spotsLeft, setSpotsLeft] = useState(0);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [soldOut, setSoldOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [registeredTicketId, setRegisteredTicketId] = useState(null);

  const [selectedSize, setSelectedSize] = useState(''); // eslint-disable-line no-unused-vars
  const [selectedColor, setSelectedColor] = useState(''); // eslint-disable-line no-unused-vars
  const [selectedVariant, setSelectedVariant] = useState(''); // eslint-disable-line no-unused-vars
  const [quantity, setQuantity] = useState(1);
  // per-item selections: each element has { size, color, variant }
  const [merchItems, setMerchItems] = useState([{ size: '', color: '', variant: '' }]);


  const [customFormData, setCustomFormData] = useState({});
  const [uploadingField, setUploadingField] = useState(null);
  const [teamName, setTeamName] = useState('');

  const [myTeam, setMyTeam] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [createTeamName, setCreateTeamName] = useState('');
  const [createTeamSize, setCreateTeamSize] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [teamTab, setTeamTab] = useState('create');
  const [teamJustCompleted, setTeamJustCompleted] = useState(false);
  const [teamTickets, setTeamTickets] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatLastSeen, setChatLastSeen] = useState(new Date().toISOString());

  useEffect(() => { loadEvent(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // poll for unread chat messages when team exists and chat is closed
  useEffect(() => {
    if (!myTeam || showChat) { setChatUnread(0); return; }
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/chat/unread/${myTeam._id}?since=${encodeURIComponent(chatLastSeen)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.count !== undefined) setChatUnread(data.count);
      } catch (e) { }
    }, 5000);
    return () => clearInterval(poll);
  }, [myTeam, showChat, chatLastSeen, token]);

  // fetch event details and check if team based event needs team loading
  const loadEvent = async () => {
    try {
      const res = await fetch(`${API_URL}/browse/event/${eventId}`);
      const data = await res.json();
      setEvent(data.event);
      setSpotsLeft(data.spotsLeft);
      setDeadlinePassed(data.deadlinePassed);
      setSoldOut(data.soldOut);
      setLoading(false);
      if (data.event?.teamBased && token) {
        loadMyTeam();
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const loadMyTeam = async () => {
    setTeamLoading(true);
    try {
      const res = await fetch(`${API_URL}/team/my-team/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.team) {
        setMyTeam(data.team);
        if (data.tickets && data.tickets.length > 0) setTeamTickets(data.tickets);
      } else {
        setMyTeam(null);
      }
    } catch (err) {
      setMyTeam(null);
    }
    setTeamLoading(false);
  };

  // create a new team for team based event registration
  const handleCreateTeam = async () => {
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/team/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ eventId, teamName: createTeamName, maxSize: parseInt(createTeamSize) || event.maxTeamSize })
      });
      const data = await res.json();
      if (data.team) {
        setMessage('Team created! Share the invite code with teammates.');
        setMyTeam(data.team);
      } else {
        setMessage(data.message || 'Failed to create team');
      }
    } catch (err) {
      setMessage('Error creating team');
    }
  };

  // join an existing team using invite code
  const handleJoinTeam = async () => {
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/team/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ inviteCode: joinInviteCode })
      });
      const data = await res.json();
      if (data.team) {
        setMyTeam(data.team);
        if (data.teamComplete) {
          if (data.tickets) setTeamTickets(data.tickets);
          setTeamJustCompleted(true);
          loadEvent();
        } else {
          setMessage(data.message || 'Joined team successfully!');
        }
      } else {
        setMessage(data.message || 'Failed to join team');
      }
    } catch (err) {
      setMessage('Error joining team');
    }
  };

  // leave or disband team with appropriate confirmation warnings
  const handleLeaveTeam = async () => {
    const isLeader = myTeam?.leaderId?._id === user.id;
    const isComplete = myTeam?.status === 'complete';

    let confirmMsg = isLeader
      ? 'Are you sure you want to disband this team?'
      : 'Are you sure you want to leave this team?';

    if (isComplete && isLeader) {
      confirmMsg = 'WARNING: This team is COMPLETE with tickets generated.\n\nDisbanding will CANCEL ALL team members\' registrations.\n\nAre you sure?';
    } else if (isComplete && !isLeader) {
      confirmMsg = 'WARNING: This team is COMPLETE.\n\nLeaving will cancel YOUR registration and the team will need a replacement member.\n\nAre you sure?';
    }

    if (!window.confirm(confirmMsg)) return;
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/team/leave/${myTeam._id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setMyTeam(null);
        setTeamTickets([]);
        loadEvent();
      } else {
        setMessage(data.message || 'Failed to leave team');
      }
    } catch (err) {
      setMessage('Error leaving team');
    }
  };

  // upload file for custom form field and store the file info
  const handleFileUpload = async (fieldName, file) => {
    if (!file) return;
    setUploadingField(fieldName);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'form');
      const res = await fetch(`${API_URL}/upload/file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.file) {
        setCustomFormData(prev => ({
          ...prev,
          [fieldName]: { url: data.file.url, originalName: data.file.originalName, size: data.file.size, mimetype: data.file.mimetype }
        }));
      } else {
        setMessage(data.message || 'File upload failed');
      }
    } catch (err) {
      setMessage('File upload failed');
    }
    setUploadingField(null);
  };

  // handle event registration with custom form validation and submission
  const handleRegister = async () => {
    setRegistering(true);
    setMessage('');
    try {
      if (event.customForm?.length > 0) {
        const missing = [];
        for (const field of event.customForm) {
          if (!field.required) continue;
          const value = customFormData[field.fieldName];

          const isFilled = (() => {
            if (value === undefined || value === null) return false;
            if (typeof value === 'string') return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'boolean') return value === true;
            return true;
          })();

          if (!isFilled) missing.push(field.fieldName);
        }
        if (missing.length > 0) {
          setMessage(`Please fill required fields: ${missing.join(', ')}`);
          setRegistering(false);
          return;
        }
      }

      const body = { eventId };
      if (event.eventType === 'merchandise') {
        const hasSizes = event.itemDetails?.sizes?.length > 0;
        const hasColors = event.itemDetails?.colors?.length > 0;
        const hasVariants = event.itemDetails?.variants?.length > 0;

        // validate each item has required selections
        for (let i = 0; i < merchItems.length; i++) {
          const item = merchItems[i];
          if (hasSizes && !item.size) { setMessage(`Please select a size for item ${i + 1}`); setRegistering(false); return; }
          if (hasColors && !item.color) { setMessage(`Please select a color for item ${i + 1}`); setRegistering(false); return; }
          if (hasVariants && !item.variant) { setMessage(`Please select a variant for item ${i + 1}`); setRegistering(false); return; }
        }

        body.items = merchItems;
        body.quantity = quantity;
        // legacy single-selection for backward compat
        body.selectedSize = merchItems[0]?.size || '';
        body.selectedColor = merchItems[0]?.color || '';
        body.selectedVariant = merchItems[0]?.variant || '';
      }
      if (event.customForm?.length > 0) body.customFormData = customFormData;
      if (teamName) body.teamName = teamName;

      const res = await fetch(`${API_URL}/registration/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.registration) {
        setMessage(`Registered! Ticket ID: ${data.registration.ticketId}`);
        setRegisteredTicketId(data.registration.ticketId);
      } else {
        setMessage(`${data.message}`);
      }
      setRegistering(false);
    } catch (err) {
      setMessage('Registration failed');
      setRegistering(false);
    }
  };

  // check if user is eligible to register based on deadline spots and role
  const canRegister = () => {
    if (deadlinePassed) return false;
    if (spotsLeft <= 0) return false;
    if (soldOut) return false;
    if (event.eligibility === 'IIIT Students' && user.role !== 'iiit-student') return false;
    if (event.eligibility === 'Non-IIIT Students' && user.role !== 'non-iiit-student') return false;
    return true;
  };

  if (loading) return <p>Loading...</p>;
  if (!event) return <p>Event not found</p>;

  // show ticket confirmation with QR code after successful registration
  if (registeredTicketId) {
    const qrData = encodeURIComponent(JSON.stringify({ ticketId: registeredTicketId, eventId: event._id, userId: user.id }));
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;

    return (
      <div className="text-center">
        <button onClick={onBack} className="btn-secondary mb-4">← Back to Events</button>

        <div className="border-2 border-gray-800 p-5 max-w-md mx-auto bg-white">
          <h2>Registration Successful!</h2>
          <hr />

          <h3>{event.eventName}</h3>
          <p><strong>Ticket ID:</strong> {registeredTicketId}</p>
          <p className="text-green-600"><strong>Status:</strong> CONFIRMED</p>

          <hr />

          <p><strong>Participant:</strong> {user.firstName} {user.lastName}</p>
          <p><strong>Email:</strong> {user.email}</p>

          <hr />

          <img src={qrUrl} alt="QR Code" className="my-4" />
          <p className="text-xs text-gray-500">Scan QR for verification</p>
          <p className="text-xs text-gray-500">Ticket details sent to your email</p>

          <button onClick={() => setRegisteredTicketId(null)} className="btn-primary mt-4">
            Register for Another Event
          </button>
        </div>
      </div>
    );
  }

  // show team completion screen with all member tickets when team is full
  if (teamJustCompleted && myTeam) {
    return (
      <div className="text-center">
        <button onClick={onBack} className="btn-secondary mb-4">← Back to Events</button>

        <div className="border-2 border-green-600 p-6 max-w-lg mx-auto bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
          <div className="text-5xl mb-2"></div>
          <h2 className="text-green-600 mt-0 mb-1">Team Complete!</h2>
          <p className="text-base text-gray-500 mb-4">All members have joined — tickets generated for everyone!</p>

          <hr className="border-0 border-t border-green-300" />

          <h3 className="mt-4 mb-1">{event?.eventName}</h3>
          <p className="m-0"><strong>Team:</strong> {myTeam.teamName} &nbsp;|&nbsp; <strong>Size:</strong> {myTeam.members?.length}/{myTeam.maxSize}</p>

          <hr className="border-0 border-t border-green-300" />

          <h4 className="mt-4 mb-2">Team Members & Tickets</h4>
          {teamTickets.length > 0 ? (
            <div className="text-left">
              {teamTickets.map((t, i) => {
                const isLeader = t.userId?._id === myTeam.leaderId?._id;
                const isYou = t.userId?._id === user.id || t.userId?.email === user.email;
                return (
                  <div key={i} className={`bg-white p-3 my-2 rounded-md relative ${isYou ? 'border-2 border-green-600' : 'border border-gray-300'}`}>
                    {isYou && <span className="absolute top-1 right-2 bg-green-600 text-white px-2 py-px rounded-full text-xs">YOU</span>}
                    <strong>{t.userId?.firstName} {t.userId?.lastName}</strong>
                    {isLeader && <span className="bg-yellow-500 text-gray-800 px-1.5 py-px rounded ml-1.5 text-xs">⭐ LEADER</span>}
                    <br />
                    <span className="text-gray-500 text-sm">{t.userId?.email}</span>
                    <br />
                    <span className="text-green-600 font-bold text-sm">{t.ticketId}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">Ticket details have been sent to everyone's email.</p>
          )}

          <hr className="border-0 border-t border-green-300" />

          <p className="text-xs text-gray-400 my-2.5">Confirmation emails with QR codes sent to all team members</p>

          <button onClick={() => setTeamJustCompleted(false)} className="btn-primary mt-2.5 py-2.5 px-6">
            View Team Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="btn-secondary mb-4">← Back</button>

      <h2>{event.eventName}</h2>
      <span className={`${event.eventType === 'merchandise' ? 'bg-yellow-500' : 'bg-teal-500'} text-white px-2 py-0.5 rounded`}>
        {event.eventType.toUpperCase()}
      </span>
      {event.teamBased && (
        <span className="bg-purple-600 text-white px-2 py-0.5 rounded ml-2">
          TEAM EVENT
        </span>
      )}

      <p className="mt-4">{event.eventDescription}</p>

      <div className="bg-gray-100 p-4 my-4">
        <p><strong>Organizer:</strong> {event.organizerId?.organizationName}</p>
        <p><strong>Eligibility:</strong> {event.eligibility}</p>
        <p><strong>Dates:</strong> {new Date(event.eventStartDate).toLocaleString()} - {new Date(event.eventEndDate).toLocaleString()}</p>
        <p><strong>Registration Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}</p>
        <p><strong>Fee:</strong> ₹{event.registrationFee}</p>
        <p><strong>Spots Left:</strong> {spotsLeft} / {event.registrationLimit}</p>
        {event.teamBased && <p><strong>Team Size:</strong> {event.minTeamSize} - {event.maxTeamSize} members</p>}
        {event.eventTags?.length > 0 && <p><strong>Tags:</strong> {event.eventTags.join(', ')}</p>}
      </div>

      {/* merchandise options section with per-item size color variant selection */}
      {event.eventType === 'merchandise' && event.itemDetails && (
        <div className="bg-yellow-100 p-4 my-4">
          <h4>Merchandise Options</h4>
          <p><strong>Stock:</strong> {event.itemDetails.stockQuantity} available</p>
          <p><strong>Max per person:</strong> {event.itemDetails.purchaseLimitPerParticipant}</p>

          <label className="font-bold mt-2 block">Quantity</label>
          <input
            type="number" min="1"
            max={Math.min(event.itemDetails.purchaseLimitPerParticipant, event.itemDetails.stockQuantity)}
            value={quantity}
            onChange={(e) => {
              const newQty = Math.max(1, Math.min(parseInt(e.target.value) || 1, event.itemDetails.purchaseLimitPerParticipant, event.itemDetails.stockQuantity));
              setQuantity(newQty);
              setMerchItems(prev => {
                const updated = [...prev];
                while (updated.length < newQty) updated.push({ size: '', color: '', variant: '' });
                return updated.slice(0, newQty);
              });
            }}
          />

          {merchItems.map((item, idx) => (
            <div key={idx} className="bg-white p-3 my-2 rounded border border-yellow-300">
              <strong>Item {idx + 1}</strong>
              <div className="flex gap-2 flex-wrap mt-1">
                {event.itemDetails.sizes?.length > 0 && (
                  <select value={item.size} onChange={(e) => {
                    const updated = [...merchItems];
                    updated[idx] = { ...updated[idx], size: e.target.value };
                    setMerchItems(updated);
                  }}>
                    <option value="">Select Size *</option>
                    {event.itemDetails.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {event.itemDetails.colors?.length > 0 && (
                  <select value={item.color} onChange={(e) => {
                    const updated = [...merchItems];
                    updated[idx] = { ...updated[idx], color: e.target.value };
                    setMerchItems(updated);
                  }}>
                    <option value="">Select Color *</option>
                    {event.itemDetails.colors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {event.itemDetails.variants?.length > 0 && (
                  <select value={item.variant} onChange={(e) => {
                    const updated = [...merchItems];
                    updated[idx] = { ...updated[idx], variant: e.target.value };
                    setMerchItems(updated);
                  }}>
                    <option value="">Select Variant *</option>
                    {event.itemDetails.variants.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}

          {quantity > 0 && event.registrationFee > 0 && (
            <p className="mt-2 font-bold">Total: ₹{event.registrationFee * quantity}</p>
          )}
        </div>
      )}

      {/* custom registration form fields defined by the organizer */}
      {event.customForm?.length > 0 && (
        <div className="bg-green-100 p-4 my-4">
          <h4>Registration Form</h4>
          {event.customForm.map((field, i) => (
            <div key={i}>
              <label>{field.fieldName} {field.required && '*'}</label>
              {field.fieldType === 'select' ? (
                <select value={customFormData[field.fieldName] || ''} onChange={(e) => setCustomFormData({ ...customFormData, [field.fieldName]: e.target.value })} required={field.required}>
                  <option value="">Select</option>
                  {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.fieldType === 'checkbox' && field.options?.length > 0 ? (
                <div className="mt-1.5">
                  {field.options.map(opt => {
                    const selected = Array.isArray(customFormData[field.fieldName])
                      ? customFormData[field.fieldName].includes(opt)
                      : false;
                    return (
                      <label key={opt} className="block">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const current = Array.isArray(customFormData[field.fieldName]) ? customFormData[field.fieldName] : [];
                            const next = e.target.checked
                              ? [...current, opt]
                              : current.filter(v => v !== opt);
                            setCustomFormData({ ...customFormData, [field.fieldName]: next });
                          }}
                        />
                        {' '}{opt}
                      </label>
                    );
                  })}
                </div>
              ) : field.fieldType === 'checkbox' ? (
                <label className="block mt-1.5">
                  <input
                    type="checkbox"
                    checked={!!customFormData[field.fieldName]}
                    onChange={(e) => setCustomFormData({ ...customFormData, [field.fieldName]: e.target.checked })}
                  />
                  {' '}Yes
                </label>
              ) : field.fieldType === 'file' ? (
                <div>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                    onChange={(e) => handleFileUpload(field.fieldName, e.target.files[0])}
                    disabled={uploadingField === field.fieldName}
                    className="inline-block w-auto text-sm"
                  />
                  {uploadingField === field.fieldName && (
                    <span className="text-xs text-blue-600 ml-2">Uploading...</span>
                  )}
                  {customFormData[field.fieldName]?.originalName && (
                    <div className="mt-1 text-sm text-green-700 flex items-center gap-1">
                      <span>✓</span>
                      <a
                        href={`http://localhost:5000${customFormData[field.fieldName].url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {customFormData[field.fieldName].originalName}
                      </a>
                      <span className="text-gray-400 text-xs">
                        ({(customFormData[field.fieldName].size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomFormData(prev => { const next = { ...prev }; delete next[field.fieldName]; return next; })}
                        className="text-red-500 text-xs ml-1 cursor-pointer bg-transparent border-none"
                      >Remove</button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Max 10MB. Images, PDF, Word, Excel, PowerPoint, text, CSV, ZIP.</p>
                </div>
              ) : (
                <input
                  type={['text', 'email', 'number'].includes(field.fieldType) ? field.fieldType : 'text'}
                  value={customFormData[field.fieldName] || ''}
                  onChange={(e) => setCustomFormData({ ...customFormData, [field.fieldName]: e.target.value })}
                  required={field.required}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Team-Based Event Registration */}
      {event.teamBased ? (
        <div className="bg-blue-50 p-5 my-4 border border-blue-300 rounded-lg">
          <h4 className="mt-0 mb-4">Team Registration (Min: {event.minTeamSize}, Max: {event.maxTeamSize} members)</h4>

          {teamLoading ? <p>Loading team info...</p> : myTeam ? (
            <div className="bg-white p-5 border border-gray-300 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h4 className="m-0">{myTeam.teamName}</h4>
                <span className={`${myTeam.status === 'complete' ? 'bg-green-600 text-white' : 'bg-yellow-500 text-gray-800'} px-3 py-1 rounded-full text-sm font-bold`}>
                  {myTeam.status === 'complete' ? 'COMPLETE' : 'FORMING'}
                </span>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>Team Progress</span>
                  <span>{myTeam.members?.length}/{myTeam.maxSize} members</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${myTeam.status === 'complete' ? 'bg-green-600' : 'bg-blue-600'} h-full rounded-full`}
                    style={{ width: `${(myTeam.members?.length / myTeam.maxSize) * 100}%` }}
                  ></div>
                </div>
              </div>

              {myTeam.status === 'forming' && (
                <div className="bg-yellow-100 p-3 mb-4 rounded-md border border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm text-yellow-800">Invite Code</strong>
                      <div className="font-mono bg-white px-3 py-1.5 text-lg tracking-[3px] mt-1 rounded border border-yellow-400 inline-block">
                        {myTeam.inviteCode}
                      </div>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(myTeam.inviteCode); setMessage('Invite code copied!'); }}
                      className="btn-secondary">Copy</button>
                  </div>
                  <p className="text-xs text-yellow-800 mt-2">Share this code with teammates so they can join your team</p>
                </div>
              )}

              <div className="mb-4">
                <h5 className="mt-0 mb-2 text-sm text-gray-800">Members ({myTeam.members?.length}/{myTeam.maxSize})</h5>
                {myTeam.members?.map((m, i) => {
                  const isLeader = m._id === myTeam.leaderId?._id;
                  const isYou = m._id === user.id || m.email === user.email;
                  const memberTicket = teamTickets.find(t => t.userId?._id === m._id || t.userId?.email === m.email);
                  return (
                    <div key={i} className={`flex items-center justify-between px-3 py-2.5 my-1.5 rounded-md ${isYou ? 'bg-green-50 border border-green-300' : 'bg-gray-100 border border-gray-200'}`}>
                      <div>
                        <strong>{m.firstName} {m.lastName}</strong>
                        {isLeader && <span className="bg-yellow-500 text-gray-800 px-1.5 py-px rounded ml-1.5 text-xs">LEADER</span>}
                        {isYou && <span className="bg-green-600 text-white px-1.5 py-px rounded ml-1.5 text-xs">YOU</span>}
                        <br />
                        <span className="text-gray-500 text-sm">{m.email}</span>
                      </div>
                      <div className="text-right">
                        {myTeam.status === 'complete' && memberTicket ? (
                          <span className="text-green-600 font-bold text-sm">{memberTicket.ticketId}</span>
                        ) : (
                          <span className="text-green-600 text-xs">Joined</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {myTeam.status === 'forming' && Array.from({ length: myTeam.maxSize - (myTeam.members?.length || 0) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center px-3 py-2.5 my-1.5 bg-white border border-dashed border-gray-300 rounded-md text-gray-400">
                    <span>⏳ Waiting for member...</span>
                  </div>
                ))}
              </div>

              {myTeam.status === 'complete' && (
                <div className="bg-green-100 p-3 rounded-md border border-green-300 mb-4">
                  <p className="m-0 text-green-800 text-sm">
                    <strong>Registration Complete</strong> — All {myTeam.members?.length} team members have confirmed tickets. Check your email for QR codes.
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  if (!showChat) { setChatUnread(0); setChatLastSeen(new Date().toISOString()); }
                  else { setChatLastSeen(new Date().toISOString()); }
                  setShowChat(!showChat);
                }}
                className={`inline-block mb-4 px-5 py-2.5 border-0 rounded-md text-white cursor-pointer text-sm font-bold relative ${showChat ? 'bg-purple-700' : 'bg-purple-600'}`}
              >
                {showChat ? 'Hide Team Chat' : 'Open Team Chat'}
                {!showChat && chatUnread > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-[22px] h-[22px] flex items-center justify-center text-xs font-bold">{chatUnread > 9 ? '9+' : chatUnread}</span>
                )}
              </button>

              {showChat && (
                <div className="mb-4">
                  <TeamChat
                    token={token}
                    teamId={myTeam._id}
                    user={user}
                    teamMembers={myTeam.members}
                    onClose={() => setShowChat(false)}
                  />
                </div>
              )}

              <button onClick={handleLeaveTeam} className="btn-danger mt-1">
                {myTeam.leaderId?._id === user.id
                  ? (myTeam.status === 'complete' ? 'Disband Team (Cancels All Registrations)' : 'Disband Team')
                  : (myTeam.status === 'complete' ? 'Leave Team (Cancels Your Registration)' : 'Leave Team')}
              </button>
            </div>
          ) : (
            <>
              {deadlinePassed ? (
                <p className="text-red-600">Registration deadline has passed</p>
              ) : (
                <>
                  <div className="flex gap-2.5 mb-4">
                    <button onClick={() => setTeamTab('create')} className={`px-4 py-2 border-0 cursor-pointer rounded ${teamTab === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>Create Team</button>
                    <button onClick={() => setTeamTab('join')} className={`px-4 py-2 border-0 cursor-pointer rounded ${teamTab === 'join' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>Join Team</button>
                  </div>

                  {teamTab === 'create' ? (
                    <div>
                      <input type="text" placeholder="Team Name" value={createTeamName} onChange={(e) => setCreateTeamName(e.target.value)} className="mb-2.5" />
                      <input type="number" placeholder={`Team Size (${event.minTeamSize}-${event.maxTeamSize})`} min={event.minTeamSize} max={event.maxTeamSize} value={createTeamSize} onChange={(e) => setCreateTeamSize(e.target.value)} className="mb-2.5" />
                      <button onClick={handleCreateTeam} className="btn-success" disabled={!createTeamName}>Create Team</button>
                    </div>
                  ) : (
                    <div>
                      <input type="text" placeholder="Enter Invite Code" value={joinInviteCode} onChange={(e) => setJoinInviteCode(e.target.value)} className="mb-2.5 tracking-[2px] uppercase" />
                      <button onClick={handleJoinTeam} className="btn-success" disabled={!joinInviteCode}>Join Team</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <input type="text" placeholder="Team Name (optional)" value={teamName} onChange={(e) => setTeamName(e.target.value)} />

          <button onClick={handleRegister} disabled={!canRegister() || registering} className={`btn-success ${canRegister() ? 'opacity-100' : 'opacity-50'}`}>
            {registering ? 'Registering...' : event.eventType === 'merchandise' ? 'Purchase' : 'Register'}
          </button>
        </>
      )}

      {message && <div className={`p-2.5 my-2.5 rounded-md ${message.includes('Registered') || message.includes('Ticket') || message.includes('created') || message.includes('Joined') || message.includes('copied') || message.includes('success') || message.includes('Left') || message.includes('disbanded') ? 'bg-green-100' : 'bg-red-100'}`}>{message}</div>}

      {!event.teamBased && deadlinePassed && <p className="text-red-600">Registration deadline has passed</p>}
      {!event.teamBased && soldOut && <p className="text-red-600">Sold out</p>}
      {!event.teamBased && spotsLeft <= 0 && !soldOut && <p className="text-red-600">Registration limit reached</p>}
    </div>
  );
}

export default EventDetails;
