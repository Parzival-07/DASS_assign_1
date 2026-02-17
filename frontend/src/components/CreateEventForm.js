import React, { useState } from 'react';
import { createEvent } from '../services/api';

function CreateEventForm({ token, onSuccess }) {
  const [eventType, setEventType] = useState('normal');
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [registrationLimit, setRegistrationLimit] = useState('');
  const [registrationFee, setRegistrationFee] = useState('');
  const [eventTags, setEventTags] = useState('');

  const [sizes, setSizes] = useState('');
  const [colors, setColors] = useState('');
  const [variants, setVariants] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [purchaseLimit, setPurchaseLimit] = useState('1');
  const [customFormFields, setCustomFormFields] = useState([]);

  const [teamBased, setTeamBased] = useState(false);
  const [minTeamSize, setMinTeamSize] = useState(2);
  const [maxTeamSize, setMaxTeamSize] = useState(4);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const deadline = new Date(registrationDeadline);
    const start = new Date(eventStartDate);
    const end = new Date(eventEndDate);

    if (deadline >= start) {
      setError('Registration deadline must be before event start date');
      return;
    }
    if (start >= end) {
      setError('Event start date must be before event end date');
      return;
    }

    const eventData = {
      eventName,
      eventDescription,
      eventType,
      eligibility,
      registrationDeadline,
      eventStartDate,
      eventEndDate,
      registrationLimit: parseInt(registrationLimit),
      registrationFee: parseFloat(registrationFee),
      eventTags: eventTags.split(',').map(t => t.trim()).filter(t => t),
      status: saveAsDraft ? 'draft' : 'published'
    };

    if (eventType === 'merchandise') {
      eventData.itemDetails = {
        sizes: sizes.split(',').map(s => s.trim()).filter(s => s),
        colors: colors.split(',').map(c => c.trim()).filter(c => c),
        variants: variants.split(',').map(v => v.trim()).filter(v => v),
        stockQuantity: parseInt(stockQuantity),
        purchaseLimitPerParticipant: parseInt(purchaseLimit)
      };
    }

    if (eventType === 'normal' && customFormFields.length > 0) {
      eventData.customForm = customFormFields;
    }

    if (eventType === 'normal' && teamBased) {
      eventData.teamBased = true;
      eventData.minTeamSize = parseInt(minTeamSize);
      eventData.maxTeamSize = parseInt(maxTeamSize);
    }

    try {
      const data = await createEvent(token, eventData);
      if (data.event) {
        setSuccess(saveAsDraft ? 'Event saved as draft!' : 'Event published successfully!');
        if (onSuccess) onSuccess();
      } else {
        setError(data.message || 'Failed to create event');
      }
    } catch (err) {
      setError('Server error');
    }
  };

  const addCustomField = () => {
    setCustomFormFields([...customFormFields, { fieldName: '', fieldType: 'text', required: false, options: [] }]);
  };

  const removeCustomField = (index) => {
    setCustomFormFields(customFormFields.filter((_, i) => i !== index));
  };

  const moveFieldUp = (index) => {
    if (index === 0) return;
    const updated = [...customFormFields];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setCustomFormFields(updated);
  };

  const moveFieldDown = (index) => {
    if (index === customFormFields.length - 1) return;
    const updated = [...customFormFields];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setCustomFormFields(updated);
  };

  const updateCustomField = (index, key, value) => {
    const updated = [...customFormFields];
    updated[index][key] = value;
    setCustomFormFields(updated);
  };

  const [saveAsDraft, setSaveAsDraft] = useState(true);

  return (
    <div>
      <h3>Create New Event</h3>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} required>
          <option value="normal">Normal Event</option>
          <option value="merchandise">Merchandise Event</option>
        </select>

        <input type="text" placeholder="Event Name" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
        <textarea placeholder="Event Description" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} required rows="3" />

        <select value={eligibility} onChange={(e) => setEligibility(e.target.value)} required>
          <option value="">Select Eligibility</option>
          <option value="All Students">All Students</option>
          <option value="IIIT Students">IIIT Students</option>
          <option value="Non-IIIT Students">Non-IIIT Students</option>
        </select>

        <label>Registration Deadline</label>
        <input type="datetime-local" value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)} required />

        <label>Event Start Date</label>
        <input type="datetime-local" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} required />

        <label>Event End Date</label>
        <input type="datetime-local" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} required />

        <input type="number" placeholder="Registration Limit" value={registrationLimit} onChange={(e) => setRegistrationLimit(e.target.value)} required />
        <input type="number" placeholder="Registration Fee" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} required />
        <input type="text" placeholder="Event Tags (comma-separated)" value={eventTags} onChange={(e) => setEventTags(e.target.value)} />

        {eventType === 'merchandise' && (
          <>
            <input type="text" placeholder="Sizes (comma-separated, e.g., S,M,L,XL)" value={sizes} onChange={(e) => setSizes(e.target.value)} required />
            <input type="text" placeholder="Colors (comma-separated)" value={colors} onChange={(e) => setColors(e.target.value)} required />
            <input type="text" placeholder="Variants (comma-separated, e.g., Standard,Premium)" value={variants} onChange={(e) => setVariants(e.target.value)} />
            <input type="number" placeholder="Stock Quantity" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} required />
            <input type="number" placeholder="Purchase Limit Per Participant" value={purchaseLimit} onChange={(e) => setPurchaseLimit(e.target.value)} required />
          </>
        )}

        {eventType === 'normal' && (
          <>
            <div className="my-4 p-4 bg-blue-50 border border-blue-300 rounded-md">
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={teamBased} onChange={(e) => setTeamBased(e.target.checked)} />
                Team-Based Event (Hackathon)
              </label>
              {teamBased && (
                <div className="mt-2 flex gap-2">
                  <div>
                    <label>Min Team Size</label>
                    <input type="number" min="2" max="20" value={minTeamSize} onChange={(e) => setMinTeamSize(e.target.value)} className="w-20" />
                  </div>
                  <div>
                    <label>Max Team Size</label>
                    <input type="number" min="2" max="20" value={maxTeamSize} onChange={(e) => setMaxTeamSize(e.target.value)} className="w-20" />
                  </div>
                </div>
              )}
            </div>

            <h4>Custom Registration Form (Optional)</h4>
            {customFormFields.map((field, index) => (
              <div key={index} className="border border-gray-300 p-2 my-2 rounded-md">
                <input type="text" placeholder="Field Name" value={field.fieldName} onChange={(e) => updateCustomField(index, 'fieldName', e.target.value)} />
                <select value={field.fieldType} onChange={(e) => updateCustomField(index, 'fieldType', e.target.value)}>
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="number">Number</option>
                  <option value="select">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="file">File Upload</option>
                </select>
                {(field.fieldType === 'select' || field.fieldType === 'checkbox') && (
                  <input type="text" placeholder="Options (comma-separated)" value={field.options?.join(',') || ''} onChange={(e) => updateCustomField(index, 'options', e.target.value.split(',').map(o => o.trim()))} />
                )}
                <label><input type="checkbox" checked={field.required} onChange={(e) => updateCustomField(index, 'required', e.target.checked)} /> Required</label>
                <div className="flex gap-1 mt-1">
                  <button type="button" onClick={() => moveFieldUp(index)} disabled={index === 0} className="btn-secondary px-2 py-0.5 text-sm">↑</button>
                  <button type="button" onClick={() => moveFieldDown(index)} disabled={index === customFormFields.length - 1} className="btn-secondary px-2 py-0.5 text-sm">↓</button>
                  <button type="button" onClick={() => removeCustomField(index)} className="btn-danger px-2 py-0.5 text-sm">Remove</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addCustomField} className="btn-secondary">Add Form Field</button>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button type="submit" onClick={() => setSaveAsDraft(true)} className="btn-secondary">Save as Draft</button>
          <button type="submit" onClick={() => setSaveAsDraft(false)} className="btn-success">Publish Now</button>
        </div>
      </form>
    </div>
  );
}

export default CreateEventForm;
