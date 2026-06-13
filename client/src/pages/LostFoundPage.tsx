import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { LostPet, LostPetClue } from '../types';
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

  const [showClueForm, setShowClueForm] = useState(false);
  const [selectedLostPet, setSelectedLostPet] = useState<LostPet | null>(null);
  const [clueForm, setClueForm] = useState({
    sighting_time: '', sighting_location: '', photo: '', description: ''
  });
  const [clueFormError, setClueFormError] = useState('');
  const [clueFormLoading, setClueFormLoading] = useState(false);

  const [showClues, setShowClues] = useState(false);
  const [clues, setClues] = useState<LostPetClue[]>([]);
  const [cluesLoading, setCluesLoading] = useState(false);

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

  const handleCluePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setClueForm(prev => ({ ...prev, photo: base64 }));
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

  const handleOpenClueForm = (lp: LostPet) => {
    setSelectedLostPet(lp);
    setClueForm({ sighting_time: '', sighting_location: '', photo: '', description: '' });
    setClueFormError('');
    setShowClueForm(true);
  };

  const handleSubmitClue = async (e: React.FormEvent) => {
    e.preventDefault();
    setClueFormError('');
    if (!clueForm.sighting_time || !clueForm.sighting_location) {
      setClueFormError('目击时间和地点为必填');
      return;
    }
    if (!selectedLostPet) return;
    setClueFormLoading(true);
    try {
      await api.submitClue(selectedLostPet.id, clueForm);
      setShowClueForm(false);
      setSelectedLostPet(null);
      alert('线索提交成功，感谢您的帮助！');
    } catch (err: any) {
      setClueFormError(err.message);
    } finally {
      setClueFormLoading(false);
    }
  };

  const handleViewClues = async (lp: LostPet) => {
    setSelectedLostPet(lp);
    setShowClues(true);
    setCluesLoading(true);
    try {
      const res = await api.getLostPetClues(lp.id);
      setClues(res.clues);
    } catch (err: any) {
      alert(err.message);
      setShowClues(false);
    } finally {
      setCluesLoading(false);
    }
  };

  const handleContactWitness = async (clue: LostPetClue) => {
    if (!selectedLostPet) return;
    try {
      await api.sendMessage({
        to_user_id: clue.witness_id,
        lost_pet_id: selectedLostPet.id,
        content: `您好，关于我走失的宠物「${selectedLostPet.name || '宠物'}」，想向您了解更多线索细节。`,
      });
      alert('已向目击者发送消息，请在消息页面查看对话。');
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
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {user && lp.user_id === user.id && tab === 'mine' && (
                    <>
                      {!lp.found && (
                        <button className="btn btn-success btn-sm" onClick={() => handleMarkFound(lp.id)}>
                          标记已找回
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => handleViewClues(lp)}>
                        查看线索
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lp.id)}>
                        删除
                      </button>
                    </>
                  )}
                  {user && lp.user_id !== user.id && !lp.found && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleOpenClueForm(lp)}>
                      提供线索
                    </button>
                  )}
                </div>
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

      {/* Submit Clue Modal */}
      {showClueForm && selectedLostPet && (
        <div className="modal-overlay" onClick={() => { setShowClueForm(false); setSelectedLostPet(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>提供线索 - {selectedLostPet.name || '未知'}</h2>
              <button className="modal-close" onClick={() => { setShowClueForm(false); setSelectedLostPet(null); }}>X</button>
            </div>
            <form onSubmit={handleSubmitClue}>
              <div className="form-group">
                <label>目击照片</label>
                <div className={`file-upload ${clueForm.photo ? 'has-image' : ''}`} onClick={() => document.getElementById('clue-photo-input')?.click()}>
                  {clueForm.photo ? (
                    <img src={clueForm.photo} alt="目击照片" />
                  ) : (
                    <p>点击上传照片（可选）</p>
                  )}
                  <input id="clue-photo-input" type="file" accept="image/*" onChange={handleCluePhoto} />
                </div>
              </div>
              <div className="form-group">
                <label>目击时间 *</label>
                <input type="datetime-local" value={clueForm.sighting_time} onChange={e => setClueForm(prev => ({ ...prev, sighting_time: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>目击地点 *</label>
                <input value={clueForm.sighting_location} onChange={e => setClueForm(prev => ({ ...prev, sighting_location: e.target.value }))} placeholder="详细目击地点" required />
              </div>
              <div className="form-group">
                <label>详细描述</label>
                <textarea value={clueForm.description} onChange={e => setClueForm(prev => ({ ...prev, description: e.target.value }))} placeholder="宠物状态、周围情况等" />
              </div>
              {clueFormError && <p className="error-msg">{clueFormError}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={clueFormLoading}>
                {clueFormLoading ? '提交中...' : '提交线索'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* View Clues Modal */}
      {showClues && selectedLostPet && (
        <div className="modal-overlay" onClick={() => { setShowClues(false); setSelectedLostPet(null); setClues([]); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>线索列表 - {selectedLostPet.name || '未知'}</h2>
              <button className="modal-close" onClick={() => { setShowClues(false); setSelectedLostPet(null); setClues([]); }}>X</button>
            </div>
            {cluesLoading ? (
              <div className="loading">加载中...</div>
            ) : clues.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <p>暂无线索</p>
              </div>
            ) : (
              <div style={{ maxHeight: 500, overflowY: 'auto', padding: '0 4px' }}>
                {clues.map(clue => (
                  <div key={clue.id} style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {clue.witness_avatar ? (
                        <img src={clue.witness_avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          {(clue.witness_nickname || '?').charAt(0)}
                        </div>
                      )}
                      <span style={{ fontWeight: 500 }}>{clue.witness_nickname || '匿名用户'}</span>
                      <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>{formatDate(clue.created_at)}</span>
                    </div>
                    {clue.photo && (
                      <img src={clue.photo} alt="线索照片" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }} />
                    )}
                    <p className="meta">目击时间：{clue.sighting_time}</p>
                    <p className="meta">目击地点：{clue.sighting_location}</p>
                    {clue.description && <p className="meta" style={{ color: '#555', marginTop: 4 }}>{clue.description}</p>}
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => handleContactWitness(clue)}
                    >
                      联系目击者
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
