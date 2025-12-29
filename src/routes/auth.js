import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Simulação de banco de dados em memória (em produção, use um banco real)
const users = [];
const sessions = {};

// Registro de usuário
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
    }

    // Verificar se email já existe
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Criar novo usuário
    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: password, // Em produção, use hash (bcrypt)
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Gerar token simples (em produção, use JWT)
    const token = uuidv4();
    sessions[token] = newUser.id;

    res.status(201).json({
      message: 'Conta criada com sucesso',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      },
      token
    });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// Login de usuário
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Verificar senha (em produção, compare hash)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Gerar token
    const token = uuidv4();
    sessions[token] = user.id;

    res.json({
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Verificar token (middleware)
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const userId = sessions[token];
  if (!userId) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }

  req.user = user;
  next();
};

// Logout
router.post('/logout', verifyToken, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && sessions[token]) {
    delete sessions[token];
  }
  res.json({ message: 'Logout realizado com sucesso' });
});

// Obter usuário atual
router.get('/me', verifyToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

export default router;

