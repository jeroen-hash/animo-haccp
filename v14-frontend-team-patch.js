(() => {
  'use strict';

  const STORAGE_KEY = 'animo_v14_frontend_team_members';
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) {
      window.alert(message);
      return;
    }
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function getMembers() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveMembers(members) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function moveDayCloseButton() {
    const dashboard = $('#dash');
    const reportButton = $('#mailReport');
    if (!dashboard || !reportButton) return;

    let header = $('.v14-dashboard-header', dashboard);
    if (!header) {
      header = document.createElement('div');
      header.className = 'v14-dashboard-header';

      const heading = $('h1', dashboard);
      if (heading) {
        heading.parentNode.insertBefore(header, heading);
        header.appendChild(heading);
      } else {
        dashboard.prepend(header);
      }
    }

    reportButton.textContent = 'Dag afsluiten en mailen';
    reportButton.classList.add('v14-close-day-button');
    header.appendChild(reportButton);
  }

  function createTeamManager() {
    const manageSection = $('#manage');
    const manageGrid = $('.manage', manageSection);
    if (!manageSection || !manageGrid || $('#v14TeamCard')) return;

    const card = document.createElement('section');
    card.id = 'v14TeamCard';
    card.className = 'card v14-team-card';
    card.innerHTML = `
      <div class="v14-team-heading">
        <div>
          <h2>Teamleden</h2>
          <p class="muted">Voeg teamleden toe, kies een rol en verwijder teamleden wanneer nodig.</p>
        </div>
        <button id="v14AddTeamMember" type="button" class="primary">+ Teamlid</button>
      </div>
      <div id="v14TeamList" class="v14-team-list"></div>
    `;
    manageGrid.appendChild(card);

    const dialog = document.createElement('dialog');
    dialog.id = 'v14TeamDialog';
    dialog.innerHTML = `
      <form id="v14TeamForm">
        <input name="id" type="hidden">
        <h2>Teamlid toevoegen</h2>
        <p class="muted">Een persoon zonder account krijgt de status <strong>Uitnodiging klaar</strong>. Kopieer daarna de uitnodigingslink.</p>
        <label>
          Naam
          <input name="name" autocomplete="name" placeholder="Naam teamlid">
        </label>
        <label>
          E-mailadres
          <input name="email" type="email" autocomplete="email" required>
        </label>
        <label>
          Rol
          <select name="role" required>
            <option value="employee">Medewerker</option>
            <option value="manager">Manager</option>
            <option value="owner">Eigenaar</option>
          </select>
        </label>
        <div class="buttons">
          <button id="v14CancelTeam" type="button">Annuleren</button>
          <button class="primary" type="submit">Bewaren</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);

    $('#v14AddTeamMember').addEventListener('click', () => {
      const form = $('#v14TeamForm');
      form.reset();
      form.elements.id.value = '';
      dialog.showModal();
    });

    $('#v14CancelTeam').addEventListener('click', () => dialog.close());

    $('#v14TeamForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') || '').trim().toLowerCase();
      const name = String(formData.get('name') || '').trim();
      const role = String(formData.get('role') || 'employee');
      const id = String(formData.get('id') || '');
      const members = getMembers();

      const duplicate = members.find((member) => member.email === email && member.id !== id);
      if (duplicate) {
        showToast('Dit e-mailadres staat al in de teamlijst.');
        return;
      }

      if (id) {
        const member = members.find((item) => item.id === id);
        if (member) Object.assign(member, { name, email, role });
      } else {
        members.push({
          id: createId(),
          name,
          email,
          role,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }

      saveMembers(members);
      dialog.close();
      renderTeamMembers();
      showToast('Teamlid opgeslagen.');
    });

    $('#v14TeamList').addEventListener('click', async (event) => {
      const editButton = event.target.closest('[data-team-edit]');
      const removeButton = event.target.closest('[data-team-remove]');
      const copyButton = event.target.closest('[data-team-copy]');
      const members = getMembers();

      if (editButton) {
        const member = members.find((item) => item.id === editButton.dataset.teamEdit);
        if (!member) return;
        const form = $('#v14TeamForm');
        form.elements.id.value = member.id;
        form.elements.name.value = member.name || '';
        form.elements.email.value = member.email;
        form.elements.role.value = member.role;
        dialog.showModal();
      }

      if (removeButton) {
        const member = members.find((item) => item.id === removeButton.dataset.teamRemove);
        if (!member) return;
        if (!window.confirm(`Teamlid ${member.email} verwijderen?`)) return;
        saveMembers(members.filter((item) => item.id !== member.id));
        renderTeamMembers();
        showToast('Teamlid verwijderd.');
      }

      if (copyButton) {
        const member = members.find((item) => item.id === copyButton.dataset.teamCopy);
        if (!member) return;
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('invite_email', member.email);
        url.searchParams.set('invite_role', member.role);
        url.searchParams.set('invite_name', member.name || '');

        try {
          await navigator.clipboard.writeText(url.toString());
          showToast('Uitnodigingslink gekopieerd.');
        } catch {
          window.prompt('Kopieer deze uitnodigingslink:', url.toString());
        }
      }
    });

    renderTeamMembers();
  }

  function roleLabel(role) {
    return ({ employee: 'Medewerker', manager: 'Manager', owner: 'Eigenaar' })[role] || role;
  }

  function renderTeamMembers() {
    const container = $('#v14TeamList');
    if (!container) return;
    const members = getMembers();

    if (!members.length) {
      container.innerHTML = '<div class="v14-team-empty">Nog geen teamleden toegevoegd.</div>';
      return;
    }

    container.innerHTML = members.map((member) => `
      <article class="v14-team-member">
        <div class="v14-team-avatar">${escapeHtml((member.name || member.email).slice(0, 1).toUpperCase())}</div>
        <div class="v14-team-details">
          <strong>${escapeHtml(member.name || 'Naam niet ingevuld')}</strong>
          <span>${escapeHtml(member.email)}</span>
        </div>
        <span class="v14-role-badge">${escapeHtml(roleLabel(member.role))}</span>
        <span class="v14-pending-badge">Uitnodiging klaar</span>
        <div class="v14-team-actions">
          <button type="button" data-team-copy="${member.id}">Link kopiëren</button>
          <button type="button" data-team-edit="${member.id}">Aanpassen</button>
          <button type="button" class="danger" data-team-remove="${member.id}">Verwijderen</button>
        </div>
      </article>
    `).join('');
  }

  function prefillInviteSignup() {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('invite_email');
    if (!email) return;

    const signupTab = $('#signupTab');
    if (signupTab) signupTab.click();

    const emailField = $('#email') || $('#authForm [name="email"]');
    const nameField = $('#authForm [name="full_name"]');
    if (emailField) emailField.value = email;
    if (nameField) nameField.value = params.get('invite_name') || '';

    showToast('Uitnodiging geopend. Maak een account met dit e-mailadres.');
  }

  function initialise() {
    moveDayCloseButton();
    createTeamManager();
    prefillInviteSignup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise);
  } else {
    initialise();
  }
})();
