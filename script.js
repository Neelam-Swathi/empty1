(() => {
  'use strict';

  // State
  const state = {
    user: loadJSON('rx_user', { name: 'Guest', phone: '' }),
    ride: null, // current ride object
    history: loadJSON('rx_history', []),
    darkMode: loadJSON('rx_dark', { enabled: true }).enabled,
    coupon: null,
  };

  // Constants
  const VEHICLE_RATES = {
    bike: { base: 20, perKm: 8, label: 'Bike' },
    auto: { base: 30, perKm: 10, label: 'Auto' },
    car: { base: 50, perKm: 14, label: 'Car' },
    suv: { base: 70, perKm: 18, label: 'SUV' },
  };
  const STATUS_FLOW = [
    'Driver on the way',
    'Arrived',
    'Ride Started',
    'Completed',
  ];

  // Elements
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const menuToggle = $('#menuToggle');
  const mainMenu = $('#mainMenu');

  const pageBooking = $('#section-booking');
  const pageTracking = $('#section-tracking');
  const pagePayment = $('#section-payment');
  const pageHistory = $('#section-history');

  const pickupInput = $('#pickupInput');
  const dropInput = $('#dropInput');
  const vehicleType = $('#vehicleType');
  const fareBtn = $('#fareBtn');
  const bookBtn = $('#bookBtn');
  const estimateCard = $('#estimateCard');

  const scheduleRow = $('#scheduleRow');
  const scheduleDate = $('#scheduleDate');
  const scheduleTime = $('#scheduleTime');

  const driverIcon = $('#driverIcon');
  const rideStatus = $('#rideStatus');
  const statusProgress = $('#statusProgress');
  const driverNameEl = $('#driverName');
  const driverRatingEl = $('#driverRating');
  const vehicleNumberEl = $('#vehicleNumber');
  const rideOtpEl = $('#rideOtp');
  const rideEtaEl = $('#rideEta');

  const payBtn = $('#payBtn');
  const upiForm = $('#upiForm');
  const cardForm = $('#cardForm');
  const paymentSuccess = $('#paymentSuccess');
  const receiptCard = $('#receiptCard');
  const receiptDate = $('#receiptDate');
  const receiptRoute = $('#receiptRoute');
  const receiptVehicle = $('#receiptVehicle');
  const receiptDistance = $('#receiptDistance');
  const receiptFare = $('#receiptFare');
  const receiptPayment = $('#receiptPayment');

  const historyList = $('#historyList');
  const historyEmpty = $('#historyEmpty');
  const searchLocation = $('#searchLocation');
  const searchDate = $('#searchDate');
  const clearFiltersBtn = $('#clearFiltersBtn');
  const clearHistoryBtn = $('#clearHistoryBtn');

  const darkModeToggle = $('#darkModeToggle');
  const yearNow = $('#yearNow');

  const modal = $('#modal');
  const modalClose = $('#modalClose');
  const startTrackingBtn = $('#startTrackingBtn');
  const confirmDriver = $('#confirmDriver');
  const confirmVehicle = $('#confirmVehicle');
  const confirmOtp = $('#confirmOtp');
  const confirmEta = $('#confirmEta');

  const profileBtn = $('#profileBtn');
  const profileModal = $('#profileModal');
  const profileClose = $('#profileClose');
  const profileName = $('#profileName');
  const profilePhone = $('#profilePhone');
  const saveProfileBtn = $('#saveProfileBtn');

  const toastContainer = $('#toastContainer');

  const applyCouponBtn = $('#applyCouponBtn');
  const couponInput = $('#couponInput');

  const goHistoryBtn = $('#goHistoryBtn');
  const callDriverBtn = $('#callDriverBtn');

  // Init UI
  yearNow.textContent = new Date().getFullYear();
  profileName.value = state.user.name || '';
  profilePhone.value = state.user.phone || '';
  applyDarkMode(state.darkMode);
  darkModeToggle.checked = state.darkMode;

  // Menu
  menuToggle?.addEventListener('click', () => {
    mainMenu.classList.toggle('open');
  });
  $$('.menu-link').forEach((btn) =>
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      navigateTo(target);
      mainMenu.classList.remove('open');
    })
  );

  function navigateTo(sectionId) {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const page = document.getElementById(sectionId);
    page?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Ride type toggle
  $$('input[name="rideType"]').forEach((r) =>
    r.addEventListener('change', () => {
      scheduleRow.classList.toggle('hidden', r.value !== 'schedule' || !r.checked);
    })
  );

  // Swap and current location mock
  $('#swapBtn').addEventListener('click', () => {
    [pickupInput.value, dropInput.value] = [dropInput.value, pickupInput.value];
  });
  $('#useCurrentBtn').addEventListener('click', () => {
    pickupInput.value = 'Current Location';
  });

  // Validation helpers
  function isValidLocation(text) {
    return typeof text === 'string' && text.trim().length >= 3;
  }

  function showEstimate(result) {
    estimateCard.innerHTML = `
      <div class="line"><span>Vehicle</span><span>${result.vehicleLabel}</span></div>
      <div class="line"><span>Distance</span><span>${result.distanceKm.toFixed(1)} km</span></div>
      <div class="line"><span>Base + Distance</span><span>₹${result.base} + ₹${result.distanceFare}</span></div>
      ${result.discount > 0 ? `<div class="line"><span>Coupon</span><span>- ₹${result.discount}</span></div>` : ''}
      <div class="price">₹${result.total}</div>
    `;
    estimateCard.classList.remove('hidden');
  }

  function randomDistanceKm() {
    // Without real geocoding, simulate distance from text hash
    const str = `${pickupInput.value}|${dropInput.value}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    const km = 1 + (hash % 250) / 10; // 1.0 - 26.9 km
    return km;
  }

  function computeFare(km, vehicleKey, couponCode) {
    const rate = VEHICLE_RATES[vehicleKey];
    const distanceFare = Math.round(rate.perKm * km);
    const base = rate.base;
    let total = base + distanceFare;
    let discount = 0;
    if (couponCode) {
      const code = couponCode.toUpperCase();
      if (code === 'SAVE20') {
        discount = Math.min(Math.round(total * 0.2), 40);
      } else if (code === 'FIRST50') {
        discount = 50;
      } else if (code === 'UBER10') {
        discount = Math.min(Math.round(total * 0.1), 30);
      }
    }
    total = Math.max(20, total - discount);
    return {
      vehicleLabel: rate.label,
      base,
      distanceFare,
      distanceKm: km,
      total,
      discount,
    };
  }

  // Fare estimate flow with loading animation
  fareBtn.addEventListener('click', async () => {
    const pickup = pickupInput.value.trim();
    const drop = dropInput.value.trim();
    if (!isValidLocation(pickup) || !isValidLocation(drop)) {
      toast('Invalid', 'Please enter valid pickup and drop locations (min 3 characters).');
      return;
    }
    estimateCard.classList.add('hidden');
    toggleBtnLoading(fareBtn, true);

    // Simulated loading
    await wait(800);

    const km = randomDistanceKm();
    const vKey = vehicleType.value;
    const estimate = computeFare(km, vKey, state.coupon);
    showEstimate(estimate);
    toggleBtnLoading(fareBtn, false);
    bookBtn.disabled = false;
  });

  // Book Now flow
  bookBtn.addEventListener('click', () => {
    const pickup = pickupInput.value.trim();
    const drop = dropInput.value.trim();
    if (!isValidLocation(pickup) || !isValidLocation(drop)) {
      toast('Invalid', 'Please enter valid pickup and drop locations.');
      return;
    }
    const km = randomDistanceKm();
    const vKey = vehicleType.value;
    const estimate = computeFare(km, vKey, state.coupon);

    const driver = randomDriver();
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const etaMin = 5 + Math.floor(Math.random() * 10);

    state.ride = {
      id: 'R' + Date.now(),
      pickup,
      drop,
      vehicleKey: vKey,
      vehicleLabel: VEHICLE_RATES[vKey].label,
      fare: estimate.total,
      distanceKm: +km.toFixed(1),
      statusIndex: 0,
      driver,
      otp,
      etaMin,
      schedule:
        !$('#section-booking input[name="rideType"][value="schedule"]').checked
          ? null
          : { date: scheduleDate.value, time: scheduleTime.value },
      createdAt: new Date().toISOString(),
    };

    // Confirmation Modal
    confirmDriver.textContent = `${driver.name} (${driver.rating}★)`;
    confirmVehicle.textContent = `${driver.vehicle} • ${driver.number}`;
    confirmOtp.textContent = state.ride.otp;
    confirmEta.textContent = `${state.ride.etaMin} min`;
    openModal(modal);

    // Notification
    toast('Ride Confirmed', `Driver ${driver.name} arriving in ~${state.ride.etaMin} min.`);
  });

  modalClose.addEventListener('click', () => closeModal(modal));
  startTrackingBtn.addEventListener('click', () => {
    closeModal(modal);
    navigateTo('section-tracking');
    startTrackingSimulation();
  });

  // Tracking simulation
  let trackingTimer = null;
  function startTrackingSimulation() {
    if (!state.ride) return;

    // Reset status
    setRideStatus(0);
    rideOtpEl.textContent = state.ride.otp;
    rideEtaEl.textContent = `${state.ride.etaMin} min`;
    driverNameEl.textContent = state.ride.driver.name;
    driverRatingEl.innerHTML = `<i class=\"fa-solid fa-star\"></i> ${state.ride.driver.rating.toFixed(1)}`;
    vehicleNumberEl.textContent = state.ride.driver.number;

    // Reset driver icon position relative to CSS markers
    driverIcon.style.left = '5%';
    driverIcon.style.top = '80%';

    const totalSteps = 50; // move towards pickup
    let step = 0;

    scheduleArrivingNotification();

    clearInterval(trackingTimer);
    trackingTimer = setInterval(() => {
      step++;
      const left = 5 + (10 - 5) * (step / totalSteps); // to ~pickup left 10%
      const top = 80 + (70 - 80) * (step / totalSteps); // to ~pickup top 70%
      driverIcon.style.left = `${left}%`;
      driverIcon.style.top = `${top}%`;

      if (step === 15) setRideStatus(1); // Arrived
      if (step === 16) toast('Arrived', 'Driver has arrived at pickup.');
      if (step === 25) setRideStatus(2); // Ride Started
      if (step === 40) {
        setRideStatus(3); // Completed
        clearInterval(trackingTimer);
        toast('Completed', 'Ride completed. Proceed to payment.');
        navigateTo('section-payment');
      }
    }, 300);
  }

  function setRideStatus(index) {
    state.ride.statusIndex = index;
    rideStatus.textContent = STATUS_FLOW[index] || '—';
    statusProgress.style.width = `${(index / (STATUS_FLOW.length - 1)) * 100}%`;
  }

  // Payment selection
  $$('input[name="payMethod"]').forEach((r) =>
    r.addEventListener('change', () => {
      const val = r.value;
      upiForm.classList.toggle('hidden', val !== 'UPI');
      cardForm.classList.toggle('hidden', val !== 'Card');
    })
  );

  // Payment processing
  payBtn.addEventListener('click', async () => {
    if (!state.ride) {
      toast('No ride', 'Please book and complete a ride before paying.');
      return;
    }

    const method = document.querySelector('input[name="payMethod"]:checked').value;
    if (method === 'UPI') {
      const upi = $('#upiId').value.trim();
      if (!/^.{3,}@.{2,}$/.test(upi)) return toast('UPI required', 'Enter a valid UPI ID like name@bank');
    }
    if (method === 'Card') {
      const number = $('#cardNumber').value.replace(/\s+/g, '');
      const name = $('#cardName').value.trim();
      const expiry = $('#cardExpiry').value.trim();
      const cvv = $('#cardCvv').value.trim();
      if (number.length < 12) return toast('Invalid card', 'Enter a valid card number');
      if (!name) return toast('Required', 'Name on card is required');
      if (!/^\d{2}\/\d{2}$/.test(expiry)) return toast('Invalid expiry', 'Use MM/YY');
      if (!/^\d{3,4}$/.test(cvv)) return toast('Invalid CVV', '3-4 digits');
    }

    toggleBtnLoading(payBtn, true);
    await wait(900);
    toggleBtnLoading(payBtn, false);

    // Payment success animation
    paymentSuccess.classList.remove('hidden');
    await wait(900);

    // Persist ride to history
    const ride = { ...state.ride };
    ride.paid = true;
    ride.paymentMethod = method;
    state.history.unshift(ride);
    saveJSON('rx_history', state.history);

    // Show receipt
    populateReceipt(ride);
    receiptCard.classList.remove('hidden');
    toast('Payment successful', `₹${ride.fare} paid via ${method}`);
  });

  function populateReceipt(ride) {
    const dt = new Date(ride.createdAt);
    receiptDate.textContent = dt.toLocaleString();
    receiptRoute.textContent = `${ride.pickup} → ${ride.drop}`;
    receiptVehicle.textContent = ride.vehicleLabel;
    receiptDistance.textContent = `${ride.distanceKm} km`;
    receiptFare.textContent = `₹${ride.fare}`;
    receiptPayment.textContent = ride.paymentMethod || '—';
  }

  // History rendering and filters
  function renderHistory() {
    historyList.innerHTML = '';
    const q = searchLocation.value.trim().toLowerCase();
    const d = searchDate.value ? new Date(searchDate.value) : null;

    const items = state.history.filter((r) => {
      const inText = `${r.pickup} ${r.drop}`.toLowerCase().includes(q);
      const after = !d || new Date(r.createdAt) >= d;
      return inText && after;
    });

    if (!items.length) {
      historyEmpty.classList.remove('hidden');
      return;
    }
    historyEmpty.classList.add('hidden');

    for (const r of items) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="history-top">
          <div>${r.pickup} → ${r.drop}</div>
          <div>₹${r.fare}</div>
        </div>
        <div class="history-sub">
          <span><i class="fa-regular fa-calendar"></i> ${new Date(r.createdAt).toLocaleString()}</span>
          <span class="badge"><i class="fa-solid fa-car"></i> ${r.vehicleLabel}</span>
          <span class="badge"><i class="fa-solid fa-route"></i> ${r.distanceKm} km</span>
          <span class="badge"><i class="fa-solid fa-wallet"></i> ${r.paymentMethod || 'Unpaid'}</span>
          <span class="badge"><i class="fa-solid fa-circle-${r.paid ? 'check' : 'dot'}"></i> ${r.paid ? 'Completed' : STATUS_FLOW[r.statusIndex]}</span>
        </div>
      `;
      historyList.appendChild(li);
    }
  }

  searchLocation.addEventListener('input', renderHistory);
  searchDate.addEventListener('change', renderHistory);
  clearFiltersBtn.addEventListener('click', () => {
    searchLocation.value = '';
    searchDate.value = '';
    renderHistory();
  });
  clearHistoryBtn.addEventListener('click', () => {
    if (!state.history.length) return;
    if (!confirm('Clear all ride history?')) return;
    state.history = [];
    saveJSON('rx_history', state.history);
    renderHistory();
  });

  // Dark Mode
  darkModeToggle.addEventListener('change', () => {
    applyDarkMode(darkModeToggle.checked);
    saveJSON('rx_dark', { enabled: darkModeToggle.checked });
  });
  function applyDarkMode(enabled) {
    document.documentElement.classList.toggle('light', !enabled);
  }

  // Coupons
  applyCouponBtn.addEventListener('click', () => {
    const code = couponInput.value.trim().toUpperCase();
    if (!code) return toast('No code', 'Enter a coupon code');
    const valid = ['SAVE20', 'FIRST50', 'UBER10'];
    if (!valid.includes(code)) return toast('Invalid code', 'Try SAVE20, FIRST50, or UBER10');
    state.coupon = code;
    toast('Coupon applied', `${code} will be applied to your next estimate`);
    if (!estimateCard.classList.contains('hidden')) {
      // recompute quickly
      const km = randomDistanceKm();
      const vKey = vehicleType.value;
      const estimate = computeFare(km, vKey, state.coupon);
      showEstimate(estimate);
    }
  });

  // Profile
  profileBtn.addEventListener('click', () => openModal(profileModal));
  profileClose.addEventListener('click', () => closeModal(profileModal));
  saveProfileBtn.addEventListener('click', () => {
    const name = profileName.value.trim();
    const phone = profilePhone.value.trim();
    if (name.length < 2) return toast('Name required', 'Please enter your name');
    if (!/^\+?\d[\d\s-]{7,}$/.test(phone)) return toast('Phone required', 'Please enter a valid phone');
    state.user = { name, phone };
    saveJSON('rx_user', state.user);
    toast('Saved', 'Profile updated');
    closeModal(profileModal);
  });

  // Navigation helpers for buttons
  $('#goHistoryBtn')?.addEventListener('click', () => {
    navigateTo('section-history');
    renderHistory();
  });
  callDriverBtn?.addEventListener('click', () => {
    if (!state.ride) return toast('Contact', 'No active ride');
    toast('Calling driver', `${state.ride.driver.name} (${state.ride.driver.number})`);
  });

  // Initial render
  renderHistory();

  // Notifications: Driver arriving soon (demo)
  function scheduleArrivingNotification() {
    // After booking, a toast triggers in startTrackingSimulation; here we ensure we also show a pre-arrival toast demo
    setTimeout(() => {
      if (document.getElementById('section-tracking').classList.contains('active')) {
        toast('Reminder', 'Driver arriving soon');
      }
    }, 6000);
  }

  // Utilities
  function openModal(el) { el.classList.remove('hidden'); }
  function closeModal(el) { el.classList.add('hidden'); }

  function wait(ms) { return new Promise((res) => setTimeout(res, ms)); }

  function toggleBtnLoading(btn, loading) {
    btn.disabled = !!loading;
    const content = btn.querySelector('.btn-content');
    const spinner = btn.querySelector('.btn-loader');
    if (content && spinner) {
      content.classList.toggle('hidden', !!loading);
      spinner.classList.toggle('hidden', !loading);
    }
  }

  function randomDriver() {
    const names = ['Anil', 'Bhavani', 'Chirag', 'Dinesh', 'Esha', 'Farhan', 'Gita', 'Harsh', 'Ishaan', 'Jaya'];
    const vehicles = ['Maruti Swift', 'Hyundai Aura', 'Honda City', 'WagonR', 'Baleno'];
    const number = `TS${String(Math.floor(1 + Math.random()*20)).padStart(2,'0')} ${String.fromCharCode(65+Math.floor(Math.random()*26))}${String.fromCharCode(65+Math.floor(Math.random()*26))} ${Math.floor(1000+Math.random()*9000)}`;
    return {
      name: names[(Math.random() * names.length) | 0],
      rating: 4.6 + Math.random() * 0.4,
      vehicle: vehicles[(Math.random() * vehicles.length) | 0],
      number,
    };
  }

  function toast(title, desc) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<div class="title">${title}</div>${desc ? `<div class="desc">${desc}</div>` : ''}`;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function loadJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  // Expose for debugging
  window.__ridex = { state };
})();