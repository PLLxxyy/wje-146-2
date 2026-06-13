import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <header className="header">
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1>社区宠物互助平台</h1>
      </Link>
      <nav className="header-nav">
        <Link to="/" className={isActive('/')}>宠物广场</Link>
        <Link to="/fostering" className={isActive('/fostering')}>寄养互助</Link>
        <Link to="/lost-found" className={isActive('/lost-found')}>寻宠启事</Link>
        {user ? (
          <>
            <Link to="/chat" className={isActive('/chat')}>聊天</Link>
            <Link to="/profile" className={isActive('/profile')}>个人中心</Link>
            <button onClick={logout}>退出</button>
          </>
        ) : (
          <Link to="/auth" className={isActive('/auth')}>登录</Link>
        )}
      </nav>
    </header>
  );
}
