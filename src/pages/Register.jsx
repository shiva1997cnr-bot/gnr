import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import CryptoJS from 'crypto-js';
import '../styles/login.css'; // Reuse login styles

const Register = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isStrongPassword = (pwd) => {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return strongRegex.test(pwd);
  };

  const hashPassword = (pwd) => CryptoJS.SHA256(pwd).toString();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username || !firstName || !lastName || !password) {
        setError('Please fill in all fields.');
        setLoading(false);
        return;
      }

      if (!isStrongPassword(password)) {
        setError('Password must be at least 8 characters, include uppercase, lowercase, number, and special symbol.');
        setLoading(false);
        return;
      }

      // ✅ Append @gmail.com if not already there
      const emailUsername = username.includes('@') ? username : `${username}@gmail.com`;

      const userRef = doc(db, 'users', emailUsername);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setError('Username already taken.');
        setLoading(false);
        return;
      }

      const passwordHash = hashPassword(password);

      await setDoc(userRef, {
        firstName,
        lastName,
        passwordHash
      });

      // ✅ Save in localStorage
      localStorage.setItem('currentUser', JSON.stringify({ username: formattedUsername, firstName, lastName }));
      setUser({ username: formattedUsername, firstName, lastName });

      navigate('/region');

    } catch (err) {
      console.error('Registration error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="org-name">Generalist</div>
      <div className="welcome-note">Welcome Aboard</div>
      <div className="sub-note">Let’s help you get started</div>

      <div className="login-box" style={{ height: 'auto', minHeight: '40vh' }}>
        <div className="login-form">
          <h2 className="logo">Register</h2>
          <p className="subtitle">Create your account</p>

          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              required
              className="login-form input"
            />
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
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>

          <button onClick={() => navigate('/')} className="toggle-button">
            Already have an account? Login here
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
