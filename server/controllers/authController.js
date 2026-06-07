import { createUser, findUserByUsername } from '../lib/db.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { pubClient } from '../lib/redis.js';
import crypto from 'crypto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 3600 * 1000 // 7 days
};

function getRefreshToken(req) {
  if (req.cookies && req.cookies.refreshToken) {
    return req.cookies.refreshToken;
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/refreshToken=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export async function register(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existingUser = await findUserByUsername(normalizedUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(normalizedUsername, passwordHash);

    const accessToken = signAccessToken({ id: user.id, username: user.username });
    const refreshToken = signRefreshToken({ id: user.id, username: user.username });

    // Store refresh token in Redis
    await pubClient.set(`refresh_token:${refreshToken}`, user.id, 'EX', 7 * 24 * 3600);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return res.json({ user: { id: user.id, username: user.username }, token: accessToken });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const user = await findUserByUsername(normalizedUsername);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const accessToken = signAccessToken({ id: user.id, username: user.username });
    const refreshToken = signRefreshToken({ id: user.id, username: user.username });

    // Store refresh token in Redis
    await pubClient.set(`refresh_token:${refreshToken}`, user.id, 'EX', 7 * 24 * 3600);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return res.json({ user: { id: user.id, username: user.username }, token: accessToken });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

export async function refresh(req, res) {
  try {
    const oldRefreshToken = getRefreshToken(req);
    if (!oldRefreshToken) {
      return res.status(401).json({ error: 'Refresh token missing.' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(oldRefreshToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    // Check Redis presence (revocation check)
    const exists = await pubClient.get(`refresh_token:${oldRefreshToken}`);
    if (!exists) {
      return res.status(401).json({ error: 'Refresh token revoked or invalid.' });
    }

    // Rotate tokens
    await pubClient.del(`refresh_token:${oldRefreshToken}`);

    const newAccessToken = signAccessToken({ id: decoded.id, username: decoded.username });
    const newRefreshToken = signRefreshToken({ id: decoded.id, username: decoded.username });

    await pubClient.set(`refresh_token:${newRefreshToken}`, decoded.id, 'EX', 7 * 24 * 3600);

    res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
    return res.json({ token: newAccessToken });
  } catch (err) {
    console.error('Token refresh error:', err);
    return res.status(500).json({ error: 'Internal server error during token refresh.' });
  }
}

export async function logout(req, res) {
  try {
    const refreshToken = getRefreshToken(req);
    if (refreshToken) {
      await pubClient.del(`refresh_token:${refreshToken}`);
    }
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Internal server error during logout.' });
  }
}

export async function googleLogin(req, res) {
  try {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
     console.log({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    })
    const options = {
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    };
    const qs = new URLSearchParams(options);
    return res.redirect(`${rootUrl}?${qs.toString()}`);
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(500).json({ error: 'Failed to initiate Google login.' });
  }
}

export async function googleCallback(req, res) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?error=OAuth code missing`);
    }
    console.log({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    })
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    };

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values).toString(),
    });
    const tokenData = await response.json();
    if (tokenData.error) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?error=${encodeURIComponent(tokenData.error_description || 'OAuth exchange failed')}`);
    }

    const userinfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
    const userinfoRes = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userinfoRes.json();
    
    const email = profile.email;
    const username = email ? email.split('@')[0] : `google-${profile.sub}`;

    let user = await findUserByUsername(username);
    if (!user) {
      const dummyHash = await hashPassword(crypto.randomUUID());
      user = await createUser(username, dummyHash);
    }

    const accessToken = signAccessToken({ id: user.id, username: user.username });
    const refreshToken = signRefreshToken({ id: user.id, username: user.username });

    await pubClient.set(`refresh_token:${refreshToken}`, user.id, 'EX', 7 * 24 * 3600);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    
    // Redirect user back to client dashboard with credentials
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?token=${accessToken}&userId=${user.id}&username=${user.username}`);
  } catch (err) {
    console.error('Google callback error:', err);
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?error=Google authentication failed`);
  }
}
