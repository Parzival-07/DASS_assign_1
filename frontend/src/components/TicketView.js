import React, { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function TicketView({ token, ticketId, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTicket = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/registration/ticket/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTicket(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }, [ticketId, token]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  if (loading) return <p>Loading ticket...</p>;
  if (!ticket) return <p>Ticket not found</p>;

  const qrData = encodeURIComponent(JSON.stringify({ ticketId, eventId: ticket.eventId?._id, userId: ticket.userId?._id }));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;

  const formatGCalDate = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const getGoogleCalendarUrl = () => {
    const ev = ticket.eventId;
    if (!ev) return '#';
    const start = formatGCalDate(ev.eventStartDate);
    const end = formatGCalDate(ev.eventEndDate);
    const details = encodeURIComponent(`Ticket ID: ${ticket.ticketId}\n${ev.eventDescription || ''}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.eventName)}&dates=${start}/${end}&details=${details}`;
  };

  const getOutlookUrl = () => {
    const ev = ticket.eventId;
    if (!ev) return '#';
    const start = new Date(ev.eventStartDate).toISOString();
    const end = new Date(ev.eventEndDate).toISOString();
    const body = encodeURIComponent(`Ticket ID: ${ticket.ticketId}\n${ev.eventDescription || ''}`);
    return `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(ev.eventName)}&startdt=${start}&enddt=${end}&body=${body}`;
  };

  const downloadICS = async () => {
    try {
      const res = await fetch(`${API_URL}/registration/calendar/${ticket.ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ticket.eventId?.eventName?.replace(/[^a-zA-Z0-9]/g, '_') || 'event'}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download calendar file');
    }
  };

  return (
    <div className="text-center">
      <button onClick={onBack} className="btn-secondary mb-4">← Back</button>
      
      <div className="border-2 border-gray-800 p-5 max-w-md mx-auto bg-white">
        <h2>Event Ticket</h2>
        <hr />
        
        <h3>{ticket.eventId?.eventName}</h3>
        <p><strong>Ticket ID:</strong> {ticket.ticketId}</p>
        <p><strong>Status:</strong> <span className={ticket.status === 'confirmed' ? 'text-green-600' : 'text-red-600'}>{ticket.status.toUpperCase()}</span></p>
        
        <hr />
        
        <p><strong>Participant:</strong> {ticket.userId?.firstName} {ticket.userId?.lastName}</p>
        <p><strong>Email:</strong> {ticket.userId?.email}</p>
        
        {ticket.teamName && <p><strong>Team:</strong> {ticket.teamName}</p>}
        
        <hr />
        
        <p><strong>Event Type:</strong> {ticket.eventType}</p>
        <p><strong>Date:</strong> {new Date(ticket.eventId?.eventStartDate).toLocaleString()}</p>
        
        {ticket.eventType === 'merchandise' && (
          <div>
            {ticket.selectedSize && <p><strong>Size:</strong> {ticket.selectedSize}</p>}
            {ticket.selectedColor && <p><strong>Color:</strong> {ticket.selectedColor}</p>}
            {ticket.selectedVariant && <p><strong>Variant:</strong> {ticket.selectedVariant}</p>}
            <p><strong>Quantity:</strong> {ticket.quantity}</p>
          </div>
        )}
        
        <hr />
        
        <img src={qrUrl} alt="QR Code" className="my-4 inline-block" />
        <p className="text-xs text-gray-500">Scan QR for verification</p>
        
        <p><strong>Registered:</strong> {new Date(ticket.registeredAt).toLocaleString()}</p>

        {ticket.status === 'confirmed' && ticket.eventId && (
          <>
            <hr />
            <h4 className="mt-2.5 mb-2">📅 Add to Calendar</h4>
            <div className="flex flex-wrap justify-center">
              <button onClick={downloadICS} className="inline-block px-3 py-1.5 rounded text-white text-xs font-bold no-underline m-1 bg-teal-500">📥 Download .ics</button>
              <a href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 rounded text-white text-xs font-bold no-underline m-1 bg-blue-500">Google Calendar</a>
              <a href={getOutlookUrl()} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 rounded text-white text-xs font-bold no-underline m-1 bg-blue-700">Outlook</a>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">.ics works with Apple Calendar, Thunderbird, and more</p>
          </>
        )}
      </div>
    </div>
  );
}

export default TicketView;
