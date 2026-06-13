import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { FosteringNeed, FosteringApplication, Pet } from '../types';
import { getStatusTag, getAppStatusText, formatDate } from '../utils';

export default function FosteringPage() {
  const { user } = useAuth();
  const [needs, setNeeds] = useState<FosteringNeed[]>([]);
  const [myNeeds, setMyNeeds] = useState<FosteringNeed[]>([]);
  const [myApplications, setMyApplications] = useState<FosteringApplication[]>([]);
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [tab, setTab] = useState<'browse' | 'mine' | 'applied'>('browse');
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [showApply, setShowApply] = useState<FosteringNeed | null>(null);
  const [showApplications, setShowApplications] = useState<number | null>(null);
  const [applications, setApplications] = useState<FosteringApplication[]>([]);
  const [showReview, setShowReview] = useState<FosteringNeed | null>(null);

  const [publishForm, setPublishForm] = useState({ pet_id: '', start_date: '', end_date: '', requirements: '' });
  const [applyForm, setApplyForm] = useState({ experience: '', environment: '' });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', reviewee_id: 0 });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, myRes, appRes] = await Promise.all([
        api.getPublicFosteringNeeds(),
        user ? api.getMyFosteringNeeds() : Promise.resolve({ needs: [] }),
        user ? api.getMyApplications() : Promise.resolve({ applications: [] }),
      ]);
      setNeeds(allRes.needs);
      setMyNeeds(myRes.needs);
      setMyApplications(appRes.applications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchMyPets = async () => {
    try {
      const res = await api.getMyPets();
      setMyPets(res.pets);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!publishForm.pet_id || !publishForm.start_date || !publishForm.end_date) {
      setFormError('请选择宠物并填写寄养时间');
      return;
    }
    setFormLoading(true);
    try {
      await api.createFosteringNeed(publishForm);
      setShowPublish(false);
      setPublishForm({ pet_id: '', start_date: '', end_date: '', requirements: '' });
      fetchAll();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showApply) return;
    setFormError('');
    setFormLoading(true);
    try {
      await api.applyFostering(showApply.id, applyForm);
      setShowApply(null);
      setApplyForm({ experience: '', environment: '' });
      alert('申请已提交');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewApplications = async (needId: number) => {
    setShowApplications(needId);
    try {
      const res = await api.getApplications(needId);
      setApplications(res.applications);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAccept = async (appId: number) => {
    try {
      await api.acceptApplication(appId);
      alert('已确认寄养人，可前往聊天沟通细节');
      setShowApplications(null);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleComplete = async (needId: number) => {
    try {
      await api.completeFostering(needId);
      alert('已标记为完成，可以给寄养人写评价了');
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReview) return;
    setFormLoading(true);
    try {
      await api.submitReview(showReview.id, reviewForm);
      setShowReview(null);
      setReviewForm({ rating: 5, comment: '', reviewee_id: 0 });
      alert('评价已提交');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const openPublish = () => {
    fetchMyPets();
    setShowPublish(true);
  };

  return (
    <div>
      <div className="section-header">
        <h2>寄养互助</h2>
        {user && (
          <button className="btn btn-primary btn-sm" onClick={openPublish}>+ 发布寄养需求</button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>全部需求</button>
        {user && <button className={`tab-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>我的发布</button>}
        {user && <button className={`tab-btn ${tab === 'applied' ? 'active' : ''}`} onClick={() => setTab('applied')}>我的申请</button>}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : tab === 'browse' ? (
        needs.length === 0 ? (
          <div className="empty-state"><p>暂无寄养需求</p></div>
        ) : (
          needs.map(need => {
            const statusTag = getStatusTag(need.status);
            return (
              <div key={need.id} className="foster-card">
                <div className="foster-card-header">
                  <h3>{need.pet_name} ({need.pet_breed})</h3>
                  <span className={`tag ${statusTag.className}`}>{statusTag.text}</span>
                </div>
                <div className="foster-card-meta">
                  <span>寄养时间：{need.start_date} 至 {need.end_date}</span>
                  <span>发布者：{need.user_nickname}</span>
                </div>
                {need.requirements && <div className="foster-card-req">{need.requirements}</div>}
                <div className="foster-card-actions">
                  {user && need.status === 'open' && need.user_id !== user.id && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowApply(need); setFormError(''); }}>
                      申请寄养
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )
      ) : tab === 'mine' ? (
        myNeeds.length === 0 ? (
          <div className="empty-state"><p>暂无发布，点击上方按钮发布寄养需求</p></div>
        ) : (
          myNeeds.map(need => {
            const statusTag = getStatusTag(need.status);
            return (
              <div key={need.id} className="foster-card">
                <div className="foster-card-header">
                  <h3>{need.pet_name} ({need.pet_breed})</h3>
                  <span className={`tag ${statusTag.className}`}>{statusTag.text}</span>
                </div>
                <div className="foster-card-meta">
                  <span>寄养时间：{need.start_date} 至 {need.end_date}</span>
                  <span>发布于：{formatDate(need.created_at)}</span>
                </div>
                {need.requirements && <div className="foster-card-req">{need.requirements}</div>}
                <div className="foster-card-actions">
                  {need.status === 'open' && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleViewApplications(need.id)}>
                      查看申请
                    </button>
                  )}
                  {need.status === 'matched' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => handleComplete(need.id)}>
                        标记完成
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleViewApplications(need.id)}>
                        查看详情
                      </button>
                    </>
                  )}
                  {need.status === 'completed' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      setShowReview(need);
                      const acceptedApp = applications.find(a => a.fostering_need_id === need.id && a.status === 'accepted');
                      setReviewForm(prev => ({ ...prev, reviewee_id: acceptedApp?.applicant_id || 0 }));
                    }}>
                      写评价
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )
      ) : (
        myApplications.length === 0 ? (
          <div className="empty-state"><p>暂无申请</p></div>
        ) : (
          myApplications.map(app => (
            <div key={app.id} className="foster-card">
              <div className="foster-card-header">
                <h3>{app.pet_name} - {app.pet_breed}</h3>
                <span className="tag" style={{ background: app.status === 'accepted' ? '#e8f5e9' : app.status === 'rejected' ? '#ffebee' : '#fff8e1', color: app.status === 'accepted' ? '#2e7d32' : app.status === 'rejected' ? '#c62828' : '#f57f17' }}>
                  {getAppStatusText(app.status)}
                </span>
              </div>
              <div className="foster-card-meta">
                <span>寄养时间：{app.start_date} 至 {app.end_date}</span>
                <span>发布者：{app.owner_nickname}</span>
              </div>
              {app.experience && <p className="meta">我的经验：{app.experience}</p>}
              {app.environment && <p className="meta">家庭环境：{app.environment}</p>}
            </div>
          ))
        )
      )}

      {/* Publish Modal */}
      {showPublish && (
        <div className="modal-overlay" onClick={() => setShowPublish(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>发布寄养需求</h2>
              <button className="modal-close" onClick={() => setShowPublish(false)}>X</button>
            </div>
            <form onSubmit={handlePublish}>
              <div className="form-group">
                <label>选择宠物 *</label>
                <select value={publishForm.pet_id} onChange={e => setPublishForm(prev => ({ ...prev, pet_id: e.target.value }))}>
                  <option value="">请选择宠物</option>
                  {myPets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.breed})</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>开始日期 *</label>
                  <input type="date" value={publishForm.start_date} onChange={e => setPublishForm(prev => ({ ...prev, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>结束日期 *</label>
                  <input type="date" value={publishForm.end_date} onChange={e => setPublishForm(prev => ({ ...prev, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>特殊要求</label>
                <textarea value={publishForm.requirements} onChange={e => setPublishForm(prev => ({ ...prev, requirements: e.target.value }))} placeholder="喂食要求、注意事项等" />
              </div>
              {formError && <p className="error-msg">{formError}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={formLoading}>
                {formLoading ? '提交中...' : '发布'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApply && (
        <div className="modal-overlay" onClick={() => setShowApply(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>申请寄养 - {showApply.pet_name}</h2>
              <button className="modal-close" onClick={() => setShowApply(null)}>X</button>
            </div>
            <form onSubmit={handleApply}>
              <div className="form-group">
                <label>养宠经验</label>
                <textarea value={applyForm.experience} onChange={e => setApplyForm(prev => ({ ...prev, experience: e.target.value }))} placeholder="描述您的养宠经历..." />
              </div>
              <div className="form-group">
                <label>家庭环境</label>
                <textarea value={applyForm.environment} onChange={e => setApplyForm(prev => ({ ...prev, environment: e.target.value }))} placeholder="描述您的家庭环境、是否有其他宠物等..." />
              </div>
              {formError && <p className="error-msg">{formError}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={formLoading}>
                {formLoading ? '提交中...' : '提交申请'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Applications List Modal */}
      {showApplications !== null && (
        <div className="modal-overlay" onClick={() => setShowApplications(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>申请列表</h2>
              <button className="modal-close" onClick={() => setShowApplications(null)}>X</button>
            </div>
            {applications.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa' }}>暂无申请</p>
            ) : (
              <div className="app-list">
                {applications.map(app => (
                  <div key={app.id} className="app-item">
                    <div className="app-item-header">
                      <h4>{app.applicant_nickname}</h4>
                      <span style={{ fontSize: 13, color: app.status === 'accepted' ? '#2e7d32' : '#888' }}>
                        {getAppStatusText(app.status)}
                      </span>
                    </div>
                    {app.experience && <p>养宠经验：{app.experience}</p>}
                    {app.environment && <p>家庭环境：{app.environment}</p>}
                    {app.status === 'pending' && (
                      <button className="btn btn-success btn-sm" style={{ marginTop: 8 }} onClick={() => handleAccept(app.id)}>
                        选择TA
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReview && (
        <div className="modal-overlay" onClick={() => setShowReview(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>给寄养人写评价</h2>
              <button className="modal-close" onClick={() => setShowReview(null)}>X</button>
            </div>
            <form onSubmit={handleReview}>
              <div className="form-group">
                <label>评分</label>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span
                      key={n}
                      className={`star ${n <= reviewForm.rating ? 'filled' : ''}`}
                      onClick={() => setReviewForm(prev => ({ ...prev, rating: n }))}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>评价内容</label>
                <textarea value={reviewForm.comment} onChange={e => setReviewForm(prev => ({ ...prev, comment: e.target.value }))} placeholder="写下您的评价..." />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={formLoading}>
                {formLoading ? '提交中...' : '提交评价'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
