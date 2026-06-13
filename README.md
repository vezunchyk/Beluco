# Beluco — Інструкція деплою на HuggingFace Spaces

## Структура проекту
```
beluco/
├── server.js          # Express сервер
├── package.json       # Залежності
├── public/
│   ├── index.html     # Публічний сайт
│   ├── admin.html     # Адмін панель (захищена паролем)
│   └── uploads/       # Фото (створюється автоматично)
```

---

## Крок 1 — MongoDB Atlas

1. Заходь на https://cloud.mongodb.com
2. Створи безкоштовний кластер (M0 Free)
3. **Database Access** → Add User → логін + пароль (запиши!)
4. **Network Access** → Add IP → `0.0.0.0/0` (дозволити всі)
5. **Connect** → Drivers → скопіюй рядок виду:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Заміни `USERNAME` і `PASSWORD` на свої

---

## Крок 2 — Згенеруй хеш пароля адміна

Відкрий термінал (або Node.js онлайн на https://playcode.io) і виконай:

```js
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('ТУТ_ТВІЙ_ПАРОЛЬ', 10));
```

Скопіюй результат — це буде `ADMIN_PASSWORD_HASH`.

---

## Крок 3 — HuggingFace Space

1. Заходь на https://huggingface.co/spaces
2. **Create new Space**
   - SDK: **Docker** (або Node.js якщо доступно)
   - Назва: `beluco-site`
3. Завантаж всі файли проекту

### Secrets (замість .env)
В налаштуваннях Space → **Settings → Repository secrets** додай:

| Ім'я | Значення |
|------|----------|
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/beluco` |
| `JWT_SECRET` | будь-який довгий рядок, напр. `beluco2025xK9mP` |
| `ADMIN_PASSWORD_HASH` | хеш з Кроку 2 |

---

## Крок 4 — Dockerfile (якщо потрібен)

Якщо HuggingFace вимагає Dockerfile, створи файл `Dockerfile`:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 7860
CMD ["node", "server.js"]
```

---

## Доступ до сайту після деплою

| Сторінка | URL |
|----------|-----|
| Публічний сайт | `https://YOUR-SPACE.hf.space/` |
| Адмін панель | `https://YOUR-SPACE.hf.space/admin.html` |

---

## Зміна пароля адміна

1. Згенеруй новий хеш (Крок 2)
2. В HuggingFace Space → Settings → Secrets
3. Оновни `ADMIN_PASSWORD_HASH`
4. Перезапусти Space

---

## Локальний запуск для тестування

```bash
# Встанови залежності
npm install

# Запусти з тестовими змінними
MONGO_URI="mongodb+srv://..." JWT_SECRET="test" node server.js

# Відкрий браузер
# Сайт:  http://localhost:7860
# Адмін: http://localhost:7860/admin.html
# Пароль за замовчуванням: admin123
```
