const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
// Стало:
const PORT = process.env.PORT || 7860;

// ── CONFIG (замінити перед деплоєм) ──
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://USER:PASS@cluster.mongodb.net/beluco';
const JWT_SECRET = process.env.JWT_SECRET || 'beluco_secret_key_change_me';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);

// ── MIDDLEWARE ──
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Папка для завантажених фото
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── MULTER (завантаження фото) ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Тільки зображення'));
  }
});

// ── MONGOOSE MODELS ──
const VacancySchema = new mongoose.Schema({
  emoji: { type: String, default: '💼' },
  title: { type: String, required: true },
  desc:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  type:  { type: String, enum: ['news', 'contest'], required: true },
  title: { type: String, required: true },
  text:  { type: String, default: '' },
  image: { type: String, default: '' }, // шлях до фото
  date:  { type: String, default: '' }, // для конкурсів — дедлайн
  createdAt: { type: Date, default: Date.now }
});

const SettingsSchema = new mongoose.Schema({
  key:   { type: String, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const Vacancy  = mongoose.model('Vacancy',  VacancySchema);
const Post     = mongoose.model('Post',     PostSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// ── AUTH MIDDLEWARE ──
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Не авторизовано' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Невірний токен' });
  }
}

// ── AUTH ROUTES ──
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) return res.status(401).json({ error: 'Невірний пароль' });
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// ── VACANCIES ──
app.get('/api/vacancies', async (req, res) => {
  const list = await Vacancy.find().sort({ createdAt: -1 });
  res.json(list);
});

app.post('/api/vacancies', auth, async (req, res) => {
  const v = await Vacancy.create(req.body);
  res.json(v);
});

app.delete('/api/vacancies/:id', auth, async (req, res) => {
  await Vacancy.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ── POSTS (news + contests) ──
app.get('/api/posts', async (req, res) => {
  const filter = req.query.type ? { type: req.query.type } : {};
  const list = await Post.find(filter).sort({ createdAt: -1 });
  res.json(list);
});

app.post('/api/posts', auth, upload.single('image'), async (req, res) => {
  const body = req.body;
  if (req.file) body.image = '/uploads/' + req.file.filename;
  const post = await Post.create(body);
  res.json(post);
});

app.delete('/api/posts/:id', auth, async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  // видалити файл якщо є
  if (post?.image) {
    const fp = path.join(__dirname, 'public', post.image);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  res.json({ ok: true });
});

// ── SETTINGS (контакти, статистика) ──
app.get('/api/settings', async (req, res) => {
  const rows = await Settings.find();
  const result = {};
  rows.forEach(r => result[r.key] = r.value);
  res.json(result);
});

app.post('/api/settings', auth, async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    await Settings.findOneAndUpdate({ key }, { value }, { upsert: true });
  }
  res.json({ ok: true });
});

// ── DB SEED (дефолтні дані при першому запуску) ──
async function seed() {
  const count = await Vacancy.countDocuments();
  if (count > 0) return;

  await Vacancy.insertMany([
    { emoji: '🧵', title: 'Швачка / Швець', desc: 'Пошиття оббивки та чохлів. Досвід на промисловій швейній машині — перевага.' },
    { emoji: '🪵', title: 'Столяр', desc: 'Виготовлення каркасів і дерев\'яних конструкцій. Робота з деревом, фанерою, ДСП.' },
    { emoji: '🖐️', title: 'Поклейщик', desc: 'Приклеювання поролону та синтепону до каркасів. Акуратність обов\'язкова.' },
    { emoji: '🔧', title: 'Монтажник меблів', desc: 'Збірка готових виробів, встановлення фурнітури, перевірка якості.' },
    { emoji: '📦', title: 'Комірник', desc: 'Прийом, зберігання та видача матеріалів і готової продукції.' },
    { emoji: '✂️', title: 'Розкрійник тканини', desc: 'Розкрій оббивних тканин за лекалами. Велюр, рогожка, шкіра.' },
  ]);

  await Settings.insertMany([
    { key: 'phone', value: '+38 (000) 000-00-00' },
    { key: 'email', value: 'hr@beluco.ua' },
    { key: 'address', value: 'Вкажіть адресу' },
    { key: 'hours', value: 'Пн–Пт, 09:00 – 17:00' },
    { key: 'years', value: '10+' },
    { key: 'staff', value: '100+' },
  ]);

  console.log('✅ Seed завершено');
}

// ── START ──
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB підключено');
    await seed();
    app.listen(PORT, () => console.log(`🚀 Сервер на порту ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB помилка:', err.message);
    process.exit(1);
  });
