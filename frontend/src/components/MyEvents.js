import React, { useState, useEffect } from 'react';
import TeamChat from './TeamChat';

const API_URL = 'http://localhost:5000/api';

function MyEvents({ token, user, onViewTicket }) {
  const [events, setEvents] = useState({ upcoming: [], completed: [], cancelled: [], normal: [], merchandise: [] });
  const [tab, setTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [teamInfo, setTeamInfo] = useState({});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [showChat, setShowChat] = useState({});
  const [chatUnread, setChatUnread] = useState({});
  const [chatLastSeen, setChatLastSeen] = useState({}); // eventId -> ISO string

  useEffect(() => { loadEvents(); }, []);

  useEffect(() => {
    const teamEntries = Object.entries(teamInfo);
    if (teamEntries.length === 0) return;
    const poll = setInterval(async () => {
      for (const [eid, team] of teamEntries) {
        if (showChat[eid]) continue;
        const since = chatLastSeen[eid] || new Date().toISOString();
        try {
          const res = await fetch(`${API_URL}/chat/unread/${team._id}?since=${encodeURIComponent(since)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.count !== undefined) setChatUnread(prev => ({ ...prev, [eid]: data.count }));
        } catch (e) { }
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [teamInfo, showChat, chatLastSeen, token]);

  const loadEvents = async () => {
    try {
      const res = await fetch(`${API_URL}/registration/my-events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEvents(data);
      setLoading(false);
      
      const allRegs = [...(data.upcoming || []), ...(data.completed || []), ...(data.normal || []), ...(data.merchandise || [])];
      const teamEventIds = allRegs.filter(r => r.eventId?.teamBased).map(r => r.eventId._id);
      const uniqueIds = [...new Set(teamEventIds)];
      for (const eid of uniqueIds) {
        try {
          const teamRes = await fetch(`${API_URL}/team/my-team/${eid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const teamData = await teamRes.json();
          if (teamData.team) {
            setTeamInfo(prev => ({ ...prev, [eid]: teamData.team }));
          }
        } catch (e) { }
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const cancelRegistration = async (ticketId, isTeamEvent, isLeader) => {
    let confirmMsg = 'Are you sure you want to cancel this registration?';
    if (isTeamEvent && isLeader) {
      confirmMsg = 'WARNING: You are the TEAM LEADER.\\n\\nCancelling will cancel ALL team members\' registrations and disband the team.\\n\\nAre you sure?';
    } else if (isTeamEvent) {
      confirmMsg = 'Cancelling will remove you from the team.\\n\\nAre you sure?';
    }
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await fetch(`${API_URL}/registration/cancel/${ticketId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Registration cancelled successfully');
        loadEvents(); // Refresh the list
      } else {
        alert(data.message || 'Failed to cancel');
      }
    } catch (err) {
      alert('Error cancelling registration');
    }
  };

  const tabs = ['upcoming', 'normal', 'merchandise', 'completed', 'cancelled'];

  const formatGCalDate = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const getGoogleCalendarUrl = (ev, tktId) => {
    if (!ev) return '#';
    const start = formatGCalDate(ev.eventStartDate);
    const end = formatGCalDate(ev.eventEndDate);
    const details = encodeURIComponent(`Ticket ID: ${tktId}\n${ev.eventDescription || ''}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.eventName)}&dates=${start}/${end}&details=${details}`;
  };

  const getOutlookUrl = (ev, tktId) => {
    if (!ev) return '#';
    const start = new Date(ev.eventStartDate).toISOString();
    const end = new Date(ev.eventEndDate).toISOString();
    const body = encodeURIComponent(`Ticket ID: ${tktId}\n${ev.eventDescription || ''}`);
    return `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(ev.eventName)}&startdt=${start}&enddt=${end}&body=${body}`;
  };

  const downloadICS = async (tktId, evName) => {
    try {
      const res = await fetch(`${API_URL}/registration/calendar/${tktId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(evName || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download calendar file');
    }
  };

  const renderEvent = (reg) => {
    const team = reg.eventId?.teamBased ? teamInfo[reg.eventId._id] : null;
    return (
      <div key={reg.ticketId} className="border border-gray-300 p-2.5 mb-2.5">
        <strong>{reg.eventId?.eventName || 'Event Deleted'}</strong>
        {reg.eventId?.teamBased && <span className="bg-purple-600 text-white px-1.5 py-0.5 rounded ml-2 text-xs">TEAM</span>}
        <p>Type: {reg.eventType} | Status: <span className={reg.status === 'cancelled' ? 'text-red-600' : 'text-green-600'}>{reg.status}</span></p>
        <p>Organizer: {reg.eventId?.organizerId?.organizationName || 'N/A'}</p>
        {reg.teamName && <p>Team: {reg.teamName}</p>}
        
        {team && (
          <div className={`${team.status === 'cancelled' ? 'bg-red-100' : 'bg-blue-50'} p-3 my-2 rounded-md border border-blue-300`}>
            <div className="flex justify-between items-center">
              <div>
                <strong>Team: {team.teamName}</strong> ({team.members?.length}/{team.maxSize})
                <span className={`ml-2.5 font-bold ${team.status === 'complete' ? 'text-green-600' : team.status === 'cancelled' ? 'text-red-600' : 'text-yellow-500'}`}>
                  [{team.status.toUpperCase()}]
                </span>
              </div>
              <button
                onClick={() => setExpandedEvents(prev => ({ ...prev, [reg.eventId._id]: !prev[reg.eventId._id] }))}
                className={`inline-block px-3.5 py-1.5 border-0 rounded text-white cursor-pointer text-xs ${expandedEvents[reg.eventId._id] ? 'bg-purple-700' : 'bg-purple-600'}`}
              >
                {expandedEvents[reg.eventId._id] ? 'Hide Team Dashboard' : 'Show Team Dashboard'}
              </button>
            </div>
            
            {!expandedEvents[reg.eventId._id] && (
              <div className="mt-1.5 text-sm text-gray-600">
                Members: {team.members?.map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                {team.status === 'forming' && (
                  <span className="ml-2.5">Invite: <code>{team.inviteCode}</code></span>
                )}
              </div>
            )}

            {/* Expanded Team Dashboard */}
            {expandedEvents[reg.eventId._id] && (
              <div className="mt-4 p-4 bg-white rounded-md border border-gray-300">
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Team Progress</span>
                    <span>{team.members?.length}/{team.maxSize} members</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${team.status === 'complete' ? 'bg-green-600' : 'bg-blue-600'} h-full rounded-full`}
                      style={{ width: `${(team.members?.length / team.maxSize) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {team.status === 'forming' && (
                  <div className="bg-yellow-100 p-2.5 mb-4 rounded-md border border-yellow-500">
                    <strong className="text-xs text-yellow-800">Invite Code</strong>
                    <div className="font-mono bg-white px-3 py-1.5 text-base tracking-[3px] mt-1 rounded border border-yellow-400 inline-block">
                      {team.inviteCode}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(team.inviteCode);
                        alert('Invite code copied!');
                      }}
                      className="inline-block ml-2.5 px-3 py-1.5 border-0 rounded bg-gray-500 text-white cursor-pointer text-xs"
                    >
                      Copy
                    </button>
                  </div>
                )}

                <div className="mb-4">
                  <h5 className="mb-2.5 text-sm text-gray-800">Team Members</h5>
                  {team.members?.map((m, i) => {
                    const isLeader = m._id === team.leaderId?._id;
                    const isYou = m._id === user?.id || m.email === user?.email;
                    return (
                      <div key={i} className={`flex items-center justify-between px-2.5 py-2 my-1 rounded text-sm ${isYou ? 'bg-green-100 border border-green-300' : 'bg-gray-100 border border-gray-200'}`}>
                        <div>
                          <strong>{m.firstName} {m.lastName}</strong>
                          {isLeader && <span className="bg-yellow-500 text-gray-800 px-1.5 py-px rounded ml-1.5 text-[10px]">LEADER</span>}
                          {isYou && <span className="bg-green-600 text-white px-1.5 py-px rounded ml-1.5 text-[10px]">YOU</span>}
                          <br />
                          <span className="text-gray-500 text-[11px]">{m.email}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>


                <button
                  onClick={() => {
                    const eid = reg.eventId._id;
                    const opening = !showChat[eid];
                    if (opening) {
                      setChatUnread(prev => ({ ...prev, [eid]: 0 }));
                      setChatLastSeen(prev => ({ ...prev, [eid]: new Date().toISOString() }));
                    } else {
                      setChatLastSeen(prev => ({ ...prev, [eid]: new Date().toISOString() }));
                    }
                    setShowChat(prev => ({ ...prev, [eid]: opening }));
                  }}
                  className={`inline-block mb-2.5 px-4 py-2 border-0 rounded-md text-white cursor-pointer text-sm font-bold relative ${showChat[reg.eventId._id] ? 'bg-purple-700' : 'bg-purple-600'}`}
                >
                  {showChat[reg.eventId._id] ? 'Hide Team Chat' : 'Open Team Chat'}
                  {!showChat[reg.eventId._id] && chatUnread[reg.eventId._id] > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                      {chatUnread[reg.eventId._id] > 9 ? '9+' : chatUnread[reg.eventId._id]}
                    </span>
                  )}
                </button>


                {showChat[reg.eventId._id] && (
                  <div className="mt-2.5">
                    <TeamChat
                      token={token}
                      teamId={team._id}
                      user={user}
                      teamMembers={team.members}
                      onClose={() => setShowChat(prev => ({ ...prev, [reg.eventId._id]: false }))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <p>Date: {reg.eventId?.eventStartDate ? new Date(reg.eventId.eventStartDate).toLocaleDateString() : 'N/A'}</p>
        <button onClick={() => onViewTicket(reg.ticketId)} className="btn-primary mt-1 mr-2.5">
          View Ticket: {reg.ticketId}
        </button>
        {reg.status === 'confirmed' && (
          <button onClick={() => cancelRegistration(
            reg.ticketId,
            !!reg.eventId?.teamBased,
            team?.leaderId?._id === user?.id
          )} className="btn-danger mt-1">
            {reg.eventId?.teamBased ? 'Cancel Team Registration' : 'Cancel Registration'}
          </button>
        )}

        {reg.status === 'confirmed' && reg.eventId && (
          <div className="mt-2.5 p-2.5 bg-blue-50 rounded-md border border-blue-300">
            <strong className="text-sm">📅 Add to Calendar:</strong>
            <div className="mt-1.5">
              <button onClick={() => downloadICS(reg.ticketId, reg.eventId?.eventName)} className="inline-block px-3 py-1.5 rounded text-white text-xs font-bold no-underline m-1 bg-teal-500">📥 .ics</button>
              <a href={getGoogleCalendarUrl(reg.eventId, reg.ticketId)} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 rounded text-white text-xs font-bold no-underline m-1 bg-blue-500">Google</a>
              <a href={getOutlookUrl(reg.eventId, reg.ticketId)} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 rounded text-white text-xs font-bold no-underline m-1 bg-blue-700">Outlook</a>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h3>My Events</h3>
      <div className="mb-4">
        {tabs.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'tab-btn-active' : 'tab-btn-inactive'}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)} ({events[t]?.length || 0})
          </button>
        ))}
      </div>
      {events[tab]?.length === 0 ? <p>No events in this category</p> : events[tab]?.map(renderEvent)}
    </div>
  );
}

export default MyEvents;
