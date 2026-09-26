(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cfg = window.ANIMO_CONFIG || {};
  const TEAM_KEY = 'animo_v14_team_members';
  let sb, user, signup = false, recovery = false;

  const note = (text) => { const t = $('#toast'); t.textContent = text; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); };
  const view = (name) => { $('#auth').hidden = name !== 'auth'; $('#recovery').hidden = name !== 'recovery'; $('#app').hidden = name !== 'app'; };
  const mode = (value) => { signup = value; $('#loginTab').classList.toggle('active', !value); $('#signupTab').classList.toggle('active', value); $('#authBtn').textContent = value ? 'Account maken' : 'Inloggen'; $('#forgot').hidden = value; $('#authMsg').textContent = ''; };
  const team = () => { try { return JSON.parse(localStorage.getItem(TEAM_KEY) || '[]'); } catch { return []; } };
  const saveTeam = (items) => localStorage.setItem(TEAM_KEY, JSON.stringify(items));
  const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  $('#loginTab').onclick = () => mode(false);
  $('#signupTab').onclick = () => mode(true);
  $('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim(), password = $('#password').value;
    const result = signup
      ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split(/[?#]/)[0] } })
      : await sb.auth.signInWithPassword({ email, password });
    $('#authMsg').textContent = result.error ? result.error.message : signup && !result.data.session ? 'Controleer je e-mail om het account te bevestigen.' : 'Gelukt.';
  };
  $('#forgot').onclick = async () => { const email = $('#email').value.trim(); if (!email) return note('Vul eerst je e-mailadres in.'); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split(/[?#]/)[0] }); note(error ? error.message : 'Herstelmail verstuurd.'); };
  $('#recoveryForm').onsubmit = async (e) => { e.preventDefault(); if ($('#pw1').value !== $('#pw2').value) return $('#recoveryMsg').textContent = 'Wachtwoorden zijn niet gelijk.'; const { error } = await sb.auth.updateUser({ password: $('#pw1').value }); if (error) return $('#recoveryMsg').textContent = error.message; recovery = false; await enter(user); };
  $('#logout').onclick = () => sb.auth.signOut();

  async function init() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { view('auth'); $('#authMsg').textContent = 'config.js is niet correct ingevuld.'; return; }
    sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange((event, session) => { if (event === 'PASSWORD_RECOVERY') { recovery = true; user = session?.user; view('recovery'); } else if (event === 'SIGNED_OUT') view('auth'); else if (session?.user && !recovery) enter(session.user); });
    const { data } = await sb.auth.getSession();
    if (data.session && !recovery) enter(data.session.user); else view('auth');
  }
  async function enter(u) { user = u; view('app'); $('#userEmail').textContent = u.email; renderTeam(); prefillInvite(); }

  $$('nav button').forEach((b) => b.onclick = () => { $$('nav button,.page').forEach((x) => x.classList.remove('active')); b.classList.add('active'); $('#' + b.dataset.page).classList.add('active'); window.scrollTo(0, 0); });
  $$('[data-close]').forEach((b) => b.onclick = () => b.closest('dialog').close());

  $('#addTeamMember').onclick = () => { $('#teamForm').reset(); $('#teamForm').elements.id.value = ''; $('#teamDialog').showModal(); };
  $('#teamForm').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target), items = team(), email = String(f.get('email')).trim().toLowerCase(), currentId = String(f.get('id') || '');
    if (items.some((x) => x.email === email && x.id !== currentId)) return note('Dit e-mailadres staat al in de teamlijst.');
    const data = { name: String(f.get('name') || '').trim(), email, role: String(f.get('role')), status: 'Uitnodiging klaar' };
    if (currentId) Object.assign(items.find((x) => x.id === currentId), data); else items.push({ id: id(), ...data });
    saveTeam(items); $('#teamDialog').close(); renderTeam(); note('Teamlid opgeslagen.');
  };
  $('#teamList').onclick = async (e) => {
    const items = team(), edit = e.target.closest('[data-edit]'), remove = e.target.closest('[data-remove]'), copy = e.target.closest('[data-copy]');
    if (edit) { const x = items.find((m) => m.id === edit.dataset.edit), f = $('#teamForm'); f.elements.id.value = x.id; f.elements.name.value = x.name; f.elements.email.value = x.email; f.elements.role.value = x.role; $('#teamDialog').showModal(); }
    if (remove && confirm('Teamlid verwijderen?')) { saveTeam(items.filter((m) => m.id !== remove.dataset.remove)); renderTeam(); }
    if (copy) { const x = items.find((m) => m.id === copy.dataset.copy), url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('invite_email', x.email); url.searchParams.set('invite_name', x.name); try { await navigator.clipboard.writeText(url.toString()); note('Uitnodigingslink gekopieerd.'); } catch { prompt('Kopieer de link:', url.toString()); } }
  };
  function renderTeam() {
    const labels = { employee: 'Medewerker', manager: 'Manager', owner: 'Eigenaar' };
    $('#teamList').innerHTML = team().map((x) => `<article class="team-row"><div><b>${x.name || 'Naam niet ingevuld'}</b><small>${x.email}</small></div><span>${labels[x.role]}</span><span class="pending">${x.status}</span><div><button data-copy="${x.id}">Link kopiëren</button><button data-edit="${x.id}">Aanpassen</button><button class="danger" data-remove="${x.id}">Verwijderen</button></div></article>`).join('') || '<p class="muted">Nog geen teamleden toegevoegd.</p>';
  }
  function prefillInvite() { const p = new URLSearchParams(location.search), email = p.get('invite_email'); if (!email) return; mode(true); $('#email').value = email; note('Maak een account met het vooraf ingevulde e-mailadres.'); }

  $('#mailReport').onclick = () => { $('#closeDayForm').reset(); $('#closeDayForm').elements.closed_by.value = user?.email || ''; $('#closeDaySummary').innerHTML = `<p><b>Temperaturen:</b> ${$('#sTemp').textContent}<br><b>Kuistaken:</b> ${$('#sClean').textContent}<br><b>Open acties:</b> ${$('#sAct').textContent}</p>`; $('#closeDayDialog').showModal(); };
  $('#closeDayForm').onsubmit = (e) => { e.preventDefault(); const p = Object.fromEntries(new FormData(e.target).entries()), html = `<!doctype html><html><body><h1>ANIMO HACCP dagafsluiting</h1>${$('#closeDaySummary').innerHTML}<p>Afgesloten door: ${p.closed_by}</p><p>${p.note || ''}</p><button onclick="print()">Afdrukken / PDF</button></body></html>`, w = open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } const subject = encodeURIComponent('ANIMO HACCP dagafsluiting'); const body = encodeURIComponent(`Dagafsluiting door ${p.closed_by}.\nTemperaturen: ${$('#sTemp').textContent}\nKuistaken: ${$('#sClean').textContent}\nOpen acties: ${$('#sAct').textContent}\n${p.note || ''}`); location.href = `mailto:?subject=${subject}&body=${body}`; $('#closeDayDialog').close(); };

  init();
})();
