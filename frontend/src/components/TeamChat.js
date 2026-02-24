// team chat component with real-time messaging via Socket.io
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || (API_URL.replace('/api', ''));

function TeamChat({ token, teamId, user, teamMembers, onClose }) {
  // state for messages typing indicators and online status
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [teamName, setTeamName] = useState('');

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // load initial message history from REST API
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chat/messages/${teamId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
      if (data.online) setOnlineStatus(data.online);
      if (data.teamName) setTeamName(data.teamName);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [teamId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // connect to socket.io and set up real-time event handlers
  useEffect(() => {
    loadMessages();

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.emit('join-team', { teamId });

    // another team member sent a message — add it if not already present
    socket.on('new-message', ({ chatMessage }) => {
      setMessages(prev => {
        if (prev.some(m => m._id === chatMessage._id)) return prev;
        return [...prev, chatMessage];
      });
    });

    // typing indicator from another member
    socket.on('user-typing', ({ userId }) => {
      setTypingUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
      // auto-clear if no stop-typing event arrives
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(id => id !== userId));
      }, 4000);
    });
    socket.on('user-stop-typing', ({ userId }) => {
      setTypingUsers(prev => prev.filter(id => id !== userId));
    });

    // online/offline presence from socket connection events
    socket.on('user-online', ({ userId }) => {
      setOnlineStatus(prev => ({ ...prev, [userId]: true }));
    });
    socket.on('user-offline', ({ userId }) => {
      setOnlineStatus(prev => ({ ...prev, [userId]: false }));
    });

    return () => {
      socket.disconnect();
    };
  }, [teamId, token, loadMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // emit typing/stop-typing events through the socket instead of REST
  const sendTyping = () => {
    if (socketRef.current) socketRef.current.emit('typing', { teamId });
  };

  const sendStopTyping = () => {
    if (socketRef.current) socketRef.current.emit('stop-typing', { teamId });
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    sendTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(sendStopTyping, 2000);
  };

  // send a text message to the team chat
  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ teamId, message: newMessage.trim() })
      });
      const data = await res.json();
      if (data.chatMessage) {
        // dedup: socket 'new-message' may have already added this
        setMessages(prev => prev.some(m => m._id === data.chatMessage._id) ? prev : [...prev, data.chatMessage]);
        setNewMessage('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Error sending message');
    }
    setSending(false);
  };

  // handle file sharing by uploading and sending as a file message
  const handleFileShare = async (file) => {
    if (!file || uploadingFile) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('teamId', teamId);
      const res = await fetch(`${API_URL}/chat/send-file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.chatMessage) {
        // dedup: socket 'new-message' may have already added this
        setMessages(prev => prev.some(m => m._id === data.chatMessage._id) ? prev : [...prev, data.chatMessage]);
      }
    } catch (err) {
      console.error('Error sharing file');
    }
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // render file messages with image preview or download link
  const renderFileMessage = (msg) => {
    try {
      const fileInfo = JSON.parse(msg.message);
      const isImage = fileInfo.mimetype?.startsWith('image/');
      const fileUrl = `http://localhost:5000${fileInfo.url}`;
      const sizeStr = fileInfo.size > 1024 * 1024
        ? `${(fileInfo.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(fileInfo.size / 1024).toFixed(1)} KB`;

      if (isImage) {
        return (
          <div>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <img src={fileUrl} alt={fileInfo.originalName} className="max-w-[200px] max-h-[200px] rounded-md" />
            </a>
            <div className="text-[10px] opacity-70 mt-0.5">{fileInfo.originalName} ({sizeStr})</div>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 bg-black/10 rounded-md px-2 py-1.5">
          <span className="text-lg"></span>
          <div>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold text-sm underline break-all">
              {fileInfo.originalName}
            </a>
            <div className="text-[10px] opacity-70">{sizeStr}</div>
          </div>
        </div>
      );
    } catch {
      return renderMessage(msg.message);
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  // group messages by date for display with date separators
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.createdAt);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  const getTypingNames = () => {
    if (!typingUsers.length || !teamMembers) return '';
    const names = typingUsers.map(uid => {
      const member = teamMembers.find(m => m._id === uid);
      return member ? member.firstName : 'Someone';
    });
    if (names.length === 1) return `${names[0]} is typing...`;
    return `${names.join(', ')} are typing...`;
  };

  const renderMessage = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 break-all">{part}</a>;
      }
      urlRegex.lastIndex = 0;
      return part;
    });
  };

  return (
    <div className="flex flex-col h-[500px] border border-gray-300 rounded-lg overflow-hidden bg-white">
      <div className="bg-purple-600 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <strong>{teamName || 'Team Chat'}</strong>
          <div className="text-xs opacity-80">
            {Object.values(onlineStatus).filter(Boolean).length} online
            {teamMembers && ` / ${teamMembers.length} members`}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            {teamMembers?.map((m, i) => (
              <div key={i} title={`${m.firstName} ${m.lastName}${onlineStatus[m._id] ? ' (Online)' : ' (Offline)'}`}
                className={`w-2.5 h-2.5 rounded-full border border-white/50 ${onlineStatus[m._id] ? 'bg-green-600' : 'bg-gray-500'}`} />
            ))}
          </div>
          {onClose && <button onClick={onClose} className="bg-white/20 border-none text-white cursor-pointer px-2 py-1 rounded text-sm">Close</button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2.5 bg-gray-100">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <div className="text-4xl mb-2.5"></div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}

        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="text-center mt-4 mb-2.5">
              <span className="bg-gray-300 px-3 py-0.5 rounded-full text-xs text-gray-500">{date}</span>
            </div>

            {msgs.map((msg, i) => {
              const isOwn = msg.userId?._id === user.id || msg.userId?.email === user.email;
              const isSystem = msg.messageType === 'system';

              if (isSystem) {
                return (
                  <div key={msg._id || i} className="text-center my-2">
                    <span className="bg-gray-300 px-3 py-1 rounded-full text-xs text-gray-500 italic">{msg.message}</span>
                  </div>
                );
              }

              return (
                <div key={msg._id || i} className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 shadow-sm ${isOwn ? 'rounded-xl rounded-br-sm bg-purple-600 text-white' : 'rounded-xl rounded-bl-sm bg-white text-gray-800'}`}>
                    {!isOwn && (
                      <div className="text-[11px] font-bold text-purple-600 mb-0.5">
                        {msg.userId?.firstName} {msg.userId?.lastName}
                      </div>
                    )}
                    <div className="break-words text-sm">
                      {msg.messageType === 'file' ? renderFileMessage(msg) : renderMessage(msg.message)}
                    </div>
                    <div className="text-[10px] opacity-70 text-right mt-0.5">
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-gray-500 italic bg-gray-100">
          {getTypingNames()}
        </div>
      )}

      <div className="p-3 bg-white border-t border-gray-300 flex gap-2 items-center">
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
          onChange={(e) => { handleFileShare(e.target.files[0]); }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          className="inline-block w-auto m-0 px-2.5 py-2 border border-gray-300 rounded-full bg-gray-100 cursor-pointer text-lg flex-shrink-0"
          title="Share a file"
        >
          {uploadingFile ? '...' : ''}
        </button>
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          style={{ display: 'block', width: 'auto', margin: 0, flex: '1 1 0%' }}
          className="px-3.5 py-2.5 border border-gray-300 rounded-full outline-none text-base text-gray-800 bg-gray-100 min-w-0"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className={`inline-block w-auto m-0 px-[18px] py-2.5 border-none rounded-full text-white text-sm font-bold flex-shrink-0 ${newMessage.trim() ? 'bg-purple-600 cursor-pointer' : 'bg-gray-300 cursor-default'
            }`}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default TeamChat;
