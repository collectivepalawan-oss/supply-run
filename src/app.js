import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PASSCODE = '5309';
const STORAGE_KEY_PROFILE = 'psr_profile';
const STORAGE_KEY_AUTH = 'psr_authed';

let currentUser = null;
let currentProfile = null;
let currentView = 'home';
let isAdminMode = false;

const STORAGE_KEY_ADMIN_MODE = 'psr_admin_mode';
const ADMIN_SETTINGS_KEY = 'psr_admin_settings';

const getAdminSettings = () => {
  try {
    const stored = localStorage.getItem(ADMIN_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {
      baseFee: 100,
      perItemFee: 50,
      heavySurcharge: 200,
      distanceBonus: 50,
      featuredStoreFee: 500
    };
  } catch (_) {
    return { baseFee: 100, perItemFee: 50, heavySurcharge: 200, distanceBonus: 50, featuredStoreFee: 500 };
  }
};

const saveAdminSettings = (settings) => {
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const loadProfileFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
    return stored ? JSON.parse(stored) : null;
  } catch (_) {
    return null;
  }
};

const saveProfileToStorage = (profile) => {
  localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
};

const init = async () => {
  const isAuthed = sessionStorage.getItem(STORAGE_KEY_AUTH);
  isAdminMode = localStorage.getItem(STORAGE_KEY_ADMIN_MODE) === '1';

  if (isAuthed) {
    const profile = loadProfileFromStorage();
    if (profile) {
      currentProfile = profile;
      currentUser = { id: profile.id };
      showMainApp();
      updateAdminUI();
      await loadHomeData();
    } else {
      showProfileSetupScreen();
    }
  } else {
    showPasscodeScreen();
  }

  setupEventListeners();
  hideLoading();
};

const hideLoading = () => {
  document.getElementById('loading-screen').classList.add('hidden');
};

const showPasscodeScreen = () => {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('passcode-screen').classList.remove('hidden');
  document.getElementById('profile-setup-screen').classList.add('hidden');
  document.getElementById('main-app').classList.add('hidden');
};

const showProfileSetupScreen = () => {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('passcode-screen').classList.add('hidden');
  document.getElementById('profile-setup-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
};

const showMainApp = () => {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
};

const handlePasscodeSubmit = () => {
  const input = document.getElementById('passcode-input');
  const code = input.value;

  if (code === PASSCODE) {
    sessionStorage.setItem(STORAGE_KEY_AUTH, '1');
    const profile = loadProfileFromStorage();
    if (profile) {
      currentProfile = profile;
      currentUser = { id: profile.id };
      showMainApp();
      loadHomeData();
    } else {
      showProfileSetupScreen();
    }
  } else {
    showToast('Incorrect passcode', 'error');
    input.value = '';
  }
};

const handleProfileSetup = async () => {
  const name = document.getElementById('setup-name').value.trim();
  const whatsapp = document.getElementById('setup-whatsapp').value.trim();
  const barangay = document.getElementById('setup-barangay').value.trim();

  if (!name || !whatsapp) {
    showToast('Name and WhatsApp number are required', 'error');
    return;
  }

  const profile = {
    id: generateId(),
    full_name: name,
    whatsapp_number: whatsapp,
    location_barangay: barangay || 'San Vicente',
    user_type: 'both',
    is_admin: false,
    created_at: new Date().toISOString()
  };

  saveProfileToStorage(profile);
  currentProfile = profile;
  currentUser = { id: profile.id };

  supabase.from('profiles').insert({
    id: profile.id,
    full_name: profile.full_name,
    whatsapp_number: profile.whatsapp_number,
    location_barangay: profile.location_barangay,
    user_type: profile.user_type
  }).then(({ error }) => {
    if (error) console.warn('Profile sync to DB failed:', error.message);
  });

  showMainApp();
  await loadHomeData();
  showToast('Welcome, ' + name + '!', 'success');
};

const setupEventListeners = () => {
  const passcodeBtn = document.getElementById('passcode-btn');
  const passcodeInput = document.getElementById('passcode-input');
  const setupBtn = document.getElementById('setup-profile-btn');

  passcodeBtn?.addEventListener('click', handlePasscodeSubmit);
  passcodeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePasscodeSubmit();
  });
  setupBtn?.addEventListener('click', handleProfileSetup);

  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem) {
      const view = navItem.dataset.view;
      switchView(view);
    }
  });

  document.getElementById('post-request-btn')?.addEventListener('click', () => showPostRequestModal());
  document.getElementById('new-request-btn')?.addEventListener('click', () => showPostRequestModal());
  document.getElementById('browse-requests-btn')?.addEventListener('click', () => switchView('requests'));
  document.getElementById('become-responder-btn')?.addEventListener('click', () => showBecomeResponderModal());
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  setupFilters();
};

const setupFilters = () => {
  document.getElementById('filter-status')?.addEventListener('change', loadRequests);
  document.getElementById('filter-urgency')?.addEventListener('change', loadRequests);
  document.getElementById('filter-store-type')?.addEventListener('change', loadStores);
  document.getElementById('store-search')?.addEventListener('input', loadStores);
  document.getElementById('filter-vehicle')?.addEventListener('change', loadResponders);
  document.getElementById('filter-rating')?.addEventListener('change', loadResponders);

  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle]').dataset.toggle;
      document.querySelectorAll('[data-toggle]').forEach(b => b.classList.remove('active'));
      e.target.closest('[data-toggle]').classList.add('active');

      if (toggle === 'map') {
        document.getElementById('stores-list').classList.add('hidden');
        document.getElementById('stores-map').classList.remove('hidden');
        initStoreMap();
      } else {
        document.getElementById('stores-list').classList.remove('hidden');
        document.getElementById('stores-map').classList.add('hidden');
      }
    });
  });
};

const handleLogout = () => {
  sessionStorage.removeItem(STORAGE_KEY_AUTH);
  currentUser = null;
  currentProfile = null;
  showPasscodeScreen();
  showToast('Logged out successfully', 'info');
};

const switchView = (viewName) => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`${viewName}-view`).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  currentView = viewName;

  switch(viewName) {
    case 'home':
      loadHomeData();
      break;
    case 'requests':
      loadRequests();
      break;
    case 'stores':
      loadStores();
      break;
    case 'responders':
      loadResponders();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'admin':
      loadAdminDashboard();
      break;
  }
};

const loadHomeData = async () => {
  const [openRequests, activeDeliveries, responders, stores] = await Promise.all([
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('requests').select('id', { count: 'exact', head: true }).in('status', ['claimed', 'at_terminal', 'en_route']),
    supabase.from('responders').select('id', { count: 'exact', head: true }).eq('verified', true),
    supabase.from('stores').select('id', { count: 'exact', head: true })
  ]);

  document.getElementById('stat-open-requests').textContent = openRequests.count || 0;
  document.getElementById('stat-active-deliveries').textContent = activeDeliveries.count || 0;
  document.getElementById('stat-responders').textContent = responders.count || 0;
  document.getElementById('stat-stores').textContent = stores.count || 0;

  const { data: recentRequests } = await supabase
    .from('requests')
    .select('*, requester:profiles(full_name, location_barangay)')
    .order('created_at', { ascending: false })
    .limit(5);

  renderRequests(recentRequests, 'recent-requests');
};

const loadRequests = async () => {
  const status = document.getElementById('filter-status')?.value || 'all';
  const urgency = document.getElementById('filter-urgency')?.value || 'all';

  let query = supabase
    .from('requests')
    .select('*, requester:profiles(full_name, location_barangay), responder:responders(id, user_id, vehicle_type)')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (urgency !== 'all') {
    query = query.eq('urgency', urgency);
  }

  const { data: requests } = await query;
  renderRequests(requests, 'requests-list');
};

const renderRequests = (requests, containerId) => {
  const container = document.getElementById(containerId);

  if (!requests || requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>No requests found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = requests.map(req => `
    <div class="request-card" onclick="viewRequestDetails('${req.id}')">
      <div class="card-header">
        <div class="card-title">
          <h3>${req.item_name}</h3>
          <p>San Vicente, ${req.requester?.location_barangay || 'N/A'}</p>
        </div>
        <div class="card-badges">
          ${getUrgencyBadge(req.urgency)}
          ${getStatusBadge(req.status)}
        </div>
      </div>

      <div class="card-badges">
        <span class="badge badge-status">
          <i class="fas fa-weight-hanging"></i> ${req.weight_estimate}
        </span>
        <span class="badge badge-status">
          <i class="fas ${getVehicleIcon(req.vehicle_needed)}"></i> ${req.vehicle_needed}
        </span>
        <span class="badge badge-status">
          <i class="fas fa-location-dot"></i> ${getTerminalName(req.terminal)}
        </span>
      </div>

      <p style="margin: 12px 0; font-size: 13px; color: var(--text-secondary);">
        ${req.description?.substring(0, 100) || 'No description'}${req.description?.length > 100 ? '...' : ''}
      </p>

      <div class="card-actions">
        ${req.status === 'open' && canClaimRequest(req) ?
          `<button class="card-btn" onclick="event.stopPropagation(); claimRequest('${req.id}')">
            <i class="fas fa-hand-holding"></i> Claim Request
          </button>` : ''}
        ${req.requester_id !== currentProfile?.id ?
          `<button class="card-btn card-btn-whatsapp" onclick="event.stopPropagation(); openWhatsApp('${req.requester_id}')">
            <i class="fab fa-whatsapp"></i> Contact
          </button>` : ''}
      </div>
    </div>
  `).join('');
};

const getUrgencyBadge = (urgency) => {
  const badges = {
    urgent: '<span class="badge badge-urgent"><i class="fas fa-circle"></i> Urgent</span>',
    normal: '<span class="badge badge-normal"><i class="fas fa-circle"></i> Normal</span>',
    flexible: '<span class="badge badge-flexible"><i class="fas fa-circle"></i> Flexible</span>'
  };
  return badges[urgency] || '';
};

const getStatusBadge = (status) => {
  const labels = {
    open: 'Open',
    claimed: 'Claimed',
    at_terminal: 'At Terminal',
    en_route: 'En Route',
    arrived: 'Arrived',
    completed: 'Completed'
  };
  return `<span class="badge badge-status">${labels[status] || status}</span>`;
};

const getVehicleIcon = (vehicle) => {
  const icons = {
    motor: 'fa-motorcycle',
    van: 'fa-van-shuttle',
    truck: 'fa-truck',
    wing_van: 'fa-truck-moving',
    any: 'fa-circle-question'
  };
  return icons[vehicle] || 'fa-circle-question';
};

const getTerminalName = (terminal) => {
  const names = {
    san_jose: 'San Jose Terminal',
    roxas: 'Roxas Junction',
    san_vicente: 'San Vicente Terminal'
  };
  return names[terminal] || terminal;
};

const canClaimRequest = (request) => {
  return currentProfile &&
         (currentProfile.user_type === 'responder' || currentProfile.user_type === 'both') &&
         request.requester_id !== currentUser.id;
};

const claimRequest = async (requestId) => {
  const { data: responder } = await supabase
    .from('responders')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('verified', true)
    .maybeSingle();

  if (!responder) {
    showToast('You must be a verified responder to claim requests', 'error');
    return;
  }

  const { error } = await supabase
    .from('requests')
    .update({
      responder_id: responder.id,
      status: 'claimed',
      claimed_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (error) {
    showToast('Failed to claim request: ' + error.message, 'error');
    return;
  }

  showToast('Request claimed successfully!', 'success');
  loadRequests();
};

const loadStores = async () => {
  const type = document.getElementById('filter-store-type')?.value || 'all';
  const search = document.getElementById('store-search')?.value || '';

  let query = supabase
    .from('stores')
    .select('*')
    .order('featured', { ascending: false })
    .order('name', { ascending: true });

  if (type !== 'all') {
    query = query.eq('store_type', type);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data: stores } = await query;
  renderStores(stores);
};

const renderStores = (stores) => {
  const container = document.getElementById('stores-list');

  if (!stores || stores.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-store"></i>
        <p>No stores found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = stores.map(store => `
    <div class="store-card">
      <div class="card-header">
        <div class="card-title">
          <h3>${store.name}</h3>
          <p>${store.address}</p>
        </div>
      </div>

      <div class="card-badges">
        ${store.featured ? '<span class="badge badge-featured"><i class="fas fa-star"></i> Featured</span>' : ''}
        <span class="badge badge-status">
          <i class="fas ${getStoreTypeIcon(store.store_type)}"></i> ${formatStoreType(store.store_type)}
        </span>
      </div>

      ${store.whatsapp_number ? `
        <div class="card-actions">
          <button class="card-btn card-btn-whatsapp" onclick="window.open('https://wa.me/${store.whatsapp_number}', '_blank')">
            <i class="fab fa-whatsapp"></i> Contact Store
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
};

const getStoreTypeIcon = (type) => {
  const icons = {
    mall: 'fa-building',
    hardware: 'fa-hammer',
    specialty: 'fa-gift',
    terminal: 'fa-bus',
    grocery: 'fa-cart-shopping',
    pharmacy: 'fa-pills',
    bank: 'fa-building-columns'
  };
  return icons[type] || 'fa-store';
};

const formatStoreType = (type) => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const initStoreMap = async () => {
  const mapContainer = document.getElementById('stores-map');

  if (!mapContainer.innerHTML) {
    const map = L.map('stores-map').setView([9.7390, 118.7362], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const { data: stores } = await supabase
      .from('stores')
      .select('*');

    stores?.forEach(store => {
      L.marker([store.latitude, store.longitude])
        .bindPopup(`
          <strong>${store.name}</strong><br>
          ${store.address}<br>
          ${store.whatsapp_number ? `<a href="https://wa.me/${store.whatsapp_number}" target="_blank">Contact</a>` : ''}
        `)
        .addTo(map);
    });
  }
};

const loadResponders = async () => {
  const vehicle = document.getElementById('filter-vehicle')?.value || 'all';
  const rating = document.getElementById('filter-rating')?.value || 'all';

  let query = supabase
    .from('responders')
    .select('*, profile:profiles(full_name, location_barangay, profile_photo)')
    .eq('verified', true)
    .order('average_rating', { ascending: false });

  if (vehicle !== 'all') {
    query = query.eq('vehicle_type', vehicle);
  }

  if (rating !== 'all') {
    query = query.gte('average_rating', parseInt(rating));
  }

  const { data: responders } = await query;
  renderResponders(responders);
};

const renderResponders = (responders) => {
  const container = document.getElementById('responders-list');

  if (!responders || responders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-truck"></i>
        <p>No responders found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = responders.map(resp => `
    <div class="responder-card" onclick="viewResponderDetails('${resp.id}')">
      <div class="card-header">
        <div class="card-title">
          <h3>${resp.profile?.full_name || 'Unknown'}</h3>
          <p>${resp.profile?.location_barangay || 'N/A'}</p>
        </div>
        <div class="rating-stars">
          ${renderStars(resp.average_rating)}
        </div>
      </div>

      <div class="card-badges">
        <span class="badge badge-status">
          <i class="fas ${getVehicleIcon(resp.vehicle_type)}"></i> ${formatStoreType(resp.vehicle_type)}
        </span>
        <span class="badge badge-status">
          <i class="fas fa-check-circle"></i> ${resp.completed_jobs} jobs
        </span>
      </div>

      <div class="card-actions">
        <button class="card-btn card-btn-whatsapp" onclick="event.stopPropagation(); openWhatsApp('${resp.user_id}')">
          <i class="fab fa-whatsapp"></i> Contact
        </button>
      </div>
    </div>
  `).join('');
};

const renderStars = (rating) => {
  const fullStars = Math.floor(rating);
  const emptyStars = 5 - fullStars;
  return '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
};

const loadProfile = async () => {
  const container = document.getElementById('profile-content');

  const { data: responder } = await supabase
    .from('responders')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  const { count: requestCount } = await supabase
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .eq('requester_id', currentUser.id);

  container.innerHTML = `
    <div class="profile-section">
      <h3><i class="fas fa-user"></i> Personal Information</h3>
      <div class="profile-info">
        <div class="info-row">
          <span class="info-label">Name</span>
          <span class="info-value">${currentProfile.full_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">WhatsApp</span>
          <span class="info-value">${currentProfile.whatsapp_number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location</span>
          <span class="info-value">${currentProfile.location_barangay}</span>
        </div>
      </div>
      <button class="btn-secondary" onclick="showEditProfileModal()" style="margin-top:16px;">
        <i class="fas fa-edit"></i> Edit Profile
      </button>
      <div class="admin-mode-toggle" style="margin-top:16px;">
        <div class="info-row">
          <span class="info-label"><i class="fas fa-shield-halved"></i> Admin Mode</span>
          <label class="toggle-switch">
            <input type="checkbox" id="admin-mode-checkbox" ${isAdminMode ? 'checked' : ''} onchange="toggleAdminMode()" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        ${isAdminMode ? '<p style="color:var(--accent-green);font-size:12px;margin-top:8px"><i class="fas fa-shield-halved"></i> Admin Mode is ON — Admin tab visible in navigation</p>' : '<p style="color:var(--text-secondary);font-size:12px;margin-top:8px">Toggle to enable admin privileges</p>'}
      </div>
    </div>

    ${responder ? `
      <div class="profile-section">
        <h3><i class="fas fa-truck"></i> Responder Stats</h3>
        <div class="profile-info">
          <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value">${responder.verified ? '✓ Verified' : '⏳ Pending'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Vehicle</span>
            <span class="info-value">${formatStoreType(responder.vehicle_type)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Completed Jobs</span>
            <span class="info-value">${responder.completed_jobs}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Rating</span>
            <span class="info-value rating-stars">${renderStars(responder.average_rating)} (${responder.average_rating.toFixed(1)})</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Earnings</span>
            <span class="info-value">₱${responder.total_earnings.toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Pending Earnings</span>
            <span class="info-value">₱${responder.pending_earnings.toFixed(2)}</span>
          </div>
        </div>
        ${responder.pending_earnings > 0 ? `
          <button class="btn-primary" onclick="requestPayout()" style="margin-top: 16px;">
            <i class="fas fa-money-bill-wave"></i> Request Payout
          </button>
        ` : ''}
      </div>
    ` : `
      <div class="profile-section">
        <h3><i class="fas fa-truck"></i> Become a Responder</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">Set up your responder profile to start claiming delivery requests.</p>
        <button class="btn-primary" onclick="showBecomeResponderModal()">
          <i class="fas fa-truck"></i> Setup Responder Profile
        </button>
      </div>
    `}

    <div class="profile-section">
      <h3><i class="fas fa-box"></i> My Requests</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <i class="fas fa-boxes"></i>
          <div class="stat-content">
            <h3>${requestCount || 0}</h3>
            <p>Total Requests</p>
          </div>
        </div>
      </div>
    </div>
  `;
};

const updateAdminUI = () => {
  const adminBtn = document.querySelector('.admin-nav-btn');
  if (adminBtn) {
    adminBtn.classList.toggle('hidden', !isAdminMode);
  }
};

const toggleAdminMode = () => {
  isAdminMode = !isAdminMode;
  localStorage.setItem(STORAGE_KEY_ADMIN_MODE, isAdminMode ? '1' : '0');
  updateAdminUI();
  if (!isAdminMode && currentView === 'admin') {
    switchView('home');
  }
  loadProfile();
  showToast(isAdminMode ? 'Admin Mode activated 🛡️' : 'Admin Mode deactivated', isAdminMode ? 'success' : 'info');
};

const logAdminAction = async (action, targetId, details) => {
  await supabase.from('admin_logs').insert({
    action,
    target_id: targetId || null,
    admin_name: currentProfile?.full_name || 'Admin',
    details: details || null
  });
};

let currentAdminTab = 'overview';

const loadAdminDashboard = () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.adminTab;
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentAdminTab = tabName;
      loadAdminTab(tabName);
    });
  });

  loadAdminTab(currentAdminTab);
};

const loadAdminTab = (tab) => {
  switch (tab) {
    case 'overview': loadAdminOverview(); break;
    case 'requests': loadAdminRequests(); break;
    case 'stores': loadAdminStores(); break;
    case 'responders': loadAdminResponders(); break;
    case 'users': loadAdminUsers(); break;
    case 'ratings': loadAdminRatings(); break;
    case 'payouts': loadAdminPayouts(); break;
    case 'settings': loadAdminSettings(); break;
    case 'terminals': loadAdminTerminals(); break;
    case 'logs': loadAdminLogs(); break;
  }
};

// ============================================================
// ADMIN TAB: OVERVIEW (Analytics)
// ============================================================
const loadAdminOverview = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading analytics...</div>';

  const [
    { count: totalRequests },
    { count: openRequests },
    { count: completedRequests },
    { count: totalResponders },
    { count: totalStores },
    { count: featuredStores },
    { count: pendingPayouts },
    { data: recentLogs }
  ] = await Promise.all([
    supabase.from('requests').select('id', { count: 'exact', head: true }),
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('responders').select('id', { count: 'exact', head: true }).eq('verified', true),
    supabase.from('stores').select('id', { count: 'exact', head: true }),
    supabase.from('stores').select('id', { count: 'exact', head: true }).eq('featured', true),
    supabase.from('payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(5)
  ]);

  const settings = getAdminSettings();
  const monthlyRevenue = (featuredStores || 0) * settings.featuredStoreFee;

  const { data: last7DaysData } = await supabase
    .from('requests')
    .select('created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const dayCounts = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayCounts[d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })] = 0;
  }
  (last7DaysData || []).forEach(r => {
    const label = new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    if (label in dayCounts) dayCounts[label]++;
  });

  const { data: topResponders } = await supabase
    .from('responders')
    .select('total_earnings, profile:profiles(full_name)')
    .eq('verified', true)
    .order('total_earnings', { ascending: false })
    .limit(5);

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-stats-grid">
        <div class="admin-stat-card">
          <i class="fas fa-box" style="color:var(--accent-blue)"></i>
          <div><h3>${totalRequests || 0}</h3><p>Total Requests</p></div>
        </div>
        <div class="admin-stat-card">
          <i class="fas fa-box-open" style="color:var(--accent-orange)"></i>
          <div><h3>${openRequests || 0}</h3><p>Open Requests</p></div>
        </div>
        <div class="admin-stat-card">
          <i class="fas fa-check-circle" style="color:var(--accent-green)"></i>
          <div><h3>${completedRequests || 0}</h3><p>Completed</p></div>
        </div>
        <div class="admin-stat-card">
          <i class="fas fa-truck" style="color:var(--accent-purple)"></i>
          <div><h3>${totalResponders || 0}</h3><p>Responders</p></div>
        </div>
        <div class="admin-stat-card">
          <i class="fas fa-store" style="color:var(--accent-blue)"></i>
          <div><h3>${totalStores || 0}</h3><p>Stores</p></div>
        </div>
        <div class="admin-stat-card">
          <i class="fas fa-star" style="color:#ffd700"></i>
          <div><h3>${featuredStores || 0}</h3><p>Featured Stores</p></div>
        </div>
        <div class="admin-stat-card">
          <i class="fas fa-money-bill-wave" style="color:var(--accent-green)"></i>
          <div><h3>₱${monthlyRevenue.toLocaleString()}</h3><p>Monthly Revenue (proj.)</p></div>
        </div>
        <div class="admin-stat-card">
          <i class="fas fa-clock" style="color:var(--accent-red)"></i>
          <div><h3>${pendingPayouts || 0}</h3><p>Pending Payouts</p></div>
        </div>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-chart-bar"></i> Requests — Last 7 Days</h3>
      </div>
      <div class="admin-chart-wrap">
        <canvas id="admin-requests-chart" height="180"></canvas>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-trophy"></i> Top Responders by Earnings</h3>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Total Earnings</th></tr></thead>
          <tbody>
            ${(topResponders || []).map(r => `
              <tr>
                <td>${r.profile?.full_name || 'Unknown'}</td>
                <td>₱${(r.total_earnings || 0).toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="2" style="text-align:center;color:var(--text-secondary)">No data</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-history"></i> Recent Admin Actions</h3>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Action</th><th>Admin</th><th>Time</th></tr></thead>
          <tbody>
            ${(recentLogs || []).map(l => `
              <tr>
                <td>${l.action}</td>
                <td>${l.admin_name}</td>
                <td>${new Date(l.created_at).toLocaleString('en-PH')}</td>
              </tr>
            `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary)">No actions yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render chart
  setTimeout(() => {
    const ctx = document.getElementById('admin-requests-chart');
    if (ctx && typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(dayCounts),
          datasets: [{
            label: 'Requests',
            data: Object.values(dayCounts),
            backgroundColor: 'rgba(0, 212, 255, 0.5)',
            borderColor: 'rgba(0, 212, 255, 1)',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#a8a8b3' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#a8a8b3', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }
  }, 100);
};

// ============================================================
// ADMIN TAB: REQUESTS
// ============================================================
const loadAdminRequests = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading requests...</div>';

  const { data: requests } = await supabase
    .from('requests')
    .select('*, requester:profiles(full_name)')
    .order('created_at', { ascending: false });

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-box"></i> All Requests (${requests?.length || 0})</h3>
        <div class="admin-header-actions">
          <input type="text" id="admin-req-search" placeholder="Search requests..." class="admin-search" />
          <select id="admin-req-filter" class="admin-filter">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="at_terminal">At Terminal</option>
            <option value="en_route">En Route</option>
            <option value="arrived">Arrived</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div class="admin-bulk-actions">
        <label><input type="checkbox" id="admin-req-select-all" /> Select All</label>
        <button class="admin-btn admin-btn-danger" onclick="adminBulkDeleteRequests()"><i class="fas fa-trash"></i> Delete Selected</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table" id="admin-requests-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="admin-req-select-all-header" /></th>
              <th>Item</th>
              <th>Requester</th>
              <th>Status</th>
              <th>Urgency</th>
              <th>Terminal</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="admin-requests-tbody">
            ${renderAdminRequestsRows(requests || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('admin-req-search')?.addEventListener('input', () => filterAdminRequestsTable(requests || []));
  document.getElementById('admin-req-filter')?.addEventListener('change', () => filterAdminRequestsTable(requests || []));
  document.getElementById('admin-req-select-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.admin-req-checkbox').forEach(cb => cb.checked = e.target.checked);
  });
  document.getElementById('admin-req-select-all-header')?.addEventListener('change', (e) => {
    document.querySelectorAll('.admin-req-checkbox').forEach(cb => cb.checked = e.target.checked);
  });
};

const renderAdminRequestsRows = (requests) => {
  if (!requests.length) return '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">No requests found</td></tr>';
  return requests.map(req => `
    <tr data-id="${req.id}" data-item="${(req.item_name || '').toLowerCase()}" data-status="${req.status}">
      <td><input type="checkbox" class="admin-req-checkbox" value="${req.id}" /></td>
      <td>${req.item_name}</td>
      <td>${req.requester?.full_name || 'Unknown'}</td>
      <td><span class="admin-status-badge admin-status-${req.status}">${req.status}</span></td>
      <td>${req.urgency}</td>
      <td>${getTerminalName(req.terminal)}</td>
      <td>${new Date(req.created_at).toLocaleDateString('en-PH')}</td>
      <td class="admin-actions-cell">
        <button class="admin-btn admin-btn-sm" onclick="adminEditRequest('${req.id}','${(req.item_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}','${req.status}','${req.urgency}')"><i class="fas fa-edit"></i></button>
        <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="adminDeleteRequest('${req.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
};

const filterAdminRequestsTable = (requests) => {
  const search = document.getElementById('admin-req-search')?.value.toLowerCase() || '';
  const status = document.getElementById('admin-req-filter')?.value || 'all';
  const filtered = requests.filter(r => {
    const matchSearch = !search || (r.item_name || '').toLowerCase().includes(search) || (r.requester?.full_name || '').toLowerCase().includes(search);
    const matchStatus = status === 'all' || r.status === status;
    return matchSearch && matchStatus;
  });
  const tbody = document.getElementById('admin-requests-tbody');
  if (tbody) tbody.innerHTML = renderAdminRequestsRows(filtered);
};

window.adminEditRequest = (id, itemName, status, urgency) => {
  createModal('Edit Request', `
    <div class="form-group">
      <label>Item Name</label>
      <input type="text" id="admin-edit-item" value="${itemName}" />
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="admin-edit-status">
        <option value="open" ${status === 'open' ? 'selected' : ''}>Open</option>
        <option value="claimed" ${status === 'claimed' ? 'selected' : ''}>Claimed</option>
        <option value="at_terminal" ${status === 'at_terminal' ? 'selected' : ''}>At Terminal</option>
        <option value="en_route" ${status === 'en_route' ? 'selected' : ''}>En Route</option>
        <option value="arrived" ${status === 'arrived' ? 'selected' : ''}>Arrived</option>
        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
      </select>
    </div>
    <div class="form-group">
      <label>Urgency</label>
      <select id="admin-edit-urgency">
        <option value="urgent" ${urgency === 'urgent' ? 'selected' : ''}>Urgent</option>
        <option value="normal" ${urgency === 'normal' ? 'selected' : ''}>Normal</option>
        <option value="flexible" ${urgency === 'flexible' ? 'selected' : ''}>Flexible</option>
      </select>
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminSaveRequest('${id}')">Save Changes</button>
    </div>
  `);
};

window.adminSaveRequest = async (id) => {
  const item_name = document.getElementById('admin-edit-item').value.trim();
  const status = document.getElementById('admin-edit-status').value;
  const urgency = document.getElementById('admin-edit-urgency').value;
  const { error } = await supabase.from('requests').update({ item_name, status, urgency }).eq('id', id);
  if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
  await logAdminAction('edited_request', id, `Set status=${status}`);
  closeModal();
  showToast('Request updated!', 'success');
  loadAdminRequests();
};

window.adminDeleteRequest = (id) => {
  createModal('Confirm Delete', `
    <p style="margin-bottom:16px">Are you sure you want to delete this request? This cannot be undone.</p>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmDeleteRequest('${id}')"><i class="fas fa-trash"></i> Delete</button>
    </div>
  `);
};

window.adminConfirmDeleteRequest = async (id) => {
  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  await logAdminAction('deleted_request', id);
  closeModal();
  showToast('Request deleted!', 'success');
  loadAdminRequests();
};

window.adminBulkDeleteRequests = () => {
  const checked = [...document.querySelectorAll('.admin-req-checkbox:checked')].map(cb => cb.value);
  if (!checked.length) { showToast('No requests selected', 'error'); return; }
  createModal('Bulk Delete', `
    <p style="margin-bottom:16px">Delete ${checked.length} selected request(s)? This cannot be undone.</p>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmBulkDeleteRequests('${checked.join(',')}')"><i class="fas fa-trash"></i> Delete All</button>
    </div>
  `);
};

window.adminConfirmBulkDeleteRequests = async (idsStr) => {
  const ids = idsStr.split(',');
  const { error } = await supabase.from('requests').delete().in('id', ids);
  if (error) { showToast('Bulk delete failed: ' + error.message, 'error'); return; }
  await logAdminAction('bulk_deleted_requests', null, `Deleted ${ids.length} requests`);
  closeModal();
  showToast(`${ids.length} requests deleted!`, 'success');
  loadAdminRequests();
};

// ============================================================
// ADMIN TAB: STORES
// ============================================================
const loadAdminStores = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading stores...</div>';

  const { data: stores } = await supabase.from('stores').select('*').order('name');

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-store"></i> Stores (${stores?.length || 0})</h3>
        <div class="admin-header-actions">
          <input type="text" id="admin-store-search" placeholder="Search stores..." class="admin-search" />
          <button class="admin-btn admin-btn-primary" onclick="adminAddStore()"><i class="fas fa-plus"></i> Add Store</button>
          <button class="admin-btn" onclick="adminBulkImportStores()"><i class="fas fa-file-import"></i> Bulk Import</button>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table" id="admin-stores-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Address</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="admin-stores-tbody">
            ${renderAdminStoresRows(stores || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('admin-store-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = (stores || []).filter(s => s.name.toLowerCase().includes(search) || s.address.toLowerCase().includes(search));
    const tbody = document.getElementById('admin-stores-tbody');
    if (tbody) tbody.innerHTML = renderAdminStoresRows(filtered);
  });
};

const renderAdminStoresRows = (stores) => {
  if (!stores.length) return '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">No stores found</td></tr>';
  return stores.map(store => `
    <tr>
      <td>${store.name}</td>
      <td>${formatStoreType(store.store_type)}</td>
      <td>${store.address}</td>
      <td>
        <button class="admin-btn admin-btn-sm ${store.featured ? 'admin-btn-featured' : ''}" onclick="adminToggleFeatured('${store.id}',${!store.featured})">
          <i class="fas fa-star"></i> ${store.featured ? 'Featured' : 'Set Featured'}
        </button>
      </td>
      <td class="admin-actions-cell">
        <button class="admin-btn admin-btn-sm" onclick="adminEditStore('${store.id}')"><i class="fas fa-edit"></i></button>
        <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="adminDeleteStore('${store.id}','${(store.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
};

window.adminAddStore = () => {
  createModal('Add New Store', `
    <div class="form-group"><label>Store Name *</label><input type="text" id="admin-store-name" required /></div>
    <div class="form-group"><label>Type *</label>
      <select id="admin-store-type">
        <option value="mall">Mall</option><option value="hardware">Hardware</option>
        <option value="specialty">Specialty</option><option value="terminal">Terminal</option>
        <option value="grocery">Grocery</option><option value="pharmacy">Pharmacy</option>
        <option value="bank">Bank</option>
      </select>
    </div>
    <div class="form-group"><label>Address *</label><input type="text" id="admin-store-address" required /></div>
    <div class="form-group"><label>Latitude</label><input type="number" id="admin-store-lat" step="any" placeholder="e.g., 9.7390" /></div>
    <div class="form-group"><label>Longitude</label><input type="number" id="admin-store-lng" step="any" placeholder="e.g., 118.7362" /></div>
    <div class="form-group"><label>WhatsApp Number</label><input type="text" id="admin-store-whatsapp" placeholder="63XXXXXXXXXX" /></div>
    <div class="form-group"><label><input type="checkbox" id="admin-store-featured" /> Featured Store (₱500/month)</label></div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminSaveNewStore()"><i class="fas fa-save"></i> Save Store</button>
    </div>
  `);
};

window.adminSaveNewStore = async () => {
  const name = document.getElementById('admin-store-name').value.trim();
  const store_type = document.getElementById('admin-store-type').value;
  const address = document.getElementById('admin-store-address').value.trim();
  const latitude = parseFloat(document.getElementById('admin-store-lat').value) || 9.7390;
  const longitude = parseFloat(document.getElementById('admin-store-lng').value) || 118.7362;
  const whatsapp_number = document.getElementById('admin-store-whatsapp').value.trim() || null;
  const featured = document.getElementById('admin-store-featured').checked;

  if (!name || !address) { showToast('Name and address are required', 'error'); return; }

  const { error } = await supabase.from('stores').insert({ name, store_type, address, latitude, longitude, whatsapp_number, featured });
  if (error) { showToast('Failed to add store: ' + error.message, 'error'); return; }
  await logAdminAction('added_store', null, name);
  closeModal();
  showToast('Store added!', 'success');
  loadAdminStores();
};

window.adminEditStore = async (id) => {
  const { data: store } = await supabase.from('stores').select('*').eq('id', id).maybeSingle();
  if (!store) { showToast('Store not found', 'error'); return; }
  createModal('Edit Store', `
    <div class="form-group"><label>Store Name *</label><input type="text" id="admin-store-name" value="${store.name}" required /></div>
    <div class="form-group"><label>Type *</label>
      <select id="admin-store-type">
        <option value="mall" ${store.store_type === 'mall' ? 'selected' : ''}>Mall</option>
        <option value="hardware" ${store.store_type === 'hardware' ? 'selected' : ''}>Hardware</option>
        <option value="specialty" ${store.store_type === 'specialty' ? 'selected' : ''}>Specialty</option>
        <option value="terminal" ${store.store_type === 'terminal' ? 'selected' : ''}>Terminal</option>
        <option value="grocery" ${store.store_type === 'grocery' ? 'selected' : ''}>Grocery</option>
        <option value="pharmacy" ${store.store_type === 'pharmacy' ? 'selected' : ''}>Pharmacy</option>
        <option value="bank" ${store.store_type === 'bank' ? 'selected' : ''}>Bank</option>
      </select>
    </div>
    <div class="form-group"><label>Address *</label><input type="text" id="admin-store-address" value="${store.address}" required /></div>
    <div class="form-group"><label>Latitude</label><input type="number" id="admin-store-lat" step="any" value="${store.latitude}" /></div>
    <div class="form-group"><label>Longitude</label><input type="number" id="admin-store-lng" step="any" value="${store.longitude}" /></div>
    <div class="form-group"><label>WhatsApp</label><input type="text" id="admin-store-whatsapp" value="${store.whatsapp_number || ''}" /></div>
    <div class="form-group"><label><input type="checkbox" id="admin-store-featured" ${store.featured ? 'checked' : ''} /> Featured</label></div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminUpdateStore('${id}')">Save Changes</button>
    </div>
  `);
};

window.adminUpdateStore = async (id) => {
  const name = document.getElementById('admin-store-name').value.trim();
  const store_type = document.getElementById('admin-store-type').value;
  const address = document.getElementById('admin-store-address').value.trim();
  const latitude = parseFloat(document.getElementById('admin-store-lat').value) || 9.7390;
  const longitude = parseFloat(document.getElementById('admin-store-lng').value) || 118.7362;
  const whatsapp_number = document.getElementById('admin-store-whatsapp').value.trim() || null;
  const featured = document.getElementById('admin-store-featured').checked;
  const { error } = await supabase.from('stores').update({ name, store_type, address, latitude, longitude, whatsapp_number, featured }).eq('id', id);
  if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
  await logAdminAction('edited_store', id, name);
  closeModal();
  showToast('Store updated!', 'success');
  loadAdminStores();
};

window.adminDeleteStore = (id, name) => {
  createModal('Delete Store', `
    <p style="margin-bottom:16px">Delete store "<strong>${name}</strong>"?</p>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmDeleteStore('${id}')"><i class="fas fa-trash"></i> Delete</button>
    </div>
  `);
};

window.adminConfirmDeleteStore = async (id) => {
  const { error } = await supabase.from('stores').delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  await logAdminAction('deleted_store', id);
  closeModal();
  showToast('Store deleted!', 'success');
  loadAdminStores();
};

window.adminToggleFeatured = async (id, featured) => {
  const featuredUntil = featured ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  const { error } = await supabase.from('stores').update({ featured, featured_until: featuredUntil }).eq('id', id);
  if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
  await logAdminAction(featured ? 'featured_store' : 'unfeatured_store', id);
  showToast(featured ? 'Store featured! ⭐' : 'Store unfeatured', 'success');
  loadAdminStores();
};

window.adminBulkImportStores = () => {
  createModal('Bulk Import Stores', `
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">
      Paste store data, one per line in format:<br>
      <code>Name | Type | Address | Lat | Lng | WhatsApp</code>
    </p>
    <div class="form-group">
      <textarea id="admin-bulk-stores" rows="8" placeholder="SM City Puerto Princesa | mall | Rizal Ave, Puerto Princesa | 9.7390 | 118.7362 | 639XXXXXXXXXX"></textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminProcessBulkStores()"><i class="fas fa-file-import"></i> Import</button>
    </div>
  `);
};

window.adminProcessBulkStores = async () => {
  const lines = document.getElementById('admin-bulk-stores').value.trim().split('\n').filter(l => l.trim());
  const stores = lines.map(line => {
    const parts = line.split('|').map(p => p.trim());
    return {
      name: parts[0] || '',
      store_type: (parts[1] || 'specialty').toLowerCase(),
      address: parts[2] || '',
      latitude: parseFloat(parts[3]) || 9.7390,
      longitude: parseFloat(parts[4]) || 118.7362,
      whatsapp_number: parts[5] || null
    };
  }).filter(s => s.name && s.address);

  if (!stores.length) { showToast('No valid stores found', 'error'); return; }

  const { error } = await supabase.from('stores').insert(stores);
  if (error) { showToast('Import failed: ' + error.message, 'error'); return; }
  await logAdminAction('bulk_imported_stores', null, `Imported ${stores.length} stores`);
  closeModal();
  showToast(`${stores.length} stores imported!`, 'success');
  loadAdminStores();
};

// ============================================================
// ADMIN TAB: RESPONDERS
// ============================================================
const loadAdminResponders = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading responders...</div>';

  const { data: responders } = await supabase
    .from('responders')
    .select('*, profile:profiles(full_name, whatsapp_number)')
    .order('created_at', { ascending: false });

  const pending = (responders || []).filter(r => !r.verified && !r.rejection_reason);
  const verified = (responders || []).filter(r => r.verified);
  const suspended = (responders || []).filter(r => !r.verified && r.rejection_reason);

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-truck"></i> Responders</h3>
        <div class="admin-header-actions">
          <input type="text" id="admin-resp-search" placeholder="Search responders..." class="admin-search" />
          <select id="admin-resp-filter" class="admin-filter">
            <option value="all">All (${responders?.length || 0})</option>
            <option value="pending">Pending (${pending.length})</option>
            <option value="verified">Verified (${verified.length})</option>
            <option value="suspended">Suspended (${suspended.length})</option>
          </select>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table" id="admin-responders-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Jobs</th>
              <th>Earnings</th>
              <th>Rating</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="admin-responders-tbody">
            ${renderAdminRespondersRows(responders || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('admin-resp-search')?.addEventListener('input', () => filterAdminRespondersTable(responders || []));
  document.getElementById('admin-resp-filter')?.addEventListener('change', () => filterAdminRespondersTable(responders || []));
};

const renderAdminRespondersRows = (responders) => {
  if (!responders.length) return '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">No responders found</td></tr>';
  return responders.map(resp => {
    const status = resp.verified ? 'verified' : (resp.rejection_reason ? 'suspended' : 'pending');
    return `
      <tr data-name="${(resp.profile?.full_name || '').toLowerCase()}" data-status="${status}">
        <td>${resp.profile?.full_name || 'Unknown'}</td>
        <td>${formatStoreType(resp.vehicle_type)}</td>
        <td><span class="admin-status-badge admin-status-${status}">${status}</span></td>
        <td>${resp.completed_jobs}</td>
        <td>₱${(resp.total_earnings || 0).toFixed(2)}</td>
        <td>${(resp.average_rating || 0).toFixed(1)} ★</td>
        <td class="admin-actions-cell">
          ${!resp.verified && !resp.rejection_reason ? `
            <button class="admin-btn admin-btn-sm admin-btn-success" onclick="adminApproveResponder('${resp.id}')"><i class="fas fa-check"></i></button>
            <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="adminRejectResponder('${resp.id}')"><i class="fas fa-times"></i></button>
          ` : ''}
          ${resp.verified ? `
            <button class="admin-btn admin-btn-sm admin-btn-warning" onclick="adminSuspendResponder('${resp.id}')"><i class="fas fa-ban"></i></button>
          ` : ''}
          ${!resp.verified && resp.rejection_reason ? `
            <button class="admin-btn admin-btn-sm admin-btn-success" onclick="adminApproveResponder('${resp.id}')"><i class="fas fa-check"></i> Reactivate</button>
          ` : ''}
          <button class="admin-btn admin-btn-sm" onclick="adminEditResponder('${resp.id}','${(resp.profile?.full_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}','${resp.total_earnings || 0}')"><i class="fas fa-edit"></i></button>
        </td>
      </tr>
    `;
  }).join('');
};

const filterAdminRespondersTable = (responders) => {
  const search = document.getElementById('admin-resp-search')?.value.toLowerCase() || '';
  const filter = document.getElementById('admin-resp-filter')?.value || 'all';
  const filtered = responders.filter(r => {
    const name = (r.profile?.full_name || '').toLowerCase();
    const status = r.verified ? 'verified' : (r.rejection_reason ? 'suspended' : 'pending');
    const matchSearch = !search || name.includes(search);
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });
  const tbody = document.getElementById('admin-responders-tbody');
  if (tbody) tbody.innerHTML = renderAdminRespondersRows(filtered);
};

window.adminApproveResponder = async (id) => {
  const { error } = await supabase.from('responders').update({ verified: true, verified_at: new Date().toISOString(), rejection_reason: null }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('approved_responder', id);
  showToast('Responder approved! ✓', 'success');
  loadAdminResponders();
};

window.adminRejectResponder = (id) => {
  createModal('Reject/Suspend Responder', `
    <div class="form-group">
      <label>Reason for rejection</label>
      <textarea id="admin-reject-reason" rows="3" placeholder="Enter reason..."></textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmRejectResponder('${id}')">Reject</button>
    </div>
  `);
};

window.adminConfirmRejectResponder = async (id) => {
  const reason = document.getElementById('admin-reject-reason').value.trim() || 'Rejected by admin';
  const { error } = await supabase.from('responders').update({ verified: false, rejection_reason: reason }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('rejected_responder', id, reason);
  closeModal();
  showToast('Responder rejected', 'info');
  loadAdminResponders();
};

window.adminSuspendResponder = (id) => {
  createModal('Suspend Responder', `
    <div class="form-group">
      <label>Suspension reason</label>
      <textarea id="admin-suspend-reason" rows="3" placeholder="Enter reason..."></textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmSuspendResponder('${id}')">Suspend</button>
    </div>
  `);
};

window.adminConfirmSuspendResponder = async (id) => {
  const reason = document.getElementById('admin-suspend-reason').value.trim() || 'Suspended by admin';
  const { error } = await supabase.from('responders').update({ verified: false, rejection_reason: reason }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('suspended_responder', id, reason);
  closeModal();
  showToast('Responder suspended', 'info');
  loadAdminResponders();
};

window.adminEditResponder = (id, name, earnings) => {
  createModal('Edit Responder Earnings', `
    <p style="margin-bottom:8px;color:var(--text-secondary)">${name}</p>
    <div class="form-group">
      <label>Adjust Total Earnings (₱)</label>
      <input type="number" id="admin-resp-earnings" value="${earnings}" step="0.01" min="0" />
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminSaveResponderEarnings('${id}')">Save</button>
    </div>
  `);
};

window.adminSaveResponderEarnings = async (id) => {
  const total_earnings = parseFloat(document.getElementById('admin-resp-earnings').value) || 0;
  const { error } = await supabase.from('responders').update({ total_earnings }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('adjusted_earnings', id, `Set to ₱${total_earnings}`);
  closeModal();
  showToast('Earnings updated!', 'success');
  loadAdminResponders();
};

// ============================================================
// ADMIN TAB: USERS
// ============================================================
const loadAdminUsers = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>';

  const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-users"></i> User Profiles (${users?.length || 0})</h3>
        <div class="admin-header-actions">
          <input type="text" id="admin-users-search" placeholder="Search users..." class="admin-search" />
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>WhatsApp</th>
              <th>Location</th>
              <th>Type</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="admin-users-tbody">
            ${renderAdminUsersRows(users || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('admin-users-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = (users || []).filter(u => u.full_name.toLowerCase().includes(search) || (u.whatsapp_number || '').includes(search));
    const tbody = document.getElementById('admin-users-tbody');
    if (tbody) tbody.innerHTML = renderAdminUsersRows(filtered);
  });
};

const renderAdminUsersRows = (users) => {
  if (!users.length) return '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">No users found</td></tr>';
  return users.map(user => `
    <tr>
      <td>${user.full_name}</td>
      <td>${user.whatsapp_number}</td>
      <td>${user.location_barangay}</td>
      <td>${user.user_type}</td>
      <td>${new Date(user.created_at).toLocaleDateString('en-PH')}</td>
      <td class="admin-actions-cell">
        <button class="admin-btn admin-btn-sm" onclick="adminEditUser('${user.id}','${(user.full_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}','${user.whatsapp_number || ''}','${user.location_barangay || ''}')"><i class="fas fa-edit"></i></button>
        ${user.id !== currentProfile?.id ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="adminDeleteUser('${user.id}','${(user.full_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
};

window.adminEditUser = (id, name, whatsapp, barangay) => {
  createModal('Edit User Profile', `
    <div class="form-group"><label>Name *</label><input type="text" id="admin-user-name" value="${name}" /></div>
    <div class="form-group"><label>WhatsApp *</label><input type="text" id="admin-user-whatsapp" value="${whatsapp}" /></div>
    <div class="form-group"><label>Barangay</label><input type="text" id="admin-user-barangay" value="${barangay}" /></div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminSaveUser('${id}')">Save</button>
    </div>
  `);
};

window.adminSaveUser = async (id) => {
  const full_name = document.getElementById('admin-user-name').value.trim();
  const whatsapp_number = document.getElementById('admin-user-whatsapp').value.trim();
  const location_barangay = document.getElementById('admin-user-barangay').value.trim();
  const { error } = await supabase.from('profiles').update({ full_name, whatsapp_number, location_barangay }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('edited_user', id, full_name);
  closeModal();
  showToast('User updated!', 'success');
  loadAdminUsers();
};

window.adminDeleteUser = (id, name) => {
  createModal('Delete User', `
    <p style="margin-bottom:16px">Delete user "<strong>${name}</strong>"? All their data will be removed.</p>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmDeleteUser('${id}')"><i class="fas fa-trash"></i> Delete</button>
    </div>
  `);
};

window.adminConfirmDeleteUser = async (id) => {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('deleted_user', id);
  closeModal();
  showToast('User deleted!', 'success');
  loadAdminUsers();
};

// ============================================================
// ADMIN TAB: RATINGS
// ============================================================
const loadAdminRatings = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading ratings...</div>';

  const { data: ratings } = await supabase
    .from('ratings')
    .select('*, requester:profiles(full_name)')
    .order('created_at', { ascending: false });

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-star"></i> Ratings & Reviews (${ratings?.length || 0})</h3>
        <div class="admin-header-actions">
          <input type="text" id="admin-ratings-search" placeholder="Search reviews..." class="admin-search" />
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Reviewer</th><th>Stars</th><th>Review</th><th>Flagged</th><th>Date</th><th>Actions</th></tr>
          </thead>
          <tbody id="admin-ratings-tbody">
            ${renderAdminRatingsRows(ratings || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('admin-ratings-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = (ratings || []).filter(r => (r.review_text || '').toLowerCase().includes(search) || (r.requester?.full_name || '').toLowerCase().includes(search));
    const tbody = document.getElementById('admin-ratings-tbody');
    if (tbody) tbody.innerHTML = renderAdminRatingsRows(filtered);
  });
};

const renderAdminRatingsRows = (ratings) => {
  if (!ratings.length) return '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">No ratings found</td></tr>';
  return ratings.map(r => `
    <tr>
      <td>${r.requester?.full_name || 'Unknown'}</td>
      <td>${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</td>
      <td>${r.review_text || '—'}</td>
      <td>${r.flagged ? '<span style="color:var(--accent-red)">⚑ Flagged</span>' : '—'}</td>
      <td>${new Date(r.created_at).toLocaleDateString('en-PH')}</td>
      <td class="admin-actions-cell">
        <button class="admin-btn admin-btn-sm admin-btn-warning" onclick="adminFlagRating('${r.id}',${!r.flagged})">
          <i class="fas fa-flag"></i> ${r.flagged ? 'Unflag' : 'Flag'}
        </button>
        <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="adminDeleteRating('${r.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
};

window.adminFlagRating = async (id, flagged) => {
  const { error } = await supabase.from('ratings').update({ flagged }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction(flagged ? 'flagged_rating' : 'unflagged_rating', id);
  showToast(flagged ? 'Rating flagged' : 'Rating unflagged', 'info');
  loadAdminRatings();
};

window.adminDeleteRating = (id) => {
  createModal('Delete Review', `
    <p style="margin-bottom:16px">Delete this review? This cannot be undone.</p>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmDeleteRating('${id}')"><i class="fas fa-trash"></i> Delete</button>
    </div>
  `);
};

window.adminConfirmDeleteRating = async (id) => {
  const { error } = await supabase.from('ratings').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('deleted_rating', id);
  closeModal();
  showToast('Review deleted!', 'success');
  loadAdminRatings();
};

// ============================================================
// ADMIN TAB: PAYOUTS
// ============================================================
const loadAdminPayouts = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading payouts...</div>';

  const { data: payouts } = await supabase
    .from('payouts')
    .select('*, responder:responders(profile:profiles(full_name))')
    .order('requested_at', { ascending: false });

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-money-bill-wave"></i> Payout Requests (${payouts?.length || 0})</h3>
        <div class="admin-header-actions">
          <select id="admin-payout-filter" class="admin-filter">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
          <button class="admin-btn" onclick="adminExportPayoutsCSV()"><i class="fas fa-file-csv"></i> Export CSV</button>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Responder</th><th>Amount</th><th>GCash</th><th>Status</th><th>Requested</th><th>Actions</th></tr>
          </thead>
          <tbody id="admin-payouts-tbody">
            ${renderAdminPayoutsRows(payouts || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('admin-payout-filter')?.addEventListener('change', (e) => {
    const filter = e.target.value;
    const filtered = filter === 'all' ? (payouts || []) : (payouts || []).filter(p => p.status === filter);
    const tbody = document.getElementById('admin-payouts-tbody');
    if (tbody) tbody.innerHTML = renderAdminPayoutsRows(filtered);
  });
};

const renderAdminPayoutsRows = (payouts) => {
  if (!payouts.length) return '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">No payouts found</td></tr>';
  return payouts.map(p => `
    <tr>
      <td>${p.responder?.profile?.full_name || 'Unknown'}</td>
      <td>₱${(p.amount || 0).toFixed(2)}</td>
      <td>${p.gcash_number}</td>
      <td><span class="admin-status-badge admin-status-${p.status}">${p.status}</span></td>
      <td>${new Date(p.requested_at).toLocaleDateString('en-PH')}</td>
      <td class="admin-actions-cell">
        ${p.status === 'pending' ? `
          <button class="admin-btn admin-btn-sm admin-btn-success" onclick="adminProcessPayout('${p.id}')"><i class="fas fa-check"></i> Process</button>
          <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="adminRejectPayout('${p.id}')"><i class="fas fa-times"></i></button>
        ` : ''}
        ${p.status === 'approved' ? `
          <button class="admin-btn admin-btn-sm admin-btn-success" onclick="adminMarkPaid('${p.id}')"><i class="fas fa-money-bill"></i> Mark Paid</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
};

window.adminProcessPayout = (id) => {
  createModal('Process Payout', `
    <p style="margin-bottom:12px">Approve this payout request?</p>
    <div class="form-group"><label>Admin Notes (optional)</label><input type="text" id="admin-payout-notes" placeholder="e.g., GCash reference..." /></div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminConfirmProcessPayout('${id}')"><i class="fas fa-check"></i> Approve</button>
    </div>
  `);
};

window.adminConfirmProcessPayout = async (id) => {
  const notes = document.getElementById('admin-payout-notes').value.trim();
  const { error } = await supabase.from('payouts').update({ status: 'approved', admin_notes: notes, processed_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('approved_payout', id);
  closeModal();
  showToast('Payout approved!', 'success');
  loadAdminPayouts();
};

window.adminRejectPayout = (id) => {
  createModal('Reject Payout', `
    <div class="form-group"><label>Reason for rejection</label><textarea id="admin-payout-reject-reason" rows="3" placeholder="Enter reason..."></textarea></div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmRejectPayout('${id}')">Reject</button>
    </div>
  `);
};

window.adminConfirmRejectPayout = async (id) => {
  const reason = document.getElementById('admin-payout-reject-reason').value.trim() || 'Rejected by admin';
  const { error } = await supabase.from('payouts').update({ status: 'rejected', admin_notes: reason, processed_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('rejected_payout', id, reason);
  closeModal();
  showToast('Payout rejected', 'info');
  loadAdminPayouts();
};

window.adminMarkPaid = (id) => {
  createModal('Mark as Paid', `
    <div class="form-group"><label>GCash Reference Number *</label><input type="text" id="admin-gcash-ref" placeholder="e.g., 123456789012" required /></div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminConfirmMarkPaid('${id}')"><i class="fas fa-check"></i> Confirm Paid</button>
    </div>
  `);
};

window.adminConfirmMarkPaid = async (id) => {
  const ref = document.getElementById('admin-gcash-ref').value.trim();
  if (!ref) { showToast('GCash reference required', 'error'); return; }
  const { error } = await supabase.from('payouts').update({ status: 'paid', admin_notes: 'GCash ref: ' + ref, processed_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('marked_payout_paid', id, 'Ref: ' + ref);
  closeModal();
  showToast('Payout marked as paid! ✓', 'success');
  loadAdminPayouts();
};

window.adminExportPayoutsCSV = async () => {
  const { data: payouts } = await supabase
    .from('payouts')
    .select('*, responder:responders(profile:profiles(full_name))')
    .order('requested_at', { ascending: false });

  const rows = [['Responder', 'Amount', 'GCash', 'Status', 'Notes', 'Requested', 'Processed']];
  (payouts || []).forEach(p => {
    rows.push([
      p.responder?.profile?.full_name || '',
      p.amount,
      p.gcash_number,
      p.status,
      p.admin_notes || '',
      p.requested_at ? new Date(p.requested_at).toLocaleString('en-PH') : '',
      p.processed_at ? new Date(p.processed_at).toLocaleString('en-PH') : ''
    ]);
  });

  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payouts-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
};

// ============================================================
// ADMIN TAB: SETTINGS
// ============================================================
const loadAdminSettings = () => {
  const container = document.getElementById('admin-content');
  const settings = getAdminSettings();

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-cog"></i> System Settings</h3>
      </div>
      <div class="profile-section">
        <h3>Pricing Configuration</h3>
        <div class="form-group"><label>Base Delivery Fee (₱)</label><input type="number" id="setting-base-fee" value="${settings.baseFee}" min="0" /></div>
        <div class="form-group"><label>Per Item Fee (₱)</label><input type="number" id="setting-item-fee" value="${settings.perItemFee}" min="0" /></div>
        <div class="form-group"><label>Heavy Item Surcharge (₱)</label><input type="number" id="setting-heavy-surcharge" value="${settings.heavySurcharge}" min="0" /></div>
        <div class="form-group"><label>Distance Bonus to San Vicente (₱)</label><input type="number" id="setting-distance-bonus" value="${settings.distanceBonus}" min="0" /></div>
        <div class="form-group"><label>Featured Store Monthly Fee (₱)</label><input type="number" id="setting-featured-fee" value="${settings.featuredStoreFee}" min="0" /></div>
        <button class="btn-primary" onclick="adminSaveSettings()" style="margin-top:16px"><i class="fas fa-save"></i> Save Settings</button>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-database"></i> Data Management</h3>
      </div>
      <div class="profile-section">
        <button class="admin-btn admin-btn-primary" onclick="adminExportAllData()" style="margin-bottom:12px;display:block"><i class="fas fa-file-csv"></i> Export All Data to CSV</button>
        <button class="admin-btn admin-btn-danger" onclick="adminResetAppData()"><i class="fas fa-exclamation-triangle"></i> Reset All App Data</button>
        <p style="color:var(--text-secondary);font-size:12px;margin-top:8px">⚠️ Reset deletes all requests, ratings, and payouts. Cannot be undone.</p>
      </div>
    </div>
  `;
};

window.adminSaveSettings = () => {
  const settings = {
    baseFee: parseFloat(document.getElementById('setting-base-fee').value) || 100,
    perItemFee: parseFloat(document.getElementById('setting-item-fee').value) || 50,
    heavySurcharge: parseFloat(document.getElementById('setting-heavy-surcharge').value) || 200,
    distanceBonus: parseFloat(document.getElementById('setting-distance-bonus').value) || 50,
    featuredStoreFee: parseFloat(document.getElementById('setting-featured-fee').value) || 500
  };
  saveAdminSettings(settings);
  logAdminAction('updated_settings', null, JSON.stringify(settings));
  showToast('Settings saved!', 'success');
};

window.adminResetAppData = () => {
  createModal('⚠️ Reset All App Data', `
    <p style="color:var(--accent-red);font-weight:500;margin-bottom:12px">This will DELETE all requests, ratings, and payouts!</p>
    <p style="color:var(--text-secondary);margin-bottom:16px">Type "RESET" to confirm:</p>
    <div class="form-group"><input type="text" id="admin-reset-confirm" placeholder="Type RESET here" /></div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-danger" onclick="adminConfirmReset()"><i class="fas fa-exclamation-triangle"></i> Reset</button>
    </div>
  `);
};

window.adminConfirmReset = async () => {
  const confirm = document.getElementById('admin-reset-confirm').value;
  if (confirm !== 'RESET') { showToast('Type RESET to confirm', 'error'); return; }
  await Promise.all([
    supabase.from('ratings').delete().lte('created_at', new Date().toISOString()),
    supabase.from('payouts').delete().lte('created_at', new Date().toISOString()),
    supabase.from('requests').delete().lte('created_at', new Date().toISOString())
  ]);
  await logAdminAction('reset_app_data', null, 'All requests, ratings, and payouts deleted');
  closeModal();
  showToast('App data reset!', 'info');
};

window.adminExportAllData = async () => {
  const [{ data: requests }, { data: stores }, { data: responders }, { data: payouts }] = await Promise.all([
    supabase.from('requests').select('*'),
    supabase.from('stores').select('*'),
    supabase.from('responders').select('*, profile:profiles(full_name)'),
    supabase.from('payouts').select('*')
  ]);

  const requestsCsv = [['ID', 'Item', 'Status', 'Urgency', 'Terminal', 'Created']].concat(
    (requests || []).map(r => [r.id, r.item_name, r.status, r.urgency, r.terminal, r.created_at])
  ).map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');

  const blob = new Blob([requestsCsv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'psr-export-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported!', 'success');
};

// ============================================================
// ADMIN TAB: TERMINALS
// ============================================================
const loadAdminTerminals = async () => {
  const container = document.getElementById('admin-content');

  const { data: terminalStores } = await supabase
    .from('stores')
    .select('*')
    .eq('store_type', 'terminal')
    .order('name');

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-bus"></i> Terminal Management</h3>
        <button class="admin-btn admin-btn-primary" onclick="adminAddTerminal()"><i class="fas fa-plus"></i> Add Terminal</button>
      </div>

      <div class="admin-info-cards">
        <div class="admin-info-card">
          <h4><i class="fas fa-bus"></i> San Jose Terminal</h4>
          <p>Puerto Princesa City</p>
          <p style="color:var(--text-secondary);font-size:12px">Main departure point from PP</p>
        </div>
        <div class="admin-info-card">
          <h4><i class="fas fa-arrows-turn-right"></i> Roxas Junction</h4>
          <p>Roxas, Palawan</p>
          <p style="color:var(--text-secondary);font-size:12px">Mid-route interchange point</p>
        </div>
        <div class="admin-info-card">
          <h4><i class="fas fa-map-marker-alt"></i> San Vicente Terminal</h4>
          <p>San Vicente, Palawan</p>
          <p style="color:var(--text-secondary);font-size:12px">Final destination terminal</p>
        </div>
      </div>

      <div class="admin-table-wrap" style="margin-top:20px">
        <table class="admin-table">
          <thead>
            <tr><th>Name</th><th>Address</th><th>WhatsApp</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${(terminalStores || []).map(t => `
              <tr>
                <td>${t.name}</td>
                <td>${t.address}</td>
                <td>${t.whatsapp_number || '—'}</td>
                <td class="admin-actions-cell">
                  <button class="admin-btn admin-btn-sm" onclick="adminEditStore('${t.id}')"><i class="fas fa-edit"></i></button>
                  <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="adminDeleteStore('${t.id}','${(t.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">No terminal stores in database. Add one below.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

window.adminAddTerminal = () => {
  createModal('Add Terminal', `
    <div class="form-group"><label>Terminal Name *</label><input type="text" id="admin-store-name" placeholder="e.g., San Jose Terminal" required /></div>
    <div class="form-group"><label>Address *</label><input type="text" id="admin-store-address" placeholder="e.g., Rizal Ave, Puerto Princesa" required /></div>
    <div class="form-group"><label>Latitude</label><input type="number" id="admin-store-lat" step="any" placeholder="e.g., 9.7390" /></div>
    <div class="form-group"><label>Longitude</label><input type="number" id="admin-store-lng" step="any" placeholder="e.g., 118.7362" /></div>
    <div class="form-group"><label>WhatsApp Contact</label><input type="text" id="admin-store-whatsapp" placeholder="63XXXXXXXXXX" /></div>
    <input type="hidden" id="admin-store-type" value="terminal" />
    <input type="hidden" id="admin-store-featured" />
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="adminSaveTerminal()">Add Terminal</button>
    </div>
  `);
};

window.adminSaveTerminal = async () => {
  const name = document.getElementById('admin-store-name').value.trim();
  const address = document.getElementById('admin-store-address').value.trim();
  const latitude = parseFloat(document.getElementById('admin-store-lat').value) || 9.7390;
  const longitude = parseFloat(document.getElementById('admin-store-lng').value) || 118.7362;
  const whatsapp_number = document.getElementById('admin-store-whatsapp').value.trim() || null;
  if (!name || !address) { showToast('Name and address are required', 'error'); return; }
  const { error } = await supabase.from('stores').insert({ name, store_type: 'terminal', address, latitude, longitude, whatsapp_number });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAdminAction('added_terminal', null, name);
  closeModal();
  showToast('Terminal added!', 'success');
  loadAdminTerminals();
};

// ============================================================
// ADMIN TAB: LOGS
// ============================================================
const loadAdminLogs = async () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading logs...</div>';

  const { data: logs } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3><i class="fas fa-history"></i> Admin Action Log</h3>
        <div class="admin-header-actions">
          <input type="text" id="admin-logs-search" placeholder="Search logs..." class="admin-search" />
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Action</th><th>Target</th><th>Admin</th><th>Details</th><th>Time</th></tr>
          </thead>
          <tbody id="admin-logs-tbody">
            ${renderAdminLogsRows(logs || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('admin-logs-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = (logs || []).filter(l => l.action.includes(search) || (l.admin_name || '').toLowerCase().includes(search) || (l.details || '').toLowerCase().includes(search));
    const tbody = document.getElementById('admin-logs-tbody');
    if (tbody) tbody.innerHTML = renderAdminLogsRows(filtered);
  });
};

const renderAdminLogsRows = (logs) => {
  if (!logs.length) return '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">No admin actions yet</td></tr>';
  return logs.map(l => `
    <tr>
      <td><code style="color:var(--accent-blue);font-size:12px">${l.action}</code></td>
      <td style="font-size:12px;color:var(--text-secondary)">${l.target_id ? l.target_id.substring(0, 8) + '...' : '—'}</td>
      <td>${l.admin_name}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${l.details || '—'}</td>
      <td style="font-size:12px">${new Date(l.created_at).toLocaleString('en-PH')}</td>
    </tr>
  `).join('');
};

const showPostRequestModal = () => {
  const modal = createModal('Post New Request', `
    <form id="post-request-form">
      <div class="form-group">
        <label>Item Name *</label>
        <input type="text" id="req-item-name" required />
      </div>

      <div class="form-group">
        <label>Quantity *</label>
        <input type="text" id="req-quantity" placeholder="e.g., 5 bags, 2 boxes" required />
      </div>

      <div class="form-group">
        <label>Weight Estimate *</label>
        <select id="req-weight" required>
          <option value="">Select weight...</option>
          <option value="small">Small (&lt;5kg)</option>
          <option value="medium">Medium (5-20kg)</option>
          <option value="large">Large (20-100kg)</option>
          <option value="xl">XL (&gt;100kg)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Size Estimate *</label>
        <select id="req-size" required>
          <option value="">Select size...</option>
          <option value="s">Small</option>
          <option value="m">Medium</option>
          <option value="l">Large</option>
          <option value="xl">Extra Large</option>
        </select>
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea id="req-description" placeholder="Detailed description of the item..."></textarea>
      </div>

      <div class="form-group">
        <label>Product Link (optional)</label>
        <input type="url" id="req-link" placeholder="Lazada, Shopee, etc." />
      </div>

      <div class="form-group">
        <label>Terminal *</label>
        <select id="req-terminal" required>
          <option value="">Select terminal...</option>
          <option value="san_jose">🚐 San Jose Terminal (Puerto Princesa)</option>
          <option value="roxas">🔄 Roxas Junction</option>
          <option value="san_vicente">🏪 San Vicente Terminal</option>
        </select>
      </div>

      <div class="form-group">
        <label>Vehicle Needed *</label>
        <select id="req-vehicle" required>
          <option value="">Select vehicle...</option>
          <option value="motor">🛵 Motor (Small items, &lt;20kg)</option>
          <option value="van">🚐 Van (Medium items, appliances)</option>
          <option value="truck">🚛 6-Wheeler Truck (Construction, bulk)</option>
          <option value="any">Any (responder chooses)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Urgency *</label>
        <select id="req-urgency" required>
          <option value="">Select urgency...</option>
          <option value="urgent">🔴 Urgent (within 24hrs)</option>
          <option value="normal">🟡 Normal (2-3 days)</option>
          <option value="flexible">🟢 Flexible (anytime)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Delivery Preference *</label>
        <select id="req-delivery" required>
          <option value="">Select preference...</option>
          <option value="pickup">Pick up at San Vicente Terminal (free)</option>
          <option value="deliver">Deliver to my location (+₱50-100)</option>
          <option value="meet_junction">Meet at Roxas Junction</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Post Request</button>
      </div>
    </form>
  `);

  document.getElementById('post-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const requestData = {
      requester_id: currentUser.id,
      item_name: document.getElementById('req-item-name').value,
      quantity: document.getElementById('req-quantity').value,
      weight_estimate: document.getElementById('req-weight').value,
      size_estimate: document.getElementById('req-size').value,
      description: document.getElementById('req-description').value,
      product_link: document.getElementById('req-link').value,
      terminal: document.getElementById('req-terminal').value,
      vehicle_needed: document.getElementById('req-vehicle').value,
      urgency: document.getElementById('req-urgency').value,
      delivery_preference: document.getElementById('req-delivery').value,
      earnings_amount: calculateEarnings(
        document.getElementById('req-weight').value,
        document.getElementById('req-delivery').value
      )
    };

    const { error } = await supabase
      .from('requests')
      .insert(requestData);

    if (error) {
      showToast('Failed to post request: ' + error.message, 'error');
      return;
    }

    closeModal();
    showToast('Request posted successfully!', 'success');
    loadRequests();
  });
};

const calculateEarnings = (weight, delivery) => {
  let base = 100;
  let itemFee = 50;
  let heavySurcharge = (weight === 'large' || weight === 'xl') ? 200 : 0;
  let deliveryBonus = (delivery === 'deliver') ? 50 : 0;

  return base + itemFee + heavySurcharge + deliveryBonus;
};

const showBecomeResponderModal = () => {
  createModal('Become a Responder', `
    <form id="responder-form">
      <div class="form-group">
        <label>Vehicle Type *</label>
        <select id="resp-vehicle" required>
          <option value="">Select vehicle...</option>
          <option value="motor">Motor</option>
          <option value="van">Van</option>
          <option value="truck">6-Wheeler Truck</option>
          <option value="wing_van">Wing Van</option>
        </select>
      </div>

      <div class="form-group">
        <label>Service Areas *</label>
        <input type="text" id="resp-areas" placeholder="e.g., Puerto Princesa, San Vicente" required />
      </div>

      <div class="form-group">
        <label>Availability</label>
        <input type="text" id="resp-availability" placeholder="e.g., Daily, Weekends, 8AM-5PM" />
      </div>

      <p style="color: var(--text-secondary); font-size: 13px; margin: 16px 0;">
        Note: You'll need to provide vehicle photos and documents. Admin will verify your application.
      </p>

      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Submit Application</button>
      </div>
    </form>
  `);

  document.getElementById('responder-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const areas = document.getElementById('resp-areas').value.split(',').map(a => a.trim());

    const { error } = await supabase
      .from('responders')
      .insert({
        user_id: currentUser.id,
        vehicle_type: document.getElementById('resp-vehicle').value,
        service_areas: areas,
        availability: document.getElementById('resp-availability').value
      });

    if (error) {
      showToast('Failed to submit application: ' + error.message, 'error');
      return;
    }

    closeModal();
    showToast('Application submitted! Awaiting admin verification.', 'success');
    loadProfile();
  });
};

const openWhatsApp = async (userId) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('whatsapp_number')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.whatsapp_number) {
    window.open(`https://wa.me/${profile.whatsapp_number}`, '_blank');
  } else {
    showToast('WhatsApp number not available', 'error');
  }
};

const createModal = (title, content) => {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" onclick="closeModal()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-content">
        ${content}
      </div>
    </div>
  `;
  container.classList.add('active');

  container.addEventListener('click', (e) => {
    if (e.target === container) {
      closeModal();
    }
  });
};

window.closeModal = () => {
  document.getElementById('modal-container').classList.remove('active');
};

window.viewRequestDetails = (id) => {
  console.log('View request:', id);
};

window.viewResponderDetails = (id) => {
  console.log('View responder:', id);
};

window.claimRequest = claimRequest;
window.openWhatsApp = openWhatsApp;
window.showBecomeResponderModal = showBecomeResponderModal;
window.showPostRequestModal = showPostRequestModal;
window.requestPayout = async () => {
  const { data: responder } = await supabase
    .from('responders')
    .select('id, pending_earnings')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (responder && responder.pending_earnings > 0) {
    const { error } = await supabase
      .from('payouts')
      .insert({
        responder_id: responder.id,
        amount: responder.pending_earnings,
        gcash_number: currentProfile.whatsapp_number
      });

    if (error) {
      showToast('Failed to request payout: ' + error.message, 'error');
      return;
    }

    showToast('Payout requested successfully!', 'success');
    loadProfile();
  }
};

const showToast = (message, type = 'info') => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  toast.innerHTML = `
    <i class="fas ${icons[type]}"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
};

window.toggleAdminMode = toggleAdminMode;
window.showEditProfileModal = () => {
  createModal('Edit Profile', `
    <div class="form-group">
      <label>Name *</label>
      <input type="text" id="edit-name" value="${currentProfile.full_name}" required />
    </div>
    <div class="form-group">
      <label>WhatsApp *</label>
      <input type="tel" id="edit-whatsapp" value="${currentProfile.whatsapp_number}" pattern="639[0-9]{9}" required />
    </div>
    <div class="form-group">
      <label>Barangay</label>
      <input type="text" id="edit-barangay" value="${currentProfile.location_barangay}" />
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="saveEditProfile()">Save</button>
    </div>
  `);
};

window.saveEditProfile = () => {
  const name = document.getElementById('edit-name').value.trim();
  const whatsapp = document.getElementById('edit-whatsapp').value.trim();
  const barangay = document.getElementById('edit-barangay').value.trim();

  if (!name || !whatsapp) {
    showToast('Name and WhatsApp are required', 'error');
    return;
  }

  currentProfile = {
    ...currentProfile,
    full_name: name,
    whatsapp_number: whatsapp,
    location_barangay: barangay || currentProfile.location_barangay
  };
  saveProfileToStorage(currentProfile);

  supabase.from('profiles').update({
    full_name: currentProfile.full_name,
    whatsapp_number: currentProfile.whatsapp_number,
    location_barangay: currentProfile.location_barangay
  }).eq('id', currentProfile.id).then(({ error }) => {
    if (error) console.warn('Profile update to DB failed:', error.message);
  });

  closeModal();
  showToast('Profile updated!', 'success');
  loadProfile();
};

document.addEventListener('DOMContentLoaded', init);
