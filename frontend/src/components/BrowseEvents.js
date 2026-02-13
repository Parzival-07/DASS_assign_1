import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function BrowseEvents({ token, onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('all');
  const [eligibility, setEligibility] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [followedOnly, setFollowedOnly] = useState(false);
  const [matchingInterests, setMatchingInterests] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTrending(); }, []);
  useEffect(() => { searchEvents(); }, [search, eventType, eligibility, startDate, endDate, followedOnly, matchingInterests]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrending = async () => {
    try {
      const res = await fetch(`${API_URL}/browse/trending`);
      const data = await res.json();
      setTrending(data.trending || []);
    } catch (err) { console.error(err); }
  };

  const searchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (eventType !== 'all') params.append('eventType', eventType);
      if (eligibility !== 'all') params.append('eligibility', eligibility);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (followedOnly) params.append('followedOnly', 'true');
      if (matchingInterests) params.append('matchingInterests', 'true');

      const res = await fetch(`${API_URL}/browse/events?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEvents(data.events || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Browse Events</h3>

      {trending.length > 0 && (
        <div className="mb-5">
          <h4>Trending (Top 5 in 24h)</h4>
          {trending.map(e => (
            <span key={e._id} onClick={() => onSelectEvent(e._id)} className="cursor-pointer mr-2 text-blue-600">
              {e.eventName}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[150px]" />
        <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="normal">Normal</option>
          <option value="merchandise">Merchandise</option>
        </select>
        <select value={eligibility} onChange={(e) => setEligibility(e.target.value)}>
          <option value="all">All Students</option>
          <option value="IIIT Students">IIIT Only</option>
          <option value="Non-IIIT Students">Non-IIIT Only</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} title="Start Date" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} title="End Date" />
        <label className="flex items-center">
          <input type="checkbox" checked={followedOnly} onChange={(e) => setFollowedOnly(e.target.checked)} />
          Followed Clubs
        </label>
        <label className="flex items-center">
          <input type="checkbox" checked={matchingInterests} onChange={(e) => setMatchingInterests(e.target.checked)} />
          Matching Interests
        </label>
      </div>

      {loading ? <p>Loading...</p> : events.length === 0 ? <p>No events found</p> : (
        <div>
          {events.map(event => (
            <div key={event._id} onClick={() => onSelectEvent(event._id)} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-pointer">
              <strong>{event.eventName}</strong> <span className="text-gray-500">({event.eventType})</span>
              <p>{event.eventDescription?.substring(0, 100)}...</p>
              <p>{new Date(event.eventStartDate).toLocaleDateString()} | {event.organizerId?.organizationName || 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BrowseEvents;
