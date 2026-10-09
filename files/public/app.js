// ===== EDIT YOUR COMPANY + PRODUCTS HERE =====
const COMPANY = { name: 'Filali Dates', wa: '212600000000', phone: '+212 600 000 000', email: 'contact@filali-dates.ma', owner: 'Your Name',
  address: { fr: '12 Rue des Oliviers, Meknès, Maroc', en: '12 Olive Street, Meknes, Morocco', ar: 'شارع الزيتون 12، مكناس، المغرب' },
  social: { Facebook: 'https://facebook.com/', WhatsApp: 'https://wa.me/212600000000', Instagram: 'https://instagram.com/', TikTok: 'https://tiktok.com/' } };
let PRODUCTS = [];
const ready = fetch('/api/products').then(r => r.json()).then(rows => { PRODUCTS = rows.map(r => ({ id: r.id, price: r.price, old: r.old_price, until: r.until || '',
  imgs: r.images.length ? r.images : ['images/none.svg'], name: { fr: r.name_fr, en: r.name_en, ar: r.name_ar || r.name_en }, desc: { fr: r.desc_fr, en: r.desc_en, ar: r.desc_ar || r.desc_en } })); })
  .catch(() => document.addEventListener('DOMContentLoaded', () => document.body.insertAdjacentHTML('afterbegin',
    '<p style="background:#c0392b;color:#fff;padding:12px;margin:0;text-align:center">Cannot reach the server. Open http://localhost:3000 and restart it with npm start.</p><i id="pready"></i>')));
const I18N = {
  fr: { home: 'Accueil', contact: 'Contactez-nous', about: 'À propos', title: 'Nos fromages', qty: 'Quantité', add: 'Ajouter au panier', total: 'Total', until: "jusqu'au",
    comments: 'Commentaires', yourName: 'Votre nom', yourComment: 'Votre commentaire', send: 'Publier', checkout: 'Finaliser votre commande', fullName: 'Nom complet', cin: 'N° de carte (CIN)',
    phone: 'Téléphone', email: 'Email', confirm: 'Confirmer la commande', thanks: 'Merci pour votre commande ! Nous vous contacterons dès que possible.', aboutTitle: 'À propos de nous',
    aboutText: 'Nous fabriquons des fromages frais selon des recettes artisanales, avec du lait de la région.', owner: 'Propriétaire', address: 'Adresse', need: 'Remplissez le nom, la CIN et un téléphone ou email.', empty: 'Aucun commentaire. Soyez le premier !' },
  en: { home: 'Home', contact: 'Contact us', about: 'About us', title: 'Our cheeses', qty: 'Quantity', add: 'Add to cart', total: 'Total', until: 'until',
    comments: 'Comments', yourName: 'Your name', yourComment: 'Your comment', send: 'Post comment', checkout: 'Complete your order', fullName: 'Full name', cin: 'ID number (CIN)',
    phone: 'Phone', email: 'Email', confirm: 'Confirm order', thanks: 'Thank you for your order! We will contact you as soon as possible.', aboutTitle: 'About us',
    aboutText: 'We make fresh cheese from artisan recipes, using milk from our region.', owner: 'Owner', address: 'Address', need: 'Enter your name, ID and a phone or email.', empty: 'No comments yet. Be the first!' },
  ar: { home: 'الرئيسية', contact: 'اتصل بنا', about: 'من نحن', title: 'منتجاتنا من الأجبان', qty: 'الكمية', add: 'أضف إلى السلة', total: 'المجموع', until: 'حتى',
    comments: 'التعليقات', yourName: 'اسمك', yourComment: 'تعليقك', send: 'نشر', checkout: 'إتمام الطلب', fullName: 'الاسم الكامل', cin: 'رقم البطاقة الوطنية',
    phone: 'الهاتف', email: 'البريد الإلكتروني', confirm: 'تأكيد الطلب', thanks: 'شكرا على طلبك! سنتصل بك في أقرب وقت ممكن.', aboutTitle: 'من نحن',
    aboutText: 'نصنع أجبانا طازجة بوصفات تقليدية باستعمال حليب منطقتنا.', owner: 'المالك', address: 'العنوان', need: 'أدخل الاسم ورقم البطاقة والهاتف أو البريد الإلكتروني.', empty: 'لا توجد تعليقات بعد. كن أول من يعلّق!' }
};
Object.assign(I18N.fr, { title: 'Nos dattes', heroTitle: 'Les meilleures dattes du Tafilalet, livrées chez vous', heroSub: 'Récoltées dans les palmeraies du Tafilalet. Goût authentique, qualité sélectionnée.',
  shop: 'Découvrir nos dattes', b1: '🌴 Origine Tafilalet', b2: '✅ Qualité sélectionnée', b3: '🚚 Livraison rapide', save: 'Vous économisez', endsIn: "L'offre se termine dans", wa: '💬 Commander sur WhatsApp',
  trust: 'Nous vous contactons pour confirmer votre commande.', aboutText: 'Nous vendons les dattes du Tafilalet, cueillies dans les palmeraies de la région et soigneusement sélectionnées.' });
Object.assign(I18N.en, { title: 'Our dates', heroTitle: 'The finest Tafilalet dates, delivered to your door', heroSub: 'Grown in the palm groves of Tafilalet. Authentic taste, carefully selected quality.',
  shop: 'Shop our dates', b1: '🌴 Tafilalet origin', b2: '✅ Selected quality', b3: '🚚 Fast delivery', save: 'You save', endsIn: 'Offer ends in', wa: '💬 Order on WhatsApp',
  trust: 'We will contact you to confirm your order.', aboutText: 'We sell dates from Tafilalet, picked in the region\'s palm groves and carefully selected.' });
Object.assign(I18N.ar, { title: 'تمورنا', heroTitle: 'أجود تمور تافيلالت تصلك إلى باب بيتك', heroSub: 'من واحات تافيلالت. طعم أصيل وجودة منتقاة بعناية.',
  shop: 'اكتشف تمورنا', b1: '🌴 من تافيلالت', b2: '✅ جودة منتقاة', b3: '🚚 توصيل سريع', save: 'توفر', endsIn: 'ينتهي العرض خلال', wa: '💬 اطلب عبر واتساب',
  trust: 'سنتصل بك لتأكيد طلبك.', aboutText: 'نبيع تمور تافيلالت المقطوفة من واحات المنطقة والمنتقاة بعناية.' });
Object.assign(I18N.fr, { wTitle: 'Bienvenue chez Filali Dates', wLead: 'Une petite entreprise familiale qui vous offre le vrai goût des palmeraies du Tafilalet.',
  w1t: '100 % bio', w1: 'Des dattes cultivées naturellement et manipulées avec soin : pures, saines et sûres pour toute la famille.',
  w2t: 'Petite entreprise, grand soin', w2: 'Chaque boîte est choisie et préparée à la main, avec l\'attention que nous donnerions à notre propre famille.',
  w3t: 'Petites quantités, meilleure qualité', w3: 'Nous travaillons en petits lots pour garder toute la fraîcheur et la saveur. Quand un lot est terminé, il faut attendre le suivant.' });
Object.assign(I18N.en, { wTitle: 'Welcome to Filali Dates', wLead: 'A small family business bringing you the true taste of the Tafilalet palm groves.',
  w1t: '100% organic', w1: 'Naturally grown and carefully handled: pure, wholesome dates that are safe for the whole family.',
  w2t: 'Small business, personal care', w2: 'Every box is chosen and packed by hand, with the care we would give our own family.',
  w3t: 'Small quantities, better quality', w3: 'We work in small batches to keep every date fresh and full of flavor. When a batch is gone, you wait for the next one.' });
Object.assign(I18N.ar, { wTitle: 'مرحبا بكم في تمور فيلالي', wLead: 'مشروع عائلي صغير يقدم لكم الطعم الحقيقي لواحات تافيلالت.',
  w1t: 'بيو 100%', w1: 'تمور مزروعة بشكل طبيعي ومعتنى بها بدقة: نقية وصحية وآمنة لكل العائلة.',
  w2t: 'مشروع صغير بعناية كبيرة', w2: 'كل علبة تُختار وتُعبأ يدويا، بالعناية التي نمنحها لعائلتنا.',
  w3t: 'كميات قليلة وجودة أفضل', w3: 'نعمل بدفعات صغيرة لنحافظ على الطراوة والنكهة. وعندما تنفد الدفعة ننتظر الدفعة التالية.' });
Object.assign(I18N.fr, { limited: '🌴 Quantité limitée : petits lots' }); Object.assign(I18N.en, { limited: '🌴 Limited quantity: small batches' }); Object.assign(I18N.ar, { limited: '🌴 كمية محدودة: دفعات صغيرة' });
Object.assign(I18N.fr, { s1: 'Produit', s2: 'Vos informations', s3: 'Confirmation', buy: "Voir l'offre →", trust: '🔒 Aucun paiement en ligne maintenant. Nous vous contactons pour confirmer votre commande.' });
Object.assign(I18N.en, { s1: 'Product', s2: 'Your details', s3: 'Confirmation', buy: 'See offer →', trust: '🔒 No online payment now. We will contact you to confirm your order.' });
Object.assign(I18N.ar, { s1: 'المنتج', s2: 'معلوماتك', s3: 'التأكيد', buy: 'شاهد العرض ←', trust: '🔒 لا يوجد دفع إلكتروني الآن. سنتصل بك لتأكيد طلبك.' });
Object.assign(I18N.fr, { wTag: 'Palmeraies du Tafilalet · Maroc', badEmail: 'Adresse email invalide (ex. nom@gmail.com)', badPhone: 'Numéro invalide : 10 chiffres, ex. 0680719510', orderNo: 'Commande N°', custNo: 'Votre ID client :', fail: 'Une erreur est survenue. Réessayez ou contactez-nous sur WhatsApp.', ref: 'Réf.' });
Object.assign(I18N.en, { wTag: 'Tafilalet palm groves · Morocco', badEmail: 'Invalid email address (e.g. name@gmail.com)', badPhone: 'Invalid number: 10 digits, e.g. 0680719510', orderNo: 'Order No.', custNo: 'Your customer ID:', fail: 'Something went wrong. Please try again or contact us on WhatsApp.', ref: 'Ref.' });
Object.assign(I18N.ar, { wTag: 'واحات تافيلالت · المغرب', badEmail: 'بريد إلكتروني غير صالح (مثال: name@gmail.com)', badPhone: 'رقم غير صالح: 10 أرقام، مثال 0680719510', orderNo: 'رقم الطلب', custNo: 'رقم العميل:', fail: 'حدث خطأ. حاول مرة أخرى أو تواصل معنا عبر واتساب.', ref: 'المرجع' });
let lang = localStorage.getItem('lang'); if (!I18N[lang]) lang = 'fr';
const t = (k) => I18N[lang][k] || k, $ = (s) => document.querySelector(s);
const dh = (n) => lang === 'ar' ? `${n} درهم` : `${n} DH`;

function layout() {
  $('#header').innerHTML = `<a class="brand" href="index.html"><img src="images/logo.png" alt="" onerror="this.style.visibility='hidden'"><span>${COMPANY.name}</span></a>
  <nav><a href="index.html" data-i="home"></a><button id="cBtn" data-i="contact"></button><a href="about.html" data-i="about"></a>
  <button class="lang" data-l="fr">Fr</button><button class="lang" data-l="en">Eng</button><button class="lang" data-l="ar">عربي</button></nav>`;
  $('#footer').innerHTML = `<div>📞 <bdi dir="ltr">${COMPANY.phone}</bdi><br>✉️ <bdi dir="ltr">${COMPANY.email}</bdi></div><div class="c" id="addr"></div>
  <div class="r"><img src="images/logo.png" alt="" onerror="this.style.visibility='hidden'"><strong>${COMPANY.name}</strong></div>
  <div class="soc">${Object.entries(COMPANY.social).map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>`;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="cModal"><div><button class="x" onclick="this.closest('.modal').classList.remove('show')">×</button>
  <h3 data-i="contact"></h3><p>📞 <bdi dir="ltr">${COMPANY.phone}</bdi></p><p>✉️ <bdi dir="ltr">${COMPANY.email}</bdi></p></div></div>`);
  $('#cBtn').onclick = () => $('#cModal').classList.add('show');
  document.title = COMPANY.name;
  document.body.insertAdjacentHTML('beforeend', `<a class="wa-float" href="https://wa.me/${COMPANY.wa}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>`);
  document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { lang = b.dataset.l; localStorage.setItem('lang', lang); applyLang(); });
  applyLang();
}
function applyLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i]').forEach(e => e.textContent = t(e.dataset.i));
  document.querySelectorAll('[data-ph]').forEach(e => e.placeholder = t(e.dataset.ph));
  document.querySelectorAll('[data-l]').forEach(b => b.classList.toggle('on', b.dataset.l === lang));
  $('#addr').textContent = '📍 ' + COMPANY.address[lang];
  if (window.onLang) window.onLang();
}
const promoText = (p) => p.old ? `<span class="old">${dh(p.old)}</span><span class="badge"><bdi dir="ltr">-${pct(p)}%</bdi></span><br><span class="until">${t('until')} <bdi dir="ltr">${p.until.split('-').reverse().join('/')}</bdi></span>` : '';
const isPromo = (p) => p.old && new Date() <= new Date(p.until + 'T23:59:59');
const unit = (p) => isPromo(p) ? p.price : (p.old || p.price);
document.addEventListener('DOMContentLoaded', () => ready.then(layout));
window.addEventListener('scroll', () => { const h = $('#header'); if (h) { if (scrollY > 60) h.classList.add('small'); else if (scrollY < 20) h.classList.remove('small'); }; });
const pct = (p) => isPromo(p) ? Math.round((1 - p.price / p.old) * 100) : 0;

// anonymous customer ID: same ID on this browser's comments and orders
const cid = () => { let c = localStorage.getItem('cid'); if (!c) { c = 'C-' + Math.random().toString(36).slice(2, 8).toUpperCase(); localStorage.setItem('cid', c); } return c; };
