import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AuthContext } from '../App';
import '../styles/login.css';
import CryptoJS from 'crypto-js';
import { db } from '../firebase';

const Login = () => {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isStrongPassword = (pwd) => {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return strongRegex.test(pwd);
  };

  const hashPassword = (pwd) => CryptoJS.SHA256(pwd).toString();

  const formatUsername = (input) => {
    const base = input.trim().toLowerCase();
    return base.endsWith('@gmail.com') ? base : `${base}@gmail.com`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formattedUsername = formatUsername(username);

    try {
      const userRef = doc(db, 'users', formattedUsername);
      const userSnap = await getDoc(userRef);

      if (mode === 'login') {
        if (!userSnap.exists()) {
          setError("User not found.");
          setLoading(false);
          return;
        }

        const userData = userSnap.data();
        const hashed = hashPassword(password);

        if (userData.passwordHash !== hashed) {
          setError("Incorrect password.");
          setLoading(false);
          return;
        }

        const currentUser = {
          username: formattedUsername,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role || 'user'
        };

        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        setUser(currentUser);
        navigate('/region');

      } else {
        if (!firstName || !lastName) {
          setError("Please fill in all fields.");
          setLoading(false);
          return;
        }

        if (userSnap.exists()) {
          setError("Username already taken.");
          setLoading(false);
          return;
        }

        if (!isStrongPassword(password)) {
          setError("Password must be at least 8 characters, include uppercase, lowercase, number, and special symbol.");
          setLoading(false);
          return;
        }

        const hashed = hashPassword(password);
        const role = formattedUsername === "admin@gmail.com" ? "admin" : "user";

        const userData = {
          firstName,
          lastName,
          passwordHash: hashed,
          role: role
        };

        await setDoc(userRef, userData);

        const currentUser = {
          username: formattedUsername,
          firstName,
          lastName,
          role
        };

        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        setUser(currentUser);
        navigate('/region');
      }
    } catch (err) {
      console.error("Firestore error:", err);
      setError(`${err.code || 'unknown'}: ${err.message || 'Something went wrong'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="org-name">Generalist</div>
      <div className="welcome-note">Glad you're here</div>
      <div className="sub-note">We're excited to help you learn and grow.</div>

      <div className="login-box" style={{ height: 'auto', minHeight: '40vh' }}>
        <div className="login-form">
          <h2 className="logo">
            {mode === 'login' ? '👤 Login' : 'Register'}
          </h2>
          <p className="subtitle">
            {mode === 'login' ? 'Access your account' : 'Create a new account'}
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="login-form input"
            />

            {mode === 'register' && (
              <>
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="login-form input"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="login-form input"
                />
              </>
            )}

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-form input"
            />

            {error && <p className="message">{error}</p>}

            <button type="submit" className="login-form button" disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Logging In...' : 'Registering...')
                : (mode === 'login' ? 'Login' : 'Register')}
            </button>
          </form>

          <p
            className="toggle-text"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login'
              ? "Don't have an account? Register"
              : "Already have an account? Login"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
