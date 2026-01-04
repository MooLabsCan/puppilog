// service.js - backend integration (PHP). Same-origin AJAX.
// All methods return promises to mirror async server calls.

(function(global){
  const BACK_BASE = '../logiback';

  async function checkSession(){
    try{
      const resp = await fetch(BACK_BASE + '/api/check_session.php', { credentials:'include' });
      if(!resp.ok) throw new Error('network');
      return await resp.json();
    }catch(e){
      console.debug('[Service] checkSession skipped:', e.message);
      return { ok:false };
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
