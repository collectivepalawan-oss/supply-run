import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentProfile = null;
let currentView = 'home';

const init = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await handleAuthStateChange(session);
  } else {
    showAuthScreen();
  }

  setupEventListeners();
  hideLoading();
};

const hideLoading = () => {
  document.getElementById('loading-screen').classList.add('hidden');
};

const showAuthScreen = () => {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
};

const showMainApp = () => {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
};

const handleAuthStateChange = async (session) => {
  if (!session) {
    showAuthScreen();
    return;
  }

  currentUser = session.user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  currentProfile = profile;

  showMainApp();
  await loadHomeData();

  if (currentProfile?.is_admin) {
    addAdminNavItem();
  }
};

const addAdminNavItem = () => {
  const nav = document.querySelector('.bottom-nav');
  const existingAdmin = nav.querySelector('[data-view="admin"]');

  if (!existingAdmin) {
    const adminBtn = document.createElement('button');
    adminBtn.className = 'nav-item';
    adminBtn.dataset.view = 'admin';
    adminBtn.innerHTML = '<i class="fas fa-shield-halved"></i><span>Admin</span>';
    nav.appendChild(adminBtn);
  }
};

const setupEventListeners = () => {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');

      if (tabName === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
      } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
      }
    });
  });

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('register-btn').addEventListener('click', handleRegister);

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

const handleLogin = async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  await handleAuthStateChange(data.session);
  showToast('Welcome back!', 'success');
};

const handleRegister = async () => {
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const fullName = document.getElementById('reg-fullname').value;
  const whatsapp = document.getElementById('reg-whatsapp').value;
  const gcash = document.getElementById('reg-gcash').value;
  const barangay = document.getElementById('reg-barangay').value;
  const landmark = document.getElementById('reg-landmark').value;
  const userType = document.getElementById('reg-usertype').value;

  if (!email || !password || !fullName || !whatsapp || !barangay || !userType) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: data.user.id,
      full_name: fullName,
      whatsapp_number: whatsapp,
      gcash_number: gcash || null,
      location_barangay: barangay,
      location_landmark: landmark || null,
      user_type: userType
    });

  if (profileError) {
    showToast('Error creating profile: ' + profileError.message, 'error');
    return;
  }

  await handleAuthStateChange(data.session);
  showToast('Account created successfully!', 'success');
};

const handleLogout = async () => {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showAuthScreen();
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
        ${req.requester && req.requester.id !== currentUser?.id ?
          `<button class="card-btn card-btn-whatsapp" onclick="event.stopPropagation(); openWhatsApp('${req.requester.id}')">
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

  const { data: myRequests } = await supabase
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
          <span class="info-label">Location</span>
          <span class="info-value">${currentProfile.location_barangay}</span>
        </div>
        <div class="info-row">
          <span class="info-label">User Type</span>
          <span class="info-value">${formatStoreType(currentProfile.user_type)}</span>
        </div>
        ${currentProfile.gcash_number ? `
          <div class="info-row">
            <span class="info-label">GCash</span>
            <span class="info-value">${currentProfile.gcash_number}</span>
          </div>
        ` : ''}
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
      ${(currentProfile.user_type === 'responder' || currentProfile.user_type === 'both') ? `
        <div class="profile-section">
          <h3><i class="fas fa-truck"></i> Become a Responder</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">You haven't set up your responder profile yet.</p>
          <button class="btn-primary" onclick="showBecomeResponderModal()">
            <i class="fas fa-truck"></i> Setup Responder Profile
          </button>
        </div>
      ` : ''}
    `}

    <div class="profile-section">
      <h3><i class="fas fa-box"></i> My Requests</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <i class="fas fa-boxes"></i>
          <div class="stat-content">
            <h3>${myRequests?.count || 0}</h3>
            <p>Total Requests</p>
          </div>
        </div>
      </div>
    </div>
  `;
};

const loadAdminDashboard = () => {
  const container = document.getElementById('admin-content');
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-shield-halved"></i>
      <p>Admin dashboard coming soon...</p>
    </div>
  `;
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
        gcash_number: currentProfile.gcash_number
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

supabase.auth.onAuthStateChange((event, session) => {
  (async () => {
    if (event === 'SIGNED_IN') {
      await handleAuthStateChange(session);
    } else if (event === 'SIGNED_OUT') {
      showAuthScreen();
    }
  })();
});

document.addEventListener('DOMContentLoaded', init);
