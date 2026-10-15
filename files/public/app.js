// ===== EDIT YOUR COMPANY + PRODUCTS HERE =====
const COMPANY = { name: 'Filali Dates', wa: '212696171655', phone: '+212 696 171 655', email: 'contact@filali-dates.ma', owner: 'Your Name',
  address: { fr: '12 Rue des Oliviers, Meknès, Maroc', en: '12 Olive Street, Meknes, Morocco', ar: 'شارع الزيتون 12، مكناس، المغرب' },
  social: { WhatsApp: 'https://wa.me/212696171655' } }; // add Facebook / Instagram / TikTok links here when the accounts exist
let PRODUCTS = [], LOAD_FAILED = false;
const ready = fetch('/api/products').then(r => { if (!r.ok) throw 0; return r.json(); }).then(rows => { PRODUCTS = rows.map(r => ({ id: r.id, price: r.price, old: r.old_price, until: r.until || '',
  imgs: r.images.length ? r.images : ['images/none.svg'], name: { fr: r.name_fr, en: r.name_en, ar: r.name_ar || r.name_en }, desc: { fr: r.desc_fr, en: r.desc_en, ar: r.desc_ar || r.desc_en } })); })
  
  .catch(() => { // friendly error is shown by the waiting screen (see hideLoader)
    LOAD_FAILED = true;
    const mark = () => document.body.insertAdjacentHTML('beforeend', '<i id="pready"></i>');
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mark) : mark();
  });
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
Object.assign(I18N.fr, { addrLbl: 'Adresse de livraison (ville, quartier, rue)', badAddr: 'Adresse trop courte : ajoutez la ville, le quartier et la rue.', need: 'Remplissez le nom complet et la CIN.' });
Object.assign(I18N.en, { addrLbl: 'Delivery address (city, area, street)', badAddr: 'Address too short: add the city, area and street.', need: 'Enter your full name and ID number.' });
Object.assign(I18N.ar, { addrLbl: 'عنوان التسليم (المدينة، الحي، الشارع)', badAddr: 'العنوان قصير: أضف المدينة والحي والشارع.', need: 'أدخل الاسم الكامل ورقم البطاقة.' });
Object.assign(I18N.fr, { loading: 'Nous préparons vos dattes', slow: 'Le serveur se réveille, encore quelques secondes…', loadFail: 'Problème de connexion. Vérifiez votre internet puis réessayez.', retry: 'Réessayer',
  boxNote: 'Vendu en boîte de 2 kg', prepInfo: 'Préparation de votre commande : 1 jour (2 jours maximum). Le délai et les frais de livraison dépendent de votre ville.',
  cinLbl: 'N° de carte (CIN) — facultatif', cinNote: 'Facultatif. Si vous ne le saisissez pas maintenant, envoyez-le-nous sur WhatsApp après la commande.',
  cinAfter: 'Pensez à nous envoyer votre numéro de carte (CIN) sur WhatsApp pour finaliser la commande.', cinWa: '💬 Envoyer mon CIN sur WhatsApp', cinMsg: 'Bonjour, voici mon numéro de carte (CIN) pour la commande',
  need: 'Entrez votre nom complet.', cityLbl: 'Ville', cityPick: 'Choisissez votre ville', badCity: 'Veuillez choisir votre ville.', etaLbl: 'Délai de livraison estimé',
  subLbl: 'Produits', feeLbl: 'Livraison', totLbl: 'Total', feeFree: 'Gratuite', feeTbd: 'à confirmer sur WhatsApp', plusFee: '+ frais de livraison', freeFrom: 'Livraison gratuite à partir de',
  locBtn: '📍 Utiliser ma position', locOk: 'Position ajoutée', locDenied: "Position non partagée. Saisissez votre adresse à la place.", locNo: "La géolocalisation n'est pas disponible sur cet appareil.",
  addrLbl: 'Adresse de livraison (quartier, rue, repère)', badAddr: 'Ajoutez votre adresse (quartier, rue) ou partagez votre position.' });
Object.assign(I18N.en, { loading: 'Preparing your dates', slow: 'The server is waking up, just a few more seconds…', loadFail: 'Connection problem. Check your internet and try again.', retry: 'Try again',
  boxNote: 'Sold in boxes of 2 kg', prepInfo: 'Your order is prepared within 1 day (2 days maximum). Delivery time and fees depend on your city.',
  cinLbl: 'ID number (CIN) — optional', cinNote: 'Optional. If you leave it empty, please send it to us on WhatsApp after ordering.',
  cinAfter: 'Please send us your ID number (CIN) on WhatsApp to complete your order.', cinWa: '💬 Send my ID on WhatsApp', cinMsg: 'Hello, here is my ID number (CIN) for order',
  need: 'Enter your full name.', cityLbl: 'City', cityPick: 'Choose your city', badCity: 'Please choose your city.', etaLbl: 'Estimated delivery time',
  subLbl: 'Products', feeLbl: 'Delivery', totLbl: 'Total', feeFree: 'Free', feeTbd: 'to be confirmed on WhatsApp', plusFee: '+ delivery fee', freeFrom: 'Free delivery from',
  locBtn: '📍 Use my current location', locOk: 'Location added', locDenied: 'Location not shared. Please type your address instead.', locNo: 'Location is not available on this device.',
  addrLbl: 'Delivery address (area, street, landmark)', badAddr: 'Add your address (area, street) or share your location.' });
Object.assign(I18N.ar, { loading: 'نحضّر لكم التمور', slow: 'الخادم يستيقظ، بضع ثوان فقط…', loadFail: 'مشكل في الاتصال. تحقق من الإنترنت وأعد المحاولة.', retry: 'إعادة المحاولة',
  boxNote: 'يُباع في علب وزن 2 كغ', prepInfo: 'يتم تحضير طلبك في يوم واحد (يومين كحد أقصى). مدة التوصيل وثمنه يختلفان حسب مدينتك.',
  cinLbl: 'رقم البطاقة الوطنية — اختياري', cinNote: 'اختياري. إذا لم تدخله الآن، المرجو إرساله إلينا عبر واتساب بعد الطلب.',
  cinAfter: 'المرجو إرسال رقم بطاقتك الوطنية إلينا عبر واتساب لإتمام الطلب.', cinWa: '💬 إرسال رقم البطاقة عبر واتساب', cinMsg: 'مرحبا، هذا رقم بطاقتي الوطنية للطلب',
  need: 'أدخل الاسم الكامل.', cityLbl: 'المدينة', cityPick: 'اختر مدينتك', badCity: 'المرجو اختيار المدينة.', etaLbl: 'مدة التوصيل المتوقعة',
  subLbl: 'المنتجات', feeLbl: 'التوصيل', totLbl: 'المجموع', feeFree: 'مجاني', feeTbd: 'سيتم تأكيده عبر واتساب', plusFee: '+ ثمن التوصيل', freeFrom: 'توصيل مجاني ابتداء من',
  locBtn: '📍 استعمال موقعي الحالي', locOk: 'تمت إضافة الموقع', locDenied: 'لم تتم مشاركة الموقع. المرجو كتابة العنوان.', locNo: 'خدمة الموقع غير متوفرة على هذا الجهاز.',
  addrLbl: 'عنوان التسليم (الحي، الشارع، علامة مميزة)', badAddr: 'أضف عنوانك (الحي، الشارع) أو شارك موقعك.' });
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
document.addEventListener('DOMContentLoaded', () => ready.then(layout).finally(hideLoader));
window.addEventListener('scroll', () => { const h = $('#header'); if (h) { if (scrollY > 60) h.classList.add('small'); else if (scrollY < 20) h.classList.remove('small'); }; });
const pct = (p) => isPromo(p) ? Math.round((1 - p.price / p.old) * 100) : 0;

// anonymous customer ID: same ID on this browser's comments and orders
const cid = () => { let c = localStorage.getItem('cid'); if (!c) { c = 'C-' + Math.random().toString(36).slice(2, 8).toUpperCase(); localStorage.setItem('cid', c); } return c; };

// ===== waiting screen (palm tree + falling dates). Appears only if loading takes more than 0.4 s =====
const LOADER_SVG = `<svg class="ld-svg" viewBox="0 0 160 190" aria-hidden="true">
  <path d="M42 168 Q80 196 118 168 Z" fill="#c98a12"/><path d="M42 168 Q80 180 118 168" fill="none" stroke="#f6d27a" stroke-width="4" stroke-linecap="round"/>
  <path d="M80 150 C76 124 84 96 80 64" stroke="#7a4a21" stroke-width="9" fill="none" stroke-linecap="round"/>
  <g class="fronds" stroke="#3f7d3a" stroke-width="6" fill="none" stroke-linecap="round"><path d="M80 64 Q50 40 16 58"/><path d="M80 64 Q56 30 30 24"/><path d="M80 64 Q80 28 80 12"/><path d="M80 64 Q104 30 130 24"/><path d="M80 64 Q110 40 144 58"/></g>
  <g fill="#6b3a12"><ellipse cx="72" cy="72" rx="4.5" ry="7"/><ellipse cx="80" cy="76" rx="4.5" ry="7"/><ellipse cx="88" cy="72" rx="4.5" ry="7"/></g>
  <ellipse class="dt d1" cx="64" cy="70" rx="5" ry="8" fill="#6b3a12"/><ellipse class="dt d2" cx="82" cy="70" rx="5" ry="8" fill="#8a4b17"/><ellipse class="dt d3" cx="98" cy="70" rx="5" ry="8" fill="#6b3a12"/></svg>`;
let ldEl = null, ldTimer = 0, ldSlow = 0;
function mkLoader() {
  if (ldEl) return;
  ldEl = document.createElement('div'); ldEl.className = 'ld';
  ldEl.innerHTML = `${LOADER_SVG}<p class="ld-t">${t('loading')}<span class="dots"></span></p><p class="ld-s"></p>`;
  document.body.appendChild(ldEl);
  ldSlow = setTimeout(() => { const s = ldEl && ldEl.querySelector('.ld-s'); if (s) s.textContent = t('slow'); }, 8000);
}
function showLoader() { ldTimer = setTimeout(mkLoader, 400); }
function hideLoader() {
  clearTimeout(ldTimer); clearTimeout(ldSlow);
  if (LOAD_FAILED) { mkLoader(); clearTimeout(ldSlow); ldEl.innerHTML = `<p class="ld-t">⚠️ ${t('loadFail')}</p><button class="cta ld-btn" onclick="location.reload()">${t('retry')}</button>`; return; }
  if (!ldEl) return;
  const el = ldEl; ldEl = null; el.classList.add('out'); setTimeout(() => el.remove(), 400);
}
showLoader();
