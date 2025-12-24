// scene.js - extracted from index.html
(function(){
  // --- Helpers and config ---
  // Use absolute public paths for production
  const IMAGE_PATH_PREFIX = '/images'; // prefer public/images
  const CANDIDATE_PATHS = [IMAGE_PATH_PREFIX, '/src/images', '/images', '/'];
  function resolveUrl(name){
    const urls = [];
    for(const p of CANDIDATE_PATHS){
      if(!p){ urls.push('/' + name); urls.push(name); }
      else {
        urls.push((p.endsWith('/')? p.slice(0,-1) : p) + '/' + name);
        urls.push((p.replace(/^\//,'')).replace(/\/$/,'') + '/' + name);
      }
    }
    return urls.filter((v,i,a)=>a.indexOf(v)===i);
  }

  function preloadImages(names){
    const promises = names.map(name => new Promise(resolve => {
      const urls = resolveUrl(name);
      let i = 0;
      function tryNext(){
        if(i >= urls.length){ console.warn('Image not found in any path:', name, urls); return resolve({name, url: null}); }
        const img = new Image();
        img.onload = () => resolve({name, url: urls[i]});
        img.onerror = () => { i++; tryNext(); };
        img.src = urls[i];
      }
      tryNext();
    }));
    return Promise.all(promises);
  }

  const imagesToPreload = ['1.png','2.png','3.png','4.png','5.png','6.png'];
  // if 5.png is missing, we will also try 5.jpg via resolveUrl fallback

  // --- Canvas snow with twinkle (optimized for mobile) ---
  const canvas = document.getElementById('snowCanvas');
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    W = canvas.width = Math.floor(innerWidth * dpr);
    H = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize);
  resize();

  function rand(min, max){ return Math.random() * (max - min) + min }
  const flakes = [];
  function createFlake(){
    return { x: rand(0, W), y: rand(-H, 0), r: rand(0.6, 3.6), d: rand(0.4, 1.9), vx: rand(-0.6, 0.6), a: rand(0.5,1), tw: rand(600,2800) };
  }

  (function initFlakes(){
    // detect touch/small screens and reduce density
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints>0);
    const baseDensity = isTouch || innerWidth < 640 ? 0.00035 : 0.0007;
    const DENSITY = baseDensity;
    const minFlakes = isTouch ? 80 : 150;
    const maxFlakes = isTouch ? 400 : 1000;
    const count = Math.max(minFlakes, Math.min(maxFlakes, Math.floor((innerWidth * innerHeight) * DENSITY)));
    for(let i = 0; i < count; i++) flakes.push(createFlake());
  })();

  let last = performance.now();
  function update(now){
    const dt = Math.min(40, now - last); last = now;
    ctx.clearRect(0,0,innerWidth,innerHeight);
    for(const f of flakes){
      const twPhase = (now % f.tw) / f.tw;
      const alpha = f.a * (0.68 + 0.32 * Math.sin(twPhase * Math.PI * 2));
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
      f.x += f.vx * (dt/16);
      f.y += f.d * (dt/16);
      if(f.y > innerHeight){ f.y = rand(-50, 0); f.x = rand(0, innerWidth); }
      if(f.x > innerWidth) f.x = 0;
      if(f.x < 0) f.x = innerWidth;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(update);
  }

  // Ambient audio using provided MP3 (tries user file name first, then a corrected spelling)
  // Use absolute sounds path
  let ambientAudio = new Audio('/sounds/wewishyoumerrychirstmas.mp3');
  ambientAudio.loop = true;
  ambientAudio.preload = 'auto';
  ambientAudio.volume = 0.65;
  // if user saved with different spelling, fallback to common variant on error
  ambientAudio.addEventListener('error', function onAudioError(){
    ambientAudio.removeEventListener('error', onAudioError);
    try{
      const alt = '/sounds/wewishyoumerrychristmas.mp3';
      const next = new Audio(alt);
      next.loop = true; next.preload = 'auto'; next.volume = ambientAudio.volume; next.muted = ambientAudio.muted;
      ambientAudio = next;
    }catch(e){ console.warn('Audio fallback failed', e); }
  });
  // restore muted preference
  if(localStorage.getItem('sleighMuted') === '1') ambientAudio.muted = true;

  // Try to autoplay on load; if blocked by browser, we'll start on first user gesture
  let ambientAutoStarted = false;
  function tryStartAudio(){
    if(ambientAutoStarted) return;
    ambientAutoStarted = true;
    ambientAudio.play().then(()=>{
      // playing
    }).catch(err=>{
      // autoplay blocked; wait for user interaction to start playback
      console.warn('Autoplay blocked, will start on user interaction', err);
    });
  }

  // Mute control helpers (used by UI)
  function setSleighMuted(m){
    ambientAudio.muted = m;
    localStorage.setItem('sleighMuted', m ? '1' : '0');
    updateAudioUI();
  }
  function updateAudioUI(){ const btn = document.getElementById('audioToggle'); if(!btn) return; btn.textContent = ambientAudio.muted ? '🔈' : '🔔'; btn.setAttribute('aria-pressed', String(!ambientAudio.muted)); }

  // Start attempt on DOMContentLoaded and on first click as fallback
  document.addEventListener('DOMContentLoaded', tryStartAudio);
  document.addEventListener('click', ()=>{ if(ambientAudio.paused) ambientAudio.play().catch(()=>{}); }, {once:true});

  // Defer animation start until assets preloaded
  preloadImages(imagesToPreload).then(() => {
    last = performance.now();
    requestAnimationFrame(update);
    // start other animations after preload
    initScene();
  });

  // --- Forest spawn with layers, parallax and sway ---
  function initScene(){
    const back = document.getElementById('forestBack');
    const front = document.getElementById('forestFront');
    back.innerHTML = '';
    front.innerHTML = '';

    const treeUrls = resolveUrl('1.png');
    const treeUrls2 = resolveUrl('2.png');

    const approxTreeWidth = 80;
    const countBack = Math.max(20, Math.ceil(innerWidth / approxTreeWidth));
    const countFront = Math.max(28, Math.ceil(innerWidth / approxTreeWidth) * 2);

    for(let i=0;i<countBack;i++){
      const img = document.createElement('img'); img.className = 'tree sway';
      img.src = treeUrls[i % treeUrls.length] || '';
      img.alt = 'tree';
      const scale = rand(0.6, 0.95);
      img.style.height = Math.round(innerHeight * (0.09 + Math.random() * 0.08) * scale) + 'px';
      img.style.left = Math.floor(i * (innerWidth / countBack) + rand(-40, 40)) + 'px';
      img.style.opacity = (0.45 + Math.random() * 0.4).toFixed(2);
      img.style.animationDuration = (6 + Math.random()*6) + 's';
      back.appendChild(img);
    }
    for(let i=0;i<countFront;i++){
      const img = document.createElement('img'); img.className = 'tree sway';
      img.src = (i % 2 === 0 ? (treeUrls2[0]||'') : (treeUrls[0]||'')); img.alt = 'tree';
      const scale = rand(0.9, 1.6);
      img.style.height = Math.round(innerHeight * (0.12 + Math.random() * 0.18) * scale) + 'px';
      img.style.left = Math.floor(i * (innerWidth / countFront) + rand(-40, 40)) + 'px';
      img.style.opacity = (0.65 + Math.random() * 0.35).toFixed(2);
      img.style.animationDuration = (5 + Math.random()*7) + 's';
      front.appendChild(img);
    }

    // parallax based on mouse movement
    window.addEventListener('mousemove', (ev)=>{
      const mx = (ev.clientX / innerWidth - 0.5) * 2; // -1..1
      back.style.transform = 'translateX(' + (-mx * 6) + 'px)';
      front.style.transform = 'translateX(' + (-mx * 14) + 'px)';
    });

    // mount audio control if missing
    if(!document.getElementById('audioControl')){
      const ctrl = document.createElement('div'); ctrl.id = 'audioControl'; ctrl.style.position = 'fixed'; ctrl.style.left = '12px'; ctrl.style.bottom = '12px'; ctrl.style.zIndex = '60';
      const btn = document.createElement('button'); btn.id = 'audioToggle'; btn.setAttribute('aria-label','Toggle sleigh sound'); btn.style.padding='8px 10px'; btn.style.borderRadius='8px'; btn.style.border='0'; btn.style.cursor='pointer'; btn.style.background='rgba(255,255,255,0.06)'; btn.style.color='#fff';
      btn.addEventListener('click', ()=>{ ambientAudio.muted = !ambientAudio.muted; setSleighMuted(ambientAudio.muted); if(!ambientAudio.muted) tryStartAudio(); });
      ctrl.appendChild(btn); document.body.appendChild(ctrl); updateAudioUI();
    }

    // start santa + moon + greeting after small delay
    mountMoonAndSanta();
  }

  // --- Moon, Santa, greeting and overlay logic ---
  function mountMoonAndSanta(){
    const existingMoon = document.getElementById('moon');
    const existingSanta = document.getElementById('santa');
    let moon = existingMoon, santa = existingSanta;
    if(!moon){ moon = document.createElement('img'); moon.id = 'moon'; moon.alt='moon'; document.body.appendChild(moon); }
    if(!santa){ santa = document.createElement('img'); santa.id = 'santa'; santa.alt='santa'; document.body.appendChild(santa); }
    preloadImages(['4.png']).then(list => { if(list[0] && list[0].url) moon.src = list[0].url; });
    preloadImages(['3.png']).then(list => { if(list[0] && list[0].url) santa.src = list[0].url; });

    const greetingWrap = document.getElementById('greetingWrap') || (function(){ const g=document.createElement('div'); g.id='greetingWrap'; document.body.appendChild(g); return g; })();

    function easeInOutQuad(t){ return t<0.5 ? 2*t*t : -1+(4-2*t)*t }
    let messageShown = false;
    const duration = 4200;
    let santaWidth = 140;

    function startAnimation(){
      const rectEstimate = santa.getBoundingClientRect();
      santaWidth = Math.max(rectEstimate.width || 140, 80);
      const startTime = performance.now();

      function frame(now){
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeInOutQuad(t);
        const x = -santaWidth + (innerWidth + santaWidth*2) * eased;
        const amplitude = Math.min(60, innerHeight * 0.05);
        const yOffset = Math.sin(eased * Math.PI * 2) * amplitude;
        santa.style.left = x + 'px'; santa.style.top = (innerHeight * 0.12 + yOffset) + 'px';
        const rot = Math.sin(eased * Math.PI * 2) * 8; santa.style.transform = 'rotate(' + rot + 'deg)';

        if(!messageShown && x + santaWidth/2 > innerWidth/2){ messageShown = true; setTimeout(showGreeting, 220); }
        if(t < 1) requestAnimationFrame(frame);
        else { setTimeout(()=>{ messageShown = false; setTimeout(()=> startAnimation(), 2200); }, 1200); }
      }
      requestAnimationFrame(frame);
    }

    function showGreeting(){
      if(document.getElementById('greeting')) return;
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(SVG_NS, 'svg'); svg.setAttribute('id','greeting');
      const fontSize = Math.round(Math.min(96, innerWidth * 0.07 + innerHeight * 0.01));
      svg.setAttribute('width', Math.min(1200, innerWidth * 0.9)); svg.setAttribute('height', fontSize * 1.4);

      // Prefer an SVG path asset if present (merry-path.svg), otherwise fallback to stroked text
      preloadImages(['merry-path.svg']).then(list=>{
        const asset = list[0] && list[0].url;
        if(asset){
          fetch(asset).then(r=>r.text()).then(str=>{
            const parser = new DOMParser(); const doc = parser.parseFromString(str, 'image/svg+xml');
            const path = doc.querySelector('path');
            if(path){ path.setAttribute('fill','none'); path.setAttribute('stroke','#fff'); path.setAttribute('stroke-width','1.6'); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round'); svg.appendChild(path.cloneNode(true)); greetingWrap.appendChild(svg); animateSVGPath(svg); showCelebrateButton(greetingWrap); return; }
            fallbackText();
          }).catch(()=> fallbackText());
        } else fallbackText();
      }).catch(()=> fallbackText());

      function fallbackText(){
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x','50%'); text.setAttribute('y','60%'); text.setAttribute('text-anchor','middle'); text.setAttribute('dominant-baseline','middle');
        text.setAttribute('font-family','cursive, "Segoe Script", "Brush Script MT", "Pacifico", sans-serif'); text.setAttribute('font-size', String(fontSize));
        text.setAttribute('fill','transparent'); text.setAttribute('stroke','#fff'); text.setAttribute('stroke-width','1.8'); text.setAttribute('stroke-linecap','round'); text.setAttribute('stroke-linejoin','round');
        text.textContent = 'Merry Christmas'; svg.appendChild(text); greetingWrap.appendChild(svg);
        // improved stroke animation
        try{
          const len = text.getComputedTextLength(); text.style.transition = 'stroke-dashoffset 900ms cubic-bezier(.22,.9,.21,1)';
          text.style.strokeDasharray = len; text.style.strokeDashoffset = len; void text.getBBox(); requestAnimationFrame(()=>{ text.style.strokeDashoffset = '0'; });
          setTimeout(()=>{ text.style.transition = 'fill 420ms ease, opacity 420ms ease'; text.setAttribute('fill','#fff'); showCelebrateButton(greetingWrap); }, 1100);
        }catch(e){ showCelebrateButton(greetingWrap); }
      }

      greetingWrap.style.opacity = '1';
      setTimeout(()=>{ greetingWrap.style.opacity = '0'; setTimeout(()=>greetingWrap.innerHTML = '', 900); }, 9000);
    }

    function animateSVGPath(svg){
      const path = svg.querySelector('path'); if(!path) return; const len = path.getTotalLength ? path.getTotalLength() : path.getAttribute('d').length;
      path.style.strokeDasharray = len; path.style.strokeDashoffset = len; path.style.transition = 'stroke-dashoffset 900ms cubic-bezier(.22,.9,.21,1)'; requestAnimationFrame(()=> path.style.strokeDashoffset = '0');
      setTimeout(()=>{ path.style.fill = '#fff'; }, 1100);
    }

    function showCelebrateButton(container){
      const btn = document.createElement('button'); btn.id = 'celebrateBtn'; btn.setAttribute('aria-label','Celebrate'); btn.textContent = 'Celebrate'; btn.addEventListener('click', onCelebrateClick); container.style.pointerEvents = 'auto'; container.appendChild(btn);
    }

    function onCelebrateClick(e){ const btn = e.currentTarget; btn.disabled = true; btn.style.cursor='default'; tryStartAudio(); morphToBiblePage(); }

    function morphToBiblePage(){
      const back = document.getElementById('forestBack'); const front = document.getElementById('forestFront'); const moonEl = document.getElementById('moon'); const santaEl = document.getElementById('santa');
      const overlayAnimTime = 1000;
      if(back) back.animate([{ transform: 'translateY(0) scale(1)', opacity: 1 },{ transform: 'translateY(30vh) scale(0.95)', opacity: 0 }], { duration: overlayAnimTime, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      if(front) front.animate([{ transform: 'translateY(0) scale(1)', opacity: 1 },{ transform: 'translateY(36vh) scale(0.9)', opacity: 0 }], { duration: overlayAnimTime, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      if(moonEl) moonEl.animate([{ transform: 'translateY(0) scale(1)', opacity: 1 },{ transform: 'translateY(-8vh) scale(0.6)', opacity: 0.4 }], { duration: overlayAnimTime, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      if(santaEl) santaEl.animate([{ transform: getComputedStyle(santaEl).transform || 'none', opacity: 1 },{ transform: 'translateX(' + (innerWidth * 0.7) + 'px) translateY(-40vh) rotate(-20deg)', opacity: 0 }], { duration: overlayAnimTime, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      canvas.animate([{ opacity: 1 }, { opacity: 0.09 }], { duration: overlayAnimTime, fill: 'forwards', easing: 'ease' });
      const greetingWrap = document.getElementById('greetingWrap'); if(greetingWrap) greetingWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' });
      setTimeout(showBiblePage, overlayAnimTime + 160);
    }

    function showBiblePage(){
      const verses = [
        'Luke 2:11 – “For unto you is born this day in the city of David a Savior, which is Christ the Lord.”',
        'Isaiah 9:6 – “For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder, and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.”',
        'Matthew 1:23 – “Behold, a virgin shall be with child, and shall bring forth a son, and they shall call his name Emmanuel, which being interpreted is, God with us.”',
        'John 1:14 – “And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.”',
        'Luke 2:14 – “Glory to God in the highest, and on earth peace, good will toward men.”'
      ];

      let idx = sessionStorage.getItem('christmasVerseIndex');
      if(idx === null){ idx = Math.floor(Math.random() * verses.length); sessionStorage.setItem('christmasVerseIndex', String(idx)); }
      else idx = parseInt(idx,10);

      const overlay = document.createElement('div'); overlay.id = 'bibleOverlay'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
      const bg = document.createElement('img'); bg.id = 'bibleBg'; preloadImages(['5.png']).then(list => { if(list[0] && list[0].url) bg.src = list[0].url; }); bg.alt='background'; overlay.appendChild(bg);

      const box = document.createElement('div'); box.id = 'scrollBox';
      const closeBtn = document.createElement('button'); closeBtn.className='closeBtn'; closeBtn.innerText='Close'; closeBtn.addEventListener('click', ()=>{ overlay.remove(); sessionStorage.removeItem('christmasVerseIndex'); }); box.appendChild(closeBtn);

      const angelL = document.createElement('img'); angelL.className='angel left'; angelL.alt='angel';
      const angelR = document.createElement('img'); angelR.className='angel right'; angelR.alt='angel';
      preloadImages(['6.png']).then(list => {
        const url = list[0] && list[0].url;
        if(url){ angelL.src = url; angelR.src = url; } else { angelL.style.display = 'none'; angelR.style.display = 'none'; console.warn('Angel image not found'); }
      });
      box.appendChild(angelL); box.appendChild(angelR);

      const title = document.createElement('h2'); title.textContent = 'A Christmas Reflection'; box.appendChild(title);
      const versePara = document.createElement('p'); versePara.id='versePara'; versePara.textContent = verses[idx]; box.appendChild(versePara);

      const newBtn = document.createElement('button'); newBtn.id='newVerseBtn'; newBtn.textContent='New verse'; newBtn.addEventListener('click', ()=>{
        const newIdx = Math.floor(Math.random() * verses.length); sessionStorage.setItem('christmasVerseIndex', String(newIdx)); document.getElementById('versePara').textContent = verses[newIdx];
        newBtn.classList.remove('popIn'); void newBtn.offsetWidth; newBtn.classList.add('popIn');
      });
      box.appendChild(newBtn);

      overlay.appendChild(box); document.body.appendChild(overlay);

      overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: 'forwards', easing: 'ease-out' });
      box.animate([{ transform: 'translateY(10px) scale(0.98)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 700, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)' });
      angelL.animate([{ transform: 'translateY(-6px) scale(0.8)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 700, delay: 180, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)'});
      angelR.animate([{ transform: 'translateY(-6px) scaleX(-0.8)', opacity: 0 }, { transform: 'translateY(0) scaleX(-1)', opacity: 1 }], { duration: 700, delay: 240, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)'});

      const keyHandler = (ev)=>{ if(ev.key === 'Escape'){ overlay.remove(); sessionStorage.removeItem('christmasVerseIndex'); window.removeEventListener('keydown', keyHandler); } };
      window.addEventListener('keydown', keyHandler);
      overlay.addEventListener('click', (ev)=>{ if(ev.target === overlay){ overlay.remove(); sessionStorage.removeItem('christmasVerseIndex'); window.removeEventListener('keydown', keyHandler); } });
    }

    // start after small delay to let images load
    setTimeout(()=>{ startAnimation(); }, 300);
  }

})();
