import React, { useState, useEffect } from 'react';
import { getAllEvents } from '../services/api';

function EventsList({ token }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await getAllEvents(token);
      if (Array.isArray(data)) {
        setEvents(data);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  if (loading) return <p>Loading events...</p>;

  return (
    <div>
      <h3>All Events {token && '(Personalized for you)'}</h3>
      {events.length === 0 ? (
        <p>No events available</p>
      ) : (
        events.map(event => (
          <div key={event._id} style={{border: '1px solid #ccc', padding: '10px', margin: '10px 0'}}>
            <h4>{event.eventName}</h4>
            <p><strong>Type:</strong> {event.eventType}</p>
            <p>{event.eventDescription}</p>
            <p><strong>Organizer:</strong> {event.organizerId?.organizationName}</p>
            <p><strong>Fee:</strong> ₹{event.registrationFee}</p>
            <p><strong>Limit:</strong> {event.currentRegistrations}/{event.registrationLimit}</p>
            <p><strong>Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}</p>
            {event.eventTags?.length > 0 && <p><strong>Tags:</strong> {event.eventTags.join(', ')}</p>}
          </div>
        ))
      )}
    </div>
  );
}

export default EventsList;
