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
  // team = several people per role (replaces the old one-person-per-role "staff" table)
  await db.execute(`CREATE TABLE IF NOT EXISTS team(id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, name TEXT, lang TEXT, telegram_chat_id TEXT, email TEXT, active INTEGER DEFAULT 1);`);
  for (const q of ['ALTER TABLE orders ADD COLUMN ready_by_name TEXT', 'ALTER TABLE orders ADD COLUMN courier_id INTEGER', 'ALTER TABLE orders ADD COLUMN courier_name TEXT']) { try { await db.execute(q); } catch {} }
  if (!Number((await db.execute('SELECT COUNT(*) AS c FROM team')).rows[0].c)) { // one-time copy of the people you already saved
    try { await db.execute('INSERT INTO team(role,name,lang,telegram_chat_id,email,active) SELECT role,name,lang,telegram_chat_id,email,1 FROM staff'); } catch {}
  }
  for (const q of ['ALTER TABLE orders ADD COLUMN city TEXT', 'ALTER TABLE orders ADD COLUMN subtotal REAL', 'ALTER TABLE orders ADD COLUMN delivery_fee REAL', 'ALTER TABLE orders ADD COLUMN location_url TEXT']) { try { await db.execute(q); } catch {} }
  await db.execute(`CREATE TABLE IF NOT EXISTS cities(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, name_ar TEXT, fee REAL, eta TEXT, active INTEGER DEFAULT 1);`);
  await db.execute(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);`);
  if (!Number((await db.execute('SELECT COUNT(*) AS c FROM cities')).rows[0].c)) { // starter list: fees are EMPTY on purpose (= "to be confirmed on WhatsApp") until you set them in Admin -> Delivery
    for (const [n, a] of [['Meknès', 'مكناس'], ['Fès', 'فاس'], ['Rabat', 'الرباط'], ['Casablanca', 'الدار البيضاء'], ['Marrakech', 'مراكش'], ['Tanger', 'طنجة'], ['Agadir', 'أكادير'], ['Errachidia', 'الرشيدية'], ['Erfoud', 'أرفود'], ['Rissani', 'الريصاني'], ['Other city', 'مدينة أخرى']])
      await db.execute({ sql: 'INSERT INTO cities(name,name_ar,fee,eta) VALUES(?,?,NULL,?)', args: [n, a, ''] });
  }
  // Seed initial products if empty
  const prodCheck = await db.execute('SELECT COUNT(*) as count FROM products');
  if (Number(prodCheck.rows[0].count) === 0) {
    const products = [
      ['mejhoul','Mejhoul (Medjool)','Mejhoul (Medjool)','Le « roi des dattes » : grosse, charnue et fondante, récoltée dans les palmeraies du Tafilalet. Boîte de 2 kg.','The "king of dates": large, soft and caramel-like, harvested in the Tafilalet palm groves. Box of 2 kg.',110,140,'2026-11-15','[]','المجهول','ملك التمور: كبير وطري بمذاق الكراميل، من واحات تافيلالت. علبة 2 كغ.'],
      ['boufeggous','Boufeggous','Boufeggous','Datte fine au goût délicat et peu sucrée, idéale pour le petit-déjeuner et le Ramadan. Boîte de 2 kg.','A delicate, lightly sweet date, ideal for breakfast and Ramadan. Box of 2 kg.',55,70,'2026-11-15','[]','بوفقوس','تمر رقيق بحلاوة خفيفة، مثالي للفطور ورمضان. علبة 2 كغ.'],
      ['jihel','Jihel','Jihel','Datte sèche et ferme, parfaite à croquer ou à cuisiner. Boîte de 2 kg.','Firm, dry date, perfect as a snack or for cooking. Box of 2 kg.',40,null,null,'[]','الجيهل','تمر جاف متماسك، للتحلية أو الطبخ. علبة 2 كغ.'],
      ['khalt','Khalt (mélange)','Khalt (mix)','Mélange de dattes variées à petit prix, idéal pour la famille. Boîte de 2 kg.','A mix of date varieties at a small price, great for the family. Box of 2 kg.',30,null,null,'[]','الخلط','خليط من أنواع التمور بسعر مناسب للعائلة. علبة 2 كغ.']
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

app.use('/api/admin/products', express.json({ limit: '25mb' })); // only the product form sends photos
app.use(express.json({ limit: '50kb' })); // everything else stays small 
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'welcome.html')));
// product link previews: when a product link is shared, WhatsApp / Facebook / Telegram show its photo, name and price
const hAttr = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function ogTags(p, base) {
  const first = JSON.parse(p.images || '[]')[0] || '/images/logo.png', img = /^https?:/.test(first) ? first : base + (first.startsWith('/') ? first : '/' + first);
  const title = `${p.name_fr}${p.name_ar ? ' — ' + p.name_ar : ''} | Filali Dates`, desc = `${unitPrice(p)} DH — ${clean(p.desc_fr || p.desc_en, 140)}`;
  return `<title>${hAttr(title)}</title><meta name="description" content="${hAttr(desc)}"><meta property="og:type" content="product"><meta property="og:site_name" content="Filali Dates"><meta property="og:title" content="${hAttr(title)}"><meta property="og:description" content="${hAttr(desc)}"><meta property="og:image" content="${hAttr(img)}"><meta property="og:url" content="${hAttr(base + '/product.html?id=' + encodeURIComponent(p.id))}"><meta name="twitter:card" content="summary_large_image">`;
}
let productTpl = null;
app.get('/product.html', async (req, res, next) => {
  const p = (await db.execute({ sql: 'SELECT * FROM products WHERE id=?', args: [clean(req.query.id, 80)] })).rows[0];
  if (!p) return next();
  productTpl = productTpl || fs.readFileSync(path.join(__dirname, 'public', 'product.html'), 'utf8');
  res.type('html').send(productTpl.replace('<title>Filali Dates</title>', ogTags(p, baseUrl(req))));
});
app.use(express.static(path.join(__dirname, 'public')));

const clean = (s, n = 300) => String(s || '').trim().slice(0, n);
const custId = v => /^C-[A-Z0-9]{4,10}$/.test(String(v)) ? String(v) : null;

// ===== SMALL PROTECTIONS (no extra package): remember recent hits per visitor =====
const hits = new Map();
const recent = (k, ms) => { const now = Date.now(), l = (hits.get(k) || []).filter(t => now - t < ms); hits.set(k, l); return l; };
const isLimited = (name, req, max, ms) => recent(name + ':' + req.ip, ms).length >= max;
const record = (name, req) => { const k = name + ':' + req.ip, l = hits.get(k) || []; l.push(Date.now()); hits.set(k, l); };
setInterval(() => { const now = Date.now(); for (const [k, l] of hits) if (!l.some(t => now - t < 4 * 3600e3)) hits.delete(k); }, 3600e3).unref();

// ===== PRICES: the server calculates every order (the browser's total is never trusted) =====
function unitPrice(p) { // same rule as the website: the offer price is used only while the "until" date has not passed
  const promo = p.old_price && p.until && new Date() <= new Date(p.until + 'T23:59:59+01:00');
  return promo ? Number(p.price) : Number(p.old_price || p.price);
}
function deliveryFee(city, subtotal, freeFrom) { // null = fee will be confirmed on WhatsApp
  if (freeFrom > 0 && subtotal >= freeFrom) return 0;
  return city && city.fee != null ? Number(city.fee) : null;
}
const getFreeFrom = async () => Number(((await db.execute({ sql: 'SELECT value FROM settings WHERE key=?', args: ['free_from'] })).rows[0] || {}).value) || 0;

// ===== CSV export helpers =====
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }; // the quote blocks Excel formula injection
const csvText = v => '"=""' + String(v ?? '').replace(/[^0-9A-Za-z +]/g, '') + '"""'; // a properly quoted field that Excel reads as text, so phone numbers keep their leading 0
const fmtDate = iso => iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Africa/Casablanca' }) : '';
const STATUS_NAME = { waiting: 'Waiting', ready: 'Prepared', delivering: 'On the way', delivered: 'Delivered', failed: 'Failed delivery', cancelled: 'Cancelled' };
const nextDay = d => new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
// [header, value, isText]
const CSV_COLS = {
  admin: [['Order', o => refOf(o.id)], ['Customer ID', o => o.customer_id], ['Date', o => fmtDate(o.created_at)], ['Product', o => o.product], ['Boxes (2 kg)', o => o.qty],
    ['Products DH', o => o.subtotal ?? o.total], ['Delivery DH', o => o.city ? (o.delivery_fee == null ? 'to confirm' : o.delivery_fee) : ''], ['Total DH', o => o.total],
    ['Name', o => o.name], ['CIN', o => o.cin], ['Phone', o => o.phone, true], ['Email', o => o.email], ['City', o => o.city], ['Address', o => o.address], ['Location', o => o.location_url],
    ['Language', o => o.lang], ['Status', o => STATUS_NAME[stOf(o)]], ['Prepared by', o => o.ready_by_name], ['Courier', o => o.courier_name],
    ['Prepared at', o => fmtDate(o.ready_at)], ['Picked up at', o => fmtDate(o.picked_at)], ['Delivered at', o => fmtDate(o.delivered_at)]],
  warehouse: [['Order', o => refOf(o.id)], ['Date', o => fmtDate(o.created_at)], ['Product', o => o.product], ['Boxes (2 kg)', o => o.qty], ['Status', o => STATUS_NAME[stOf(o)]], ['Prepared by', o => o.ready_by_name]],
  delivery: [['Order', o => refOf(o.id)], ['Date', o => fmtDate(o.created_at)], ['Product', o => o.product], ['Boxes (2 kg)', o => o.qty], ['Client', o => o.name], ['Phone', o => o.phone, true],
    ['City', o => o.city], ['Address', o => o.address], ['Location', o => o.location_url], ['Total to collect DH', o => o.total], ['Status', o => STATUS_NAME[stOf(o)]], ['Courier', o => o.courier_name]]
};

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
  fr: { wh: '📦 Commande à préparer', dl: '🚚 Commande prête à livrer', p: 'Produit', q: 'Quantité (boîtes de 2 kg)', to: 'Destination', c: 'Client', tel: 'Tél', tot: 'Total', bReady: '✅ Commande préparée', bPick: "🚚 Je l'ai récupérée", bDone: '✔️ Livrée au client', map: '📍 Ouvrir dans Maps', test: '✅ Test : vous recevrez ici les commandes Filali Dates.', already: 'Déjà enregistré ✔️', notYet: 'Action indisponible pour le moment.', ok: 'Enregistré ✔️', taken: 'Déjà pris en charge par', prep: 'Déjà préparée par', ct: 'Ville', loc: 'Position', closed: "Cette commande est annulée ou n'a pas pu être livrée." },
  en: { wh: '📦 Order to prepare', dl: '🚚 Order ready for delivery', p: 'Product', q: 'Quantity (2 kg boxes)', to: 'Destination', c: 'Customer', tel: 'Phone', tot: 'Total', bReady: '✅ Order prepared', bPick: '🚚 I picked it up', bDone: '✔️ Delivered to customer', map: '📍 Open in Maps', test: '✅ Test: you will receive Filali Dates orders here.', already: 'Already recorded ✔️', notYet: 'Not available right now.', ok: 'Saved ✔️', taken: 'Already taken by', prep: 'Already prepared by', ct: 'City', loc: 'Location', closed: 'This order was cancelled or could not be delivered.' },
  ar: { wh: '📦 طلب للتحضير', dl: '🚚 طلب جاهز للتسليم', p: 'المنتج', q: 'الكمية (علب 2 كغ)', to: 'الوجهة', c: 'الزبون', tel: 'الهاتف', tot: 'المجموع', bReady: '✅ تم تحضير الطلب', bPick: '🚚 استلمت الطلب', bDone: '✔️ تم التسليم للزبون', map: '📍 فتح في الخرائط', test: '✅ تجربة: ستتوصل هنا بطلبات فيلالي.', already: 'تم تسجيله مسبقا ✔️', notYet: 'غير متاح حاليا.', ok: 'تم الحفظ ✔️', taken: 'تم استلامه مسبقا من طرف', prep: 'تم تحضيره مسبقا من طرف', ct: 'المدينة', loc: 'الموقع', closed: 'تم إلغاء هذا الطلب أو تعذر تسليمه.' }
};
const STATUS = ['waiting', 'ready', 'delivering', 'delivered', 'failed', 'cancelled'];
const stOf = o => o.status || 'waiting';
const refOf = id => 'FD-' + String(id).padStart(4, '0');
const baseUrl = req => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const secret = () => process.env.APP_SECRET || process.env.ADMIN_PASSWORD || 'admin123';
const sign = (id, act, sid) => crypto.createHmac('sha256', secret()).update(`${id}.${act}.${sid}`).digest('hex').slice(0, 16);
const okSig = (id, act, sid, sig) => { const a = Buffer.from(String(sig)), b = Buffer.from(sign(id, act, sid)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
// every message carries personal links: the link says WHO acts (staff id), so we know who prepared / who delivers
const actLink = (base, id, act, sid) => `${base}/act/${id}.${act}.${sid}.${sign(id, act, sid)}`;
const mapsUrl = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);
const staffOf = async role => (await db.execute({ sql: 'SELECT * FROM team WHERE role=? AND active=1 ORDER BY id', args: [role] })).rows;
const notifyStaff = async (s, subject, text, buttons) => {
  if (!s) return {};
  const [telegram, email] = await Promise.all([sendTelegram(text, s.telegram_chat_id, buttons), sendEmail(s.email, subject, text, buttons)]);
  const bad = [!telegram.ok && !telegram.skipped && 'Telegram: ' + telegram.error, !email.ok && !email.skipped && 'Email: ' + email.error].filter(Boolean);
  if (bad.length) sendTelegram(`⚠️ Notification failed (${s.role} ${s.name || ''})\n${bad.join('\n')}`); // tell the admin instead of failing silently
  return { telegram, email };
};

// New order -> ALL active warehouse people (first one to tap "prepared" takes it). No client personal data here.
async function notifyWarehouse(o, base) {
  const list = await staffOf('warehouse'), ref = refOf(o.id);
  if (!list.length) return sendTelegram(`⚠️ ${ref}: no active warehouse person to notify (Admin → Team)`);
  await Promise.all(list.map(s => { const x = TXT[s.lang] || TXT.fr; return notifyStaff(s, `${x.wh} ${ref}`, `${x.wh} ${ref}\n\n${x.p}: ${o.product}\n${x.q}: ${o.qty}`, [{ text: x.bReady, url: actLink(base, o.id, 'ready', s.id) }]); }));
}
// Order prepared -> ALL active delivery people (first one to tap "picked up" takes it): ID + destination + client contact
async function notifyDelivery(o, base) {
  const list = await staffOf('delivery'), ref = refOf(o.id);
  if (!list.length) return sendTelegram(`⚠️ ${ref}: no active delivery person to notify (Admin → Team)`);
  await Promise.all(list.map(s => {
    const x = TXT[s.lang] || TXT.fr;
    const dest = o.location_url || (o.address ? mapsUrl(`${o.address}, ${o.city || ''}`) : '');
    const text = `${x.dl} ${ref}\n\n${x.p}: ${o.product} × ${o.qty}\n${x.c}: ${o.name}\n${x.tel}: ${o.phone}\n${x.ct}: ${o.city || '-'}\n${x.to}: ${o.address || '-'}${o.location_url ? `\n${x.loc}: ${o.location_url}` : ''}\n${x.tot}: ${o.total} DH`;
    const buttons = [{ text: x.bPick, url: actLink(base, o.id, 'pickup', s.id) }, { text: x.bDone, url: actLink(base, o.id, 'done', s.id) }];
    if (dest) buttons.push({ text: x.map, url: dest });
    return notifyStaff(s, `${x.dl} ${ref}`, text, buttons);
  }));
}
// after any status change: tell the admin, and start the next step
async function afterStatus(id, st, base) {
  const o = (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] })).rows[0]; if (!o) return;
  const who = st === 'ready' ? o.ready_by_name : (st === 'delivering' || st === 'delivered') ? o.courier_name : '';
  sendTelegram(`${{ waiting: '⏳', ready: '📦', delivering: '🚚', delivered: '✅', failed: '❌', cancelled: '🚫' }[st]} ${refOf(id)} → ${st}${who ? ' (' + who + ')' : ''}\n${o.product} × ${o.qty} — ${o.name}`);
  if (st === 'ready') await notifyDelivery(o, base);
}
// status changed by the ADMIN from the Orders list
async function setStatus(id, st, base) {
  const o = (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] })).rows[0];
  if (!o || stOf(o) === st) return;
  const extra = { waiting: ', ready_by_name=NULL, courier_id=NULL, courier_name=NULL', ready: ', ready_at=?, courier_id=NULL, courier_name=NULL', delivering: ', picked_at=?', delivered: ', delivered_at=?' }[st] ?? '';
  await db.execute({ sql: `UPDATE orders SET status=?${extra} WHERE id=?`, args: [st, ...(extra.includes('?') ? [new Date().toISOString()] : []), id] });
  await afterStatus(id, st, base);
}
const ACT = { ready: { role: 'warehouse', to: 'ready' }, pickup: { role: 'delivery', to: 'delivering' }, done: { role: 'delivery', to: 'delivered' } };
async function actCtx(tok) {
  const [id, act, sid, sig] = String(tok).split('.'), a = ACT[act];
  if (!a || !/^\d+$/.test(id) || !/^\d+$/.test(sid) || !okSig(id, act, sid, sig)) return null;
  const o = (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [Number(id)] })).rows[0];
  const s = (await db.execute({ sql: 'SELECT * FROM team WHERE id=? AND role=? AND active=1', args: [Number(sid), a.role] })).rows[0];
  return o && s ? { o, act, a, s, x: TXT[s.lang] || TXT.fr } : null; // deleted / deactivated people lose their links
}
// what can this person do with this order right now?
function actState(c) {
  const { o, act, s, x } = c, st = stOf(o), free = o.courier_id == null, mine = !free && Number(o.courier_id) === Number(s.id);
  const taken = { state: 'blocked', msg: `${x.taken} ${o.courier_name || '?'}` };
  if (st === 'cancelled' || st === 'failed') return { state: 'blocked', msg: x.closed };
  if (act === 'ready') return st === 'waiting' ? { state: 'todo' } : { state: 'done', msg: o.ready_by_name ? `${x.prep} ${o.ready_by_name}` : x.already };
  if (st === 'waiting') return { state: 'blocked', msg: x.notYet };
  if (st === 'delivered') return { state: 'done', msg: x.already };
  if (act === 'pickup') return free ? { state: 'todo' } : mine ? { state: 'done', msg: x.already } : taken;
  return free || mine ? { state: 'todo' } : taken;
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
  if (req.body.website) return res.json({ author: a, text: t, created_at: new Date().toISOString() }); // honeypot: only bots fill this hidden field
  if (isLimited('comment', req, 5, 3600e3)) return res.status(429).json({ error: 'Too many comments. Please try again later.' });
  if (!product_id || !a || !t) return res.status(400).json({ error: 'Missing fields' });
  record('comment', req);
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
  const b = req.body || {};
  if (b.website) return res.json({ ok: true, ref: 'FD-0000' }); // honeypot: only bots fill this hidden field
  if (isLimited('order', req, 5, 3600e3)) return res.status(429).json({ error: 'Too many orders from this connection. Please try again later or contact us on WhatsApp.' });
  const qty = Math.min(5, Math.max(1, parseInt(b.qty) || 1)), lang = ['fr', 'en', 'ar'].includes(b.lang) ? b.lang : 'fr';
  const prod = (await db.execute({ sql: 'SELECT * FROM products WHERE id=?', args: [clean(b.product_id, 80)] })).rows[0];
  if (!prod) return res.status(400).json({ error: 'Unknown product' });
  const city = (await db.execute({ sql: 'SELECT * FROM cities WHERE id=? AND active=1', args: [Number(b.city_id) || 0] })).rows[0];
  if (!city) return res.status(400).json({ error: 'Bad city' });
  const lat = Number(b.lat), lng = Number(b.lng);
  const hasLoc = b.lat != null && b.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const subtotal = unitPrice(prod) * qty, fee = deliveryFee(city, subtotal, await getFreeFrom());
  const o = {
    product_id: prod.id, product: prod['name_' + lang] || prod.name_en, qty, subtotal, delivery_fee: fee, total: subtotal + (fee || 0),
    name: clean(b.name, 100), cin: clean(b.cin, 30), phone: clean(b.phone, 30), email: clean(b.email, 100), address: clean(b.address, 200),
    city: city.name_ar ? `${city.name} (${city.name_ar})` : city.name, location_url: hasLoc ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` : '',
    lang, customer_id: custId(b.customer_id), created_at: new Date().toISOString()
  };
  if (!o.name) return res.status(400).json({ error: 'Missing fields' });
  if (!/^0\d{9}$/.test(o.phone)) return res.status(400).json({ error: 'Bad phone' });
  if (o.address.length < 6 && !o.location_url) return res.status(400).json({ error: 'Bad address' });
  if (o.email && !/^\S+@\S+\.\S+$/.test(o.email)) return res.status(400).json({ error: 'Bad email' });

  const ins = await db.execute({
    sql: 'INSERT INTO orders(product_id,product,qty,total,name,cin,phone,email,lang,created_at,customer_id,address,city,subtotal,delivery_fee,location_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [o.product_id, o.product, o.qty, o.total, o.name, o.cin, o.phone, o.email, o.lang, o.created_at, o.customer_id, o.address, o.city, o.subtotal, o.delivery_fee, o.location_url]
  });
  record('order', req);
  const id = Number(ins.lastInsertRowid), ref = refOf(id);
  sendTelegram(`🛍️ NOUVELLE COMMANDE ${ref}\n\n🆔 Client: ${o.customer_id || '-'}\n👤 Nom: ${o.name}\n🪪 CIN: ${o.cin || '⚠️ non fourni (à demander sur WhatsApp)'}\n📞 Tél: ${o.phone}\n🏙️ Ville: ${o.city}\n📍 Adresse: ${o.address || '-'}${o.location_url ? '\n🗺️ Position: ' + o.location_url : ''}\n✉️ Email: ${o.email || '-'}\n🌴 Produit: ${o.product}\n📦 Quantité: ${o.qty}\n🚚 Livraison: ${fee === null ? 'à confirmer' : fee === 0 ? 'gratuite' : fee + ' DH'}\n💰 Total: ${o.total} DH${fee === null ? ' + livraison' : ''}`);
  notifyWarehouse({ ...o, id }, baseUrl(req)).catch(e => console.error('Warehouse notify:', e));
  res.json({ ok: true, ref, total: o.total, fee });
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
  const WIN = 4 * 3600e3, MAX = 5, fails = recent('login:' + req.ip, WIN);
  if (fails.length >= MAX) return res.status(429).json({ error: `Too many wrong attempts. Try again in ${Math.ceil((WIN - (Date.now() - fails[0])) / 60000)} min.` });
  if ((req.body || {}).password !== ADMIN_PASSWORD) { record('login', req); return res.status(401).json({ error: `Wrong password (${MAX - fails.length - 1} attempts left)` }); }
  hits.delete('login:' + req.ip);
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
  const c = await actCtx(req.params.tok); if (!c) return res.status(404).json({ error: 'This link is no longer active.' });
  const { o, act, s, x } = c, st = actState(c);
  const lines = [[x.p, `${o.product} × ${o.qty}`]];
  if (act !== 'ready' && (st.state === 'todo' || Number(o.courier_id) === Number(s.id))) // client data only for the person who has the order
    { lines.push([x.c, o.name], [x.tel, o.phone, 'tel:' + o.phone], [x.ct, o.city || '-'], [x.to, o.address || '-', o.address ? mapsUrl(`${o.address}, ${o.city || ''}`) : '']);
    if (o.location_url) lines.push([x.loc, x.map, o.location_url]);
    lines.push([x.tot, o.total + ' DH']); }
  res.json({ ref: refOf(o.id), dir: s.lang === 'ar' ? 'rtl' : 'ltr', title: act === 'ready' ? x.wh : x.dl, lines, state: st.state, msg: st.msg || '', button: { ready: x.bReady, pickup: x.bPick, done: x.bDone }[act] });
});
app.post('/api/act/:tok', async (req, res) => {
  const c = await actCtx(req.params.tok); if (!c) return res.status(404).json({ error: 'This link is no longer active.' });
  const { o, act, s, x } = c, now = new Date().toISOString();
  // one atomic UPDATE: if two people tap at the same moment, only the first one wins
  const [sql, args] = {
    ready: ["UPDATE orders SET status='ready', ready_at=?, ready_by_name=? WHERE id=? AND status='waiting'", [now, s.name, o.id]],
    pickup: ["UPDATE orders SET status='delivering', picked_at=?, courier_id=?, courier_name=? WHERE id=? AND status IN ('ready','delivering') AND courier_id IS NULL", [now, s.id, s.name, o.id]],
    done: ["UPDATE orders SET status='delivered', delivered_at=?, courier_id=?, courier_name=? WHERE id=? AND status IN ('ready','delivering') AND (courier_id IS NULL OR courier_id=?)", [now, s.id, s.name, o.id, s.id]]
  }[act];
  const r = await db.execute({ sql, args });
  if (!r.rowsAffected) {
    const fresh = (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [o.id] })).rows[0];
    return res.status(409).json({ error: actState({ ...c, o: fresh }).msg || x.notYet });
  }
  await afterStatus(o.id, ACT[act].to, baseUrl(req));
  if (act !== 'done') for (const p of (await staffOf(s.role)).filter(p => p.id !== s.id)) // tell the others it is taken
    sendTelegram(`ℹ️ ${refOf(o.id)} — ${(TXT[p.lang] || TXT.fr)[act === 'ready' ? 'prep' : 'taken']} ${s.name}`, p.telegram_chat_id);
  const out = { ok: true, msg: x.ok };
  if (act === 'pickup') out.next = { button: x.bDone, url: `/act/${o.id}.done.${s.id}.${sign(o.id, 'done', s.id)}` };
  res.json(out);
});

// ===== TEAM (admin: add / edit / delete people, as many as needed per role) =====
const ROLES = ['warehouse', 'delivery'];
function staffBody(b) {
  const v = { role: b.role, name: clean(b.name, 60), lang: ['fr', 'en', 'ar'].includes(b.lang) ? b.lang : 'fr', tg: clean(b.telegram_chat_id, 20), email: clean(b.email, 100), active: b.active === false || b.active === 0 ? 0 : 1 };
  if (!ROLES.includes(v.role)) return { error: 'Bad role' };
  if (!v.name) return { error: 'Name is required' };
  if (!v.tg && !v.email) return { error: 'Add a Telegram chat ID or an email' };
  if (v.tg && !/^-?\d{5,15}$/.test(v.tg)) return { error: 'Telegram chat ID must be a number' };
  if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return { error: 'Invalid email' };
  return { v };
}
app.get('/api/admin/staff', auth, async (req, res) => res.json((await db.execute('SELECT * FROM team ORDER BY role, id')).rows));
app.post('/api/admin/staff', auth, async (req, res) => {
  const { v, error } = staffBody(req.body); if (error) return res.status(400).json({ error });
  const r = await db.execute({ sql: 'INSERT INTO team(role,name,lang,telegram_chat_id,email,active) VALUES(?,?,?,?,?,?)', args: [v.role, v.name, v.lang, v.tg, v.email, v.active] });
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/admin/staff/:id', auth, async (req, res) => {
  const { v, error } = staffBody(req.body); if (error) return res.status(400).json({ error });
  await db.execute({ sql: 'UPDATE team SET role=?,name=?,lang=?,telegram_chat_id=?,email=?,active=? WHERE id=?', args: [v.role, v.name, v.lang, v.tg, v.email, v.active, Number(req.params.id)] });
  res.json({ ok: true });
});
app.delete('/api/admin/staff/:id', auth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM team WHERE id=?', args: [Number(req.params.id)] });
  res.json({ ok: true });
});
app.post('/api/admin/staff/:id/test', auth, async (req, res) => {
  const s = (await db.execute({ sql: 'SELECT * FROM team WHERE id=?', args: [Number(req.params.id)] })).rows[0]; if (!s) return res.status(404).json({ error: 'Save first' });
  res.json(await notifyStaff(s, 'Filali Dates - test', (TXT[s.lang] || TXT.fr).test + ' — ' + s.name, []));
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
  const team = (await db.execute('SELECT * FROM team')).rows;
  for (const r of ROLES) if (!team.some(s => s.role === r && s.active)) add(false, r, 'no active person: add one in Admin → Team');
  for (const s of team) {
    const w = `${s.name} (${s.role})`;
    if (!s.telegram_chat_id) add(false, `${w}: Telegram`, 'no chat ID saved');
    else if (botId && s.telegram_chat_id === botId) add(false, `${w}: Telegram`, "this is the BOT's own ID. Use the person's ID from @userinfobot");
    if (!s.email) add(false, `${w}: email`, 'no email saved');
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

// ===== DELIVERY: cities, fees, free-delivery threshold =====
app.get('/api/delivery', async (req, res) => res.json({ free_from: await getFreeFrom(), cities: (await db.execute('SELECT id,name,name_ar,fee,eta FROM cities WHERE active=1 ORDER BY id')).rows }));
app.get('/api/admin/delivery', auth, async (req, res) => res.json({ free_from: await getFreeFrom(), cities: (await db.execute('SELECT * FROM cities ORDER BY id')).rows }));
app.put('/api/admin/delivery', auth, async (req, res) => {
  const n = Math.max(0, Number(req.body.free_from) || 0);
  await db.execute({ sql: "INSERT INTO settings(key,value) VALUES('free_from',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", args: [String(n)] });
  res.json({ ok: true });
});
function cityBody(b) {
  const name = clean(b.name, 60), name_ar = clean(b.name_ar, 60), eta = clean(b.eta, 60), active = b.active === false || b.active === 0 ? 0 : 1;
  const fee = b.fee === '' || b.fee == null ? null : Number(b.fee);
  if (!name) return { error: 'City name is required' };
  if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return { error: 'Fee must be a number (or empty)' };
  return { v: { name, name_ar, fee, eta, active } };
}
app.post('/api/admin/cities', auth, async (req, res) => {
  const { v, error } = cityBody(req.body); if (error) return res.status(400).json({ error });
  const r = await db.execute({ sql: 'INSERT INTO cities(name,name_ar,fee,eta,active) VALUES(?,?,?,?,?)', args: [v.name, v.name_ar, v.fee, v.eta, v.active] });
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/admin/cities/:id', auth, async (req, res) => {
  const { v, error } = cityBody(req.body); if (error) return res.status(400).json({ error });
  await db.execute({ sql: 'UPDATE cities SET name=?,name_ar=?,fee=?,eta=?,active=? WHERE id=?', args: [v.name, v.name_ar, v.fee, v.eta, v.active, Number(req.params.id)] });
  res.json({ ok: true });
});
app.delete('/api/admin/cities/:id', auth, async (req, res) => { await db.execute({ sql: 'DELETE FROM cities WHERE id=?', args: [Number(req.params.id)] }); res.json({ ok: true }); });

// ===== CSV EXPORT: 3 files (admin = everything, warehouse = what to prepare, delivery = where to deliver) =====
// builds the CSV text for one of the 3 files. Separator: comma (Excel English, Google Sheets, phones) or semicolon (Excel with French / Arabic regional settings)
async function buildExport(q) {
  const type = CSV_COLS[q.type] ? q.type : 'admin', sep = q.sep === ';' ? ';' : ',', where = [], args = [];
  if (STATUS.includes(q.status)) { where.push(q.status === 'waiting' ? "(status='waiting' OR status IS NULL)" : 'status=?'); if (q.status !== 'waiting') args.push(q.status); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.from || '')) { where.push('created_at>=?'); args.push(q.from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.to || '')) { where.push('created_at<?'); args.push(nextDay(q.to)); }
  const rows = (await db.execute({ sql: `SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, args })).rows;
  const cols = CSV_COLS[type];
  const lines = [cols.map(c => csvCell(c[0])).join(sep), ...rows.map(o => cols.map(c => c[2] ? csvText(c[1](o)) : csvCell(c[1](o))).join(sep))];
  return { type, count: rows.length, name: `orders-${type}-${new Date().toISOString().slice(0, 10)}.csv`, csv: '\uFEFF' + lines.join('\r\n') }; // BOM = Arabic / accents display correctly
}
app.get('/api/admin/export', auth, async (req, res) => {
  const x = await buildExport(req.query);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${x.name}"` });
  res.send(x.csv);
});
// who receives a file on Telegram: warehouse file -> warehouse team, delivery file -> delivery team, admin file -> you (+ a copy for you if asked)
async function exportTargets(type, copy, getTeam = staffOf, me = process.env.TELEGRAM_CHAT_ID) {
  const role = { warehouse: 'warehouse', delivery: 'delivery' }[type], targets = new Map();
  if (role) for (const s of await getTeam(role)) if (s.telegram_chat_id) targets.set(String(s.telegram_chat_id), s.name);
  if (me && (!role || copy)) targets.set(String(me), targets.get(String(me)) || 'You (admin)');
  return targets;
}
async function sendTelegramFile(chatId, name, text, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is missing in Render' };
  try {
    const fd = new FormData(); fd.append('chat_id', String(chatId)); fd.append('caption', caption); fd.append('document', new Blob([text], { type: 'text/csv' }), name);
    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: fd }), j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok !== false, error: r.ok && j.ok !== false ? '' : (j.description || 'HTTP ' + r.status) };
  } catch (e) { return { ok: false, error: e.message }; }
}
app.post('/api/admin/export/telegram', auth, async (req, res) => {
  const b = req.body || {}, x = await buildExport(b), targets = await exportTargets(x.type, !!b.copy);
  if (!targets.size) return res.status(400).json({ error: x.type === 'admin' ? 'TELEGRAM_CHAT_ID is missing in Render' : 'No Telegram chat ID found for this team. Add it in Admin → Team.' });
  const caption = `${{ admin: '📥 Admin file', warehouse: '📦 Warehouse file', delivery: '🚚 Delivery file' }[x.type]} — ${x.count} order(s) — ${x.name}`;
  const results = await Promise.all([...targets].map(async ([chat, name]) => ({ name, ...(await sendTelegramFile(chat, x.name, x.csv, caption)) })));
  res.json({ count: x.count, results });
});

// readable JSON errors (too big, bad JSON...) instead of an HTML page
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const big = err.type === 'entity.too.large';
  res.status(big ? 413 : (err.status || 500)).json({ error: big ? 'Request too large' : err.status === 400 ? 'Bad request' : 'Server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));