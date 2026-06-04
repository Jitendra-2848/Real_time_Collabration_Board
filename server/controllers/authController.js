import { createUser, findUserByUsername } from '../lib/db.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';

export async function register(req, res) {
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

  const token = signToken({ id: user.id, username: user.username });

  return res.json({ user: { id: user.id, username: user.username }, token });
}

export async function login(req, res) {
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


  const token = signToken({ id: user.id, username: user.username });
  return res.json({ user: { id: user.id, username: user.username }, token });
}
