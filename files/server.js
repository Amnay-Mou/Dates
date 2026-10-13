const crypto = require('crypto');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const app = express();
app.set('trust proxy', 1); // so https links are built correctly behind Render
process.on('unhandledRejection', e => console.error('Unhandled:', e));
// every async route is protected: a DB error returns 500 instead of crashing the server
['get', 'post', 'put', 'delete'].forEach(m => { const o = app[m].bind(app); app[m] = (p, ...h) => o(p, ...h.map(f => f.constructor.name === 'AsyncFunction' ? (q, s, n) => f(q, s, n).catch(e => { console.error(e); if (!s.headersSent) s.status(500).json({ error: 'Server error' }); }) : f)); });

// Initialize Turso Cloud Client (Falls back to local file if env vars are missing)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:files/data/cheese.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Initialize Tables on startup
async function initDb() {
  await db.execute(`CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT, author TEXT, text TEXT, created_at TEXT);`);
  await db.execute(`CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT, product TEXT, qty INTEGER, total REAL, name TEXT, cin TEXT, phone TEXT, email TEXT, status TEXT DEFAULT 'waiting', lang TEXT, created_at TEXT);`);
  await db.execute(`CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, name_fr TEXT, name_en TEXT, desc_fr TEXT, desc_en TEXT, price REAL, old_price REAL, until TEXT, images TEXT, name_ar TEXT, desc_ar TEXT);`);

  await db.execute(`CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY, mime TEXT, data TEXT);`);
  for (const q of ['ALTER TABLE comments ADD COLUMN customer_id TEXT', 'ALTER TABLE orders ADD COLUMN customer_id TEXT']) { try { await db.execute(q); } catch {} }
  for (const q of ['ALTER TABLE orders ADD COLUMN address TEXT', 'ALTER TABLE orders ADD COLUMN ready_at TEXT', 'ALTER TABLE orders ADD COLUMN picked_at TEXT', 'ALTER TABLE orders ADD COLUMN delivered_at TEXT']) { try { await db.execute(q); } catch {} }
  await db.execute(`CREATE TABLE IF NOT EXISTS staff(role TEXT PRIMARY KEY, name TEXT, lang TEXT, telegram_chat_id TEXT, email TEXT);`);
  // Seed initial products if empty
  const prodCheck = await db.execute('SELECT COUNT(*) as count FROM products');
  if (Number(prodCheck.rows[0].count) === 0) {
    const products = [
      ['mejhoul','Mejhoul (Medjool)','Mejhoul (Medjool)','Le « roi des dattes » : grosse, charnue et fondante, récoltée dans les palmeraies du Tafilalet. 500 g ou 1 kg.','The "king of dates": large, soft and caramel-like, harvested in the Tafilalet palm groves. 500 g or 1 kg.',110,140,'2026-11-15','[]','المجهول','ملك التمور: كبير وطري بمذاق الكراميل، من واحات تافيلالت. 500 غ أو 1 كغ.'],
      ['boufeggous','Boufeggous','Boufeggous','Datte fine au goût délicat et peu sucrée, idéale pour le petit-déjeuner et le Ramadan. 500 g ou 1 kg.','A delicate, lightly sweet date, ideal for breakfast and Ramadan. 500 g or 1 kg.',55,70,'2026-11-15','[]','بوفقوس','تمر رقيق بحلاوة خفيفة، مثالي للفطور ورمضان. 500 غ أو 1 كغ.'],
      ['jihel','Jihel','Jihel','Datte sèche et ferme, parfaite à croquer ou à cuisiner. 500 g ou 1 kg.','Firm, dry date, perfect as a snack or for cooking. 500 g or 1 kg.',40,null,null,'[]','الجيهل','تمر جاف متماسك، للتحلية أو الطبخ. 500 غ أو 1 كغ.'],
      ['khalt','Khalt (mélange)','Khalt (mix)','Mélange de dattes variées à petit prix, idéal pour la famille. 500 g ou 1 kg.','A mix of date varieties at a small price, great for the family. 500 g or 1 kg.',30,null,null,'[]','الخلط','خليط من أنواع التمور بسعر مناسب للعائلة. 500 غ أو 1 كغ.']
    ];
    for (const p of products) {
      await db.execute({
        sql: 'INSERT INTO products(id,name_fr,name_en,desc_fr,desc_en,price,old_price,until,images,name_ar,desc_ar) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        args: p
      });
    }
  }
}
initDb().catch(console.error);

app.use(express.json({ limit: '25mb' })); 
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'welcome.html')));
app.use(express.static(path.join(__dirname, 'public')));

const clean = (s, n = 300) => String(s || '').trim().slice(0, n);
const custId = v => /^C-[A-Z0-9]{4,10}$/.test(String(v)) ? String(v) : null;

// ===== TELEGRAM + EMAIL + TEAM WORKFLOW (warehouse -> delivery) =====
async function post(url, headers, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await r.text();
  let j = {}; try { j = JSON.parse(text); } catch {}
  if (!r.ok) console.error('POST failed', url.split('?')[0].replace(/bot[^/]+/, 'bot***'), r.status, text.slice(0, 200));
  return { ok: r.ok, error: r.ok ? '' : (j.description || j.message || text.slice(0, 160) || 'HTTP ' + r.status) };
}
// buttons = [{ text, url }]; admin chat is the default receiver. Always returns { ok, error, skipped }
async function sendTelegram(msg, chatId = process.env.TELEGRAM_CHAT_ID, buttons = []) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, skipped: true, error: 'TELEGRAM_BOT_TOKEN is missing in Render' };
  if (!chatId) return { ok: false, skipped: true, error: 'no Telegram chat ID' };
  const body = { chat_id: chatId, text: msg };
  if (buttons.length) {
    if (buttons.some(b => /localhost|127\.0\.0\.1/.test(b.url))) body.text += '\n\n' + buttons.map(b => `${b.text}: ${b.url}`).join('\n'); // Telegram refuses localhost buttons
    else body.reply_markup = { inline_keyboard: buttons.map(b => [{ text: b.text, url: b.url }]) };
  }
  try { return await post(`https://api.telegram.org/bot${token}/sendMessage`, {}, body); } catch (e) { console.error('Telegram error:', e.message); return { ok: false, error: e.message }; }
}
// Email through an HTTPS API (Render blocks SMTP). Brevo first, Resend as alternative. Always returns { ok, error, skipped }
async function sendEmail(to, subject, text, buttons = []) {
  if (!to) return { ok: false, skipped: true, error: 'no email address' };
  if (!process.env.EMAIL_FROM) return { ok: false, error: 'EMAIL_FROM is missing in Render' };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#3b2a1a">${text.split('\n').map(l => l ? `<div>${esc(l)}</div>` : '<br>').join('')}${buttons.map(b => `<p><a href="${b.url}" style="background:#e0a526;color:#2f2013;padding:12px 20px;border-radius:30px;text-decoration:none;font-weight:bold;display:inline-block">${esc(b.text)}</a></p>`).join('')}</div>`;
  try {
    if (process.env.BREVO_API_KEY) return await post('https://api.brevo.com/v3/smtp/email', { 'api-key': process.env.BREVO_API_KEY }, { sender: { name: 'Filali Dates', email: process.env.EMAIL_FROM }, to: [{ email: to }], subject, htmlContent: html });
    if (process.env.RESEND_API_KEY) return await post('https://api.resend.com/emails', { Authorization: 'Bearer ' + process.env.RESEND_API_KEY }, { from: `Filali Dates <${process.env.EMAIL_FROM}>`, to: [to], subject, html });
    return { ok: false, error: 'BREVO_API_KEY is missing in Render' };
  } catch (e) { console.error('Email error:', e.message); return { ok: false, error: e.message }; }
}

const TXT = {
  fr: { wh: '📦 Commande à préparer', dl: '🚚 Commande prête à livrer', p: 'Produit', q: 'Quantité', to: 'Destination', c: 'Client', tel: 'Tél', tot: 'Total', bReady: '✅ Commande préparée', bPick: "🚚 Je l'ai récupérée", bDone: '✔️ Livrée au client', map: '📍 Ouvrir dans Maps', test: '✅ Test : vous recevrez ici les commandes Filali Dates.', already: 'Déjà enregistré ✔️', notYet: 'Action indisponible pour le moment.', ok: 'Enregistré ✔️' },
  en: { wh: '📦 Order to prepare', dl: '🚚 Order ready for delivery', p: 'Product', q: 'Quantity', to: 'Destination', c: 'Customer', tel: 'Phone', tot: 'Total', bReady: '✅ Order prepared', bPick: '🚚 I picked it up', bDone: '✔️ Delivered to customer', map: '📍 Open in Maps', test: '✅ Test: you will receive Filali Dates orders here.', already: 'Already recorded ✔️', notYet: 'Not available right now.', ok: 'Saved ✔️' },
  ar: { wh: '📦 طلب للتحضير', dl: '🚚 طلب جاهز للتسليم', p: 'المنتج', q: 'الكمية', to: 'الوجهة', c: 'الزبون', tel: 'الهاتف', tot: 'المجموع', bReady: '✅ تم تحضير الطلب', bPick: '🚚 استلمت الطلب', bDone: '✔️ تم التسليم للزبون', map: '📍 فتح في الخرائط', test: '✅ تجربة: ستتوصل هنا بطلبات فيلالي.', already: 'تم تسجيله مسبقا ✔️', notYet: 'غير متاح حاليا.', ok: 'تم الحفظ ✔️' }
};
const STATUS = ['waiting', 'ready', 'delivering', 'delivered'];
const stOf = o => o.status || 'waiting';
const refOf = id => 'FD-' + String(id).padStart(4, '0');
const baseUrl = req => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const secret = () => process.env.APP_SECRET || process.env.ADMIN_PASSWORD || 'admin123';
const sign = (id, act) => crypto.createHmac('sha256', secret()).update(`${id}.${act}`).digest('hex').slice(0, 16);
const okSig = (id, act, sig) => { const a = Buffer.from(String(sig)), b = Buffer.from(sign(id, act)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const actLink = (base, id, act) => `${base}/act/${id}.${act}.${sign(id, act)}`;
const mapsUrl = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);
const getStaff = async role => (await db.execute({ sql: 'SELECT * FROM staff WHERE role=?', args: [role] })).rows[0] || null;
const notifyStaff = async (s, subject, text, buttons) => {
  if (!s) return {};
  const [telegram, email] = await Promise.all([sendTelegram(text, s.telegram_chat_id, buttons), sendEmail(s.email, subject, text, buttons)]);
  const bad = [!telegram.ok && !telegram.skipped && 'Telegram: ' + telegram.error, !email.ok && !email.skipped && 'Email: ' + email.error].filter(Boolean);
  if (bad.length) sendTelegram(`⚠️ Notification failed (${s.role} ${s.name || ''})\n${bad.join('\n')}`); // tell the admin instead of failing silently
  return { telegram, email };
};

// New order -> warehouse owner: only what is needed to prepare it (no client personal data)
async function notifyWarehouse(o, base) {
  const s = await getStaff('warehouse'); if (!s) return;
  const x = TXT[s.lang] || TXT.fr, ref = refOf(o.id);
  await notifyStaff(s, `${x.wh} ${ref}`, `${x.wh} ${ref}\n\n${x.p}: ${o.product}\n${x.q}: ${o.qty}`, [{ text: x.bReady, url: actLink(base, o.id, 'ready') }]);
}
// Order prepared -> delivery man: order ID + destination + client contact
async function notifyDelivery(o, base) {
  const s = await getStaff('delivery'); if (!s) return;
  const x = TXT[s.lang] || TXT.fr, ref = refOf(o.id);
  const text = `${x.dl} ${ref}\n\n${x.p}: ${o.product} × ${o.qty}\n${x.c}: ${o.name}\n${x.tel}: ${o.phone}\n${x.to}: ${o.address || '-'}\n${x.tot}: ${o.total} DH`;
  const buttons = [{ text: x.bPick, url: actLink(base, o.id, 'pickup') }, { text: x.bDone, url: actLink(base, o.id, 'done') }];
  if (o.address) buttons.push({ text: x.map, url: mapsUrl(o.address) });
  await notifyStaff(s, `${x.dl} ${ref}`, text, buttons);
}
// One place changes a status (admin page, warehouse link, delivery link) and triggers the right messages
async function setStatus(id, st, base) {
  const o = (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] })).rows[0];
  if (!o || stOf(o) === st) return o;
  const col = { ready: 'ready_at', delivering: 'picked_at', delivered: 'delivered_at' }[st];
  await db.execute({ sql: `UPDATE orders SET status=?${col ? `, ${col}=?` : ''} WHERE id=?`, args: col ? [st, new Date().toISOString(), id] : [st, id] });
  const n = { ...o, status: st };
  sendTelegram(`${{ waiting: '⏳', ready: '📦', delivering: '🚚', delivered: '✅' }[st]} ${refOf(id)} → ${st}\n${o.product} × ${o.qty} — ${o.name}`);
  if (st === 'ready') await notifyDelivery(n, base);
  return n;
}
const ACT = { ready: { role: 'warehouse', from: ['waiting'], to: 'ready' }, pickup: { role: 'delivery', from: ['ready'], to: 'delivering' }, done: { role: 'delivery', from: ['ready', 'delivering'], to: 'delivered' } };
async function actCtx(tok) {
  const [id, act, sig] = String(tok).split('.'), a = ACT[act];
  if (!a || !/^\d+$/.test(id) || !okSig(id, act, sig)) return null;
  const o = (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [Number(id)] })).rows[0];
  if (!o) return null;
  const s = await getStaff(a.role);
  return { o, act, a, s, x: TXT[s && s.lang] || TXT.fr };
}

// ===== COMMENTS =====
app.get('/api/comments/:pid', async (req, res) => {
  try {
    const rs = await db.execute({ sql: 'SELECT author,text,created_at FROM comments WHERE product_id=? ORDER BY id DESC', args: [req.params.pid] });
    res.json(rs.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/comments', async (req, res) => {
  const { product_id, author, text } = req.body, a = clean(author, 50), t = clean(text, 500), cust = custId(req.body.customer_id);
  if (!product_id || !a || !t) return res.status(400).json({ error: 'Missing fields' });
  const created_at = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO comments(product_id,author,text,created_at,customer_id) VALUES(?,?,?,?,?)',
    args: [product_id, a, t, created_at, cust]
  });

  sendTelegram(`💬 NOUVEAU COMMENTAIRE\n\n🌴 Produit: ${product_id}\n👤 Auteur: ${a}\n🆔 Client: ${cust || '-'}\n📝 Message: ${t}`);
  res.json({ author: a, text: t, created_at });
});

// ===== ORDERS =====
app.post('/api/orders', async (req, res) => {
  const b = req.body, qty = Math.min(5, Math.max(1, parseInt(b.qty) || 1));
  const o = { 
    product_id: clean(b.product_id, 30), product: clean(b.product, 100), qty, total: Number(b.total) || 0,
    name: clean(b.name, 100), cin: clean(b.cin, 30), phone: clean(b.phone, 30), email: clean(b.email, 100), address: clean(b.address, 200), 
    lang: ['fr','en','ar'].includes(b.lang) ? b.lang : 'fr', customer_id: custId(b.customer_id), created_at: new Date().toISOString() 
  };
  if (!o.name || !o.cin) return res.status(400).json({ error: 'Missing fields' });
  if (!/^0\d{9}$/.test(o.phone)) return res.status(400).json({ error: 'Bad phone' });
  if (o.address.length < 6) return res.status(400).json({ error: 'Bad address' });
  if (o.email && !/^\S+@\S+\.\S+$/.test(o.email)) return res.status(400).json({ error: 'Bad email' });

  const ins = await db.execute({
    sql: 'INSERT INTO orders(product_id,product,qty,total,name,cin,phone,email,lang,created_at,customer_id,address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [o.product_id, o.product, o.qty, o.total, o.name, o.cin, o.phone, o.email, o.lang, o.created_at, o.customer_id, o.address]
  });

  const ref = 'FD-' + String(Number(ins.lastInsertRowid)).padStart(4, '0');
  sendTelegram(`🛍️ NOUVELLE COMMANDE ${ref}\n\n🆔 Client: ${o.customer_id || '-'}\n👤 Nom: ${o.name}\n🪪 CIN: ${o.cin}\n📞 Tél: ${o.phone}\n📍 Adresse: ${o.address}\n✉️ Email: ${o.email || '-'}\n🌴 Produit: ${o.product}\n📦 Quantité: ${o.qty}\n💰 Total: ${o.total} DH`);
  notifyWarehouse({ ...o, id: Number(ins.lastInsertRowid) }, baseUrl(req)).catch(e => console.error('Warehouse notify:', e));
  res.json({ ok: true, ref });
});

// ===== ADMIN & PRODUCTS =====
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const tokens = new Set(), UP = path.join(__dirname, 'public', 'uploads'); fs.mkdirSync(UP, { recursive: true });

const out = r => ({ ...r, images: JSON.parse(r.images || '[]') });
const auth = (req, res, next) => tokens.has(req.get('x-token')) ? next() : res.status(401).json({ error: 'Unauthorized' });

async function saveImgs(list) {
  const keep = [];
  for (const s of (Array.isArray(list) ? list : []).slice(0, 8)) {
    const m = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(s);
    if (m) { const id = crypto.randomBytes(10).toString('hex'); await db.execute({ sql: 'INSERT INTO images(id,mime,data) VALUES(?,?,?)', args: [id, 'image/' + m[1], m[2]] }); keep.push('/img/' + id); }
    else if (/^(images\/[\w.\-]+|\/uploads\/[\w.\-]+|\/img\/[a-f0-9]+)$/.test(s)) keep.push(s);
  }
  return keep;
}

const pvals = async b => [clean(b.name_fr, 100), clean(b.name_en, 100), clean(b.desc_fr, 800), clean(b.desc_en, 800), Number(b.price) || 0, Number(b.old_price) || null, clean(b.until, 10) || null, JSON.stringify(await saveImgs(b.images)), clean(b.name_ar, 100), clean(b.desc_ar, 800)];

app.get('/img/:id', async (req, res) => {
  const rs = await db.execute({ sql: 'SELECT mime,data FROM images WHERE id=?', args: [req.params.id] });
  if (!rs.rows.length) return res.status(404).end();
  res.set({ 'Content-Type': rs.rows[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.send(Buffer.from(rs.rows[0].data, 'base64'));
});
app.get('/api/products', async (req, res) => {
  const rs = await db.execute('SELECT * FROM products');
  res.json(rs.rows.map(out));
});

app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  const t = crypto.randomBytes(24).toString('hex'); tokens.add(t); res.json({ token: t });
});

app.post('/api/admin/products', auth, async (req, res) => {
  const v = await pvals(req.body); if (!v[0] || !v[1] || v[4] <= 0) return res.status(400).json({ error: 'Name and price required' });
  const id = v[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'p' + Date.now();
  try { 
    await db.execute({ sql: 'INSERT INTO products(id,name_fr,name_en,desc_fr,desc_en,price,old_price,until,images,name_ar,desc_ar) VALUES(?,?,?,?,?,?,?,?,?,?,?)', args: [id, ...v] }); 
    res.json({ id }); 
  } catch { res.status(400).json({ error: 'Product already exists' }); }
});

app.put('/api/admin/products/:id', auth, async (req, res) => {
  const v = await pvals(req.body); if (!v[0] || !v[1] || v[4] <= 0) return res.status(400).json({ error: 'Name and price required' });
  await db.execute({ sql: 'UPDATE products SET name_fr=?,name_en=?,desc_fr=?,desc_en=?,price=?,old_price=?,until=?,images=?,name_ar=?,desc_ar=? WHERE id=?', args: [...v, req.params.id] });
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', auth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM products WHERE id=?', args: [req.params.id] });
  res.json({ ok: true });
});

app.get('/api/admin/comments', auth, async (req, res) => {
  const rs = await db.execute('SELECT * FROM comments ORDER BY id DESC');
  res.json(rs.rows);
});

app.delete('/api/admin/comments/:id', auth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM comments WHERE id=?', args: [req.params.id] });
  res.json({ ok: true });
});

app.get('/api/admin/orders', auth, async (req, res) => {
  const rs = await db.execute('SELECT * FROM orders ORDER BY id DESC');
  res.json(rs.rows);
});

app.put('/api/admin/orders/:id/status', auth, async (req, res) => {
  const st = req.body.status; if (!STATUS.includes(st)) return res.status(400).json({ error: 'Bad status' });
  await setStatus(Number(req.params.id), st, baseUrl(req));
  res.json({ ok: true });
});

app.delete('/api/admin/orders/:id', auth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM orders WHERE id=?', args: [req.params.id] });
  res.json({ ok: true });
});

// ===== ONE-TAP ACTION LINKS (sent to warehouse / delivery by Telegram + email) =====
app.get('/act/:tok', (req, res) => res.sendFile(path.join(__dirname, 'public', 'act.html')));
app.get('/api/act/:tok', async (req, res) => {
  const c = await actCtx(req.params.tok); if (!c) return res.status(404).json({ error: 'Invalid link' });
  const { o, act, a, x } = c, st = stOf(o), rank = s => STATUS.indexOf(s);
  const lines = [[x.p, `${o.product} × ${o.qty}`]];
  if (act !== 'ready') lines.push([x.c, o.name], [x.tel, o.phone, 'tel:' + o.phone], [x.to, o.address || '-', o.address ? mapsUrl(o.address) : ''], [x.tot, o.total + ' DH']);
  let state = 'todo', msg = '';
  if (rank(st) >= rank(a.to)) { state = 'done'; msg = x.already; } else if (!a.from.includes(st)) { state = 'blocked'; msg = x.notYet; }
  res.json({ ref: refOf(o.id), dir: c.s && c.s.lang === 'ar' ? 'rtl' : 'ltr', title: act === 'ready' ? x.wh : x.dl, lines, state, msg, button: { ready: x.bReady, pickup: x.bPick, done: x.bDone }[act] });
});
app.post('/api/act/:tok', async (req, res) => {
  const c = await actCtx(req.params.tok); if (!c) return res.status(404).json({ error: 'Invalid link' });
  if (!c.a.from.includes(stOf(c.o))) return res.status(409).json({ error: c.x.notYet });
  await setStatus(c.o.id, c.a.to, baseUrl(req));
  const r = { ok: true, msg: c.x.ok };
  if (c.act === 'pickup') r.next = { button: c.x.bDone, url: `/act/${c.o.id}.done.${sign(c.o.id, 'done')}` };
  res.json(r);
});

// ===== TEAM (admin sets who receives what) =====
const ROLES = ['warehouse', 'delivery'];
app.get('/api/admin/staff', auth, async (req, res) => res.json((await db.execute('SELECT * FROM staff')).rows));
app.put('/api/admin/staff/:role', auth, async (req, res) => {
  const role = req.params.role; if (!ROLES.includes(role)) return res.status(400).json({ error: 'Bad role' });
  const b = req.body, name = clean(b.name, 60), lang = ['fr', 'en', 'ar'].includes(b.lang) ? b.lang : 'fr', tg = clean(b.telegram_chat_id, 20), email = clean(b.email, 100);
  if (tg && !/^-?\d{5,15}$/.test(tg)) return res.status(400).json({ error: 'Telegram chat ID must be a number' });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  await db.execute({ sql: 'INSERT INTO staff(role,name,lang,telegram_chat_id,email) VALUES(?,?,?,?,?) ON CONFLICT(role) DO UPDATE SET name=excluded.name, lang=excluded.lang, telegram_chat_id=excluded.telegram_chat_id, email=excluded.email', args: [role, name, lang, tg, email] });
  res.json({ ok: true });
});
app.post('/api/admin/staff/:role/test', auth, async (req, res) => {
  const s = await getStaff(req.params.role); if (!s) return res.status(404).json({ error: 'Save first' });
  const r = await notifyStaff(s, 'Filali Dates - test', (TXT[s.lang] || TXT.fr).test + (s.name ? ' — ' + s.name : ''), []);
  res.json(r);
});

// ===== SETUP CHECK: tells the admin exactly what is missing for Telegram / email =====
app.get('/api/admin/diag', auth, async (req, res) => {
  const out = [], add = (ok, label, detail = '') => out.push({ ok, label, detail });
  const tok = process.env.TELEGRAM_BOT_TOKEN; let botId = '';
  if (!tok) add(false, 'Telegram bot', 'TELEGRAM_BOT_TOKEN is missing in Render');
  else {
    try {
      const j = await (await fetch(`https://api.telegram.org/bot${tok}/getMe`)).json();
      if (j.ok) { botId = String(j.result.id); add(true, 'Telegram bot', `@${j.result.username} (bot ID ${botId})`); } else add(false, 'Telegram bot', 'token rejected: ' + j.description);
    } catch (e) { add(false, 'Telegram bot', e.message); }
  }
  add(!!process.env.TELEGRAM_CHAT_ID, 'Your admin chat ID', process.env.TELEGRAM_CHAT_ID ? 'set' : 'TELEGRAM_CHAT_ID is missing in Render');
  for (const s of (await db.execute('SELECT * FROM staff')).rows) {
    if (!s.telegram_chat_id) add(false, `${s.role}: Telegram`, 'no chat ID saved, so no Telegram message will be sent');
    else if (botId && s.telegram_chat_id === botId) add(false, `${s.role}: Telegram`, "this is the BOT's own ID. Use the person's ID from @userinfobot");
    if (!s.email) add(false, `${s.role}: email`, 'no email saved');
  }
  const from = process.env.EMAIL_FROM;
  if (process.env.BREVO_API_KEY) {
    try {
      const r = await fetch('https://api.brevo.com/v3/senders', { headers: { 'api-key': process.env.BREVO_API_KEY } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) add(false, 'Brevo API key', `rejected (${r.status}) ${j.message || ''}. Create an API key (starts with xkeysib-), not an SMTP key`);
      else {
        add(true, 'Brevo API key', 'valid');
        const s = (j.senders || []).find(x => from && String(x.email).toLowerCase() === from.toLowerCase());
        if (!from) add(false, 'EMAIL_FROM', 'missing in Render');
        else if (!s) add(false, 'EMAIL_FROM', `${from} is not a sender in Brevo (Senders, Domains & Dedicated IPs → Senders → Add a sender)`);
        else if (s.active === false) add(false, 'EMAIL_FROM', `${from} is not verified yet: open the email Brevo sent you and click the link`);
        else add(true, 'EMAIL_FROM', `${from} is a verified sender`);
      }
    } catch (e) { add(false, 'Brevo', e.message); }
  } else if (process.env.RESEND_API_KEY) add(!!from, 'Resend', from ? `key set, sender ${from}` : 'EMAIL_FROM is missing in Render');
  else add(false, 'Email', 'BREVO_API_KEY is missing in Render');
  const pu = process.env.PUBLIC_URL;
  add(!pu || /^https:\/\//.test(pu), 'PUBLIC_URL (links in messages)', !pu ? `not set, using ${baseUrl(req)}` : /^https:\/\//.test(pu) ? pu : `"${pu}" must start with https://`);
  add(!!process.env.APP_SECRET, 'APP_SECRET', process.env.APP_SECRET ? 'set' : 'missing: set a long random text in Render');
  res.json(out);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));