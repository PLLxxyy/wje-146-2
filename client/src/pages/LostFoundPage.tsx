import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { LostPet } from '../types';
import { fileToBase64, formatDate } from '../utils';

export default function LostFoundPage() {
  const { user } = useAuth();
  const [lostPets, setLostPets] = useState<LostPet[]>([]);
  const [myLostPets, setMyLostPets] = useState<LostPet[]>([]);
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [form, setForm] = useState({
    photo: '', species: '猫', breed: '', name: '',
    lost_location: '', lost_date: '', contact: '', description: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, myRes] = await Promise.all([
        api.getLostPets(),
        user ? api.getMyLostPets() : Promise.resolve({ lostPets: [] }),
      ]);
      setLostPets(allRes.lostPets);
      setMyLostPets(myRes.lostPets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setForm(prev => ({ ...prev, photo: base64 }));
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.lost_location || !form.lost_date || !form.contact) {
      setFormError('走失地点、时间和联系方式为必填');
      return;
    }
    setFormLoading(true);
    try {
      await api.createLostPet(form);
      setShowPublish(false);
      setForm({ photo: '', species: '猫', breed: '', name: '', lost_location: '', lost_date: '', contact: '', description: '' });
      fetchAll();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleMarkFound = async (id: number) => {
    if (!confirm('确认已找回？')) return;
    try {
      await api.markFound(id);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除？')) return;
    try {
      await api.deleteLostPet(id);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const list = tab === 'all' ? lostPets : myLostPets;

  return (
    <div>
      <div className="section-header">
        <h2>寻宠启事</h2>
        {user && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowPublish(true)}>
            + 发布寻宠启事
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>全部启事</button>
        {user && <button className={`tab-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>我的记录</button>}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <p>{tab === 'all' ? '暂无寻宠启事' : '暂无记录'}</p>
        </div>
      ) : (
        <div className="card-grid">
          {list.map(lp => (
            <div key={lp.id} className="pet-card" style={{ opacity: lp.found ? 0.6 : 1 }}>
              {lp.photo ? (
                <img src={lp.photo} alt={lp.name} className="pet-card-img" />
              ) : (
                <div className="pet-card-img">{lp.name || '宠物照片'}</div>
              )}
              <div className="pet-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <h3>{lp.name || '未知'} ({lp.breed || lp.species})</h3>
                  {lp.found ? (
                    <span className="tag tag-completed">已找回</span>
                  ) : (
                    <span className="tag tag-open">寻找中</span>
                  )}
                </div>
                <p className="meta">走失地点：{lp.lost_location}</p>
                <p className="meta">走失时间：{lp.lost_date}</p>
                <p className="meta">联系方式：{lp.contact}</p>
                {lp.description && <p className="meta" style={{ marginTop: 4, color: '#555' }}>{lp.description}</p>}
                {lp.user_nickname && <p className="meta">发布者：{lp.user_nickname}</p>}
                <p className="meta" style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{formatDate(lp.created_at)}</p>
                {user && lp.user_id === user.id && tab === 'mine' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {!lp.found && (
                      <button className="btn btn-success btn-sm" onClick={() => handleMarkFound(lp.id)}>
                        标记已找回
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lp.id)}>
                      删除
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish Modal */}
      {showPublish && (
        <div className="modal-overlay" onClick={() => setShowPublish(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>发布寻宠启事</h2>
              <button className="modal-close" onClick={() => setShowPublish(false)}>X</button>
            </div>
            <form onSubmit={handlePublish}>
              <div className="form-group">
                <label>宠物照片</label>
                <div className={`file-upload ${form.photo ? 'has-image' : ''}`} onClick={() => document.getElementById('lost-photo-input')?.click()}>
                  {form.photo ? (
                    <img src={form.photo} alt="宠物照片" />
                  ) : (
                    <p>点击上传照片</p>
                  )}
                  <input id="lost-photo-input" type="file" accept="image/*" onChange={handlePhoto} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>宠物名称</label>
                  <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="宠物名字" />
                </div>
                <div className="form-group">
                  <label>品种</label>
                  <input value={form.breed} onChange={e => setForm(prev => ({ ...prev, breed: e.target.value }))} placeholder="品种" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>类型</label>
                  <select value={form.species} onChange={e => setForm(prev => ({ ...prev, species: e.target.value }))}>
                    <option value="猫">猫</option>
                    <option value="狗">狗</option>
                    <option value="异宠">异宠</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>走失日期 *</label>
                  <input type="date" value={form.lost_date} onChange={e => setForm(prev => ({ ...prev, lost_date: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label>走失地点 *</label>
                <input value={form.lost_location} onChange={e => setForm(prev => ({ ...prev, lost_location: e.target.value }))} placeholder="详细走失地点" required />
              </div>
              <div className="form-group">
                <label>联系方式 *</label>
                <input value={form.contact} onChange={e => setForm(prev => ({ ...prev, contact: e.target.value }))} placeholder="手机号/微信号" required />
              </div>
              <div className="form-group">
                <label>详细描述</label>
                <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="宠物特征、走失情况等" />
              </div>
              {formError && <p className="error-msg">{formError}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={formLoading}>
                {formLoading ? '提交中...' : '发布启事'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
