<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useUserStore } from '../stores/user'
import { goToLogin } from '../services/auth'

const userStore = useUserStore()
const isSignedIn = computed(() => userStore.isSignedIn)
const username = computed(() => {
  const u = userStore.user || null
  if (!u) return ''
  const name = (u.username).toString().trim()
  if (name) return name
  const email = (u.email || '').toString()
  if (email && email.includes('@')) return email.split('@')[0]
  return 'You'
})
const lang = computed(() => userStore.user?.lang || '')

const open = ref(false)
const rootEl = ref(null)

function onClick() {
  if (!isSignedIn.value) {
    try { goToLogin() } catch {}
  } else {
    open.value = !open.value
  }
}

function onDocClick(e) {
  try {
    if (!open.value) return
    const el = rootEl.value
    if (el && e.target && !el.contains(e.target)) open.value = false
  } catch {}
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

// Logout function per spec: clear globals, cookies/storage, and redirect to server logout
function logout() {
  try {
    // if (typeof window.logout === 'function') window.logout()
  } catch (err) {
    // ignore
  }
  try {
    if (typeof globalState !== 'undefined' && globalState) {
      globalState.logged = false
      globalState.une = 'Welcome'
      globalState.lang = 'EN'
      try { globalState.currentTarget = '' } catch {}
    }
  } catch {}

  // Clear cookies
  try { document.cookie = 'target=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' } catch {}
  try { document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' } catch {}

  // Clear storage
  try { localStorage.removeItem('authToken') } catch {}

  const hostname = window.location.hostname
  const urllg = hostname === 'localhost'
    ? 'http://localhost/mapmoo/logout.php?site=LitterLogi'
    : 'https://liap.ca/logout.php?site=LitterLogi'

  window.location.href = urllg
}
</script>

<template>
  <div class="user-root" ref="rootEl">
    <button
      class="user-btn"
      :class="{ authed: isSignedIn }"
      title="User"
      aria-label="User"
      type="button"
      @click="onClick"
      aria-haspopup="true"
      :aria-expanded="isSignedIn ? String(open) : 'false'"
    >
      <!-- Default logo image -->
      <img class="icon" src="/moolabcow.png" alt="User" aria-hidden="true" />
    </button>

    <!-- Info card below the button when authenticated -->
    <div
      v-if="isSignedIn && open"
      class="user-card"
      role="dialog"
      aria-label="User information"
    >
      <div class="row"><span class="lab">Username</span><span class="val">{{ username }}</span></div>
      <div class="row"><span class="lab">Language</span><span class="val">{{ lang }}</span></div>
      <div class="actions">
        <button type="button" class="logout-btn" @click="logout">Logout</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-root { position: fixed; top: 12px; right: 12px; z-index: 60; }

.user-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  padding: 4px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(148,163,184,0.4);
  background: radial-gradient(120% 120% at 50% -20%, rgba(31,41,55,0.55) 0%, rgba(11,18,32,0.45) 48%, rgba(11,18,32,0.45) 100%);
  color: #e8f0fb;
  box-shadow: 0 8px 20px rgba(2,6,23,0.28);
  backdrop-filter: saturate(160%) blur(6px);
}
.user-btn .icon { width: 24px; height: 24px; display: block; }
.user-btn:active { transform: translateY(1px); }

/* Vibrant green when authenticated */
.user-btn.authed {
  background: linear-gradient(160deg, #10b981 0%, #16a34a 55%, #059669 100%);
  border-color: rgba(22,163,74,0.85);
  box-shadow: 0 10px 28px rgba(16,185,129,0.45);
}

.user-card {
  position: absolute;
  right: 0;
  top: 44px; /* below the button (36 + margin) */
  min-width: 180px;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff, #eef4fb);
  color: #0f172a;
  border: 1px solid rgba(15,23,42,0.18);
  box-shadow: 0 16px 40px rgba(2,6,23,0.28);
}
.user-card .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; }
.user-card .lab { color: #475569; font-size: 12px; }
.user-card .val { font-weight: 700; font-size: 13px; color: #0f172a; }
.user-card .actions { display: flex; justify-content: flex-end; padding-top: 8px; }
.logout-btn {
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(15,23,42,0.18);
  background: #f8fafc;
  color: #0f172a;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}
.logout-btn:hover { background: #eef2f7; }
.logout-btn:active { transform: translateY(1px); }

/* Keep it tucked below header menus on wide screens too */
@media (min-width: 1001px) {
  .user-root { top: 16px; right: 16px; }
}
</style>
