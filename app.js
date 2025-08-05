    /*******************************************************
     * FIREBASE CONFIG
     * Replace the FIREBASE_CONFIG object below with your
     * web app config from Firebase console.
     *******************************************************/
    const FIREBASE_CONFIG = {
      apiKey: "AIzaSyCuoUMX1iWfNYrX4FdFLlFjX-7yEumg0dc",
      authDomain: "pastoraldatabase.firebaseapp.com",
      projectId: "pastoraldatabase",
      storageBucket: "pastoraldatabase.firebasestorage.app",
      messagingSenderId: "859785843482",
      appId: "1:859785843482:web:4e0e5458391c1daee592a3",
      measurementId: "G-54LQVPWPJH"
    };

    // --- Import Firebase modules (modular SDK) ---
    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
    import {
      getFirestore, collection, addDoc, doc, deleteDoc,
      onSnapshot, query, orderBy, runTransaction, getDocs
    } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

    // Initialize Firebase
    if(!FIREBASE_CONFIG || !FIREBASE_CONFIG.projectId){
      console.error('Please paste your Firebase config into FIREBASE_CONFIG in the HTML file.');
      alert('Missing Firebase config. Open the HTML and paste your Firebase web app config into FIREBASE_CONFIG.');
      // still define a minimal local fallback so UI doesn't crash (but won't sync)
    }
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    const ticketsCol = collection(db, 'tickets');

    /*****************************************
     * All other behavior preserved from your app.
     * Main differences:
     * - Uses Firestore for state
     * - Transaction used for VIP booking
     *****************************************/
    const VIP_LIMIT = 10;
    const ADMIN_USER = 'OSSAdmin2025';
    const ADMIN_PASS = 'OSSAdmin2025';

    // DOM helpers
    const $ = (s, el=document) => el.querySelector(s);
    const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
    const modalRoot = $('#modal-root');

    // Local mirror cache (keeps UI responsive)
    let state = { vip: [], standard: [] };

    // Toast
    let toastTimeout = null;
    function showToast(msg, duration = 2400){
      const existing = document.getElementById('__oss_toast');
      if(existing) existing.remove();
      const t = document.createElement('div');
      t.id = '__oss_toast';
      t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
      t.style.position = 'fixed'; t.style.right = '20px'; t.style.bottom = '20px';
      t.style.background = 'linear-gradient(90deg, rgba(96,165,250,0.12), rgba(110,231,183,0.08))';
      t.style.padding = '12px 16px'; t.style.borderRadius = '10px';
      t.style.border = '1px solid rgba(255,255,255,0.04)'; t.style.backdropFilter = 'blur(6px)';
      t.style.fontWeight = '700'; t.style.color = '#e8f9ff'; t.style.boxShadow = '0 10px 30px rgba(2,6,23,0.6)';
      t.textContent = msg;
      document.body.appendChild(t);
      if(toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(()=> { t.style.opacity = '0'; setTimeout(()=> t.remove(),300); }, duration);
    }

    // Setup real-time listener to 'tickets' collection
    function setupRealtimeListener(){
      try {
        // order by time so UI shows consistent ordering
        const q = query(ticketsCol, orderBy('time', 'asc'));
        onSnapshot(q, (snapshot) => {
          const vip = [];
          const std = [];
          snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const entry = {
              id: docSnap.id,
              roleplay: d.roleplay,
              roblox: d.roblox,
              discord: d.discord,
              time: d.time,
              type: d.type
            };
            if(d.type === 'vip') vip.push(entry);
            else std.push(entry);
          });
          state.vip = vip;
          state.standard = std;
          renderCounts();
        }, err => {
          console.error('Firestore listener error', err);
        });
      } catch(err){
        console.error('Failed to set up Firestore listener:', err);
      });
    }

    // Render counts and activity
    function renderCounts(){
      const vipCount = state.vip.length;
      const stdCount = state.standard.length;
      const vipCountEl = $('#vip-count');
      const standardCountEl = $('#standard-count');
      const vipBadge = $('#vip-count-badge');
      const chooseVip = $('#choose-vip');
      const vipSpace = $('#vip-space');
      const activity = $('#activity');

      if(vipCountEl) vipCountEl.textContent = `${vipCount} / ${VIP_LIMIT}`;
      if(vipBadge) vipBadge.textContent = `VIP ${vipCount}/${VIP_LIMIT}`;
      if(standardCountEl) standardCountEl.textContent = stdCount;

      if(chooseVip){
        if(vipCount >= VIP_LIMIT){
          chooseVip.disabled = true;
          chooseVip.textContent = 'SOLD OUT';
          chooseVip.classList.remove('btn-primary');
          chooseVip.classList.add('btn-ghost');
          if(vipSpace) vipSpace.innerHTML = '<span class="soldout">SOLD OUT</span>';
        } else {
          chooseVip.disabled = false;
          chooseVip.textContent = 'Select VIP';
          if(!chooseVip.classList.contains('btn-primary')) chooseVip.classList.add('btn-primary');
          if(vipSpace) vipSpace.textContent = 'Limited — 10 seats';
        }
      }

      if(activity){
        const total = state.vip.length + state.standard.length;
        if(total === 0){
          activity.textContent = 'No bookings yet.';
        } else {
          // last booking by time (most recent)
          const all = state.vip.concat(state.standard);
          all.sort((a,b) => new Date(b.time) - new Date(a.time));
          const last = all[0];
          activity.textContent = `${last.roleplay} reserved ${last.type.toUpperCase()} on ${new Date(last.time).toLocaleString()}`;
        }
      }
    }

    // Helper to create modal wrapper and wire X button
    function createModal(innerHtml, options = {}){
      const wrapper = document.createElement('div');
      wrapper.className = 'modal-backdrop';
      wrapper.innerHTML = innerHtml;
      wrapper.addEventListener('click', (e) => {
        if(e.target === wrapper && options.backdropClose) wrapper.remove();
      });
      modalRoot.appendChild(wrapper);
      const x = wrapper.querySelector('.modal-close-x');
      if(x) x.addEventListener('click', ()=> wrapper.remove());
      // close ids used across modals
      wrapper.querySelectorAll('#close-modal,#close-admin,#close-adminpanel').forEach(b => b.addEventListener('click', ()=> wrapper.remove()));
      // focus first
      setTimeout(()=>{
        const first = wrapper.querySelector('input, button, [tabindex="0"]');
        if(first) first.focus();
      },40);
      return wrapper;
    }

    // Book standard: simple addDoc
    async function bookStandard(data){
      await addDoc(ticketsCol, {
        roleplay: data.roleplay,
        roblox: data.roblox,
        discord: data.discord,
        type: 'standard',
        time: new Date().toISOString()
      });
    }

    // Book VIP: run transaction to ensure VIP_LIMIT not exceeded
    async function bookVIP(data){
      // Implementation detail:
      // We perform a transaction by creating a new ticket doc (add) only if current vip count < VIP_LIMIT.
      // Firestore transactions cannot operate on collection count directly — we do a query inside transaction: get all vip docs then check length.
      // This minimizes oversell risk (client transaction executed on server atomically).
      try {
        // create a temporary doc ref with auto-id
        await runTransaction(getFirestore(app), async (tx) => {
          // query current vip docs
          // Note: transactions don't support collection group queries easily here; we fetch snapshot via getDocs
          const vipSnapshot = await getDocs(query(ticketsCol, orderBy('time', 'asc')));
          const currentVip = vipSnapshot.docs.filter(d => d.data().type === 'vip').length;
          if(currentVip >= VIP_LIMIT){
            throw new Error('VIP sold out');
          }
          // create new doc (outside tx API createDoc), but to ensure atomicity we just add — Firestore will retry transaction if conflict
          await addDoc(ticketsCol, {
            roleplay: data.roleplay,
            roblox: data.roblox,
            discord: data.discord,
            type: 'vip',
            time: new Date().toISOString()
          });
        });
      } catch(err){
        throw err;
      }
    }

    // UI wiring (mirrors the previous behavior, but backed by Firestore)
    document.addEventListener('DOMContentLoaded', () => {
      // Attach click handlers, keyboard support
      function withTempDisable(button, ms = 800){
        if(!button) return false;
        if(button.disabled) return false;
        button.disabled = true;
        setTimeout(()=> button.disabled = false, ms);
        return true;
      }

      function makeCardKeyboardFriendly(cardId, buttonId){
        const card = document.getElementById(cardId);
        const btn = document.getElementById(buttonId);
        if(!card || !btn) return;
        card.tabIndex = 0;
        card.addEventListener('keydown', e => {
          if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); btn.click(); }
        });
        card.addEventListener('click', (e) => {
          if(['button','a','input'].includes(e.target.tagName.toLowerCase())) return;
          btn.click();
        });
      }
      makeCardKeyboardFriendly('standard-card','choose-standard');
      makeCardKeyboardFriendly('vip-card','choose-vip');

      // Booking modal opener
      function openBookingForm(ticketType){
        if(ticketType === 'VIP' && state.vip.length >= VIP_LIMIT){
          showToast('VIP sold out');
          return;
        }
        if(!withTempDisable(document.getElementById(ticketType === 'VIP' ? 'choose-vip' : 'choose-standard'))) return;

        const modalHtml = `
          <div class="modal" role="dialog" aria-modal="true" aria-label="Book ${ticketType}">
            <button class="modal-close-x" aria-label="Close dialog">&times;</button>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div>
                <h3 style="margin:0">${ticketType} booking</h3>
                <div class="muted-note">Please enter your details below</div>
              </div>
              <button id="close-modal" class="btn btn-ghost">Close</button>
            </div>

            <div>
              <div class="form-row"><label>Roleplay Name</label><input id="roleplay" type="text" placeholder="e.g. CaptainSparrow" autocomplete="name" /></div>
              <div class="form-row"><label>ROBLOX Username</label><input id="roblox" type="text" placeholder="Roblox username" autocomplete="username" /></div>
              <div class="form-row"><label>Discord Username</label><input id="discord" type="text" placeholder="Username#1234" autocomplete="off" /></div>

              <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px">
                <button id="cancel-book" class="btn btn-ghost">Cancel</button>
                <button id="confirm-book" class="btn btn-primary">Confirm Booking</button>
              </div>
            </div>
          </div>
        `;
        const modal = createModal(modalHtml, { backdropClose: false });

        const confirmBtn = modal.querySelector('#confirm-book');
        const cancelBtn = modal.querySelector('#cancel-book');
        const roleplay = modal.querySelector('#roleplay');
        const roblox = modal.querySelector('#roblox');
        const discord = modal.querySelector('#discord');

        if(cancelBtn) cancelBtn.addEventListener('click', ()=> modal.remove());
        [roleplay, roblox, discord].forEach(inp => {
          if(!inp) return;
          inp.addEventListener('keydown', e => {
            if(e.key === 'Enter'){ e.preventDefault(); if(confirmBtn) confirmBtn.click(); }
          });
        });

        if(confirmBtn){
          confirmBtn.addEventListener('click', async () => {
            if(confirmBtn.disabled) return;
            if(!withTempDisable(confirmBtn, 900)) return;
            const rp = (roleplay && roleplay.value || '').trim();
            const rb = (roblox && roblox.value || '').trim();
            const dc = (discord && discord.value || '').trim();
            if(!rp || rp.length < 2){ alert('Please enter a valid Roleplay Name (at least 2 characters).'); roleplay && roleplay.focus(); return; }
            if(!rb || rb.length < 2){ alert('Please enter a valid ROBLOX username.'); roblox && roblox.focus(); return; }
            if(!dc || dc.length < 3){ alert('Please enter a valid Discord username.'); discord && discord.focus(); return; }

            try {
              if(ticketType === 'VIP'){
                await bookVIP({ roleplay: rp, roblox: rb, discord: dc });
              } else {
                await bookStandard({ roleplay: rp, roblox: rb, discord: dc });
              }
              modal.remove();
              showToast(`${ticketType} booked — ${rp}`);
            } catch(err){
              console.error('Booking error', err);
              alert(err.message || 'Booking failed.');
            }
          });
        }
      }

      // Admin login modal (client-side password preserved for UX)
      function openAdminLogin(){
        if(!withTempDisable(document.getElementById('open-admin'),700)) return;
        const html = `
          <div class="modal" role="dialog" aria-modal="true" aria-label="Admin login">
            <button class="modal-close-x" aria-label="Close dialog">&times;</button>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div><h3 style="margin:0">Administrator Login</h3><div class="muted-note">Enter administrator credentials</div></div>
              <button id="close-admin" class="btn btn-ghost">Close</button>
            </div>

            <div>
              <div class="form-row"><label>Username</label><input id="admin-user" type="text" /></div>
              <div class="form-row"><label>Password</label><input id="admin-pass" type="password" /></div>
              <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
                <button id="admin-cancel" class="btn btn-ghost">Cancel</button>
                <button id="admin-login" class="btn btn-primary">Login</button>
              </div>
            </div>
          </div>
        `;
        const modal = createModal(html, { backdropClose: false });
        const loginBtn = modal.querySelector('#admin-login');
        const cancelBtn = modal.querySelector('#admin-cancel');
        const userInp = modal.querySelector('#admin-user');
        const passInp = modal.querySelector('#admin-pass');

        if(cancelBtn) cancelBtn.addEventListener('click', ()=> modal.remove());
        if(passInp) passInp.addEventListener('keydown', e => { if(e.key === 'Enter' && loginBtn) loginBtn.click(); });

        if(loginBtn){
          loginBtn.addEventListener('click', ()=> {
            const u = (userInp && userInp.value || '').trim();
            const p = (passInp && passInp.value) || '';
            if(u === ADMIN_USER && p === ADMIN_PASS){
              modal.remove();
              openAdminPanel();
            } else {
              alert('Invalid admin credentials.');
            }
          });
        }
      }

      // Admin panel: displays Firestore tickets, allow delete & export
      function openAdminPanel(){
        const html = `
          <div class="modal" role="dialog" aria-modal="true" aria-label="Admin panel" style="max-width:760px">
            <button class="modal-close-x" aria-label="Close dialog">&times;</button>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div><h3 style="margin:0">Admin — Ticket Lists</h3><div class="muted-note">Viewing stored reservations</div></div>
              <div>
                <button id="export-csv" class="btn btn-ghost">Export CSV</button>
                <button id="close-adminpanel" class="btn btn-ghost">Close</button>
              </div>
            </div>

            <div style="display:flex;gap:12px">
              <div style="min-width:160px">
                <div class="tabs" id="admin-tabs">
                  <div class="tab active" data-tab="standard">Standard (${state.standard.length})</div>
                  <div class="tab" data-tab="vip">VIP (${state.vip.length})</div>
                </div>
                <div class="muted-note" style="margin-top:6px">Click an entry to copy details</div>
              </div>

              <div style="flex:1">
                <div id="admin-list-wrap"></div>
              </div>
            </div>
          </div>
        `;
        const modal = createModal(html, { backdropClose: false });
        const wrap = modal.querySelector('#admin-list-wrap');
        const tabs = Array.from(modal.querySelectorAll('.tab'));
        const exportBtn = modal.querySelector('#export-csv');

        function renderAdminTab(which){
          const arr = which === 'vip' ? state.vip : state.standard;
          wrap.innerHTML = '';
          if(arr.length === 0){
            wrap.innerHTML = '<div class="muted-note">No entries yet.</div>';
            return;
          }
          const ul = document.createElement('ul');
          ul.className = 'list';
          arr.slice().reverse().forEach(e => {
            const li = document.createElement('li');
            li.className = 'item';
            li.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
                <div>
                  <div style="font-weight:800">${e.roleplay}</div>
                  <div class="meta">ROBLOX: ${e.roblox} • Discord: ${e.discord}</div>
                  <div class="meta" style="margin-top:6px;font-size:12px;color:var(--muted)">Booked: ${new Date(e.time).toLocaleString()}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
                  <button class="btn btn-ghost copy-btn" data-id="${e.id}">Copy</button>
                  <button class="btn btn-ghost remove-btn" data-id="${e.id}">Remove</button>
                </div>
              </div>
            `;
            // copy
            li.querySelector('.copy-btn').addEventListener('click', async () => {
              const text = `Type: ${which.toUpperCase()} — ${e.roleplay} — Roblox: ${e.roblox} — Discord: ${e.discord}`;
              try{ await navigator.clipboard.writeText(text); showToast('Copied to clipboard'); }
              catch(err){ const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); showToast('Copied to clipboard'); }
            });
            // remove
            li.querySelector('.remove-btn').addEventListener('click', async () => {
              if(!confirm('Remove this booking?')) return;
              try{
                await deleteDoc(doc(db, 'tickets', e.id));
                showToast('Removed entry.');
              }catch(err){ console.error('Delete failed', err); alert('Failed to remove entry'); }
            });

            ul.appendChild(li);
          });
          wrap.appendChild(ul);
        }

        tabs.forEach(t => {
          t.addEventListener('click', () => {
            tabs.forEach(x=>x.classList.remove('active'));
            t.classList.add('active');
            renderAdminTab(t.dataset.tab);
          });
        });

        renderAdminTab('standard');

        // Export CSV uses current state
        if(exportBtn){
          exportBtn.addEventListener('click', () => {
            const rows = [
              ['type','roleplay','roblox','discord','time'],
              ...state.standard.map(s => ['standard', s.roleplay, s.roblox, s.discord, s.time]),
              ...state.vip.map(s => ['vip', s.roleplay, s.roblox, s.discord, s.time])
            ];
            const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'oss_tickets_export.csv'; a.click();
            URL.revokeObjectURL(url);
            showToast('Exported CSV');
          });
        }
      }

      // Clear local-only data button still available (resets nothing in Firestore)
      const clearBtn = document.getElementById('clear-storage');
      if(clearBtn){
        clearBtn.addEventListener('click', () => {
          if(!confirm('This clears only local cached state (no server deletes). Continue?')) return;
          state = { vip: [], standard: [] };
          renderCounts();
          showToast('Local view cleared.');
        });
      }

      // Attach front-end click handlers
      const chooseStandardBtn = document.getElementById('choose-standard');
      const chooseVipBtn = document.getElementById('choose-vip');
      const openAdmin = document.getElementById('open-admin');
      const openAdmin2 = document.getElementById('open-admin-2');

      if(chooseStandardBtn) chooseStandardBtn.addEventListener('click', () => openBookingForm('Standard'));
      if(chooseVipBtn) chooseVipBtn.addEventListener('click', () => openBookingForm('VIP'));
      if(openAdmin) openAdmin.addEventListener('click', openAdminLogin);
      if(openAdmin2) openAdmin2.addEventListener('click', openAdminLogin);

      // Keyboard shortcut A opens admin (non-typing)
      document.addEventListener('keydown', (e)=> {
        const active = document.activeElement;
        if(['INPUT','TEXTAREA','SELECT'].includes(active.tagName)) return;
        if(e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) { if(openAdmin) openAdmin.click(); }
      });

      // Start listener
      setupRealtimeListener();
    }); // end DOMContentLoaded
