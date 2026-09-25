(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let client, currentUser, profile, branches = [];

  function addStyles(){if(!document.querySelector('link[href="production-enhancements.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='production-enhancements.css';document.head.appendChild(l)}}
  function toast(text){const t=$('#toast');if(t){t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}else alert(text)}
  async function audit(action, entityType, entityId=null, details={}){if(!client||!currentUser)return;await client.from('audit_log').insert({action,entity_type:entityType,entity_id:entityId,details,user_agent:navigator.userAgent})}
  async function loadContext(){
    if(!window.supabase||!window.ANIMO_CONFIG)return;
    client=window.supabase.createClient(window.ANIMO_CONFIG.SUPABASE_URL,window.ANIMO_CONFIG.SUPABASE_ANON_KEY);
    const {data:{user}}=await client.auth.getUser();if(!user)return;currentUser=user;
    const {data:p}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();profile=p;
    let {data:b}=await client.from('branch_memberships').select('role,branches(id,name,address,organisation_id)').eq('user_id',user.id);
    if(!b?.length){
      const {data:settings}=await client.from('business_settings').select('company_name,site_name,address').maybeSingle();
      const {error:bootError}=await client.rpc('bootstrap_organisation',{p_org_name:settings?.company_name||'ANIMO HACCP klant',p_branch_name:settings?.site_name||'Hoofdvestiging',p_address:settings?.address||''});
      if(bootError){toast('Organisatie kon niet worden aangemaakt: '+bootError.message);return}
      ({data:b}=await client.from('branch_memberships').select('role,branches(id,name,address,organisation_id)').eq('user_id',user.id));
    }
    branches=(b||[]).map(x=>({...x.branches,role:x.role}));
    const saved=localStorage.getItem('animo_active_branch');if(!saved&&branches[0])localStorage.setItem('animo_active_branch',branches[0].id);
    renderProductionPanel();applyRolePermissions();
  }
  function applyRolePermissions(){
    const role=profile?.platform_role||branches[0]?.role||'employee';
    document.documentElement.dataset.role=role;
    if(role==='employee'){
      document.querySelectorAll('[data-page="manage"],button[onclick*="delete"],button[onclick*="remove"]').forEach(el=>el.hidden=true);
    }
  }
  function renderProductionPanel(){
    const manage=$('#manage');if(!manage||$('#productionPanel'))return;
    const branchOptions=branches.map(b=>`<option value="${b.id}">${esc(b.name)} (${esc(b.role)})</option>`).join('');
    manage.insertAdjacentHTML('beforeend',`<section id="productionPanel" class="prod-panel"><h2>Productiebeheer</h2><div class="prod-grid"><div><h3>Vestiging en rol</h3><label>Actieve vestiging<select id="activeBranch">${branchOptions||'<option>Geen vestiging toegewezen</option>'}</select></label><p>Rol: <span class="prod-badge">${esc(profile?.platform_role||branches[0]?.role||'employee')}</span></p></div><div><h3>Abonnement</h3><p id="subscriptionState">Status wordt geladen...</p><div class="prod-actions"><button id="startSubscription" type="button">Abonnement starten</button><button id="manageSubscription" type="button">Abonnement beheren</button></div></div><div><h3>Back-up en export</h3><p class="prod-small">Exporteer een leesbare kopie van de gegevens die zichtbaar zijn voor de ingelogde gebruiker.</p><button id="exportData" type="button">Gegevens exporteren</button></div><div><h3>Juridisch</h3><p><a href="privacy.html" target="_blank">Privacyverklaring</a><br><a href="terms.html" target="_blank">Gebruiksvoorwaarden</a></p></div></div><h3>Auditlog</h3><div id="auditPreview">Laden...</div></section>`);
    $('#activeBranch')?.addEventListener('change',e=>{localStorage.setItem('animo_active_branch',e.target.value);audit('branch.selected','branch',e.target.value)});
    $('#exportData').onclick=exportData;$('#startSubscription').onclick=()=>openBilling('create-checkout-session');$('#manageSubscription').onclick=()=>openBilling('create-customer-portal');
    loadSubscription();loadAudit();
  }
  async function loadSubscription(){const {data}=await client.from('subscriptions').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle();$('#subscriptionState').textContent=data?`${data.status} · ${data.plan_code||'abonnement'}`:'Nog geen actief abonnement.'}
  async function openBilling(fn){try{const {data,error}=await client.functions.invoke(fn,{body:{return_url:location.href}});if(error)throw error;if(!data?.url)throw new Error('Geen betaal-URL ontvangen.');location.href=data.url}catch(e){toast('Betaling is nog niet geconfigureerd: '+e.message)}}
  async function exportData(){
    const tables=['temperature_records','cleaning_checks','corrective_actions','allergen_plan_items','audit_log'];const result={exported_at:new Date().toISOString(),user:currentUser.email,data:{}};
    for(const table of tables){const {data,error}=await client.from(table).select('*').limit(5000);result.data[table]=error?{error:error.message}:data}
    const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`animo-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);await audit('data.exported','system');
  }
  async function loadAudit(){const {data,error}=await client.from('audit_log').select('created_at,action,entity_type').order('created_at',{ascending:false}).limit(20);const el=$('#auditPreview');if(error){el.textContent='Auditlog nog niet beschikbaar.';return}el.innerHTML=`<table class="prod-table"><tr><th>Tijd</th><th>Actie</th><th>Onderdeel</th></tr>${data.map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('nl-BE')}</td><td>${esc(x.action)}</td><td>${esc(x.entity_type)}</td></tr>`).join('')}</table>`}
  function bindAuditEvents(){document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const text=b.textContent.trim().toLowerCase();if(text.includes('opslaan')||text.includes('afvinken')||text.includes('voltooid'))audit('ui.submit','button',b.id||null,{label:b.textContent.trim()});if(text.includes('wis')||text.includes('verwijder'))audit('ui.delete_attempt','button',b.id||null,{label:b.textContent.trim()})},true)}
  async function boot(){addStyles();bindAuditEvents();for(let i=0;i<20;i++){if(window.supabase&&window.ANIMO_CONFIG&&$('#app'))break;await new Promise(r=>setTimeout(r,250))}await loadContext()}
  document.addEventListener('DOMContentLoaded',boot);
})();
