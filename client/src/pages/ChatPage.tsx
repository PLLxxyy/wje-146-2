import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Message, Conversation } from '../types';
import { formatDate } from '../utils';

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conv: Conversation) => {
    setActiveConv(conv);
    try {
      const res = await api.getMessages(conv.fostering_need_id);
      setMessages(res.messages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv || !user) return;

    setSending(true);
    try {
      const res = await api.sendMessage({
        to_user_id: activeConv.other_user_id,
        fostering_need_id: activeConv.fostering_need_id,
        content: newMessage.trim(),
      });
      setMessages(prev => [...prev, res.message]);
      setNewMessage('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="chat-page">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">消息列表</div>
        {conversations.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            暂无消息，确认寄养后可聊天
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={`${conv.fostering_need_id}-${conv.other_user_id}`}
              className={`chat-item ${activeConv?.fostering_need_id === conv.fostering_need_id && activeConv?.other_user_id === conv.other_user_id ? 'active' : ''}`}
              onClick={() => fetchMessages(conv)}
            >
              <div className="chat-item-header">
                <h4>
                  {conv.other_nickname}
                  {conv.unread_count > 0 && <span className="unread-badge">{conv.unread_count}</span>}
                </h4>
                <span className="time">{conv.last_time ? formatDate(conv.last_time) : ''}</span>
              </div>
              <p className="chat-item-preview">
                {conv.pet_name && `[${conv.pet_name}] `}{conv.last_message || '暂无消息'}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="chat-main">
        {activeConv ? (
          <>
            <div className="chat-header">
              {activeConv.other_nickname} - {activeConv.pet_name} 寄养沟通
            </div>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: 20 }}>
                  开始沟通寄养细节吧
                </div>
              )}
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.from_user_id === user?.id ? 'sent' : 'received'}`}
                >
                  <div>{msg.content}</div>
                  <div className="msg-time">{formatDate(msg.created_at)}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-area" onSubmit={handleSend}>
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="输入消息..."
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !newMessage.trim()}>
                发送
              </button>
            </form>
          </>
        ) : (
          <div className="chat-empty">
            选择一个对话开始聊天
          </div>
        )}
      </div>
    </div>
  );
}
