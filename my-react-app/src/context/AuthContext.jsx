import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginApi, getMe } from '../api/auth.api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('techavo_token');
    const storedUser = localStorage.getItem('techavo_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('techavo_token');
        localStorage.removeItem('techavo_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await loginApi({ email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('techavo_token', token);
    localStorage.setItem('techavo_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('techavo_token');
    localStorage.removeItem('techavo_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
