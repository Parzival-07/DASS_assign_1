import React, { useState } from 'react';
import { register } from '../services/api';

function RegisterForm() {
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState('');
  const [studentType, setStudentType] = useState(''); // 'iiit', 'non-iiit'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectUserType = (type) => {
    setUserType(type);
    setError('');
    setSuccess('');
    
    if (type === 'student') {
      setStep(2);
    } else {
      setStep(3);
    }
  };

  const selectStudentType = (type) => {
    setStudentType(type);
    if (type === 'iiit') {
      setCollegeName('IIIT');
    } else {
      setCollegeName('');
    }
    setStep(3);
  };

  const goBack = () => {
    if (step === 3 && userType === 'student') {
      setStep(2);
      setStudentType('');
    } else {
      setStep(1);
      setUserType('');
      setStudentType('');
    }
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (userType === 'admin' || userType === 'organizer') {
      setError('Admin and Organizer accounts cannot self-register. Contact administrator.');
      return;
    }

    const role = studentType === 'iiit' ? 'iiit-student' : 'non-iiit-student';
    const finalCollegeName = role === 'iiit-student' ? 'IIIT' : collegeName;

    try {
      const data = await register(email, password, role, firstName, lastName, finalCollegeName, contactNumber);

      if (data.user) {
        setSuccess('Registration successful! You can now login.');
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setCollegeName('');
        setContactNumber('');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Server error. Please try again.');
    }
  };

  if (step === 1) {
    return (
      <div>
        <h3>Step 1: Select User Type</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => selectUserType('student')} className="btn-primary">
            STUDENT
          </button>
          <button onClick={() => selectUserType('organizer')} className="btn-secondary">
            ORGANIZER / CLUB
          </button>
          <button onClick={() => selectUserType('admin')} className="btn-secondary">
            ADMIN
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        <h3>Step 2: Are You an IIIT Student?</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => selectStudentType('iiit')} className="btn-success">
            YES - IIIT STUDENT
          </button>
          <button onClick={() => selectStudentType('non-iiit')} className="btn-primary">
            NO - NON-IIIT STUDENT
          </button>
          <button onClick={goBack} className="btn-secondary">
            BACK
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    if (userType === 'admin' || userType === 'organizer') {
      return (
        <div>
          <h3>{userType === 'admin' ? 'Admin Account' : 'Organizer Account'}</h3>
          <div className="error">
            {userType === 'admin' 
              ? 'Admin accounts are provisioned by the backend. No self-registration allowed.'
              : 'Organizer accounts must be created by an Admin. Contact administrator.'}
          </div>
          <button onClick={goBack} className="btn-secondary">
            BACK
          </button>
        </div>
      );
    }

    return (
      <div>
        <h3>Step 3: {studentType === 'iiit' ? 'IIIT Student' : 'Non-IIIT Student'} Registration</h3>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          
          <input
            type="email"
            placeholder={studentType === 'iiit' ? 'Email (must end with .iiit.ac.in)' : 'Email'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {studentType === 'non-iiit' && (
            <input
              type="text"
              placeholder="College Name"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              required
            />
          )}
          
          <input
            type="tel"
            placeholder="Contact Number"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <div className="flex gap-2 mt-2">
            <button type="submit" className="btn-success">REGISTER</button>
            <button type="button" onClick={goBack} className="btn-secondary">BACK</button>
          </div>
        </form>
      </div>
    );
  }
}

export default RegisterForm;
