import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Pet, FosteringNeed, FosteringApplication, LostPet, User } from '../types';
import { getStatusTag, formatDate, getAppStatusText } from '../utils';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<'pets' | 'fostering' | 'lost'>('pets');
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [myNeeds, setMyNeeds] = useState<FosteringNeed[]>([]);
  const [myApplications, setMyApplications] = useState<FosteringApplication[]>([]);
  const [myLostPets, setMyLostPets] = useState<LostPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ nickname: '', phone: '', bio: '' });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileForm({ nickname: user.nickname || '', phone: user.phone || '', bio: user.bio || '' });
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [petsRes, needsRes, appsRes, lostRes] = await Promise.all([
        api.getMyPets(),
        api.getMyFosteringNeeds(),
        api.getMyApplications(),
        api.getMyLostPets(),
      ]);
      setMyPets(petsRes.pets);
      setMyNeeds(needsRes.needs);
      setMyApplications(appsRes.applications);
      setMyLostPets(lostRes.lostPets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      await api.updateProfile(profileForm);
      await refreshUser();
      setShowEditProfile(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePet = async (id: number) => {
    if (!confirm('确认删除该宠物档案？')) return;
    try {
      await api.deletePet(id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="profile-header">
        <div className="profile-avatar">
          {user.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (user.nickname || user.username).charAt(0)}
        </div>
        <div className="profile-info" style={{ flex: 1 }}>
          <h2>{user.nickname || user.username}</h2>
          {user.bio && <p>{user.bio}</p>}
          {user.phone && <p style={{ fontSize: 13, color: '#aaa' }}>电话：{user.phone}</p>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowEditProfile(true)}>
          编辑资料
        </button>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'pets' ? 'active' : ''}`} onClick={() => setTab('pets')}>
          我的宠物 ({myPets.length})
        </button>
        <button className={`tab-btn ${tab === 'fostering' ? 'active' : ''}`} onClick={() => setTab('fostering')}>
          我的寄养
        </button>
        <button className={`tab-btn ${tab === 'lost' ? 'active' : ''}`} onClick={() => setTab('lost')}>
          寻宠记录 ({myLostPets.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : tab === 'pets' ? (
        myPets.length === 0 ? (
          <div className="empty-state"><p>还没有添加宠物，去宠物广场添加吧</p></div>
        ) : (
          <div className="card-grid">
            {myPets.map(pet => (
              <div key={pet.id} className="pet-card">
                {pet.photo ? (
                  <img src={pet.photo} alt={pet.name} className="pet-card-img" />
                ) : (
                  <div className="pet-card-img">{pet.name}</div>
                )}
                <div className="pet-card-body">
                  <h3>{pet.name}</h3>
                  <p className="meta">{pet.breed} {pet.age && `/ ${pet.age}`}</p>
                  {pet.vaccine && <p className="meta">疫苗: {pet.vaccine}</p>}
                  {pet.notes && <p className="meta">{pet.notes}</p>}
                  <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => handleDeletePet(pet.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'fostering' ? (
        <div>
          {myNeeds.length > 0 && (
            <>
              <h3 style={{ marginBottom: 12, color: '#555' }}>我发布的寄养需求</h3>
              {myNeeds.map(need => {
                const statusTag = getStatusTag(need.status);
                return (
                  <div key={need.id} className="foster-card">
                    <div className="foster-card-header">
                      <h3>{need.pet_name} ({need.pet_breed})</h3>
                      <span className={`tag ${statusTag.className}`}>{statusTag.text}</span>
                    </div>
                    <div className="foster-card-meta">
                      <span>{need.start_date} 至 {need.end_date}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {myApplications.length > 0 && (
            <>
              <h3 style={{ marginBottom: 12, marginTop: 20, color: '#555' }}>我的申请</h3>
              {myApplications.map(app => (
                <div key={app.id} className="foster-card">
                  <div className="foster-card-header">
                    <h3>{app.pet_name} - {app.pet_breed}</h3>
                    <span className="tag" style={{ background: app.status === 'accepted' ? '#e8f5e9' : '#fff8e1', color: app.status === 'accepted' ? '#2e7d32' : '#f57f17' }}>
                      {getAppStatusText(app.status)}
                    </span>
                  </div>
                  <div className="foster-card-meta">
                    <span>寄养时间：{app.start_date} 至 {app.end_date}</span>
                  </div>
                </div>
              ))}
            </>
          )}
          {myNeeds.length === 0 && myApplications.length === 0 && (
            <div className="empty-state"><p>暂无寄养记录</p></div>
          )}
        </div>
      ) : (
        myLostPets.length === 0 ? (
          <div className="empty-state"><p>暂无寻宠记录</p></div>
        ) : (
          <div className="card-grid">
            {myLostPets.map(lp => (
              <div key={lp.id} className="pet-card" style={{ opacity: lp.found ? 0.6 : 1 }}>
                {lp.photo ? (
                  <img src={lp.photo} alt={lp.name} className="pet-card-img" />
                ) : (
                  <div className="pet-card-img">{lp.name || '宠物照片'}</div>
                )}
                <div className="pet-card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>{lp.name || '未知'}</h3>
                    {lp.found ? <span className="tag tag-completed">已找回</span> : <span className="tag tag-open">寻找中</span>}
                  </div>
                  <p className="meta">走失地点：{lp.lost_location}</p>
                  <p className="meta">走失时间：{lp.lost_date}</p>
                  <p className="meta" style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{formatDate(lp.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal-overlay" onClick={() => setShowEditProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑个人资料</h2>
              <button className="modal-close" onClick={() => setShowEditProfile(false)}>X</button>
            </div>
            <form onSubmit={handleEditProfile}>
              <div className="form-group">
                <label>昵称</label>
                <input value={profileForm.nickname} onChange={e => setProfileForm(prev => ({ ...prev, nickname: e.target.value }))} placeholder="你的昵称" />
              </div>
              <div className="form-group">
                <label>电话</label>
                <input value={profileForm.phone} onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="联系电话" />
              </div>
              <div className="form-group">
                <label>个人简介</label>
                <textarea value={profileForm.bio} onChange={e => setProfileForm(prev => ({ ...prev, bio: e.target.value }))} placeholder="介绍一下自己" />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={editLoading}>
                {editLoading ? '保存中...' : '保存'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
