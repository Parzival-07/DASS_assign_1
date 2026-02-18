// QR code scanner component for event attendance verification
import React, { useState, useEffect, useRef } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function QRScanner({ token, eventId, onScanComplete }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [manualTicketId, setManualTicketId] = useState('');
  const html5QrCodeRef = useRef(null);

  // start camera scanner using html5 qrcode library
  const startScanner = async () => {
    setError('');
    setResult(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQRData(decodedText);
          stopScanner();
        },
        () => { }
      );
      setScanning(true);
    } catch (err) {
      setError('Camera access denied or not available. Use manual entry or file upload.');
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (e) { }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  // process scanned QR data and send to server for attendance marking
  const handleQRData = async (rawData) => {
    setResult(null);
    setError('');
    try {
      let qrPayload;
      try {
        qrPayload = JSON.parse(decodeURIComponent(rawData));
      } catch {
        try {
          qrPayload = JSON.parse(rawData);
        } catch {
          setError('Invalid QR code format');
          return;
        }
      }

      const res = await fetch(`${API_URL}/organizer/event/${eventId}/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(qrPayload)
      });
      const data = await res.json();

      setResult({
        scanResult: data.scanResult,
        message: data.message,
        participant: data.participant
      });

      if (onScanComplete) onScanComplete();
    } catch (err) {
      setError('Failed to process QR code');
    }
  };

  // handle QR code scanning from an uploaded image file
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setResult(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-file-reader');
      const decoded = await scanner.scanFile(file, true);
      handleQRData(decoded);
    } catch (err) {
      setError('Could not read QR from image. Try a clearer photo.');
    }
  };

  // manually verify a ticket ID entered by the organizer
  const handleManualEntry = async () => {
    if (!manualTicketId.trim()) return;
    setResult(null);
    setError('');
    try {
      const res = await fetch(`${API_URL}/organizer/event/${eventId}/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ticketId: manualTicketId.trim() })
      });
      const data = await res.json();
      setResult({
        scanResult: data.scanResult,
        message: data.message,
        participant: data.participant
      });
      if (onScanComplete) onScanComplete();
      setManualTicketId('');
    } catch (err) {
      setError('Failed to verify ticket');
    }
  };

  // determine result styling class based on scan outcome
  const getResultClass = () => {
    if (!result) return '';
    const classes = {
      success: 'bg-green-100 border-2 border-green-600 text-green-800',
      duplicate: 'bg-yellow-100 border-2 border-yellow-500 text-yellow-800',
      invalid: 'bg-red-100 border-2 border-red-600 text-red-800',
      cancelled: 'bg-red-100 border-2 border-red-600 text-red-800',
      'wrong-event': 'bg-red-100 border-2 border-red-600 text-red-800'
    };
    return classes[result.scanResult] || classes.invalid;
  };

  const getResultIcon = () => {
    if (!result) return '';
    const icons = { success: 'OK', duplicate: 'WARN', invalid: 'ERR', cancelled: 'ERR', 'wrong-event': 'ERR' };
    return icons[result.scanResult] || 'ERR';
  };

  return (
    <div>
      {result && (
        <div className={`${getResultClass()} rounded-lg p-4 my-4 text-center`}>
          <h3 className="mb-2.5">{getResultIcon()} {result.message}</h3>
          {result.participant && (
            <div>
              <p className="my-1"><strong>Name:</strong> {result.participant.name}</p>
              <p className="my-1"><strong>Email:</strong> {result.participant.email}</p>
              {result.participant.ticketId && <p className="my-1"><strong>Ticket:</strong> {result.participant.ticketId}</p>}
              {result.participant.markedAt && <p className="my-1"><strong>Time:</strong> {new Date(result.participant.markedAt).toLocaleString()}</p>}
            </div>
          )}
          <button onClick={() => { setResult(null); }} className="btn-primary mt-2.5">
            Scan Next
          </button>
        </div>
      )}

      {error && <div className="bg-red-100 p-2.5 my-2.5 text-red-800 rounded">{error}</div>}

      <div className="mb-5">
        <h4>Camera Scanner</h4>
        <div id="qr-reader" className="w-full max-w-md mx-auto"></div>
        <div className="text-center mt-2.5">
          {!scanning ? (
            <button onClick={startScanner} className="btn-primary">Start Camera</button>
          ) : (
            <button onClick={stopScanner} className="btn-danger">Stop Camera</button>
          )}
        </div>
      </div>

      <div className="mb-5 p-4 bg-gray-100 rounded">
        <h4>Upload QR Image</h4>
        <input type="file" accept="image/*" onChange={handleFileUpload} />
        <div id="qr-file-reader" className="hidden"></div>
      </div>

      <div className="p-4 bg-gray-100 rounded">
        <h4>Manual Ticket ID Entry</h4>
        <div className="flex gap-2.5 items-center">
          <input type="text" placeholder="Enter Ticket ID (e.g., TKT-XXXXXXXX)" value={manualTicketId}
            onChange={(e) => setManualTicketId(e.target.value)}
            className="flex-1 inline-block w-auto text-gray-800 bg-white border-2 border-gray-400 px-3 py-2.5 m-0 rounded text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()} />
          <button onClick={handleManualEntry} className="btn-success w-auto whitespace-nowrap"
            disabled={!manualTicketId.trim()}>Verify</button>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;
