const crypto = require('crypto');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const app = express();
const db = new DatabaseSync(path.join(__dirname, 'data', 'cheese.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, product_id TEXT, author TEXT, text TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, product_id TEXT, product TEXT, qty INTEGER, total REAL, name TEXT, cin TEXT, phone TEXT, email TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, name_fr TEXT, name_en TEXT, desc_fr TEXT, desc_en TEXT, price REAL, old_price REAL, until TEXT, images TEXT);
`);

app.use(express.json({ limit: '25mb' })); 
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'welcome.html')));
app.use(express.static(path.join(__dirname, 'public')));

const clean = (s, n = 300) => String(s || '').trim().slice(0, n);

app.get('/api/comments/:pid', (req, res) =>
  res.json(db.prepare('SELECT author,text,created_at FROM comments WHERE product_id=? ORDER BY id DESC').all(req.params.pid))
);

app.post('/api/comments', (req, res) => {
  const { product_id, author, text } = req.body, a = clean(author, 50), t = clean(text, 500);
  if (!product_id || !a || !t) return res.status(400).json({ error: 'Missing fields' });
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO comments(product_id,author,text,created_at) VALUES(?,?,?,?)').run(product_id, a, t, created_at);
  res.json({ author: a, text: t, created_at });
});

app.post('/api/orders', async (req, res) => {
  const b = req.body, qty = Math.min(5, Math.max(1, parseInt(b.qty) || 1));
  const o = { 
    product_id: clean(b.product_id, 30), product: clean(b.product, 100), qty, total: Number(b.total) || 0,
    name: clean(b.name, 100), cin: clean(b.cin, 30), phone: clean(b.phone, 30), email: clean(b.email, 100), 
    lang: ['fr','en','ar'].includes(b.lang) ? b.lang : 'fr', created_at: new Date().toISOString() 
  };
  if (!o.name || !o.cin || !(o.phone || o.email)) return res.status(400).json({ error: 'Missing fields' });

  // Save to database
  db.prepare('INSERT INTO orders(product_id,product,qty,total,name,cin,phone,email,lang,created_at) VALUES(@product_id,@product,@qty,@total,@name,@cin,@phone,@email,@lang,@created_at)').run(o);

  // Send Telegram Notification
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (telegramToken && chatId) {
    const msg = `🛍️ *NOUVELLE COMMANDE !*\n\n` +
      `👤 *Nom:* ${o.name}\n` +
      `🪪 *CIN:* ${o.cin}\n` +
      `📞 *Tél:* ${o.phone}\n` +
      `✉️ *Email:* ${o.email}\n` +
      `🌴 *Produit:* ${o.product}\n` +
      `📦 *Quantité:* ${o.qty}\n` +
      `💰 *Total:* ${o.total} DH`;

    fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' })
    }).catch(err => console.error('Telegram notification error:', err));
  }

  res.json({ ok: true });
});

// ===== PRODUCTS + ADMIN =====
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const tokens = new Set(), UP = path.join(__dirname, 'public', 'uploads'); fs.mkdirSync(UP, { recursive: true });

if (!db.prepare('SELECT 1 FROM products').get()) {
  const ins = db.prepare('INSERT INTO products(id,name_fr,name_en,desc_fr,desc_en,price,old_price,until,images) VALUES(?,?,?,?,?,?,?,?,?)');
  [['mejhoul','Mejhoul (Medjool)','Mejhoul (Medjool)','Le « roi des dattes » : grosse, charnue et fondante, récoltée dans les palmeraies du Tafilalet. 500 g ou 1 kg.','The "king of dates": large, soft and caramel-like, harvested in the Tafilalet palm groves. 500 g or 1 kg.',110,140,'2026-11-15'],
   ['boufeggous','Boufeggous','Boufeggous','Datte fine au goût délicat et peu sucrée, idéale pour le petit-déjeuner et le Ramadan. 500 g ou 1 kg.','A delicate, lightly sweet date, ideal for breakfast and Ramadan. 500 g or 1 kg.',55,70,'2026-11-15'],
   ['jihel','Jihel','Jihel','Datte sèche et ferme, parfaite à croquer ou à cuisiner. 500 g ou 1 kg.','Firm, dry date, perfect as a snack or for cooking. 500 g or 1 kg.',40,null,null],
   ['khalt','Khalt (mélange)','Khalt (mix)','Mélange de dattes variées à petit prix, idéal pour la famille. 500 g ou 1 kg.','A mix of date varieties at a small price, great for the family. 500 g or 1 kg.',30,null,null]]
  .forEach(([id, ...r]) => ins.run(id, ...r.slice(0, 7), '[]'));
}

for (const c of ['name_ar', 'desc_ar']) try { db.exec(`ALTER TABLE products ADD COLUMN ${c} TEXT`); } catch {}
for (const c of ["status TEXT DEFAULT 'waiting'", 'lang TEXT']) try { db.exec(`ALTER TABLE orders ADD COLUMN ${c}`); } catch {}

const bf = db.prepare('UPDATE products SET name_ar=?, desc_ar=? WHERE id=? AND name_ar IS NULL');
bf.run('المجهول', 'ملك التمور: كبير وطري بمذاق الكراميل، من واحات تافيلالت. 500 غ أو 1 كغ.', 'mejhoul'); 
bf.run('بوفقوس', 'تمر رقيق بحلاوة خفيفة، مثالي للفطور ورمضان. 500 غ أو 1 كغ.', 'boufeggous');
bf.run('الجيهل', 'تمر جاف متماسك، للتحلية أو الطبخ. 500 غ أو 1 كغ.', 'jihel'); 
bf.run('الخلط', 'خليط من أنواع التمور بسعر مناسب للعائلة. 500 غ أو 1 كغ.', 'khalt');

const out = r => ({ ...r, images: JSON.parse(r.images || '[]') });
const auth = (req, res, next) => tokens.has(req.get('x-token')) ? next() : res.status(401).json({ error: 'Unauthorized' });

function saveImgs(list) {
  return (Array.isArray(list) ? list : []).slice(0, 8).map(s => {
    const m = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(s);
    if (m) { const f = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(path.join(UP, f), Buffer.from(m[2], 'base64')); return '/uploads/' + f; }
    return /^(images\/|\/uploads\/)[\w.\-]+$/.test(s) ? s : null;
  }).filter(Boolean);
}

const pvals = b => [clean(b.name_fr, 100), clean(b.name_en, 100), clean(b.desc_fr, 800), clean(b.desc_en, 800), Number(b.price) || 0, Number(b.old_price) || null, clean(b.until, 10) || null, JSON.stringify(saveImgs(b.images)), clean(b.name_ar, 100), clean(b.desc_ar, 800)];

app.get('/api/products', (req, res) => res.json(db.prepare('SELECT * FROM products').all().map(out)));

app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  const t = crypto.randomBytes(24).toString('hex'); tokens.add(t); res.json({ token: t });
});

app.post('/api/admin/products', auth, (req, res) => {
  const v = pvals(req.body); if (!v[0] || !v[1] || v[4] <= 0) return res.status(400).json({ error: 'Name and price required' });
  const id = v[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'p' + Date.now();
  try { db.prepare('INSERT INTO products(id,name_fr,name_en,desc_fr,desc_en,price,old_price,until,images,name_ar,desc_ar) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, ...v); res.json({ id }); } catch { res.status(400).json({ error: 'Product already exists' }); }
});

app.put('/api/admin/products/:id', auth, (req, res) => {
  const v = pvals(req.body); if (!v[0] || !v[1] || v[4] <= 0) return res.status(400).json({ error: 'Name and price required' });
  db.prepare('UPDATE products SET name_fr=?,name_en=?,desc_fr=?,desc_en=?,price=?,old_price=?,until=?,images=?,name_ar=?,desc_ar=? WHERE id=?').run(...v, req.params.id); res.json({ ok: true });
});

app.delete('/api/admin/products/:id', auth, (req, res) => { db.prepare('DELETE FROM products WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.get('/api/admin/comments', auth, (req, res) => res.json(db.prepare('SELECT * FROM comments ORDER BY id DESC').all()));
app.delete('/api/admin/comments/:id', auth, (req, res) => { db.prepare('DELETE FROM comments WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.get('/api/admin/orders', auth, (req, res) => res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC').all()));
app.put('/api/admin/orders/:id/status', auth, (req, res) => {
  const st = req.body.status; if (!['waiting', 'delivered'].includes(st)) return res.status(400).json({ error: 'Bad status' });
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(st, req.params.id); res.json({ ok: true });
});
app.delete('/api/admin/orders/:id', auth, (req, res) => { db.prepare('DELETE FROM orders WHERE id=?').run(req.params.id); res.json({ ok: true }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));