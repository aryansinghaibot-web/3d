/* ==========================================================================
   FAMOUS SWEETS & BAKERS — 3D WALKTHROUGH ENGINE & APPLICATION CONTROLLER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Configuration & Constants
  const TOTAL_FRAMES = 192;
  const FRAME_PREFIX = 'video_frames/frame_';
  const FRAME_EXT = '.jpg';

  let images = new Array(TOTAL_FRAMES + 1);
  let loadedCount = 0;
  let currentFrame = 1;
  let targetFrame = 1;
  let isAutoPlaying = false;
  let playSpeed = 1;
  let autoPlayRaf = null;

  // 2. DOM Elements
  const tourTrack = document.getElementById('tourTrack');
  const canvas = document.getElementById('walkthroughCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const siteHeader = document.getElementById('siteHeader');

  // Preloader elements
  const loaderOverlay = document.getElementById('loaderOverlay');
  const loaderFill = document.getElementById('loaderFill');
  const loaderPercent = document.getElementById('loaderPercent');
  const loaderCount = document.getElementById('loaderCount');
  const scrollCue = document.getElementById('scrollCue');

  // Story stage overlays
  const storyStages = document.querySelectorAll('.story-stage');

  // HUD elements
  const hudPlayBtn = document.getElementById('hudPlayBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playBtnText = document.getElementById('playBtnText');
  const hudFrameIndicator = document.getElementById('hudFrameIndicator');
  const timelineTrack = document.getElementById('timelineTrack');
  const timelineFill = document.getElementById('timelineFill');
  const timelineThumb = document.getElementById('timelineThumb');
  const speedToggleBtn = document.getElementById('speedToggleBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const chapterDots = document.querySelectorAll('.chapter-dot');

  // Menu filtering
  const menuFilters = document.getElementById('menuFilters');
  const menuCards = document.querySelectorAll('.menu-item-card');

  // Cart system
  const openCartBtn = document.getElementById('openCartBtn');
  const closeCartBtn = document.getElementById('closeCartBtn');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartItemList = document.getElementById('cartItemList');
  const emptyCart = document.getElementById('emptyCart');
  const cartFooter = document.getElementById('cartFooter');
  const cartCountEl = document.getElementById('cartCount');
  const cartTotalDisplay = document.getElementById('cartTotalDisplay');
  const proceedCheckoutBtn = document.getElementById('proceedCheckoutBtn');

  // Booking & Modals
  const bookTableBtn = document.getElementById('bookTableBtn');
  const bookingModal = document.getElementById('bookingModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalForm = document.getElementById('modalForm');
  const mainBookingForm = document.getElementById('mainBookingForm');
  const toastNotice = document.getElementById('toastNotice');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');

  // Cart Data State
  let cart = [];

  // Helper: Format frame filename: 1 -> "video_frames/frame_000001.jpg"
  function getFrameSrc(index) {
    const pad = String(index).padStart(6, '0');
    return `${FRAME_PREFIX}${pad}${FRAME_EXT}`;
  }

  // 3. Canvas Resizing with High-DPI handling
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    renderFrame(Math.round(currentFrame));
  }

  // 4. Draw Frame with 'Cover' scaling
  function renderFrame(frameIndex) {
    const img = images[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let rw, rh, ox, oy;

    if (canvasRatio > imgRatio) {
      rw = cw;
      rh = cw / imgRatio;
      ox = 0;
      oy = (ch - rh) / 2;
    } else {
      rw = ch * imgRatio;
      rh = ch;
      ox = (cw - rw) / 2;
      oy = 0;
    }

    ctx.drawImage(img, ox, oy, rw, rh);
  }

  // 5. Preloading Pipeline
  function initPreloader() {
    // Phase 1: Load Frame 1 immediately
    const firstImg = new Image();
    firstImg.src = getFrameSrc(1);
    firstImg.onload = () => {
      images[1] = firstImg;
      loadedCount++;
      renderFrame(1);
      updateLoader();

      // Phase 2: Load key milestone frames first (every 8th frame for quick tour responsiveness)
      const priorityFrames = [];
      for (let i = 8; i <= TOTAL_FRAMES; i += 8) priorityFrames.push(i);

      let pIdx = 0;
      function loadNextPriority() {
        if (pIdx < priorityFrames.length) {
          const f = priorityFrames[pIdx++];
          const img = new Image();
          img.src = getFrameSrc(f);
          img.onload = () => { images[f] = img; loadedCount++; updateLoader(); loadNextPriority(); };
          img.onerror = () => { loadedCount++; updateLoader(); loadNextPriority(); };
        } else {
          // Phase 3: Stream all remaining frames
          for (let i = 2; i <= TOTAL_FRAMES; i++) {
            if (images[i]) continue;
            const img = new Image();
            img.src = getFrameSrc(i);
            img.onload = () => { images[i] = img; loadedCount++; updateLoader(); };
            img.onerror = () => { loadedCount++; updateLoader(); };
          }
        }
      }
      loadNextPriority();
    };
  }

  function updateLoader() {
    const pct = Math.min(Math.round((loadedCount / TOTAL_FRAMES) * 100), 100);
    if (loaderFill) loaderFill.style.width = `${pct}%`;
    if (loaderPercent) loaderPercent.textContent = `${pct}%`;
    if (loaderCount) loaderCount.textContent = `${loadedCount} / ${TOTAL_FRAMES} Frames`;

    // Unlock interactive viewport as soon as 16 frames have loaded
    if (loadedCount >= 16 && !loaderOverlay.classList.contains('hidden')) {
      loaderOverlay.classList.add('hidden');
    }
  }

  // 6. Scroll Scrubbing Controller
  function onScroll() {
    // Header shadow on scroll
    if (window.scrollY > 40) {
      siteHeader.classList.add('scrolled');
    } else {
      siteHeader.classList.remove('scrolled');
    }

    if (isAutoPlaying) return; // Allow user scroll or auto play

    const rect = tourTrack.getBoundingClientRect();
    const scrollDistance = tourTrack.offsetHeight - window.innerHeight;

    if (scrollDistance <= 0) return;

    // Progress from 0 (top of section) to 1 (passed section)
    const progress = Math.min(Math.max(-rect.top / scrollDistance, 0), 1);
    targetFrame = Math.round(progress * (TOTAL_FRAMES - 1)) + 1;

    // Fade scroll cue after initial interaction
    if (progress > 0.02 && scrollCue) {
      scrollCue.classList.add('faded');
    } else if (progress <= 0.02 && scrollCue) {
      scrollCue.classList.remove('faded');
    }

    // Synchronize Story Overlay Stages
    updateStoryStages(progress);
  }

  function updateStoryStages(progress) {
    storyStages.forEach(stage => {
      const range = stage.getAttribute('data-range').split(',').map(Number);
      if (progress >= range[0] && progress <= range[1]) {
        stage.classList.add('active');
      } else {
        stage.classList.remove('active');
      }
    });
  }

  // 7. Render Loop with Smooth Lerping
  function animationLoop() {
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.02) {
      currentFrame += diff * 0.18; // Silky lerp
      const frameIdx = Math.min(Math.max(Math.round(currentFrame), 1), TOTAL_FRAMES);
      renderFrame(frameIdx);

      // Update HUD
      const pct = ((frameIdx - 1) / (TOTAL_FRAMES - 1)) * 100;
      if (timelineFill) timelineFill.style.width = `${pct}%`;
      if (timelineThumb) timelineThumb.style.left = `${pct}%`;
      if (hudFrameIndicator) {
        hudFrameIndicator.textContent = `Frame ${String(frameIdx).padStart(3, '0')} / ${TOTAL_FRAMES}`;
      }
    }

    requestAnimationFrame(animationLoop);
  }

  // 8. Auto Play Tour Feature
  function toggleAutoPlay() {
    isAutoPlaying = !isAutoPlaying;

    if (isAutoPlaying) {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      playBtnText.textContent = 'Pause';
      autoPlayStep();
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      playBtnText.textContent = 'Play Tour';
      if (autoPlayRaf) cancelAnimationFrame(autoPlayRaf);
    }
  }

  function autoPlayStep() {
    if (!isAutoPlaying) return;

    targetFrame += 0.5 * playSpeed;
    if (targetFrame > TOTAL_FRAMES) {
      targetFrame = 1;
      currentFrame = 1;
    }

    // Scroll page along with tour
    const scrollDistance = tourTrack.offsetHeight - window.innerHeight;
    const progress = (targetFrame - 1) / (TOTAL_FRAMES - 1);
    const targetScrollY = tourTrack.offsetTop + (progress * scrollDistance);

    window.scrollTo({
      top: targetScrollY,
      behavior: 'auto'
    });

    updateStoryStages(progress);
    autoPlayRaf = requestAnimationFrame(autoPlayStep);
  }

  // HUD Speed Toggle
  if (speedToggleBtn) {
    speedToggleBtn.addEventListener('click', () => {
      playSpeed = playSpeed === 1 ? 2 : 1;
      speedToggleBtn.textContent = `${playSpeed}x Speed`;
    });
  }

  // HUD Fullscreen Toggle
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        tourTrack.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // HUD Timeline Click / Jump
  if (timelineTrack) {
    timelineTrack.addEventListener('click', (e) => {
      const rect = timelineTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const progress = Math.min(Math.max(clickX / rect.width, 0), 1);
      jumpToProgress(progress);
    });
  }

  // Chapter Notches Click
  chapterDots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetF = parseInt(dot.getAttribute('data-frame'), 10);
      const progress = (targetF - 1) / (TOTAL_FRAMES - 1);
      jumpToProgress(progress);
    });
  });

  // Footer / General Chapter Jumps
  document.querySelectorAll('.jump-tour').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetF = parseInt(link.getAttribute('data-frame'), 10);
      const progress = (targetF - 1) / (TOTAL_FRAMES - 1);
      jumpToProgress(progress);
    });
  });

  function jumpToProgress(progress) {
    const scrollDistance = tourTrack.offsetHeight - window.innerHeight;
    const targetScrollY = tourTrack.offsetTop + (progress * scrollDistance);
    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth'
    });
  }

  if (hudPlayBtn) hudPlayBtn.addEventListener('click', toggleAutoPlay);

  // 9. Menu Filter Controller
  if (menuFilters) {
    menuFilters.addEventListener('click', (e) => {
      if (!e.target.classList.contains('filter-btn')) return;

      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      const cat = e.target.getAttribute('data-category');
      menuCards.forEach(card => {
        const itemCat = card.getAttribute('data-cat');
        if (cat === 'all' || itemCat === cat) {
          card.style.display = 'flex';
          setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 50);
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // Experience Card Quick Filter Links
  document.querySelectorAll('.exp-link[data-filter]').forEach(link => {
    link.addEventListener('click', (e) => {
      const filter = link.getAttribute('data-filter');
      const targetBtn = document.querySelector(`.filter-btn[data-category="${filter}"]`);
      if (targetBtn) targetBtn.click();
    });
  });

  // 10. Shopping Cart Functionality
  document.querySelectorAll('.add-to-bag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const price = parseInt(btn.getAttribute('data-price'), 10);

      addToCart(id, name, price);
      openCartDrawer();
      showToast('Added to Order', `${name} added to your selection.`);
    });
  });

  function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
      existing.qty++;
    } else {
      cart.push({ id, name, price, qty: 1 });
    }
    updateCartUI();
  }

  function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    if (cartCountEl) cartCountEl.textContent = totalItems;
    if (cartTotalDisplay) cartTotalDisplay.textContent = `₹${totalPrice.toLocaleString('en-IN')}`;

    if (cart.length === 0) {
      if (emptyCart) emptyCart.style.display = 'block';
      if (cartFooter) cartFooter.style.display = 'none';
      if (cartItemList) cartItemList.innerHTML = '';
      if (cartItemList && emptyCart) cartItemList.appendChild(emptyCart);
    } else {
      if (emptyCart) emptyCart.style.display = 'none';
      if (cartFooter) cartFooter.style.display = 'block';

      if (cartItemList) {
        cartItemList.innerHTML = '';
        cart.forEach(item => {
          const row = document.createElement('div');
          row.className = 'cart-item-row';
          row.innerHTML = `
            <div class="cart-item-info">
              <h5>${item.name}</h5>
              <span>₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
            </div>
            <div class="cart-qty-ctrl">
              <button class="qty-btn" data-action="dec" data-id="${item.id}">-</button>
              <span class="qty-num">${item.qty}</span>
              <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
            </div>
          `;
          cartItemList.appendChild(row);
        });
      }
    }
  }

  if (cartItemList) {
    cartItemList.addEventListener('click', (e) => {
      const btn = e.target.closest('.qty-btn');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const item = cart.find(i => i.id === id);
      if (!item) return;

      if (action === 'inc') {
        item.qty++;
      } else if (action === 'dec') {
        item.qty--;
        if (item.qty <= 0) {
          cart = cart.filter(i => i.id !== id);
        }
      }
      updateCartUI();
    });
  }

  function openCartDrawer() {
    if (cartOverlay) cartOverlay.classList.add('open');
  }

  function closeCartDrawer() {
    if (cartOverlay) cartOverlay.classList.remove('open');
  }

  if (openCartBtn) openCartBtn.addEventListener('click', openCartDrawer);
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) closeCartDrawer();
    });
  }

  // Checkout from Cart
  if (proceedCheckoutBtn) {
    proceedCheckoutBtn.addEventListener('click', () => {
      closeCartDrawer();
      const messageBox = document.getElementById('bookMessage');
      if (messageBox) {
        const orderSummary = cart.map(i => `${i.qty}x ${i.name}`).join(', ');
        messageBox.value = `Order Items: ${orderSummary}. Estimated: ${cartTotalDisplay.textContent}`;
      }
      const contactSec = document.getElementById('contactSection');
      if (contactSec) contactSec.scrollIntoView({ behavior: 'smooth' });
      showToast('Order Items Loaded', 'Please fill your name and phone number to finalize.');
    });
  }

  // 11. Modal Controllers
  function openModal(heading = 'Reserve Your Experience', subtext = 'Book an executive grooming session or reserve a VIP tasting table.') {
    const headingEl = document.getElementById('modalHeading');
    const subtextEl = document.getElementById('modalSubtext');
    if (headingEl) headingEl.textContent = heading;
    if (subtextEl) subtextEl.textContent = subtext;
    if (bookingModal) bookingModal.classList.add('open');
  }

  function closeModal() {
    if (bookingModal) bookingModal.classList.remove('open');
  }

  if (bookTableBtn) bookTableBtn.addEventListener('click', () => openModal('Reserve Your Experience', 'Book an exclusive dining or VIP tasting session.'));
  
  document.querySelectorAll('.book-lounge-trigger').forEach(btn => {
    btn.addEventListener('click', () => openModal('Executive Salon Booking', 'Reserve an exclusive luxury hair styling & grooming session.'));
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (bookingModal) {
    bookingModal.addEventListener('click', (e) => {
      if (e.target === bookingModal) closeModal();
    });
  }

  // Form Submissions
  if (modalForm) {
    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('mName').value;
      closeModal();
      modalForm.reset();
      showToast('Reservation Requested', `Thank you ${name}! Our concierge will call you at +91 9219482449 to confirm.`);
    });
  }

  if (mainBookingForm) {
    mainBookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('bookName').value;
      mainBookingForm.reset();
      cart = [];
      updateCartUI();
      showToast('Order Inquiry Received', `Thank you ${name}! We will process your order and call you promptly.`);
    });
  }

  // Toast System
  let toastTimer = null;
  function showToast(title, message) {
    if (!toastNotice) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;

    toastNotice.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 4500);
  }

  // ==========================================================================
  // 3D WATCH EXPLOSION ENGINE (from watch_video_frames_all.zip)
  // ==========================================================================
  const WATCH_TOTAL_FRAMES = 192;
  const WATCH_FRAME_PREFIX = 'watch_video_frames/frame_';
  const WATCH_FRAME_EXT = '.jpg';

  let watchImages = new Array(WATCH_TOTAL_FRAMES + 1);
  let watchLoadedCount = 0;
  let watchCurrentFrame = 1;
  let watchTargetFrame = 1;
  let isDraggingWatch = false;
  let dragStartX = 0;
  let dragStartFrame = 1;

  const watchCanvas = document.getElementById('watchExplosionCanvas');
  const watchCtx = watchCanvas ? watchCanvas.getContext('2d') : null;
  const watchFrameCount = document.getElementById('watchFrameCount');
  const watchProgressFill = document.getElementById('watchProgressFill');
  const watchHint = document.getElementById('watchHint');
  const watchCard = document.querySelector('.watch-canvas-card');
  const watchVisualContainer = document.getElementById('watchVisualContainer');

  function getWatchFrameSrc(index) {
    const pad = String(index).padStart(6, '0');
    return `${WATCH_FRAME_PREFIX}${pad}${WATCH_FRAME_EXT}`;
  }

  function resizeWatchCanvas() {
    if (!watchCanvas) return;
    const rect = watchCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    watchCanvas.width = rect.width * dpr;
    watchCanvas.height = rect.height * dpr;
    renderWatchFrame(Math.round(watchCurrentFrame));
  }

  function renderWatchFrame(frameIndex) {
    if (!watchCtx || !watchCanvas) return;
    const img = watchImages[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = watchCanvas.width;
    const ch = watchCanvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let rw, rh, ox, oy;

    if (canvasRatio > imgRatio) {
      rh = ch;
      rw = ch * imgRatio;
      ox = (cw - rw) / 2;
      oy = 0;
    } else {
      rw = cw;
      rh = cw / imgRatio;
      ox = 0;
      oy = (ch - rh) / 2;
    }

    watchCtx.clearRect(0, 0, cw, ch);
    watchCtx.drawImage(img, ox, oy, rw, rh);
  }

  function initWatchPreloader() {
    if (!watchCanvas) return;
    const firstImg = new Image();
    firstImg.src = getWatchFrameSrc(1);
    firstImg.onload = () => {
      watchImages[1] = firstImg;
      watchLoadedCount++;
      renderWatchFrame(1);

      // Preload remaining frames
      for (let i = 2; i <= WATCH_TOTAL_FRAMES; i++) {
        const img = new Image();
        img.src = getWatchFrameSrc(i);
        img.onload = () => { watchImages[i] = img; watchLoadedCount++; };
        img.onerror = () => { watchLoadedCount++; };
      }
    };
  }

  function updateWatchOnScroll() {
    if (!watchVisualContainer || isDraggingWatch) return;
    const rect = watchVisualContainer.getBoundingClientRect();
    const windowH = window.innerHeight;

    const totalDist = windowH + rect.height;
    const currentDist = windowH - rect.top;
    const progress = Math.min(Math.max(currentDist / totalDist, 0), 1);
    watchTargetFrame = Math.round(progress * (WATCH_TOTAL_FRAMES - 1)) + 1;
  }

  // Interactive Drag / Touch Scrubbing on the Watch Card
  if (watchCard) {
    const startDrag = (clientX) => {
      isDraggingWatch = true;
      dragStartX = clientX;
      dragStartFrame = watchTargetFrame;
      if (watchHint) watchHint.style.opacity = '0';
    };

    const moveDrag = (clientX) => {
      if (!isDraggingWatch) return;
      const rect = watchCard.getBoundingClientRect();
      const deltaX = clientX - dragStartX;
      const frameDelta = (deltaX / rect.width) * WATCH_TOTAL_FRAMES * 1.5;
      let newFrame = Math.round(dragStartFrame + frameDelta);
      newFrame = Math.min(Math.max(newFrame, 1), WATCH_TOTAL_FRAMES);
      watchTargetFrame = newFrame;
    };

    const endDrag = () => {
      isDraggingWatch = false;
    };

    watchCard.addEventListener('mousedown', (e) => startDrag(e.clientX));
    window.addEventListener('mousemove', (e) => {
      if (isDraggingWatch) moveDrag(e.clientX);
    });
    window.addEventListener('mouseup', endDrag);

    watchCard.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) startDrag(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDraggingWatch && e.touches.length > 0) moveDrag(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', endDrag);
  }

  function watchAnimationLoop() {
    if (watchCanvas) {
      const diff = watchTargetFrame - watchCurrentFrame;
      if (Math.abs(diff) > 0.02) {
        watchCurrentFrame += diff * 0.16;
        const fIdx = Math.min(Math.max(Math.round(watchCurrentFrame), 1), WATCH_TOTAL_FRAMES);
        renderWatchFrame(fIdx);

        const pct = ((fIdx - 1) / (WATCH_TOTAL_FRAMES - 1)) * 100;
        if (watchProgressFill) watchProgressFill.style.width = `${pct}%`;
        if (watchFrameCount) watchFrameCount.textContent = `Frame ${String(fIdx).padStart(3, '0')} / ${WATCH_TOTAL_FRAMES}`;
      }
    }
    requestAnimationFrame(watchAnimationLoop);
  }

  // 12. Event Listeners Setup
  window.addEventListener('scroll', () => {
    onScroll();
    updateWatchOnScroll();
  }, { passive: true });

  window.addEventListener('resize', () => {
    resizeCanvas();
    resizeWatchCanvas();
  });

  // Keyboard navigation (Arrow Up/Down or Left/Right to scrub frames)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      targetFrame = Math.min(targetFrame + 4, TOTAL_FRAMES);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      targetFrame = Math.max(targetFrame - 4, 1);
    }
  });

  // Initialize Both Engines
  resizeCanvas();
  initPreloader();
  animationLoop();

  resizeWatchCanvas();
  initWatchPreloader();
  watchAnimationLoop();
});
