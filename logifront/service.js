// service.js - backend integration (PHP). Same-origin AJAX.
// All methods return promises to mirror async server calls.

(function(global){
  // Determine backend base URL
  // Priority:
  // 1) window.BACK_BASE if explicitly set
  // 2) If running on puppi.liap.ca (or any subdomain of liap.ca pointing to puppi), use absolute live URL
  // 3) Fallback to same-origin relative path for local/dev
  const HOST = (typeof window !== 'undefined' ? window.location.hostname : '');
  const LIVE_BASE = 'https://puppi.liap.ca/logiback';
  const BACK_BASE = (typeof window !== 'undefined' && window.BACK_BASE)
    ? window.BACK_BASE
    : (HOST && HOST.endsWith('liap.ca') ? LIVE_BASE : '../logiback');

  function readCookie(name){
    try{
      const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g,'\\$1') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    }catch(_){ return '' }
  }

  function getAuthToken(){
    try{ const t = localStorage.getItem('authToken'); if (t) return t }catch(_){ }
    return readCookie('authToken');
  }

  async function checkSession(){
    try{
      const token = getAuthToken();
      const resp = await fetch(BACK_BASE + '/api/check_session.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token })
      });

      let data = null;
      try { data = await resp.json(); } catch(_) { data = null }

      if (!resp.ok) {
        const message = data && (data.message || data.error) ? (data.message || data.error) : ('HTTP ' + resp.status);
        return { ok:false, status: (data && data.status) || 'error', message };
      }

      // Normalize success shape with ok flag for callers that expect it
      if (data && typeof data === 'object') {
        if (data.status && data.status !== 'authenticated') {
          // backend conveyed a non-success status but HTTP 200
          return { ok:false, ...data };
        }
        return { ok:true, ...data };
      }

      return { ok:false, status:'error', message:'Empty response' };
    }catch(e){
      console.debug('[Service] checkSession error:', e.message);
      return { ok:false, status:'network', message:e.message };
    }
  }

  async function loadLitters(){
    const resp = await fetch(BACK_BASE + '/users/litters_read.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if(!resp.ok) throw new Error('Failed to load litters');
    const data = await resp.json();
    if(data.status !== 'ok') throw new Error(data.message || 'Load error');
    return data.items || [];
  }

  async function saveLitter(litter){
    const resp = await fetch(BACK_BASE + '/users/litters_write.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ litter })
    });
    if(!resp.ok) throw new Error('Failed to save litter');
    const data = await resp.json();
    if(data.status !== 'ok') throw new Error(data.message || 'Save error');
    return data.litter;
  }

  // Placeholders for future endpoints using newly created tables
  async function updatePregnancy(preg){
    console.debug('[Service] updatePregnancy not implemented on backend yet:', preg);
    return { ok:true };
  }

  async function addPuppy(puppy){
    console.debug('[Service] addPuppy not implemented on backend yet:', puppy);
    return { ok:true };
  }

  async function savePhoto({ litterId, imageDataUrl, takenAt, puppyIds }){
    const resp = await fetch(BACK_BASE + '/users/photos_write.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ litterId, imageDataUrl, takenAt, puppyIds })
    });
    if(!resp.ok) throw new Error('Failed to save photo');
    const data = await resp.json();
    if(data.status !== 'ok') throw new Error(data.message || 'Save photo error');
    return data.item;
  }

  async function loadPhotos(litterId){
    const resp = await fetch(BACK_BASE + '/users/photos_read.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ litterId })
    });
    if(!resp.ok) throw new Error('Failed to load photos');
    const data = await resp.json();
    if(data.status !== 'ok') throw new Error(data.message || 'Load photos error');
    return data.items || [];
  }

  global.PuppilogService = { checkSession, loadLitters, saveLitter, updatePregnancy, addPuppy, savePhoto, loadPhotos };
})(window);
