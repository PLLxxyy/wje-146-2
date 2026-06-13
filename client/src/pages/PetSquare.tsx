import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Pet, LostPet } from '../types';
import { fileToBase64, getSpeciesTag } from '../utils';

export default function PetSquare() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [lostPets, setLostPets] = useState<LostPet[]>([]);
  const [species, setSpecies] = useState('全部');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddPet, setShowAddPet] = useState(false);
  const [newPet, setNewPet] = useState({ name: '', breed: '', species: '猫', age: '', photo: '', vaccine: '', notes: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchPets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPets({ species: species === '全部' ? undefined : species, search: search || undefined });
      setPets(res.pets);
    } catch (err) {
      console.error('Failed to fetch pets:', err);
    } finally {
      setLoading(false);
    }
  }, [species, search]);

  const fetchLostPets = useCallback(async () => {
    try {
      const res = await api.getActiveLostPets();
      setLostPets(res.lostPets);
    } catch (err) {
      console.error('Failed to fetch lost pets:', err);
    }
  }, []);

  useEffect(() => {
    fetchPets();
    fetchLostPets();
  }, [fetchPets, fetchLostPets]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setNewPet(prev => ({ ...prev, photo: base64 }));
    }
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newPet.name || !newPet.breed) {
      setAddError('请填写宠物名字和品种');
      return;
    }
    setAddLoading(true);
    try {
      await api.createPet(newPet);
      setShowAddPet(false);
      setNewPet({ name: '', breed: '', species: '猫', age: '', photo: '', vaccine: '', notes: '' });
      fetchPets();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPets();
  };

  const speciesList = ['全部', '猫', '狗', '异宠'];

  return (
    <div>
      {/* Lost pet carousel */}
      {lostPets.length > 0 && (
        <div className="lost-pet-banner">
          <h3>寻宠启事</h3>
          <div className="lost-pet-carousel">
            {lostPets.map(lp => (
              <div key={lp.id} className="lost-pet-card">
                <h4>{lp.name || '未知名字'} ({lp.breed || lp.species})</h4>
                <p>走失地点：{lp.lost_location}</p>
                <p>走失时间：{lp.lost_date}</p>
                <p>联系方式：{lp.contact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-header">
        <h2>宠物广场</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              className="search-input"
              placeholder="搜索品种名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">搜索</button>
          </form>
          {user && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddPet(true)}>
              + 添加宠物
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {speciesList.map(s => (
          <button
            key={s}
            className={`filter-btn ${species === s ? 'active' : ''}`}
            onClick={() => setSpecies(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : pets.length === 0 ? (
        <div className="empty-state">
          <div className="icon">Paw</div>
          <p>暂无宠物，快来添加第一只吧</p>
        </div>
      ) : (
        <div className="card-grid">
          {pets.map(pet => {
            const tag = getSpeciesTag(pet.species);
            return (
              <div key={pet.id} className="pet-card">
                {pet.photo ? (
                  <img src={pet.photo} alt={pet.name} className="pet-card-img" />
                ) : (
                  <div className="pet-card-img">{pet.name}</div>
                )}
                <div className="pet-card-body">
                  <h3>{pet.name}</h3>
                  <p className="meta">{pet.breed} {pet.age && `/ ${pet.age}`}</p>
                  <span className={`tag ${tag.className}`}>{tag.text}</span>
                  {pet.vaccine && <p className="meta" style={{ marginTop: 6 }}>疫苗: {pet.vaccine}</p>}
                  {pet.owner_name && <p className="meta">主人: {pet.owner_name}</p>}
                  {pet.notes && <p className="meta" style={{ color: '#666', marginTop: 4 }}>备注: {pet.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Pet Modal */}
      {showAddPet && (
        <div className="modal-overlay" onClick={() => setShowAddPet(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>添加宠物档案</h2>
              <button className="modal-close" onClick={() => setShowAddPet(false)}>X</button>
            </div>
            <form onSubmit={handleAddPet}>
              <div className="form-group">
                <label>宠物照片</label>
                <div className={`file-upload ${newPet.photo ? 'has-image' : ''}`} onClick={() => document.getElementById('pet-photo-input')?.click()}>
                  {newPet.photo ? (
                    <img src={newPet.photo} alt="宠物照片" />
                  ) : (
                    <p>点击上传照片</p>
                  )}
                  <input id="pet-photo-input" type="file" accept="image/*" onChange={handlePhoto} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>名字 *</label>
                  <input value={newPet.name} onChange={e => setNewPet(prev => ({ ...prev, name: e.target.value }))} placeholder="宠物名字" />
                </div>
                <div className="form-group">
                  <label>品种 *</label>
                  <input value={newPet.breed} onChange={e => setNewPet(prev => ({ ...prev, breed: e.target.value }))} placeholder="品种" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>类型</label>
                  <select value={newPet.species} onChange={e => setNewPet(prev => ({ ...prev, species: e.target.value }))}>
                    <option value="猫">猫</option>
                    <option value="狗">狗</option>
                    <option value="异宠">异宠</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>年龄</label>
                  <input value={newPet.age} onChange={e => setNewPet(prev => ({ ...prev, age: e.target.value }))} placeholder="如：2岁" />
                </div>
              </div>
              <div className="form-group">
                <label>疫苗情况</label>
                <input value={newPet.vaccine} onChange={e => setNewPet(prev => ({ ...prev, vaccine: e.target.value }))} placeholder="已完成的疫苗接种情况" />
              </div>
              <div className="form-group">
                <label>注意事项</label>
                <textarea value={newPet.notes} onChange={e => setNewPet(prev => ({ ...prev, notes: e.target.value }))} placeholder="性格特点、饮食禁忌等" />
              </div>
              {addError && <p className="error-msg">{addError}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={addLoading}>
                {addLoading ? '提交中...' : '添加宠物'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
