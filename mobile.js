// Safari ve Chrome ana ekran uygulamalarında klavyenin yazma alanını örtmesini önler.
(() => {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const chatInput = document.getElementById('chatInput');
  let frame = null;
  let baseHeight = window.innerHeight;
  let baseWidth = window.innerWidth;

  function updateViewport(){
    frame = null;
    if(Math.abs(window.innerWidth - baseWidth) > 80){
      baseWidth = window.innerWidth;
      baseHeight = window.innerHeight;
    }
    const height = viewport?.height || window.innerHeight;
    const offset = viewport?.offsetTop || 0;
    const editing = document.activeElement?.matches('input:not([type="file"]), textarea');
    if(!editing) baseHeight = Math.max(baseHeight, window.innerHeight);
    // Odak kalktıktan sonra klavye kapanış animasyonu bitene kadar alanı koru.
    const hadKeyboard = document.body.classList.contains('keyboard-open');
    const keyboardOpen = Boolean((editing || hadKeyboard) && baseHeight - height > 120 && (!viewport || viewport.scale < 1.05));
    const inset = keyboardOpen ? Math.max(0, window.innerHeight - height - offset) : 0;
    root.style.setProperty('--viewport-height', `${Math.round(height)}px`);
    root.style.setProperty('--viewport-offset', `${Math.round(offset)}px`);
    root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
    document.body.classList.toggle('keyboard-open', keyboardOpen);
  }

  function scheduleViewport(){
    if(frame === null) frame = requestAnimationFrame(updateViewport);
  }

  function updateRoute(){
    const activePage = document.querySelector('.tab-page.active');
    // switchTab sayfayı bir sonraki karede açar; aradaki boşlukta hedef düğme geçerlidir.
    const activeButton = document.querySelector('.tab-btn.active');
    document.body.dataset.currentTab = activePage?.dataset.page || activeButton?.dataset.tab || 'home';
    document.querySelectorAll('.tab-btn').forEach(button => {
      const active = button.dataset.tab === document.body.dataset.currentTab;
      if(active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const settings=document.querySelector('.settings-shortcut');
    if(settings){
      if(document.body.dataset.currentTab==='settings')settings.setAttribute('aria-current','page');
      else settings.removeAttribute('aria-current');
    }
    scheduleViewport();
  }

  if(viewport){
    viewport.addEventListener('resize', scheduleViewport, { passive: true });
    viewport.addEventListener('scroll', scheduleViewport, { passive: true });
  }
  window.addEventListener('resize', scheduleViewport, { passive: true });
  window.addEventListener('pageshow', scheduleViewport);
  document.addEventListener('focusin', scheduleViewport);
  document.addEventListener('focusout', scheduleViewport);
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden) scheduleViewport();
  });
  document.querySelectorAll('.tab-page').forEach(page => {
    new MutationObserver(updateRoute).observe(page, { attributes: true, attributeFilter: ['class'] });
  });

  // Renk değişince Safari/Chrome araç alanını da uygulamayla aynı renkte tut.
  function syncThemeColor(){
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if(themeColor) themeColor.content = root.dataset.theme === 'dark' ? '#1c191b' : '#fbf6f2';
  }
  new MutationObserver(syncThemeColor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  syncThemeColor();
  updateRoute();
  if(chatInput) chatInput.setAttribute('enterkeyhint', 'send');
})();
