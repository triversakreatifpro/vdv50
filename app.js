import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, increment, getDoc, query, serverTimestamp, addDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE SETUP ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "demo", projectId: "demo" };

// TRY-CATCH Safety Wrapper untuk Firebase
let appFirebase, auth, db;
try {
    appFirebase = initializeApp(firebaseConfig);
    auth = getAuth(appFirebase);
    db = getFirestore(appFirebase);
    console.log("Firebase initialized successfully");
} catch (e) {
    console.error("Firebase init failed (Offline Mode Active):", e);
    // Dummy objects agar UI tidak crash total
    auth = { currentUser: null };
    db = {}; 
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'vdv-intl-v1';

// --- STATE ---
let currentUser = null;
let isAdmin = localStorage.getItem('vdv_admin_key') === 'vdv1februari2022';
let currentEditingEventId = null;

// --- DATA ---
const structureData = {
    1: { ketum: "Kak Ridwan Pasorong (Founder)", sekum: "Pionir 1", bendum: "Pionir 2", divisions: [] },
    2: { ketum: "Ketua Periode 2", sekum: "Sekum 2", bendum: "Bendum 2", divisions: [] },
    3: { ketum: "Ketua Periode 3", sekum: "Sekum 3", bendum: "Bendum 3", divisions: [] },
    4: { ketum: "Ketua Periode 4", sekum: "Sekum 4", bendum: "Bendum 4", divisions: [] },
    5: { 
        ketum: "Budi Santoso (2024/2025)",
        sekum: "Siti Aminah",
        bendum: "Rizky Pratama",
        divisions: [
            { name: "Bidang Litigasi", members: ["Andi", "Bayu", "Citra", "Dedi", "Eka"] },
            { name: "Bidang Kompetisi", members: ["Fajar", "Gita", "Hadi", "Indah", "Joko"] },
            { name: "Bidang Kaderisasi", members: ["Kiki", "Lina", "Mario", "Nina", "Oscar"] },
            { name: "Bidang Humas", members: ["Putri", "Qibil", "Rina", "Soni", "Tia"] },
            { name: "Bidang Danus", members: ["Umar", "Vivi", "Wawan", "Xena", "Yudi"] }
        ]
    }
};

const eventsDB = [
    { id: 'vr', title: "VR (Open Recruitment)", date: "21 Agustus", desc: "Penerimaan Anggota Baru VDV.", gform: "https://forms.google.com/vr", active: true },
    { id: 'vmcc', title: "VMCC Internal", date: "23 November", desc: "Kompetisi Peradilan Semu Internal.", gform: "https://forms.google.com/vmcc", active: false },
    { id: 'nmcc', title: "NMCC Nasional", date: "21 Mei", desc: "Delegasi Nasional membawa nama Unsrat.", gform: "https://forms.google.com/nmcc", active: false },
    { id: 'hut', title: "HUT VDV", date: "1 Februari", desc: "Dies Natalis & Syukuran Organisasi.", gform: "#", active: false }
];

// --- APP CONTROLLER (Global Object Rewrite) ---
window.app = {
    // Navigation
    nav: (page) => {
        const menu = document.getElementById('side-menu');
        const panel = document.getElementById('side-menu-panel');
        if (panel) {
            panel.classList.remove('translate-x-0');
            panel.classList.add('translate-x-full');
            setTimeout(() => { 
                if (menu) {
                    menu.classList.add('hidden'); 
                    menu.classList.remove('opacity-100'); 
                }
            }, 300);
        }

        document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(page);
        if (target) target.classList.remove('hidden');
        
        window.scrollTo({top: 0, behavior: 'smooth'});

        // Active State Nav
        document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
        // Mencari tombol nav yang sesuai (simple string match pada onclick)
        const activeBtn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(page));
        if(activeBtn) activeBtn.classList.add('active');

        // Init Page Specific
        if(page === 'structure') window.app.loadStructure(5);
        if(page === 'calendar') window.app.renderCalendar();
        if(window.lucide) window.lucide.createIcons();
    },

    toggleMenu: () => {
        const menu = document.getElementById('side-menu');
        const panel = document.getElementById('side-menu-panel');
        
        if(menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            // Sedikit delay agar transisi CSS berjalan
            setTimeout(() => { 
                menu.classList.add('opacity-100');
                panel.classList.remove('translate-x-full');
                panel.classList.add('translate-x-0');
            }, 10);
        } else {
            panel.classList.remove('translate-x-0');
            panel.classList.add('translate-x-full');
            menu.classList.remove('opacity-100');
            setTimeout(() => { menu.classList.add('hidden'); }, 300);
        }
    },

    loadStructure: (period) => {
        document.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        
        const data = structureData[period];
        const container = document.getElementById('org-chart-display');
        
        let html = `
            <div class="flex flex-col items-center gap-8 animate-slide-up">
                <div class="flex flex-col items-center">
                    <div class="w-24 h-24 rounded-full border-2 border-vdv-accent flex items-center justify-center bg-black mb-3 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                        <i data-lucide="user" class="w-10 h-10 text-vdv-accent"></i>
                    </div>
                    <div class="text-xl font-header font-bold text-vdv-accent text-center">${data.ketum}</div>
                    <div class="text-xs text-gray-500 uppercase tracking-widest">Ketua Umum</div>
                </div>

                <div class="flex gap-16 border-t border-white/10 pt-6 w-full justify-center">
                    <div class="text-center">
                        <div class="font-bold text-white">${data.sekum}</div>
                        <div class="text-xs text-gray-500 uppercase">Sekretaris</div>
                    </div>
                    <div class="text-center">
                        <div class="font-bold text-white">${data.bendum}</div>
                        <div class="text-xs text-gray-500 uppercase">Bendahara</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-5 gap-4 w-full mt-6">
                    ${data.divisions.length > 0 ? data.divisions.map(div => `
                        <div class="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition group">
                            <h4 class="text-vdv-accent font-bold text-sm mb-3 pb-2 border-b border-white/10 group-hover:border-vdv-accent transition">${div.name}</h4>
                            <ul class="space-y-1">
                                ${div.members.map(m => `<li class="text-xs text-gray-400 flex items-center gap-2"><span class="w-1 h-1 bg-gray-600 rounded-full"></span>${m}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('') : '<div class="col-span-5 text-center text-gray-600 italic py-8">Data divisi diarsipkan.</div>'}
                </div>
            </div>
        `;
        if (container) {
            container.innerHTML = html;
            if(window.lucide) window.lucide.createIcons();
        }
    },

    renderCalendar: () => {
        const container = document.getElementById('event-list-container');
        if (container) {
            container.innerHTML = eventsDB.map(ev => `
                <div onclick="app.viewEvent('${ev.id}')" class="bg-white/5 p-4 rounded-xl border-l-4 ${ev.active ? 'border-green-500' : 'border-gray-600'} cursor-pointer hover:bg-white/10 transition">
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="text-vdv-accent font-bold text-lg">${ev.date}</div>
                            <div class="text-white text-sm font-bold">${ev.title}</div>
                        </div>
                        ${ev.active ? '<span class="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded font-bold">BUKA</span>' : ''}
                    </div>
                </div>
            `).join('');
        }
        if(isAdmin && document.getElementById('admin-edit-btn')) document.getElementById('admin-edit-btn').classList.remove('hidden');
    },

    viewEvent: (id) => {
        currentEditingEventId = id;
        const ev = eventsDB.find(e => e.id === id);
        const detail = document.getElementById('event-detail-content');
        if (detail) {
            detail.innerHTML = `
                <div class="animate-slide-up">
                    <h2 class="text-3xl font-header font-bold text-vdv-accent mb-2">${ev.title}</h2>
                    <h3 class="text-5xl font-black text-white mb-6 tracking-tighter">${ev.date}</h3>
                    <p class="text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">${ev.desc}</p>
                    ${ev.active 
                        ? `<a href="${ev.gform}" target="_blank" class="btn-primary">Daftar Sekarang</a>`
                        : `<button class="btn-secondary opacity-50 cursor-not-allowed">Belum Dibuka</button>`
                    }
                </div>
            `;
        }
    },

    adminLogin: () => {
        const pass = prompt("Masukkan Passkey Admin:");
        if(pass === "vdv1februari2022") {
            localStorage.setItem('vdv_admin_key', pass);
            isAdmin = true;
            alert("Akses Admin: Diberikan.");
            window.app.checkAdmin();
            window.app.nav('calendar');
        } else {
            alert("Passkey Salah.");
        }
    },

    checkAdmin: () => {
        if(isAdmin) {
            if(document.getElementById('finance-panel')) document.getElementById('finance-panel').classList.remove('hidden');
            if(document.getElementById('admin-edit-btn')) document.getElementById('admin-edit-btn').classList.remove('hidden');
        }
    },

    adminEditEvent: () => {
        if(!isAdmin || !currentEditingEventId) return alert("Pilih event dulu.");
        const evIndex = eventsDB.findIndex(e => e.id === currentEditingEventId);
        const newDate = prompt("Tanggal Baru:", eventsDB[evIndex].date);
        if(newDate) {
            eventsDB[evIndex].date = newDate;
            window.app.renderCalendar();
            window.app.viewEvent(currentEditingEventId);
        }
    },

    handleLogin: async (e) => {
        e.preventDefault();
        const name = document.getElementById('login-name-input').value;
        if(!name) return;
        try {
            if(auth && !auth.currentUser) await signInAnonymously(auth);
            if(auth && auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: name });
                if (db) {
                    await setDoc(doc(db, `artifacts/${appId}/public/data/users`, auth.currentUser.uid), {
                        name: name, status: 'online', lastLogin: serverTimestamp()
                    }, { merge: true });
                }
            }
            document.getElementById('login-modal').classList.add('hidden');
            alert("Login Berhasil.");
        } catch(err) { alert("Login error: " + err.message); }
    }
};

// --- LISTENERS ---
if (auth) {
    onAuthStateChanged(auth, async (user) => {
        if(user && user.displayName) {
            if (db) await setDoc(doc(db, `artifacts/${appId}/public/data/users`, user.uid), { status: 'online', lastLogin: serverTimestamp() }, { merge: true });
        } else {
            setTimeout(() => {
                const modal = document.getElementById('login-modal');
                if (modal) modal.classList.remove('hidden');
            }, 2000);
        }
    });
}

if (db) {
    const q = query(collection(db, `artifacts/${appId}/public/data/users`), orderBy('lastLogin', 'desc'), limit(50));
    onSnapshot(q, (snap) => {
        const total = snap.size;
        let online = 0;
        const html = snap.docs.map(d => {
            const u = d.data();
            if(u.status === 'online') online++;
            return `<tr class="border-b border-white/5 hover:bg-white/5 transition">
                <td class="p-4 font-bold text-white">${u.name}</td>
                <td class="p-4"><span class="px-2 py-1 rounded text-[10px] ${u.status === 'online' ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}">${u.status || 'offline'}</span></td>
                <td class="p-4 text-xs text-gray-500">Baru Saja</td>
            </tr>`;
        }).join('');
        
        const tbody = document.getElementById('member-table-body');
        if (tbody) tbody.innerHTML = html;
        if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
        if(document.getElementById('stat-online')) document.getElementById('stat-online').innerText = online;
    });
}

// Init
window.app.checkAdmin();
window.app.renderCalendar();
if(window.lucide) window.lucide.createIcons();