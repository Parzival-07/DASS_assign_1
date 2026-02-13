import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = 'http://localhost:5000/api';

function TeamChat({ token, teamId, user, teamMembers, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeen, setLastSeen] = useState(null);

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const heartbeatRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async (since) => {
    try {
      const url = since
        ? `${API_URL}/chat/messages/${teamId}?since=${encodeURIComponent(since)}`
        : `${API_URL}/chat/messages/${teamId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.messages) {
        if (since) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m._id));
            const newMsgs = data.messages.filter(m => !existingIds.has(m._id));
            if (newMsgs.length > 0) {
              setUnreadCount(c => c + newMsgs.filter(m => m.userId?._id !== user.id).length);
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        } else {
          setMessages(data.messages);
        }
      }
      if (data.online) setOnlineStatus(data.online);
      if (data.typing) setTypingUsers(data.typing);
      if (data.teamName) setTeamName(data.teamName);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [teamId, token, user.id]);

  useEffect(() => {
    loadMessages();
  }, [teamId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (messages.length > 0) {
        const latest = messages[messages.length - 1].createdAt;
        loadMessages(latest);
      } else {
        loadMessages();
      }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [messages, loadMessages]);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_URL}/chat/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ teamId })
        });
      } catch (e) { /* ignore */ }
    };
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(heartbeatRef.current);
  }, [teamId, token]);

  const sendTyping = async () => {
    try {
      await fetch(`${API_URL}/chat/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ teamId })
      });
    } catch (e) { }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping();
    typingTimeoutRef.current = setTimeout(() => {}, 3000);
  };

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
        setMessages(prev => [...prev, data.chatMessage]);
        setNewMessage('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Error sending message');
    }
    setSending(false);
  };

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
        setMessages(prev => [...prev, data.chatMessage]);
      }
    } catch (err) {
      console.error('Error sharing file');
    }
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

      {/* Message Input */}
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
          className={`inline-block w-auto m-0 px-[18px] py-2.5 border-none rounded-full text-white text-sm font-bold flex-shrink-0 ${
            newMessage.trim() ? 'bg-purple-600 cursor-pointer' : 'bg-gray-300 cursor-default'
          }`}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default TeamChat;
