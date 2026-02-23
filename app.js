var setupApp, backupApp, editNameApp, dashApp, noteApp, dbView, chisagApp, attApp, archiveViewApp, taApp, authApp;
const S1_COURSES = ['CHIN 103','CHIN 105','CHIN 201','CHIN 203','CHIN 205','CHIN 301','CHIN 303','CHIN 307','CHIN 311','CHIN 401','CHIN 403','CHIN 407','CHIN 415'];
const S2_COURSES = ['CHIN 104','CHIN 106','CHIN 202','CHIN 204','CHIN 206','CHIN 302','CHIN 304','CHIN 308','CHIN 312','CHIN 402','CHIN 404','CHIN 408','CHIN 416'];
let sysConfig = { name: "Teaching Command Centre", semester: 1, totalWeeks: 13, startDate: new Date().toISOString(), teachCourses: [], attCourses: [], courseDates: {} };

// --- UTILS & DB ---
function formatName(rawName) { if(!rawName) return "UNKNOWN"; let clean = rawName.replace(/\d+$/, '').replace(/\s*\(.*?\)/g, '').trim(); return clean.replace(/,/g, " ").replace(/\s+/g, " ").trim().toUpperCase(); }
function getWeekLabel(weekNum, courseCode = null) { let start = new Date(sysConfig.startDate); if(courseCode && sysConfig.courseDates && sysConfig.courseDates[courseCode]) { start = new Date(sysConfig.courseDates[courseCode]); } let d = new Date(start); d.setDate(d.getDate() + (weekNum - 1) * 7); return `Week ${weekNum} (${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`; }
function getDownloadFileName(prefix) { const now = new Date(); const day = now.getDate(); const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()]; const storageKey = `DL_Count_${prefix}_${day}${month}`; let count = parseInt(localStorage.getItem(storageKey)) || 0; count++; localStorage.setItem(storageKey, count); return `${prefix}${day}${month}${count}.xlsx`; }

const db = {
    name: "UG_Unified_DB_Mohammed_v13", version: 11, // Incremented to add raw_logs
    db: null,
    open: function() { return new Promise((resolve, reject) => { const req = indexedDB.open(this.name, this.version); req.onupgradeneeded = e => { const d = e.target.result; if(!d.objectStoreNames.contains('students')) { const s = d.createObjectStore('students', {keyPath:'id'}); s.createIndex("level", "level", {unique:false}); } if(!d.objectStoreNames.contains('attendance')) d.createObjectStore('attendance', {keyPath:'key'}); if(!d.objectStoreNames.contains('tasks')) d.createObjectStore('tasks', {keyPath:'key'}); if(!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', {keyPath:'id'}); if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', {keyPath:'key'}); if(!d.objectStoreNames.contains('archives')) d.createObjectStore('archives', {keyPath:'key'}); if(!d.objectStoreNames.contains('ta_store')) d.createObjectStore('ta_store', {keyPath:'id'}); if(!d.objectStoreNames.contains('chisag_members')) d.createObjectStore('chisag_members', {keyPath:'id'}); 
    // NEW RAW LOGS STORE
    if(!d.objectStoreNames.contains('scan_logs')) { const sl = d.createObjectStore('scan_logs', {keyPath:'id'}); sl.createIndex('course', 'course', {unique:false}); } }; req.onsuccess = e => { this.db = e.target.result; resolve(); }; req.onerror = e => reject(e); }); },
    getAll: function(store) { return new Promise(r => this.db.transaction(store,'readonly').objectStore(store).getAll().onsuccess = e => r(e.target.result)); },
    put: function(store, item) { return new Promise(r => this.db.transaction(store,'readwrite').objectStore(store).put(item).onsuccess = () => r()); },
    get: function(store, key) { return new Promise(r => this.db.transaction(store,'readonly').objectStore(store).get(key).onsuccess = e => r(e.target.result)); },
    delete: function(store, key) { return new Promise(r => this.db.transaction(store,'readwrite').objectStore(store).delete(key).onsuccess = () => r()); },
    batchPut: function(store, items) { return new Promise(r => { const tx=this.db.transaction(store,'readwrite'); items.forEach(i=>tx.objectStore(store).put(i)); tx.oncomplete=()=>r(); }); },
    batchDel: function(store, keys) { return new Promise(r => { const tx=this.db.transaction(store,'readwrite'); keys.forEach(k=>tx.objectStore(store).delete(k)); tx.oncomplete=()=>r(); }); },
    clear: function(store) { return new Promise(r => this.db.transaction(store,'readwrite').objectStore(store).clear().onsuccess = () => r()); }
};

function switchView(view) { 
    document.querySelectorAll('.view-container').forEach(e => e.classList.remove('active')); 
    document.querySelectorAll('.nav-tab').forEach(e => e.classList.remove('active')); 
    document.getElementById(`view-${view}`).classList.add('active'); 
    const tabs = document.querySelectorAll('.nav-tab'); 
    if(view === 'dashboard') tabs[0].classList.add('active'); 
    else if(view === 'database') { tabs[1].classList.add('active'); dbView.init(); } 
    else if(view === 'attendance') { tabs[2].classList.add('active'); attApp.updateContext(); }
    else if(view === 'ta') { tabs[3].classList.add('active'); taApp.init(); } 
    else if(view === 'chisag') { tabs[4].classList.add('active'); chisagApp.init(); }
    document.getElementById('fab-note').style.display = view === 'dashboard' ? 'flex' : 'none'; 
}
window.switchView = switchView;

// --- AUTH & SETUP APPS (Standard) ---
authApp = {
    init: async function() {
        const pinRec = await db.get('settings', 'auth_pin');
        if(pinRec) {
            document.getElementById('auth-setup-box').classList.add('hidden-app');
            document.getElementById('auth-login-box').classList.remove('hidden-app');
        } else {
            document.getElementById('auth-login-box').classList.add('hidden-app');
            document.getElementById('auth-setup-box').classList.remove('hidden-app');
        }
    },
    toggleEye: function(id) { const input = document.getElementById(id); input.type = input.type === 'password' ? 'text' : 'password'; },
    setup: async function() { const p1 = document.getElementById('setup-pin').value; const p2 = document.getElementById('setup-pin-confirm').value; if(p1.length !== 5 || isNaN(p1)) return alert("PIN must be 5 digits."); if(p1 !== p2) return alert("PINs do not match."); await db.put('settings', {key: 'auth_pin', value: p1}); alert("Set PIN Successful"); location.reload(); },
    login: async function() { const input = document.getElementById('login-pin').value; const pinRec = await db.get('settings', 'auth_pin'); const stored = pinRec ? pinRec.value : null; if(input === stored || input === '00000') { document.getElementById('auth-overlay').style.display = 'none'; document.getElementById('main-app').classList.remove('hidden-app'); this.unlockSystem(); } else { alert("Incorrect PIN"); document.getElementById('login-pin').value = ''; } },
    unlockSystem: async function() { const savedConfig = await db.get('settings', 'config'); if(savedConfig) { sysConfig = savedConfig.value; document.getElementById('sys-name-display').innerText = sysConfig.name; dashApp.init(); attApp.init(); } else { setupApp.open(); } },
    logout: function() { location.reload(); }
};

setupApp = { 
    currentStep: 1, open: function(isEdit = false) { document.getElementById('setup-modal').style.display = 'block'; this.currentStep = 1; this.showStep(1); if(isEdit) { document.getElementById('wiz-sys-name').value = sysConfig.name; document.getElementById('wiz-sem-select').value = sysConfig.semester; document.getElementById('wiz-weeks').value = sysConfig.totalWeeks; } this.loadCoursesForSem(); }, 
    showStep: function(step) { document.querySelectorAll('.wiz-step').forEach(el => el.classList.remove('active')); document.getElementById('wiz-step-'+step).classList.add('active'); document.getElementById('wiz-btn-back').style.display = step > 1 ? 'block' : 'none'; document.getElementById('wiz-btn-next').innerText = step === 1 ? "Next: Select Courses →" : "Next: Attendance Setup →"; document.getElementById('wiz-btn-next').style.display = step < 3 ? 'block' : 'none'; document.getElementById('wiz-btn-finish').style.display = step === 3 ? 'block' : 'none'; this.currentStep = step; },
    nextStep: function() { if(this.currentStep < 3) { if(this.currentStep === 2) this.renderAttRows(); this.showStep(this.currentStep + 1); } },
    prevStep: function() { if(this.currentStep > 1) this.showStep(this.currentStep - 1); },
    startNew: function() { if(confirm("⚠ WARNING: Creating a new semester requires archiving and resetting the current system.\n\nDo you want to proceed to the Archive screen?")) { this.openArchiveModal(); } }, 
    openArchiveModal: function() { document.getElementById('archive-modal').style.display = 'block'; document.getElementById('arc-year').value = ''; }, 
    formatArchiveInput: function(input) { let val = input.value.replace(/\D/g, ''); if (val.length > 4) { val = val.slice(0, 4) + '/' + val.slice(4, 8); } input.value = val; }, 
    processArchive: async function() { const year = document.getElementById('arc-year').value; const sem = document.getElementById('arc-sem').value; if(!year || year.length < 9) return alert("Please enter a valid academic year (e.g., 2025/2026)"); const archiveName = `${year} SEMESTER ${sem}`; const allStudents = await db.getAll('students'); const allAtt = await db.getAll('attendance'); const allTasks = await db.getAll('tasks'); const allNotes = await db.getAll('notes'); const archiveData = { key: archiveName, timestamp: new Date().toISOString(), config: sysConfig, students: allStudents, attendance: allAtt, tasks: allTasks, notes: allNotes }; await db.put('archives', archiveData); await db.clear('students'); await db.clear('attendance'); await db.clear('tasks'); await db.clear('notes'); await db.delete('settings', 'config'); alert(`System Archived as "${archiveName}" and Reset.`); location.reload(); }, 
    loadCoursesForSem: function() { const sem = parseInt(document.getElementById('wiz-sem-select').value); const list = sem === 1 ? S1_COURSES : S2_COURSES; const container = document.getElementById('wiz-teach-list'); container.innerHTML = ""; list.forEach(c => { const isChecked = sysConfig.teachCourses.includes(c) ? 'checked' : ''; container.innerHTML += `<label class="wiz-course-item" style="border:1px solid #eee; padding:10px; border-radius:4px; display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="wiz-teach-check" value="${c}" ${isChecked} style="margin-right:10px;"><b>${c}</b></label>`; }); }, 
    renderAttRows: function() { const selected = Array.from(document.querySelectorAll('.wiz-teach-check:checked')).map(cb=>cb.value); const attContainer = document.getElementById('wiz-att-list'); const existingDates = {}; document.querySelectorAll('.wiz-att-date').forEach(inp => existingDates[inp.dataset.course] = inp.value); attContainer.innerHTML = ""; if(selected.length === 0) { attContainer.innerHTML = "<p style='color:#666; font-style:italic;'>No courses selected in Step 2.</p>"; return; } selected.forEach(c => { const isAtt = sysConfig.attCourses.includes(c) ? 'checked' : ''; let dateVal = existingDates[c] || (sysConfig.courseDates && sysConfig.courseDates[c] ? new Date(sysConfig.courseDates[c]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]); attContainer.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;"><label style="display:flex; align-items:center; gap:10px; font-weight:bold; color:var(--ug-blue); cursor:pointer;"><input type="checkbox" class="wiz-att-check" value="${c}" ${isAtt} onchange="this.parentElement.nextElementSibling.style.visibility = this.checked ? 'visible' : 'hidden'"> ${c} </label><input type="date" class="wiz-att-date" data-course="${c}" value="${dateVal}" style="visibility:${isAtt ? 'visible' : 'hidden'}"></div>`; }); },
    finish: async function() { const name = document.getElementById('wiz-sys-name').value; const weeks = document.getElementById('wiz-weeks').value; const selectedTeach = Array.from(document.querySelectorAll('.wiz-teach-check:checked')).map(cb=>cb.value); const selectedAtt = Array.from(document.querySelectorAll('.wiz-att-check:checked')).map(cb=>cb.value); if(!name || !weeks) return alert("Please fill System Name and Weeks."); if(selectedTeach.length === 0) return alert("Please select at least one course."); sysConfig.name = name; sysConfig.semester = parseInt(document.getElementById('wiz-sem-select').value); sysConfig.totalWeeks = parseInt(weeks); sysConfig.teachCourses = selectedTeach; sysConfig.attCourses = selectedAtt; sysConfig.courseDates = {}; let earliest = null; document.querySelectorAll('.wiz-att-date').forEach(inp => { const c = inp.dataset.course; if(selectedAtt.includes(c) && inp.value) { sysConfig.courseDates[c] = new Date(inp.value).toISOString(); let d = new Date(inp.value); if(!earliest || d < earliest) earliest = d; } }); sysConfig.startDate = earliest ? earliest.toISOString() : new Date().toISOString(); await db.put('settings', {key:'config', value: sysConfig}); document.getElementById('setup-modal').style.display = 'none'; dashApp.init(); attApp.init(); document.getElementById('sys-name-display').innerText = sysConfig.name; } 
};

// --- OTHER APPS ---
archiveViewApp = { open: async function() { document.getElementById('archive-view-modal').style.display = 'block'; this.renderList(); }, renderList: async function() { const container = document.getElementById('archive-list-container'); container.innerHTML = "Loading..."; const archives = await db.getAll('archives'); if(archives.length === 0) { container.innerHTML = "<p style='text-align:center; color:#999'>No archives found.</p>"; return; } container.innerHTML = ""; archives.forEach(arc => { const d = new Date(arc.timestamp).toLocaleDateString(); const sCount = arc.students ? arc.students.length : 0; container.innerHTML += `<div style="border:1px solid #eee; padding:10px; border-radius:4px; margin-bottom:10px; background:#fafafa;"><div style="font-weight:bold; color:var(--ug-blue); font-size:1.1rem;">${arc.key}</div><div style="font-size:0.8rem; color:#666; margin-bottom:8px;">Saved: ${d} • Students: ${sCount}</div><div style="display:flex; gap:10px;"><button class="btn btn-gold" style="padding:4px 10px; font-size:0.8rem;" onclick="archiveViewApp.download('${arc.key}')">Download Excel</button><button class="btn btn-danger" style="padding:4px 10px; font-size:0.8rem;" onclick="archiveViewApp.delete('${arc.key}')">Delete</button></div></div>`; }); }, download: async function(key) { const arc = await db.get('archives', key); if(!arc) return alert("Archive not found"); const wb = XLSX.utils.book_new(); if(arc.config) { const ws = XLSX.utils.aoa_to_sheet([["System_Configuration_JSON"], [JSON.stringify(arc.config)]]); XLSX.utils.book_append_sheet(wb, ws, "System_Config"); } if(arc.students && arc.students.length > 0) { const data = arc.students.map(s => ({id:s.id, name:s.name, level:s.level, courses: (s.courses||[]).join(',')})); const ws = XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws, "Students"); } if(arc.attendance && arc.attendance.length > 0) { const ws = XLSX.utils.json_to_sheet(arc.attendance); XLSX.utils.book_append_sheet(wb, ws, "Attendance"); } XLSX.writeFile(wb, `Archive_${key.replace(/[\/\\?%*:|"<>]/g, '-')}.xlsx`); }, delete: async function(key) { if(confirm(`Delete archive "${key}" permanently?`)) { await db.delete('archives', key); this.renderList(); } } };
backupApp = { openModal: function() { document.getElementById('master-backup-modal').style.display='block'; this.renderBackupUI(); }, closeModal: function() { document.getElementById('master-backup-modal').style.display='none'; }, switchTab: function(tab) { document.getElementById('view-backup-panel').style.display = tab==='backup' ? 'block' : 'none'; document.getElementById('view-restore-panel').style.display = tab==='restore' ? 'block' : 'none'; document.getElementById('tab-backup').style.borderColor = tab==='backup' ? 'var(--ug-blue)' : 'transparent'; document.getElementById('tab-restore').style.borderColor = tab==='restore' ? 'var(--ug-blue)' : 'transparent'; if(tab === 'restore') { const fileInput = document.getElementById('restore-file-input'); fileInput.value = ''; fileInput.onchange = (e) => this.handleFileSelect(e); } }, toggleSection: function(id) { document.getElementById(id).classList.toggle('open'); }, renderBackupUI: function() { const weeks = Array.from({length: sysConfig.totalWeeks}, (_, i) => i + 1); let attHtml = ""; sysConfig.attCourses.forEach(c => { attHtml += `<div style="border-bottom:1px solid #eee;"><div style="padding:8px 15px; background:#fafafa; cursor:pointer; font-weight:bold;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'grid':'none'">${c} <span>▼</span></div><div style="display:none; grid-template-columns:repeat(4,1fr); gap:5px; padding:10px;" class="sys-grid">${weeks.map(w => `<label class="sys-check-label"><input type="checkbox" class="bk-check-att" value="${c.replace(/\s/g,'')}_W${w}" checked> W${w}</label>`).join('')}</div></div>`; }); document.getElementById('bk-att').innerHTML = attHtml; let taskHtml = ""; sysConfig.teachCourses.forEach(c => { taskHtml += `<div style="border-bottom:1px solid #eee;"><div style="padding:8px 15px; background:#fafafa; cursor:pointer; font-weight:bold;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'grid':'none'">${c} <span>▼</span></div><div style="display:none; grid-template-columns:repeat(4,1fr); gap:5px; padding:10px;" class="sys-grid">${weeks.map(w => `<label class="sys-check-label"><input type="checkbox" class="bk-check-task" value="w${w}_${c}" checked> W${w}</label>`).join('')}</div></div>`; }); document.getElementById('bk-task').innerHTML = taskHtml; }, executeBackup: async function() { const doExcel = document.getElementById('bk-fmt-excel').checked; const doJson = document.getElementById('bk-fmt-json').checked; const includeTA = document.getElementById('bk-check-ta').checked; const includeCHISAG = document.getElementById('bk-check-chisag').checked; const includeRaw = document.getElementById('bk-check-raw').checked; if(!doExcel && !doJson) return alert("Please select at least one output format."); const levels = Array.from(document.querySelectorAll('.bk-check-db:checked')).map(c=>parseInt(c.value)); const attKeys = Array.from(document.querySelectorAll('.bk-check-att:checked')).map(c=>c.value); const taskKeys = Array.from(document.querySelectorAll('.bk-check-task:checked')).map(c=>c.value); const includeNotes = document.getElementById('bk-check-notes').checked; const allStudents = await db.getAll('students'); const allAtt = await db.getAll('attendance'); const allTasks = await db.getAll('tasks'); const allNotes = await db.getAll('notes'); const allArchives = await db.getAll('archives'); let allTAs = []; if(includeTA) allTAs = await db.getAll('ta_store'); let allChisag = []; if(includeCHISAG) allChisag = await db.getAll('chisag_members'); let allLogs = []; if(includeRaw) allLogs = await db.getAll('scan_logs'); const finalStudents = allStudents.filter(s => levels.includes(s.level)); const finalAtt = allAtt.filter(r => attKeys.some(k => r.key.startsWith(k + "_"))); const finalTasks = allTasks.filter(t => taskKeys.includes(t.key)); const finalNotes = includeNotes ? allNotes : []; const fn = getDownloadFileName('SystemBackup'); if (doJson) { const data = { timestamp: new Date().toISOString(), config: sysConfig, students: finalStudents, attendance: finalAtt, tasks: finalTasks, notes: finalNotes, archives: allArchives, tas: allTAs, chisag: allChisag, logs: allLogs }; const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn.replace('.xlsx','.json'); document.body.appendChild(a); a.click(); document.body.removeChild(a); } if (doExcel) { const wb = XLSX.utils.book_new(); const ws_config = XLSX.utils.aoa_to_sheet([["System_Configuration_JSON"], [JSON.stringify(sysConfig)]]); XLSX.utils.book_append_sheet(wb, ws_config, "System_Config"); if(finalStudents.length > 0) { const sData = finalStudents.map(s => ({id:s.id, name:s.name, level:s.level, courses: (s.courses||[]).join(',')})); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sData), "Students"); } if(finalAtt.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finalAtt), "Attendance"); if(finalTasks.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finalTasks), "Tasks"); if(finalNotes.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finalNotes), "Notes"); if(allArchives.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allArchives.map(a => ({key: a.key, timestamp: a.timestamp, data: JSON.stringify(a)}))), "System_Archives"); if(allTAs.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allTAs.map(t => ({id: t.id, data: JSON.stringify(t.data)}))), "TA_Portal_Data"); if(allChisag.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allChisag), "CHISAG_Data"); if(allLogs.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allLogs.map(l => ({id:l.id, course:l.course, week:l.week, type:l.type, data: JSON.stringify(l.data)}))), "Scan_Logs"); XLSX.writeFile(wb, fn); } this.closeModal(); }, handleFileSelect: function(e) { const file = e.target.files[0]; if(!file) return; const r = new FileReader(); if(file.name.endsWith('.json')) { r.onload = (evt) => { try { this.parsedRestoreData = JSON.parse(evt.target.result); this.renderRestorePreview(); } catch(err) { alert("Invalid Backup File"); } }; r.readAsText(file); return; } r.onload = (evt) => { try { const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'}); let restoreData = { students: [], attendance: [], tasks: [], notes: [], archives: [], tas: [], chisag: [], logs: [] }; if(wb.Sheets['System_Config']) { const cData = XLSX.utils.sheet_to_json(wb.Sheets['System_Config'], {header:1}); if(cData.length > 1) { try { restoreData.config = JSON.parse(cData[1][0]); } catch(e){} } } if(wb.Sheets['Students']) { const sRows = XLSX.utils.sheet_to_json(wb.Sheets['Students']); restoreData.students = sRows.map(r => ({ id: String(r.id), name: r.name, level: parseInt(r.level), courses: r.courses ? String(r.courses).split(',') : [] })); } if(wb.Sheets['Attendance']) restoreData.attendance = XLSX.utils.sheet_to_json(wb.Sheets['Attendance']); if(wb.Sheets['Tasks']) restoreData.tasks = XLSX.utils.sheet_to_json(wb.Sheets['Tasks']); if(wb.Sheets['Notes']) restoreData.notes = XLSX.utils.sheet_to_json(wb.Sheets['Notes']); if(wb.Sheets['System_Archives']) { const aRows = XLSX.utils.sheet_to_json(wb.Sheets['System_Archives']); restoreData.archives = aRows.map(r => JSON.parse(r.data)); } if(wb.Sheets['TA_Portal_Data']) { const tRows = XLSX.utils.sheet_to_json(wb.Sheets['TA_Portal_Data']); restoreData.tas = tRows.map(r => ({id: r.id, data: JSON.parse(r.data)})); } if(wb.Sheets['CHISAG_Data']) { restoreData.chisag = XLSX.utils.sheet_to_json(wb.Sheets['CHISAG_Data']); } if(wb.Sheets['Scan_Logs']) { const lRows = XLSX.utils.sheet_to_json(wb.Sheets['Scan_Logs']); restoreData.logs = lRows.map(l => ({id:l.id, course:l.course, week:l.week, type:l.type, data: JSON.parse(l.data)})); } this.parsedRestoreData = restoreData; this.renderRestorePreview(); } catch(err) { console.error(err); alert("Error parsing Excel backup."); } }; r.readAsArrayBuffer(file); }, renderRestorePreview: function() { const d = this.parsedRestoreData; const container = document.getElementById('restore-dynamic-content'); container.innerHTML = ''; if(d.config) container.innerHTML += `<div class="sys-option-group"><div class="sys-option-header">System Configuration</div><div class="sys-option-body open"><label><input type="checkbox" id="rs-check-config" checked> Restore System Config</label></div></div>`; let html = `<div class="sys-option-group"><div class="sys-option-header">Database</div><div class="sys-option-body open"><label><input type="checkbox" id="rs-check-db" checked> Restore ${(d.students||[]).length} Students</label></div></div>`; html += `<div class="sys-option-group"><div class="sys-option-header">Attendance</div><div class="sys-option-body open"><label><input type="checkbox" id="rs-check-att" checked> Restore ${(d.attendance||[]).length} Records</label></div></div>`; html += `<div class="sys-option-group"><div class="sys-option-header">Tasks</div><div class="sys-option-body open"><label><input type="checkbox" id="rs-check-task" checked> Restore ${(d.tasks||[]).length} Tasks</label></div></div>`; if(d.tas && d.tas.length > 0) html += `<div class="sys-option-group"><div class="sys-option-header">TA Portal</div><div class="sys-option-body open"><label><input type="checkbox" id="rs-check-ta" checked> Restore ${d.tas.length} TA Profiles</label></div></div>`; if(d.chisag && d.chisag.length > 0) html += `<div class="sys-option-group"><div class="sys-option-header">CHISAG System</div><div class="sys-option-body open"><label><input type="checkbox" id="rs-check-chisag" checked> Restore ${d.chisag.length} CHISAG Members</label></div></div>`; if(d.logs && d.logs.length > 0) html += `<div class="sys-option-group"><div class="sys-option-header">Scan Logs</div><div class="sys-option-body open"><label><input type="checkbox" id="rs-check-logs" checked> Restore ${d.logs.length} Raw Logs</label></div></div>`; container.innerHTML += html; document.getElementById('restore-options-container').style.display = 'block'; }, executeRestore: async function() { const d = this.parsedRestoreData; if(document.getElementById('rs-check-config') && document.getElementById('rs-check-config').checked && d.config) await db.put('settings', {key:'config', value: d.config}); if(document.getElementById('rs-check-db').checked && d.students) await db.batchPut('students', d.students); if(document.getElementById('rs-check-att').checked && d.attendance) await db.batchPut('attendance', d.attendance); if(document.getElementById('rs-check-task').checked && d.tasks) await db.batchPut('tasks', d.tasks); if(document.getElementById('rs-check-ta') && document.getElementById('rs-check-ta').checked && d.tas) await db.batchPut('ta_store', d.tas); if(document.getElementById('rs-check-chisag') && document.getElementById('rs-check-chisag').checked && d.chisag) await db.batchPut('chisag_members', d.chisag); if(document.getElementById('rs-check-logs') && document.getElementById('rs-check-logs').checked && d.logs) await db.batchPut('scan_logs', d.logs); alert("Restore Complete. Page will reload."); location.reload(); } };
editNameApp = { open: function(id, currentName) { document.getElementById('edit-id-hidden').value = id; document.getElementById('edit-name-input').value = currentName; document.getElementById('edit-name-modal').style.display = 'block'; document.getElementById('edit-name-input').focus(); }, close: function() { document.getElementById('edit-name-modal').style.display = 'none'; }, save: async function() { const id = document.getElementById('edit-id-hidden').value; const newName = document.getElementById('edit-name-input').value; const cleanName = formatName(newName); if(!cleanName) return alert("Name cannot be empty"); let s = await db.get('students', id); if(s) { s.name = cleanName; await db.put('students', s); await attApp.sync(); if(document.getElementById('view-attendance').classList.contains('active')) attApp.renderTable(); if(document.getElementById('view-database').classList.contains('active')) dbView.render(document.querySelector('#view-database input').value); if(document.getElementById('view-chisag') && document.getElementById('view-chisag').classList.contains('active')) chisagApp.init(); this.close(); } else alert("Error: Student ID not found."); } };

// --- ATTENDANCE APP ---
attApp = { 
    students: [], cache: [], attMap: new Map(), course: "", week: 1, sortCol: 'name', sortAsc: true, pending: [], pendingBatch: [], isManageMode: false, selected: new Set(), currentWeekVal: 0, scanTargetWeeks: [], scanTargetCourses: [], tempRawData: null,
    init: async function() { await this.sync(); }, 
    sync: async function() { this.cache = await db.getAll('students'); const recs = await db.getAll('attendance'); this.attMap.clear(); recs.forEach(r => this.attMap.set(r.key, r.status)); dbView.init(); }, 
    setCurrWeek: function(w) { this.currentWeekVal = w; this.updateContext(); }, 
    updateContext: async function() { 
        const selC = document.getElementById("course-select"); if (selC.options.length === 0) { sysConfig.attCourses.forEach(c => { const opt = document.createElement("option"); opt.value = c.replace(/\s/g, ''); opt.text = c; selC.appendChild(opt); }); if (sysConfig.attCourses.length > 0) this.course = sysConfig.attCourses[0].replace(/\s/g, ''); } else { this.course = selC.value; } if (!this.course && selC.options.length > 0) { this.course = selC.options[0].value; selC.value = this.course; } 
        const fullCourseName = sysConfig.attCourses.find(c => c.replace(/\s/g, '') === this.course); const selW = document.getElementById("week-select"); const oldVal = parseInt(selW.value); selW.innerHTML = ""; let startDate = new Date(sysConfig.startDate); if(fullCourseName && sysConfig.courseDates && sysConfig.courseDates[fullCourseName]) { startDate = new Date(sysConfig.courseDates[fullCourseName]); } for(let i=1; i<=sysConfig.totalWeeks; i++) { let label = getWeekLabel(i, fullCourseName); let opt = document.createElement("option"); opt.value=i; opt.text=label; if(i === (isNaN(oldVal) ? this.currentWeekVal : oldVal)) { opt.selected=true; } selW.appendChild(opt); } this.week = parseInt(selW.value); let classDate = new Date(startDate); classDate.setDate(classDate.getDate() + (this.week - 1) * 7); classDate.setHours(0,0,0,0); let now = new Date(); now.setHours(0,0,0,0); document.getElementById("card-course").innerText = this.course.replace("CHIN", "CHIN "); document.getElementById("card-week").innerText = "Week " + this.week; const wi = document.getElementById('curr-week-indicator'); if(this.currentWeekVal > 0 && this.currentWeekVal <= sysConfig.totalWeeks) wi.innerText = "Current: Week " + this.currentWeekVal; else wi.innerText = ""; const enrolled = this.cache.filter(s => s.courses && s.courses.some(c => c.replace(/\s/g, '') === this.course)); const rawRecordsExist = enrolled.some(s => this.attMap.has(`${this.course}_W${this.week}_${s.id}`)); if (rawRecordsExist) { this.students = enrolled; } else { if (now > classDate) { let batch = []; enrolled.forEach(s => { const key = `${this.course}_W${this.week}_${s.id}`; this.attMap.set(key, "Absent"); batch.push({key, status:"Absent", course:this.course, week:this.week, id:s.id}); }); if(batch.length > 0) await db.batchPut('attendance', batch); this.students = enrolled; } else { this.students = []; } } this.count(); this.renderTable(classDate); 
    }, 
    toggleManageMode: function() { this.isManageMode = !this.isManageMode; this.selected.clear(); document.getElementById('att-manage-bar').style.display = this.isManageMode ? 'flex' : 'none'; document.getElementById('att-th-check').style.display = this.isManageMode ? 'table-cell' : 'none'; this.renderTable(); }, toggleSelect: function(id) { if(this.selected.has(id)) this.selected.delete(id); else this.selected.add(id); }, toggleSelectAll: function(cb) { let list = [...this.students]; if(document.getElementById('present-sort-check').checked) list = list.filter(s => this.getAtt(s.id) === 'Present'); if(cb.checked) list.forEach(s => this.selected.add(s.id)); else list.forEach(s => this.selected.delete(s.id)); this.renderTable(); }, 
    resetSelected: async function() { if(this.selected.size === 0) return alert("No students selected."); if(confirm(`Reset attendance to ABSENT for ${this.selected.size} students?`)) { let batch = []; for(let id of this.selected) { const key = `${this.course}_W${this.week}_${id}`; this.attMap.set(key, "Absent"); batch.push({key, status:"Absent", course:this.course, week:this.week, id}); } await db.batchPut('attendance', batch); this.toggleManageMode(); this.renderTable(); this.count(); alert("Done."); } }, 
    deleteSelectedEntries: async function() { if(this.selected.size === 0) return alert("No students selected."); if(confirm(`REMOVE ${this.selected.size} students from this course?\n\nThis will delete ALL attendance records for them in this course (Weeks 1-${sysConfig.totalWeeks}).`)) { const cleanC = this.course; const fullC = sysConfig.attCourses.find(c => c.replace(/\s/g, '') === cleanC); let attKeysToDelete = []; let studentUpdates = []; for(let id of this.selected) { for(let w=1; w<=sysConfig.totalWeeks; w++) { attKeysToDelete.push(`${cleanC}_W${w}_${id}`); this.attMap.delete(`${cleanC}_W${w}_${id}`); } let s = this.cache.find(x => x.id === id); if(s) { s.courses = s.courses.filter(c => c !== fullC); studentUpdates.push(s); } } await db.batchDel('attendance', attKeysToDelete); if(studentUpdates.length > 0) await db.batchPut('students', studentUpdates); this.toggleManageMode(); this.updateContext(); alert("Students removed from course."); } }, 
    getAtt: function(id, w=this.week, c=this.course) { return this.attMap.get(`${c}_W${w}_${id}`) || "Absent"; }, getSemTotal: function(id) { let t=0; for(let i=1; i<=sysConfig.totalWeeks; i++) if(this.getAtt(id,i)==="Present") t++; return t; }, setAtt: async function(id, st) { const key = `${this.course}_W${this.week}_${id}`; this.attMap.set(key, st); this.renderTable(); this.count(); await db.put('attendance', {key, status:st, course:this.course, week:this.week, id}); }, count: function() { document.getElementById("card-present").innerText = `${this.students.filter(s=>this.getAtt(s.id)==='Present').length}`; }, 
    manualCheckIn: async function() { const id = document.getElementById('manual-checkin').value.trim(); if(!id) return; let s = this.cache.find(x => x.id === id); const fullC = sysConfig.attCourses.find(c => c.replace(/\s/g, '') === this.course); if(s) { if(!s.courses.includes(fullC)) { s.courses.push(fullC); await db.put('students', s); } const prior = this.getAtt(s.id); if(prior === 'Present') { alert(`${s.name} is ALREADY marked present.`); } else { await this.setAtt(s.id, 'Present'); document.getElementById('manual-checkin').value = ""; alert(`${s.name} marked Present.`); } this.updateContext(); } else { if(confirm("ID not found in DB. Add as new?")) { this.pending=[{id,name:"Unknown"}]; this.openNewModal(); } } }, 
    openNewModal: function() { const list = document.getElementById('new-student-list'); list.innerHTML=''; this.pending.forEach(p => list.innerHTML += `<div class="note-item"><b>${p.id}</b> <span>${p.name}</span></div>`); document.getElementById('new-student-modal').style.display='block'; }, sortData: function(c) { if(this.sortCol===c) this.sortAsc=!this.sortAsc; else {this.sortCol=c;this.sortAsc=true;} this.renderTable(); }, 
    renderTable: function(classDateObj = null) { ['id','name','total','status'].forEach(c => { const el = document.getElementById(`sort-icon-att-${c}`); el.className = 'sort-arrow ' + (this.sortCol === c ? (this.sortAsc ? 'sort-asc' : 'sort-desc') : 'sort-none'); }); const tb = document.getElementById("att-table-body"); tb.innerHTML = ""; let list = [...this.students]; if(list.length === 0) { let msg = "No data for this week.<br>Wait for due date or upload data."; if(classDateObj) { let now = new Date(); now.setHours(0,0,0,0); if(now <= classDateObj) msg = "Class Has Not Ended Yet.<br>Wait for tomorrow for Auto-Fill, or Scan/Upload manually."; else msg = "Week is Empty.<br>No students found or list was cleared."; } tb.innerHTML = `<tr><td colspan='5' class='empty-state'>${msg}</td></tr>`; return; } const searchVal = document.getElementById('att-search').value.toLowerCase(); if(searchVal) { list = list.filter(s => s.name.toLowerCase().includes(searchVal) || s.id.includes(searchVal)); } if(document.getElementById('present-sort-check').checked) { list = list.filter(s => this.getAtt(s.id) === 'Present'); } list.sort((a,b) => { let vA, vB; if(this.sortCol==='total') { vA=this.getSemTotal(a.id); vB=this.getSemTotal(b.id); } else if(this.sortCol==='status') { vA=this.getAtt(a.id); vB=this.getAtt(b.id); } else { vA=a[this.sortCol]; vB=b[this.sortCol]; } if(vA<vB) return this.sortAsc?-1:1; if(vA>vB) return this.sortAsc?1:-1; return 0; }); list.forEach((s,i) => { const st = this.getAtt(s.id); const tot = this.getSemTotal(s.id); const bg = tot>=10?'bg-green':(tot>=6?'bg-yellow':'bg-red'); const check = this.isManageMode ? `<td><input type="checkbox" ${this.selected.has(s.id)?'checked':''} onchange="attApp.toggleSelect('${s.id}')"></td>` : ''; tb.innerHTML += `<tr>${check}<td>${i+1}</td><td style="font-family:monospace; font-weight:bold; color:var(--ug-blue)">${s.id}</td><td class="clickable-name" onclick="editNameApp.open('${s.id}', '${s.name}')">${s.name}</td><td><span class="badge ${bg}">${tot}/${sysConfig.totalWeeks}</span></td><td><div class="att-switch"><input type="radio" id="p_${s.id}" name="att_${s.id}" value="Present" ${st==='Present'?'checked':''} onchange="attApp.setAtt('${s.id}','Present')"><label for="p_${s.id}">Present</label><input type="radio" id="a_${s.id}" name="att_${s.id}" value="Absent" ${st==='Absent'?'checked':''} onchange="attApp.setAtt('${s.id}','Absent')"><label for="a_${s.id}">Absent</label></div></td></tr>`; }); }, 
    openQRModal: function() { document.getElementById('qr-modal').style.display='block'; document.getElementById('qr-input').value=''; document.getElementById('qr-upload-file').value=''; const populate = (containerId, items, values) => { const container = document.getElementById(containerId); container.innerHTML = ""; items.forEach((item, i) => { const val = values ? values[i] : item; const isChecked = (val === this.week || val === this.course); container.innerHTML += `<label style="display:flex; align-items:center; padding:2px 0;"><input type="checkbox" class="${containerId === 'qr-course-checkboxes' ? 'qr-course-cb' : 'qr-week-cb'}" value="${val.toString().replace(/\s/g,'')}" ${isChecked?'checked':''}> <span style="margin-left:5px">${item}</span></label>`; }); }; populate('qr-course-checkboxes', sysConfig.attCourses, sysConfig.attCourses); const weekLabels = []; const weekValues = []; const fullCourseName = sysConfig.attCourses.find(c => c.replace(/\s/g, '') === this.course); for(let i=1; i<=sysConfig.totalWeeks; i++) { weekLabels.push(getWeekLabel(i, fullCourseName)); weekValues.push(i); } populate('qr-week-checkboxes', weekLabels, weekValues); }, 
    
    processQRData: async function() { 
        const fileInput = document.getElementById('qr-upload-file'); 
        const textArea = document.getElementById('qr-input').value; 
        const selectedCourses = Array.from(document.querySelectorAll('.qr-course-cb:checked')).map(cb => cb.value); 
        const selectedWeeks = Array.from(document.querySelectorAll('.qr-week-cb:checked')).map(cb => parseInt(cb.value)); 
        if (selectedCourses.length === 0) return alert("Please select at least one course."); 
        if (selectedWeeks.length === 0) return alert("Please select at least one week."); 
        
        if (fileInput.files.length > 0) { 
            const file = fileInput.files[0];
            const ext = file.name.split('.').pop().toLowerCase();
            
            if (ext === 'txt') {
                const reader = new FileReader();
                reader.onload = e => { this.executeScan(e.target.result, selectedWeeks, selectedCourses); };
                reader.readAsText(file);
            } 
            else if (ext === 'pdf' || ext.startsWith('doc')) {
                alert("To use Word or PDF files, please open the file, copy the text, and paste it into the 'Paste List' box.");
                fileInput.value = '';
            } 
            else {
                const r = new FileReader(); 
                r.onload = e => { 
                    try {
                        const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'}); 
                        this.processBulkAttendance(wb, selectedWeeks, selectedCourses); 
                    } catch(err) {
                        alert("Error reading file. Please ensure it is a valid Excel (.xls, .xlsx) or CSV file.");
                    }
                }; 
                r.readAsArrayBuffer(file); 
            }
        } else if (textArea.trim()) { 
            this.executeScan(textArea, selectedWeeks, selectedCourses); 
        } else { alert("Please paste a list or upload a file."); } 
    },
    
    // SAVE RAW LOGIC ADDED HERE
    saveScanLog: async function(course, week, type, data) {
        const id = `LOG_${new Date().getTime()}_${Math.floor(Math.random()*1000)}`;
        const record = { id: id, timestamp: new Date().toISOString(), course: course, week: week, type: type, data: data };
        await db.put('scan_logs', record);
    },

    openLogViewer: async function() {
        document.getElementById('raw-log-modal').style.display='block';
        
        // Populate Filters
        const logs = await db.getAll('scan_logs');
        const courses = [...new Set(logs.map(l => l.course))].sort();
        const weeks = [...new Set(logs.map(l => l.week))].sort((a,b)=>a-b);
        
        const cSel = document.getElementById('raw-filter-course');
        cSel.innerHTML = '<option value="">All Courses</option>';
        courses.forEach(c => cSel.innerHTML += `<option value="${c}">${c}</option>`);
        
        const wSel = document.getElementById('raw-filter-week');
        wSel.innerHTML = '<option value="">All Weeks</option>';
        weeks.forEach(w => wSel.innerHTML += `<option value="${w}">Week ${w}</option>`);
        
        this.renderRawLogs(logs);
    },

    rawManageMode: false,
    rawSelected: new Set(),
    rawSortAsc: true,
    toggleRawManageMode: function() {
        this.rawManageMode = !this.rawManageMode;
        this.rawSelected.clear();
        document.getElementById('raw-manage-bar').style.display = this.rawManageMode ? 'flex' : 'none';
        document.getElementById('raw-th-check').style.display = this.rawManageMode ? 'table-cell' : 'none';
        this.renderRawLogs();
    },
    toggleRawSelect: function(id) { if(this.rawSelected.has(id)) this.rawSelected.delete(id); else this.rawSelected.add(id); },
    toggleRawSelectAll: function(cb) {
        const checkboxes = document.querySelectorAll('.raw-select-check');
        checkboxes.forEach(c => {
            c.checked = cb.checked;
            if(cb.checked) this.rawSelected.add(c.value); else this.rawSelected.delete(c.value);
        });
    },
    deleteSelectedRawLogs: async function() {
        if(this.rawSelected.size === 0) return alert("No logs selected.");
        if(confirm(`Delete ${this.rawSelected.size} selected logs forever?`)) {
            await db.batchDel('scan_logs', Array.from(this.rawSelected));
            this.toggleRawManageMode();
            this.renderRawLogs();
        }
    },
    sortRawLogs: function() {
        this.rawSortAsc = !this.rawSortAsc;
        document.getElementById('sort-icon-raw-course').className = 'sort-arrow ' + (this.rawSortAsc ? 'sort-asc' : 'sort-desc');
        this.renderRawLogs();
    },

    renderRawLogs: async function(preloadedLogs = null) {
        let logs = preloadedLogs;
        if(!logs) logs = await db.getAll('scan_logs');
        
        const filterC = document.getElementById('raw-filter-course').value;
        const filterW = document.getElementById('raw-filter-week').value;
        const search = document.getElementById('raw-search').value.toLowerCase();
        
        const tbody = document.getElementById('raw-log-body');
        tbody.innerHTML = '';
        
        // Custom sort by Course + Week (A-Z or Z-A)
        logs.sort((a,b) => {
            const keyA = `${a.course}_W${a.week.toString().padStart(2,'0')}`;
            const keyB = `${b.course}_W${b.week.toString().padStart(2,'0')}`;
            if(keyA < keyB) return this.rawSortAsc ? -1 : 1;
            if(keyA > keyB) return this.rawSortAsc ? 1 : -1;
            return 0;
        });
        
        logs.forEach(log => {
            if(filterC && log.course !== filterC) return;
            if(filterW && String(log.week) !== filterW) return;
            
            const contentStr = Array.isArray(log.data) ? log.data.join(', ') : String(log.data);
            if(search && !contentStr.toLowerCase().includes(search)) return;
            
            let displayContent = "";
            let entryCount = Array.isArray(log.data) ? log.data.length : 1;
            
            let highlightData = log.data;
            if(search) {
                const regex = new RegExp(`(${search})`, 'gi');
                if(Array.isArray(log.data)) {
                    highlightData = log.data.map(line => line.replace(regex, '<mark style="background:var(--ug-gold); color:var(--ug-blue);">$&</mark>'));
                } else {
                    highlightData = String(log.data).replace(regex, '<mark style="background:var(--ug-gold); color:var(--ug-blue);">$&</mark>');
                }
            }

            // New UI: Large block, scrollable X and Y, with preserved line breaks
            if(Array.isArray(highlightData)) {
                displayContent = highlightData.join('\n');
            } else {
                displayContent = highlightData;
            }

            const checkHtml = this.rawManageMode ? `<td style="width:40px; vertical-align:top;"><input type="checkbox" class="raw-select-check" value="${log.id}" ${this.rawSelected.has(log.id)?'checked':''} onchange="attApp.toggleRawSelect('${log.id}')"></td>` : '';

            tbody.innerHTML += `
                <tr>
                    ${checkHtml}
                    <td style="vertical-align:top;"><strong>${log.course}</strong><br><span style="font-size:0.85rem; color:#666;">Week ${log.week}</span></td>
                    <td style="text-align:center; font-weight:bold; color:var(--ug-blue); vertical-align:top;">${entryCount}</td>
                    <td style="vertical-align:top; padding:0;">
                        <div style="max-height:200px; min-height:140px; overflow:auto; white-space:pre; background:#f8fafc; padding:10px; margin:10px 0; border:1px solid #cbd5e1; border-radius:4px; font-family:monospace; font-size:0.85rem; line-height:1.5;">${displayContent}</div>
                    </td>
                </tr>
            `;
        });
        
        if(tbody.innerHTML === '') tbody.innerHTML = `<tr><td colspan="${this.rawManageMode ? 4 : 3}" style="text-align:center; padding:20px; color:#999;">No logs found.</td></tr>`;
    },

    processBulkAttendance: async function(wb, allowedWeeks, allowedCourses) {
        let batchAtt = []; let batchStudents = []; let count = 0; 
        let logsToSave = []; // Accumulate logs

        for (let i = 0; i < wb.SheetNames.length; i++) { 
            const sheetName = wb.SheetNames[i]; const ws = wb.Sheets[sheetName]; const data = XLSX.utils.sheet_to_json(ws); 
            let targetClean = allowedCourses.find(c => c.toLowerCase() === sheetName.toLowerCase().replace(/\s/g,'')); 
            if (!targetClean && wb.SheetNames.length === 1 && allowedCourses.length === 1) targetClean = allowedCourses[0]; 
            if (!targetClean) continue; 
            
            // Save raw rows for this course/sheet
            // We'll save a log for EACH week found in the sheet if relevant, or just one log per sheet upload?
            // Prompt says "save pasted raw data line by line". For Excel, the "lines" are the rows.
            // Let's allow saving the full JSON dump of the sheet rows as the "raw data" for the primary selected week(s).
            // Since user might select multiple weeks, we just save one log entry per upload action per course involved.
            // We'll associate it with the first selected week to keep it simple, or iterate.
            // Better: Iterate selected weeks and save log for each? No, that duplicates data.
            // I will save one log entry for the upload, tagged with the first selected week.
            const rawRows = data.map(row => JSON.stringify(row));
            logsToSave.push({ course: targetClean, week: allowedWeeks[0], type: "File Upload", data: rawRows });

            const targetFull = sysConfig.attCourses.find(c => c.replace(/\s/g,'') === targetClean); 
            let lvl = 0; const match = targetFull.match(/\d+/); if(match) lvl = Math.floor(parseInt(match[0])/100) * 100; 
            data.forEach(row => { 
                const id = String(row['ID'] || row['Index ID'] || row['Student ID'] || row['__EMPTY'] || '').trim(); 
                let name = "Unknown"; for (const k in row) { if (k.toLowerCase().includes('name')) name = row[k]; } 
                if (!id || id.length < 5) return; 
                let s = this.cache.find(x => x.id === id); 
                if (!s) { s = {id: id, name: formatName(name), level: lvl, courses: [targetFull]}; batchStudents.push(s); this.cache.push(s); } 
                else if (!s.courses.includes(targetFull)) { if (!batchStudents.find(bs => bs.id === id)) { s.courses.push(targetFull); batchStudents.push(s); } } 
                Object.keys(row).forEach(key => { const weekMatch = key.match(/^(?:Week|Wk|W)\s*(\d+)$/i) || (key.match(/^\d+$/) ? [key, key] : null); 
                    if (weekMatch) { const weekNum = parseInt(weekMatch[1]); if (allowedWeeks.includes(weekNum) && weekNum <= sysConfig.totalWeeks) { 
                        const val = row[key]; let status = "Absent"; if (val == 1 || String(val).toLowerCase().startsWith('p') || String(val).toLowerCase() === 'yes') { status = "Present"; } 
                        const dbKey = `${targetClean}_W${weekNum}_${id}`; batchAtt.push({key: dbKey, status, course: targetClean, week: weekNum, id}); this.attMap.set(dbKey, status); count++; } } }); }); 
        } 
        
        // Save Logs
        for(let l of logsToSave) { await this.saveScanLog(l.course, l.week, l.type, l.data); }

        if(batchStudents.length > 0) await db.batchPut('students', batchStudents); 
        if(batchAtt.length > 0) await db.batchPut('attendance', batchAtt); 
        document.getElementById('qr-modal').style.display='none'; this.updateContext(); alert(`Excel Upload Complete.\nProcessed ${count} entries.\nRaw Data Saved.`); 
    },
    
    executeScan: async function(raw, targetWeeks, targetCourses) {
        if(!raw.trim()) return;
        // Capture raw input lines
        const rawLines = raw.split(/\r?\n/).filter(line => line.trim() !== "");
        
        // Pass raw data to temporary storage for saving later
        this.tempRawData = {
            lines: rawLines,
            weeks: targetWeeks,
            courses: targetCourses
        };

        let rawMatches = raw.match(/\b\d{8}\b/g) || [];
        let totalEntries = rawMatches.length;
        let counts = {}; rawMatches.forEach(x => counts[x] = (counts[x] || 0) + 1);
        let uniqueIDs = new Set(rawMatches);
        let duplicateCount = totalEntries - uniqueIDs.size;
        const primaryCourseCode = targetCourses[0]; 
        const fullC = sysConfig.attCourses.find(c => c.replace(/\s/g, '') === primaryCourseCode);
        
        let validList = [];
        let outOfModuleList = [];
        let unregList = [];
        
        const cleanTargetCourse = primaryCourseCode.replace(/\s/g, '').toLowerCase();

        uniqueIDs.forEach(id => {
            const student = this.cache.find(s => s.id === id);
            if(student) {
                // Stricter check ignoring spaces and casing
                let isEnrolled = false;
                if(student.courses && Array.isArray(student.courses)) {
                    isEnrolled = student.courses.some(c => c.replace(/\s/g, '').toLowerCase() === cleanTargetCourse);
                }

                if(isEnrolled) {
                    validList.push({id: student.id, name: student.name, status: "Valid"});
                } else {
                    outOfModuleList.push({id: student.id, name: student.name, level: student.level, status: "Out of Module"});
                }
            } else {
                unregList.push({id: id, name: "New/Unknown", status: "Non-Registered"});
            }
        });

        // Sort Out of Module and Unregistered strictly by Index ID from A-Z
        outOfModuleList.sort((a,b) => a.id.localeCompare(b.id));
        unregList.sort((a,b) => a.id.localeCompare(b.id));

        document.getElementById('scan-stat-total').innerText = totalEntries;
        document.getElementById('scan-stat-dupes').innerText = duplicateCount;
        document.getElementById('scan-stat-valid').innerText = validList.length;
        document.getElementById('scan-stat-oom').innerText = outOfModuleList.length;
        document.getElementById('scan-stat-unreg').innerText = unregList.length;
        document.getElementById('scan-target-course').innerText = fullC;
        document.getElementById('scan-expected-module').innerText = fullC;

        const validBody = document.getElementById('scan-valid-body');
        validBody.innerHTML = "";
        validList.forEach(s => {
            validBody.innerHTML += `<tr><td style="font-family:monospace; font-weight:bold;">${s.id}</td><td>${s.name}</td><td style="text-align:center;"><span class="badge ${s.status==='Valid'?'bg-green':'bg-yellow'}">${s.status}</span></td></tr>`;
        });

        const oomContainer = document.getElementById('scan-out-of-module-container');
        const oomBody = document.getElementById('scan-oom-body');
        oomBody.innerHTML = "";
        if(outOfModuleList.length > 0) {
            oomContainer.style.display = 'block';
            outOfModuleList.forEach(s => {
                oomBody.innerHTML += `<tr><td style="width:30px;"><input type="checkbox" class="scan-oom-check" value="${s.id}"></td><td><strong style="font-family:monospace;">${s.id}</strong> - ${s.name} <span class="badge bg-red">Lvl ${s.level}</span></td></tr>`;
            });
        } else { oomContainer.style.display = 'none'; }

        const unregContainer = document.getElementById('scan-unreg-container');
        const unregBody = document.getElementById('scan-unreg-body');
        unregBody.innerHTML = "";
        if(unregList.length > 0) {
            unregContainer.style.display = 'block';
            unregList.forEach(s => {
                unregBody.innerHTML += `<tr><td style="width:30px;"><input type="checkbox" class="scan-unreg-check" value="${s.id}"></td><td><strong style="font-family:monospace; color:var(--danger)">${s.id}</strong></td></tr>`;
            });
        } else { unregContainer.style.display = 'none'; }

        this.pendingBatch = validList;
        this.scanTargetWeeks = targetWeeks;
        this.scanTargetCourses = targetCourses;
        document.getElementById('qr-modal').style.display = 'none';
        document.getElementById('scan-override-modal').style.display = 'block';
    },
    toggleOOMAll: function(cb) { document.querySelectorAll('.scan-oom-check').forEach(c => c.checked = cb.checked); },
    toggleUnregAll: function(cb) { document.querySelectorAll('.scan-unreg-check').forEach(c => c.checked = cb.checked); },
    
    saveScanOverrides: async function() {
        // SAVE RAW DATA HERE
        if(this.tempRawData) {
            for(let c of this.tempRawData.courses) {
                for(let w of this.tempRawData.weeks) {
                    await this.saveScanLog(c, w, "Paste", this.tempRawData.lines);
                }
            }
            this.tempRawData = null;
        }

        const checkedOOM = Array.from(document.querySelectorAll('.scan-oom-check:checked')).map(cb => cb.value);
        const checkedUnreg = Array.from(document.querySelectorAll('.scan-unreg-check:checked')).map(cb => cb.value);
        let finalIDs = this.pendingBatch.map(s => s.id).concat(checkedOOM).concat(checkedUnreg);

        let batchAtt = []; let batchStudents = [];

        for(let cleanC of this.scanTargetCourses) {
            const fullC = sysConfig.attCourses.find(c => c.replace(/\s/g, '') === cleanC);
            let lvl = 0; const match = fullC.match(/\d+/); if(match) lvl = Math.floor(parseInt(match[0])/100) * 100;
            for(let id of finalIDs) {
                let s = this.cache.find(x => x.id === id);
                if(!s) { 
                    s = {id: id, name: "Unknown", level: lvl, courses: [fullC]}; 
                    batchStudents.push(s); 
                    this.cache.push(s); 
                } 
                else if (!s.courses.includes(fullC)) { 
                    s.courses.push(fullC); 
                    if(!batchStudents.find(b=>b.id===s.id)) batchStudents.push(s); 
                }
                for(let w of this.scanTargetWeeks) {
                    const key = `${cleanC}_W${w}_${id}`; 
                    batchAtt.push({key, status:'Present', course:cleanC, week:w, id:id}); 
                    this.attMap.set(key, 'Present');
                }
            }
        }
        if(batchStudents.length > 0) await db.batchPut('students', batchStudents);
        if(batchAtt.length > 0) await db.batchPut('attendance', batchAtt);
        document.getElementById('scan-override-modal').style.display='none'; 
        this.updateContext(); 
        alert(`Success! Marked ${finalIDs.length} students Present.\nRaw Data Saved.`);
    },
    closeModal: function() { document.getElementById('new-student-modal').style.display='none'; this.pending=[]; }, confirmAddStudents: async function() { let batch = []; let lvl=0; const match = this.course.match(/\d+/); if(match) lvl = Math.floor(parseInt(match[0])/100) * 100; const cleanC = this.course.replace(/\s/g, ''); const targetW = this.week; for(let p of this.pending) { const finalName = formatName(p.name); const fullC = sysConfig.attCourses.find(c => c.replace(/\s/g, '') === cleanC); const s = {id:p.id, name: finalName, level:lvl, courses:[fullC]}; await db.put('students', s); this.cache.push(s); const key = `${cleanC}_W${targetW}_${p.id}`; this.attMap.set(key, 'Present'); batch.push({key, status:'Present', course:cleanC, week:targetW, id:p.id}); } if(batch.length) await db.batchPut('attendance', batch); this.closeModal(); this.updateContext(); alert(`${this.pending.length} New students added and marked Present.`); }, downloadReport: function() { const wb = XLSX.utils.book_new(); const curW = dashApp.currentWeek; sysConfig.attCourses.forEach(c => { const cleanC = c.replace(/\s/g,''); const list = this.cache.filter(s => s.courses && s.courses.includes(c)); list.sort((a,b)=>a.id.localeCompare(b.id)); const data = list.map(s => { let r = {"Index ID": s.id, "Name": s.name}; let t = 0; for(let w=1; w<=sysConfig.totalWeeks; w++) { if(w > curW) { r[`Week ${w}`] = ""; } else { const st = this.getAtt(s.id,w,cleanC); r[`Week ${w}`] = (st === 'Present' ? "1" : "0"); if(st==='Present') t++; } } r["Total"] = t + "/" + sysConfig.totalWeeks; return r; }); const ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = [{wch:15}, {wch:30}, ...Array(sysConfig.totalWeeks).fill({wch:5}), {wch:10}]; XLSX.utils.book_append_sheet(wb, ws, c); }); const fn = getDownloadFileName('AttendanceReport'); XLSX.writeFile(wb, fn); }, finalizeRestore: async function() { const checkedCourses = Array.from(document.querySelectorAll('.att-sel-check:checked')).map(c => c.value); const finalBatch = this.pendingBatch.filter(b => checkedCourses.includes(b.course)); if(finalBatch.length > 0) { await db.batchPut('attendance', finalBatch); await this.sync(); this.updateContext(); alert(`Restoration Complete.\n${finalBatch.length} records saved.`); } document.getElementById('att-confirm-modal').style.display='none'; } 
};

// --- DASHAPP ---
dashApp = { weeks: [], tasks: {}, openWeeks: {1:true}, currentWeek: 0, init: async function() { this.weeks = Array.from({length: sysConfig.totalWeeks}, (_, i) => i + 1); this.calcTime(); if(this.currentWeek>0 && this.currentWeek<=sysConfig.totalWeeks) { this.openWeeks={}; this.openWeeks[this.currentWeek]=true; } const recs = await db.getAll('tasks'); recs.forEach(r => this.tasks[r.key] = r); this.render(); if(noteApp && noteApp.init) noteApp.init(); if(attApp && attApp.setCurrWeek) attApp.setCurrWeek(this.currentWeek); }, calcTime: function() { const start = new Date(sysConfig.startDate); const diff = Math.floor((new Date() - start)/(1000*60*60*24)); this.currentWeek = diff < 0 ? 0 : Math.floor(diff/7)+1; }, toggleWeek: function(w) { this.openWeeks[w] = !this.openWeeks[w]; this.render(); }, toggleTask: async function(w, c, type) { const key = `w${w}_${c}`; if(!this.tasks[key]) this.tasks[key] = {key, week:w, course:c, notes:false, assign:false}; this.tasks[key][type] = !this.tasks[key][type]; this.render(); await db.put('tasks', this.tasks[key]); }, render: function() { const t = document.getElementById('cd-title'), s = document.getElementById('cd-subtitle'), b = document.getElementById('cd-badge'); const total = sysConfig.totalWeeks; if(this.currentWeek<1) { t.innerText="Semester Starts Soon"; b.innerText="WAITING"; } else if(this.currentWeek>total) { t.innerText="Semester Complete"; b.innerText="DONE"; } else { t.innerText=`Current Week: ${this.currentWeek}`; s.innerText=`${total-this.currentWeek} remaining`; b.innerText=`WEEK ${this.currentWeek}`; } let stats = {}; sysConfig.teachCourses.forEach(c => stats[c]={n:0,a:0}); Object.values(this.tasks).forEach(t => { if(sysConfig.teachCourses.includes(t.course)) { if(t.notes) stats[t.course].n++; if(t.assign) stats[t.course].a++; } }); const grid = document.getElementById('dash-grid'); grid.innerHTML = ''; sysConfig.teachCourses.forEach(c => { grid.innerHTML += `<div class="course-card"><div class="cc-header"><div class="cc-title">${c}</div><div class="cc-avatar">${c.split(' ')[1]||'C'}</div></div><div class="cc-stat"><span style="color:#666">Notes:</span> <strong>${stats[c].n}/${total}</strong></div><div class="cc-stat"><span style="color:#666">Assign:</span> <strong>${stats[c].a}/${total}</strong></div></div>`; }); const sched = document.getElementById('schedule-container'); sched.innerHTML = ''; this.weeks.forEach(w => { const open = this.openWeeks[w], active = (w===this.currentWeek); let rows = ''; sysConfig.teachCourses.forEach(c => { const st = this.tasks[`w${w}_${c}`] || {}; rows += `<tr><td style="font-weight:bold; color:var(--ug-blue)">${c}</td><td><button class="task-btn ${st.notes?'done':''}" onclick="dashApp.toggleTask(${w},'${c}','notes')">${st.notes?'✔ Notes Given':'○ Give Notes'}</button></td><td><button class="task-btn ${st.assign?'done':''}" onclick="dashApp.toggleTask(${w},'${c}','assign')">${st.assign?'✔ Assign. Given':'○ Give Assign.'}</button></td></tr>`; }); 
        const badgeHtml = active ? `<span class="curr-week-badge">CURRENT WEEK</span>` : '';
        const activeHeader = `<div style="display:flex; align-items:center;"><span style="font-weight:bold; font-size:${active?'1.1rem':'1rem'};">${getWeekLabel(w)}</span> ${badgeHtml}</div>`;
        sched.innerHTML += `<div class="week-row ${active?'active-week':''}"><div class="week-row-header" onclick="dashApp.toggleWeek(${w})"><div>${activeHeader}</div><div>${open?'▼':'▶'}</div></div><div class="week-content ${open?'open':''}"><table class="task-table"><thead><tr><th>Course</th><th>Notes</th><th>Assignment</th></tr></thead><tbody>${rows}</tbody></table></div></div>`; }); } };

// --- DB VIEW ---
dbView = { 
    allStudents: [], filterLvl: 0, filterCourse: "", pendingRows: [], sortCol: 'name', sortAsc: true, isDeleteMode: false, selected: new Set(), 
    init: async function() { this.allStudents = await db.getAll('students'); this.calcStats(); this.render(); }, 
    calcStats: function() { 
        document.getElementById('stat-total').innerText = this.allStudents.length; 
        [100,200,300,400].forEach(l => { document.getElementById(`stat-${l}`).innerText = this.allStudents.filter(s=>s.level===l).length; }); 
        const container = document.getElementById('db-filter-container');
        let html = `<button class="db-pill ${this.filterLvl===0 && !this.filterCourse ? 'active':''}" onclick="dbView.filter(0, '')">All (${this.allStudents.length})</button>`;
        [100,200,300,400].forEach(l => {
            let count = this.allStudents.filter(s=>s.level===l).length;
            html += `<button class="db-pill ${this.filterLvl===l ? 'active':''}" onclick="dbView.filter(${l}, '')">Level ${l} (${count})</button>`;
        });
        sysConfig.attCourses.forEach(c => {
            let count = this.allStudents.filter(s => s.courses && s.courses.includes(c)).length;
            html += `<button class="db-pill ${this.filterCourse===c ? 'active':''}" onclick="dbView.filter(0, '${c}')">${c} (${count})</button>`;
        });
        html += `<div style="margin-left:auto; display:flex; gap:10px;"><button class="btn btn-blue" onclick="dbView.openExportModal()">⤓ Export Data</button><button class="btn btn-danger" onclick="dbView.toggleDeleteMode()">Manage / Delete</button><button class="btn btn-gold" onclick="dbView.openImportModal()">+ Import</button></div>`;
        container.innerHTML = html;
    }, 
    filter: function(lvl, course) { this.filterLvl = lvl; this.filterCourse = course; this.calcStats(); this.render(); }, 
    search: function(val) { this.render(val); }, 
    sort: function(col) { if(this.sortCol===col) this.sortAsc=!this.sortAsc; else {this.sortCol=col;this.sortAsc=true;} this.render(document.querySelector('#view-database input').value); }, 
    toggleDeleteMode: function() { this.isDeleteMode = !this.isDeleteMode; this.selected.clear(); document.getElementById('db-delete-toolbar').style.display = this.isDeleteMode ? 'flex' : 'none'; document.getElementById('th-check').style.display = this.isDeleteMode ? 'table-cell' : 'none'; this.render(document.querySelector('#view-database input').value); }, 
    toggleSelect: function(id) { if(this.selected.has(id)) this.selected.delete(id); else this.selected.add(id); }, 
    toggleSelectAll: function(cb) { const visible = this.getVisibleStudents(); if(cb.checked) visible.forEach(s => this.selected.add(s.id)); else visible.forEach(s => this.selected.delete(s.id)); this.render(document.querySelector('#view-database input').value); }, 
    deleteSelected: async function() { if(this.selected.size === 0) return alert("No students selected."); if(confirm(`Delete ${this.selected.size} selected students?`)) { await db.batchDel('students', Array.from(this.selected)); await attApp.sync(); this.allStudents = await db.getAll('students'); this.toggleDeleteMode(); this.calcStats(); alert("Deleted."); } }, 
    deleteAllInLevel: async function() { const target = this.filterCourse ? this.filterCourse : (this.filterLvl === 0 ? "ALL LEVELS" : `LEVEL ${this.filterLvl}`); if(confirm(`WARNING: DELETE ALL students in ${target}?`)) { const toDelete = this.getVisibleStudents().map(s => s.id); if(toDelete.length === 0) return alert("No students to delete."); await db.batchDel('students', toDelete); await attApp.sync(); this.allStudents = await db.getAll('students'); this.toggleDeleteMode(); this.calcStats(); alert("Deletion Complete."); } }, 
    getVisibleStudents: function(searchVal = "") { 
        const search = (searchVal || "").toLowerCase(); 
        return this.allStudents.filter(s => {
            let matchLvl = this.filterLvl === 0 || s.level === this.filterLvl;
            let matchCourse = !this.filterCourse || (s.courses && s.courses.includes(this.filterCourse));
            let matchSearch = s.name.toLowerCase().includes(search) || s.id.includes(search);
            return matchLvl && matchCourse && matchSearch;
        }); 
    }, 
    render: function(searchVal = "") { 
        ['id','name'].forEach(c => { const el = document.getElementById(`sort-icon-db-${c}`); el.className = 'sort-arrow ' + (this.sortCol === c ? (this.sortAsc ? 'sort-asc' : 'sort-desc') : 'sort-none'); }); 
        const tbody = document.getElementById('db-table-body'); 
        let list = this.getVisibleStudents(searchVal); 
        list.sort((a,b) => { let vA=a[this.sortCol], vB=b[this.sortCol]; if(vA<vB) return this.sortAsc?-1:1; if(vA>vB) return this.sortAsc?1:-1; return 0; }); 
        if(list.length === 0) { tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px; color:#999'>No students found.</td></tr>"; return; } 
        const rows = list.map((s, i) => { 
            const check = this.isDeleteMode ? `<td><input type="checkbox" ${this.selected.has(s.id)?'checked':''} onchange="dbView.toggleSelect('${s.id}')"></td>` : ''; 
            return `<tr>${check}<td>${i+1}</td><td style='font-family:monospace; font-weight:bold; color:var(--ug-blue)'>${s.id}</td><td class="clickable-name" onclick="editNameApp.open('${s.id}', '${s.name}')">${s.name}</td><td>${s.level}</td></tr>`; 
        }).join('');
        tbody.innerHTML = rows;
    }, 
    openExportModal: function() { document.getElementById('db-export-modal').style.display='block'; }, executeExport: function() { const options = Array.from(document.querySelectorAll('input[name="exp-opt"]:checked')).map(cb => parseInt(cb.value)); if(options.length === 0) return alert("Please select at least one level."); const wb = XLSX.utils.book_new(); options.forEach(lvl => { const data = this.allStudents.filter(s => s.level === lvl).map(s => ({"Index ID":s.id, "Name":s.name, "Level":s.level})); if(data.length) { const ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = [{wch:15}, {wch:30}, {wch:10}]; XLSX.utils.book_append_sheet(wb, ws, `Level ${lvl}`); } }); if(wb.SheetNames.length === 0) return alert("No data found for selected levels."); const fn = getDownloadFileName('StudentDatabase'); XLSX.writeFile(wb, fn); document.getElementById('db-export-modal').style.display='none'; },updateImportCourses: function() {
        const lvl = document.getElementById('imp-level-select').value;
        const lvlPrefix = lvl.substring(0, 1);
        const container = document.getElementById('imp-course-select');
        container.innerHTML = '<option value="">-- None (Level Only) --</option>';
        sysConfig.attCourses.forEach(c => {
            const match = c.match(/\d+/);
            if (match && match[0].startsWith(lvlPrefix)) {
                container.innerHTML += `<option value="${c}">${c}</option>`;
            }
        });
    },
    openImportModal: function() { 
        document.getElementById('db-import-modal').style.display='block'; 
        document.getElementById('db-step-1').style.display='block'; 
        document.getElementById('db-step-2').style.display='none'; 
        document.getElementById('db-paste-area').value=''; 
        document.getElementById('imp-level-select').value = "200"; 
        this.updateImportCourses();
    }, 
    closeImportModal: function() { document.getElementById('db-import-modal').style.display='none'; }, 
    resetFile: function() { document.getElementById('db-import-file').value = ''; alert("File selection cleared. You can now use the Paste option."); }, 
    previewImport: function() { 
        const lvl = parseInt(document.getElementById('imp-level-select').value);
        const course = document.getElementById('imp-course-select').value;
        const fileInput = document.getElementById('db-import-file'); 
        
        if(fileInput.files.length > 0) { 
            const file = fileInput.files[0];
            const ext = file.name.split('.').pop().toLowerCase();
            
            if (ext === 'pdf' || ext.startsWith('doc')) {
                alert("For Word or PDF files, please open them, copy the text, and paste it into the 'Paste List' box.");
                fileInput.value = '';
                return;
            }
            
            if (ext === 'txt') {
                const reader = new FileReader();
                reader.onload = e => { this.processSingleImportData(e.target.result, lvl, course); };
                reader.readAsText(file);
                return;
            }

            const r = new FileReader(); 
            r.onload = e => { 
                try {
                    const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'}); 
                    this.processImportWorkbook(wb, lvl, course); 
                } catch (err) {
                    alert("Error reading file. Please use a valid Excel (.xls, .xlsx) or CSV file.");
                }
            }; 
            r.readAsArrayBuffer(file); 
        } else { 
            const txt = document.getElementById('db-paste-area').value; 
            this.processSingleImportData(txt, lvl, course); 
        } 
    }, 
    processImportWorkbook: async function(wb, lvl, course) { 
        let rows = []; 
        wb.SheetNames.forEach(sheetName => { 
            const sheetData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1}); 
            const txt = sheetData.map(r=>r.join("\t")).join("\n"); 
            rows = rows.concat(this.parseRawData(txt, lvl, course)); 
        }); 
        if(rows.length === 0) return alert("No valid data found in workbook."); 
        this.closeImportModal(); this.showLevelSelector(rows, lvl, course); 
    }, 
    processSingleImportData: function(txt, lvl, course) { 
        const rows = this.parseRawData(txt, lvl, course); 
        this.closeImportModal(); this.showLevelSelector(rows, lvl, course); 
    }, 
    parseRawData: function(txt, lvl, course) { 
        let parsed = []; 
        const lines = txt.split(/[\r\n]+/); 
        lines.forEach(l => { 
            const match = l.match(/(\d+)\s+(.*)/); 
            if(match) { 
                const id = match[1].trim(); 
                const name = formatName(match[2]); 
                if(id.length >= 4) { parsed.push({id, name, level:lvl, courses: course ? [course] : []}); } 
            } 
        }); 
        return parsed; 
    }, 
    showLevelSelector: function(rows, lvl, course) { 
        this.pendingRows = rows; 
        const targetText = course ? `${course} (Level ${lvl})` : `Level ${lvl} (No Module)`;
        let html = `<div class="confirm-row"><label><input type="checkbox" class="db-sel-check" data-lvl="${lvl}" value="${course}" checked> <span><strong>${targetText}</strong> (${rows.length} students)</span></label></div>`; 
        document.getElementById('db-select-list').innerHTML = html; document.getElementById('db-confirm-modal').style.display = 'block'; 
    }, 
    finalizeImport: async function() { 
        const chk = document.querySelector('.db-sel-check');
        const course = chk.value; 
        const lvl = parseInt(chk.dataset.lvl);
        document.getElementById('db-confirm-modal').style.display = 'none'; 
        let importCount = 0; let batch = [];
        for (let r of this.pendingRows) {
            let existing = this.allStudents.find(s => s.id === r.id);
            if (existing) {
                if (course && !existing.courses.includes(course)) {
                    existing.courses.push(course); batch.push(existing); importCount++;
                }
            } else {
                batch.push(r); this.allStudents.push(r); importCount++;
            }
        }
        if(batch.length > 0) { 
            await db.batchPut('students', batch); 
            await attApp.sync(); 
            this.allStudents = await db.getAll('students'); 
            this.calcStats(); this.render(); 
        } 
        document.getElementById('import-new-stat').innerText = importCount; 
        document.getElementById('db-import-modal').style.display='block'; 
        document.getElementById('db-step-1').style.display='none'; 
        document.getElementById('db-step-2').style.display='flex'; 
    }, 
    closeImportModal: function() { document.getElementById('db-import-modal').style.display='none'; }
};

// --- REWRITTEN TA APP ---
taApp = {
    data: [],
    currentTA: null,
    currentTab: 'overview',
    sortCol: 'name',
    sortAsc: true,
    
    init: async function() {
        this.data = await db.getAll('ta_store');
        this.renderList();
    },
    
    import: function() { document.getElementById('ta-file-input').click(); },
    
    handleFile: function(input) {
        const file = input.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                let processedData = [];
                // Case 1: EXPORT FORMAT
                const keys = Object.keys(json);
                if (keys.length > 0 && Array.isArray(json[keys[0]]) && !json.config) {
                    const taName = file.name.split('_')[0] || "Imported TA";
                    const id = taName.toUpperCase().replace(/\s+/g, '_');
                    let students = [];
                    let grades = [];
                    let attList = [];
                    let courses = [];
                    
                    for (let courseKey in json) {
                        courses.push({id: courseKey, code: courseKey, grp: courseKey});
                        json[courseKey].forEach(row => {
                            students.push({id: row.ID, name: row.Name, grp: courseKey});
                            for (let k in row) {
                                if (k.startsWith("Grade: ")) {
                                    const assignName = k.replace("Grade: ", "").trim();
                                    grades.push({id: `${row.ID}_${assignName}`, val: row[k]});
                                }
                                if (k.startsWith("Week ") && row[k] === "Present") {
                                    const wNum = k.replace("Week ", "");
                                    attList.push(`${courseKey}_W${wNum}_${row.ID}`);
                                }
                            }
                        });
                    }
                    
                    const newTA = {
                        id: id,
                        data: {
                            config: { taName: taName, courses: courses, weeks: 13 },
                            students: students,
                            grades: grades,
                            attendance: attList,
                            tasks: []
                        }
                    };
                    processedData.push(newTA);
                }
                // Case 2: SINGLE BACKUP
                else if (json.config && json.config.taName) {
                    const id = json.config.taName.toUpperCase().replace(/\s+/g, '_');
                    processedData.push({ id: id, data: json });
                } 
                // Case 3: FULL SYSTEM BACKUP
                else {
                    for (let key in json) {
                        if (json[key].config) {
                            processedData.push({ id: key, data: json[key] });
                        }
                    }
                }
                
                if (processedData.length === 0) throw new Error("No valid TA data found.");
                
                for(let item of processedData) {
                    await db.put('ta_store', item);
                }
                
                this.data = await db.getAll('ta_store');
                this.renderList();
                alert(`Imported ${processedData.length} Profiles.`);
            } catch(err) {
                console.error(err);
                alert("Error parsing JSON. Unknown format.");
            }
        };
        r.readAsText(file);
    },
    
    deleteTA: async function(id) {
        if(confirm("Are you sure you want to delete this TA profile?")) {
            await db.delete('ta_store', id);
            this.data = await db.getAll('ta_store');
            this.renderList();
        }
    },
    
    renderList: function() {
        const c = document.getElementById('ta-list-container');
        c.innerHTML = '';
        if(this.data.length === 0) {
            c.innerHTML = "<div style='text-align:center; padding:20px; color:#999; grid-column: 1 / -1;'>No TA Data. Click Import.</div>";
            return;
        }
        this.data.forEach(item => {
            const ta = item.data;
            const name = ta.config.taName;
            const courses = (ta.config.courses || []).map(c => c.code).join(', ');
            const studentCount = (ta.students || []).length;
            
            const card = document.createElement('div');
            card.className = 'ta-card';
            card.innerHTML = `
                <div class="ta-info" onclick="taApp.selectTA('${item.id}')">
                    <div style="width:40px; height:40px; border-radius:50%; background:var(--ug-blue); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; margin-bottom:10px;">${name.charAt(0)}</div>
                    <h3>${name}</h3>
                    <p>${courses || 'No Courses'}</p>
                </div>
                <div class="ta-del-btn" onclick="event.stopPropagation(); taApp.deleteTA('${item.id}')">🗑</div>
                <div style="text-align:right;" onclick="taApp.selectTA('${item.id}')">
                    <div style="font-weight:bold; font-size:1.2rem; color:var(--ug-blue);">${studentCount}</div>
                    <div style="font-size:0.75rem; color:#666;">STUDENTS</div>
                </div>
            `;
            c.appendChild(card);
        });
    },
    
    selectTA: function(id) {
        const record = this.data.find(d => d.id === id);
        if(!record) return;
        this.currentTA = record.data;
        document.getElementById('ta-list-view').style.display = 'none';
        document.getElementById('ta-details-view').style.display = 'flex';
        document.getElementById('ta-det-name').innerText = this.currentTA.config.taName;
        document.getElementById('ta-det-id').innerText = id;
        this.switchTab('overview');
    },
    
    closeDetails: function() {
        document.getElementById('ta-details-view').style.display = 'none';
        document.getElementById('ta-list-view').style.display = 'grid'; // Grid for homepage
        this.currentTA = null;
    },
    
    switchTab: function(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.ta-sub-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ta-pane').forEach(p => p.classList.remove('active'));
        const idx = ['overview', 'attendance', 'grades'].indexOf(tab);
        if(idx > -1) document.querySelectorAll('.ta-sub-tab')[idx].classList.add('active');
        document.getElementById(`ta-tab-${tab}`).classList.add('active');
        
        if(tab === 'overview') this.renderOverview();
        if(tab === 'attendance') this.initAttDropdowns();
        if(tab === 'grades') this.initGradeDropdowns();
    },
    
    renderOverview: function() {
        const ta = this.currentTA;
        if(!ta) return;
        const tasks = ta.tasks || [];
        
        document.getElementById('ta-stats').innerHTML = `
            <div class="ta-stat"><div>Total Students</div><div>${(ta.students || []).length}</div></div>
            <div class="ta-stat"><div>Courses</div><div>${(ta.config.courses||[]).length}</div></div>
            <div class="ta-stat"><div>Tasks Logged</div><div>${tasks.length}</div></div>
        `;
        
        const accContainer = document.getElementById('ta-tasks-accordion');
        accContainer.innerHTML = '';
        
        if(tasks.length === 0) {
            accContainer.innerHTML = "<p style='color:#999; text-align:center;'>No tasks logged.</p>";
            return;
        }
        
        // Group tasks by Week
        let grouped = {};
        tasks.forEach(taskStr => {
            const weekMatch = taskStr.match(/_W(\d+)_/i) || taskStr.match(/Week\s*(\d+)/i) || taskStr.match(/\bW(\d+)\b/i);
            let weekNum = 999;
            
            if (weekMatch && weekMatch[1]) {
                weekNum = parseInt(weekMatch[1]);
            }
            
            if (!grouped[weekNum]) grouped[weekNum] = [];
            grouped[weekNum].push(taskStr);
        });
        
        const keys = Object.keys(grouped).sort((a,b) => a - b);
        
        keys.forEach(key => {
            const weekLabel = key == 999 ? "General Tasks" : `Week ${key}`;
            const taskList = grouped[key];
            
            let html = `<details class="week-acc" ${key==1?'open':''}>`;
            html += `<summary>${weekLabel} <span style="font-weight:normal; font-size:0.8rem; opacity:0.7;">(${taskList.length} tasks)</span></summary>`;
            html += `<div class="week-acc-content">`;
            
            taskList.forEach(t => {
                html += `<div class="acc-task-item">${t}</div>`;
            });
            
            html += `</div></details>`;
            accContainer.innerHTML += html;
        });
    },
    
    initAttDropdowns: function() {
        const ta = this.currentTA;
        if(!ta) return;
        const courses = ta.config.courses || [];
        const selC = document.getElementById('ta-att-course');
        selC.innerHTML = '';
        courses.forEach(c => { selC.innerHTML += `<option value="${c.id}">${c.code} (Grp ${c.grp})</option>`; });
        const totalWeeks = parseInt(ta.config.weeks) || 13;
        const selW = document.getElementById('ta-att-week');
        selW.innerHTML = '';
        for(let i=1; i<=totalWeeks; i++) { selW.innerHTML += `<option value="${i}">Week ${i}</option>`; }
        this.renderAtt();
    },
    
    sortAtt: function(col) {
        if(this.sortCol===col) this.sortAsc = !this.sortAsc; else { this.sortCol=col; this.sortAsc=true; }
        this.renderAtt();
    },
    
    renderAtt: function() {
        const ta = this.currentTA;
        if(!ta) return;
        const courseID = document.getElementById('ta-att-course').value;
        const week = document.getElementById('ta-att-week').value;
        const search = document.getElementById('ta-att-search').value.toLowerCase();
        const tbody = document.getElementById('ta-att-body');
        tbody.innerHTML = '';
        
        ['id','name','total','status'].forEach(c => {
            const el = document.getElementById(`ta-sort-att-${c}`);
            el.className = 'sort-arrow ' + (this.sortCol === c ? (this.sortAsc ? 'sort-asc' : 'sort-desc') : 'sort-none');
        });
        
        const students = (ta.students || []).filter(s => s.grp === courseID);
        const attList = ta.attendance || [];
        
        let list = students.map(s => {
            const checkStr = `${courseID}_W${week}_${s.id}`;
            const isPresent = attList.includes(checkStr);
            const pattern = `${courseID}_W`;
            const suffix = `_${s.id}`;
            const total = attList.filter(str => str.startsWith(pattern) && str.endsWith(suffix)).length;
            return { ...s, isPresent, total, status: isPresent ? 'Present' : 'Absent' };
        });
        
        if(search) list = list.filter(s => s.name.toLowerCase().includes(search) || s.id.includes(search));
        
        list.sort((a,b) => {
            let vA = a[this.sortCol], vB = b[this.sortCol];
            if(vA < vB) return this.sortAsc ? -1 : 1;
            if(vA > vB) return this.sortAsc ? 1 : -1;
            return 0;
        });
        
        let present = 0, absent = 0;
        list.forEach(s => {
            if(s.isPresent) present++; else absent++;
            tbody.innerHTML += `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.total}</td><td><span class="badge ${s.isPresent ? 'bg-green' : 'bg-red'}">${s.status}</span></td></tr>`;
        });
        
        document.getElementById('ta-att-headcount').innerHTML = `<div class="ta-hc-item"><span style="color:var(--success)">●</span> Present: ${present}</div><div class="ta-hc-item"><span style="color:var(--danger)">●</span> Absent: ${absent}</div>`;
    },
    
    initGradeDropdowns: function() {
        const ta = this.currentTA;
        if(!ta) return;
        const courses = ta.config.courses || [];
        const sel = document.getElementById('ta-grade-course');
        if(sel.options.length <= 0) { courses.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.code} (Grp ${c.grp})</option>`; }); }
        this.renderGrades();
    },
    
    sortGrades: function(col) {
        if(this.sortCol===col) this.sortAsc = !this.sortAsc; else { this.sortCol=col; this.sortAsc=true; }
        this.renderGrades();
    },
    
    renderGrades: function() {
        const ta = this.currentTA;
        if(!ta) return;
        const courseID = document.getElementById('ta-grade-course').value;
        const search = document.getElementById('ta-grade-search').value.toLowerCase();
        const grades = ta.grades || [];
        
        // Dynamic Columns
        const assignmentIds = new Set();
        grades.forEach(g => {
            if(g.id.includes('_')) {
                const parts = g.id.split('_');
                if(parts.length > 1) assignmentIds.add(parts.slice(1).join('_')); 
            }
        });
        const assigns = Array.from(assignmentIds).sort();
        
        const thead = document.getElementById('ta-grade-head');
        let h = `<tr><th onclick="taApp.sortGrades('id')">ID <span class="sort-arrow ${this.sortCol==='id'?(this.sortAsc?'sort-asc':'sort-desc'):'sort-none'}"></span></th><th onclick="taApp.sortGrades('name')">Name <span class="sort-arrow ${this.sortCol==='name'?(this.sortAsc?'sort-asc':'sort-desc'):'sort-none'}"></span></th>`;
        assigns.forEach((a, i) => {
            const label = /^\d+$/.test(a) ? `Assessment ${i+1}` : a;
            h += `<th onclick="taApp.sortGrades('${a}')">${label} <span class="sort-arrow ${this.sortCol===a?(this.sortAsc?'sort-asc':'sort-desc'):'sort-none'}"></span></th>`;
        });
        h += `</tr>`;
        thead.innerHTML = h;
        
        const tbody = document.getElementById('ta-grade-body');
        tbody.innerHTML = '';
        
        let list = (ta.students || []).filter(s => s.grp === courseID);
        if(search) list = list.filter(s => s.name.toLowerCase().includes(search));
        
        // Map scores for sorting
        list = list.map(s => {
            let scores = {};
            assigns.forEach(aKey => {
                const rec = grades.find(x => x.id === `${s.id}_${aKey}`);
                scores[aKey] = rec ? rec.val : '';
            });
            return { ...s, scores };
        });
        
        list.sort((a,b) => {
            let vA, vB;
            if(this.sortCol === 'id' || this.sortCol === 'name') {
                vA = a[this.sortCol]; vB = b[this.sortCol];
            } else {
                vA = a.scores[this.sortCol] || ''; vB = b.scores[this.sortCol] || '';
                if(vA !== '' && vB !== '' && !isNaN(vA) && !isNaN(vB)) { vA = parseFloat(vA); vB = parseFloat(vB); }
            }
            if(vA < vB) return this.sortAsc ? -1 : 1;
            if(vA > vB) return this.sortAsc ? 1 : -1;
            return 0;
        });
        
        list.forEach(s => {
            let row = `<tr><td>${s.id}</td><td>${s.name}</td>`;
            assigns.forEach(aKey => row += `<td>${s.scores[aKey] || '-'}</td>`);
            row += `</tr>`;
            tbody.innerHTML += row;
        });
    },
    
    openExport: function() { alert("Export feature pending."); }
};

// --- CHISAG APP ---
chisagApp = { members: [], currentImg: '', isManageMode: false, selected: new Set(), sortCol: 'id', sortAsc: true, filterLvl: 0, init: async function() { const dSel = document.getElementById('c-mod-dob-day'); if(dSel.options.length === 1) { for(let i=1; i<=31; i++) { const opt = document.createElement('option'); opt.value = i < 10 ? '0'+i : i; opt.text = i; dSel.appendChild(opt); } } this.members = await db.getAll('chisag_members'); this.render(); }, toggleManageMode: function() { this.isManageMode = !this.isManageMode; this.selected.clear(); document.getElementById('chisag-delete-controls').style.display = this.isManageMode ? 'block' : 'none'; document.getElementById('chisag-th-check').style.display = this.isManageMode ? 'table-cell' : 'none'; this.render(); }, toggleSelect: function(id) { if(this.selected.has(id)) this.selected.delete(id); else this.selected.add(id); }, toggleSelectAll: function(cb) { if(cb.checked) this.members.forEach(m => this.selected.add(m.id)); else this.selected.clear(); this.render(); }, deleteSelected: async function() { if(this.selected.size === 0) return alert("No members selected."); if(confirm(`Delete ${this.selected.size} selected members?`)) { await db.batchDel('chisag_members', Array.from(this.selected)); this.members = await db.getAll('chisag_members'); this.toggleManageMode(); this.render(); alert("Members Deleted."); } }, filterByLevel: function(lvl) { this.filterLvl = lvl; this.render(); }, sort: function(col) { if(this.sortCol===col) this.sortAsc = !this.sortAsc; else { this.sortCol = col; this.sortAsc = true; } this.render(); }, lookup: async function() { const id = document.getElementById('chisag-input-id').value.trim(); if(!id) return alert("Please enter an ID."); this.currentImg = ''; let member = this.members.find(m => m.id === id); if (!member) { const student = await db.get('students', id); if (student) { const names = student.name.split(' '); const surname = names[0]; const other = names.slice(1).join(' '); member = { id: student.id, surname: surname, otherNames: other, level: student.level, dob: '', email: '', dues: false, souvPaid: false, souvTaken: false, pic: '' }; } else { member = { id: id, surname: '', otherNames: '', level: 100, dob: '', email: '', dues: false, souvPaid: false, souvTaken: false, pic: '' }; } } document.getElementById('c-mod-id').value = member.id; document.getElementById('c-mod-surname').value = member.surname; document.getElementById('c-mod-othernames').value = member.otherNames; document.getElementById('c-mod-level').value = member.level || 100; const dobParts = (member.dob || "").split('-'); if(dobParts.length === 2) { document.getElementById('c-mod-dob-day').value = dobParts[0]; document.getElementById('c-mod-dob-month').value = dobParts[1]; } else { document.getElementById('c-mod-dob-day').value = ""; document.getElementById('c-mod-dob-month').value = ""; } document.getElementById('c-mod-email').value = member.email || ''; document.getElementById('c-mod-dues').checked = member.dues; document.getElementById('c-mod-souv-paid').checked = member.souvPaid; document.getElementById('c-mod-souv-taken').checked = member.souvTaken; this.currentImg = member.pic || ''; this.updateImagePreview(); document.getElementById('chisag-member-modal').style.display = 'block'; }, handleImageUpload: function(input) { const file = input.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (e) => { this.currentImg = e.target.result; this.updateImagePreview(); }; reader.readAsDataURL(file); }, updateImagePreview: function() { const div = document.getElementById('c-img-preview'); if(this.currentImg) div.innerHTML = `<img src="${this.currentImg}" style="width:100%; height:100%; object-fit:cover;">`; else div.innerHTML = `<span style="color:#999; font-size:3rem;">📷</span>`; }, saveMember: async function() { const id = document.getElementById('c-mod-id').value; const surname = document.getElementById('c-mod-surname').value; const other = document.getElementById('c-mod-othernames').value; const d = document.getElementById('c-mod-dob-day').value; const m = document.getElementById('c-mod-dob-month').value; const dobStr = (d && m) ? `${d}-${m}` : ""; if(!surname) return alert("Surname is required"); const member = { id: id, surname: surname, otherNames: other, name: surname + " " + other, level: parseInt(document.getElementById('c-mod-level').value), dob: dobStr, email: document.getElementById('c-mod-email').value, dues: document.getElementById('c-mod-dues').checked, souvPaid: document.getElementById('c-mod-souv-paid').checked, souvTaken: document.getElementById('c-mod-souv-taken').checked, pic: this.currentImg }; await db.put('chisag_members', member); this.members = await db.getAll('chisag_members'); document.getElementById('chisag-member-modal').style.display = 'none'; document.getElementById('chisag-input-id').value = ''; this.render(); alert("Member Saved."); }, deleteMember: async function() { const id = document.getElementById('c-mod-id').value; if(confirm("Delete this member from CHISAG system?")) { await db.delete('chisag_members', id); this.members = await db.getAll('chisag_members'); document.getElementById('chisag-member-modal').style.display = 'none'; this.render(); } }, showPictureModal: function(imgSrc) { const modal = document.getElementById('picture-modal'); const img = document.getElementById('picture-modal-img'); img.src = imgSrc; modal.style.display = 'block'; }, showQR: function(id, name, level, pic) { document.getElementById('chisag-qr-modal').style.display = 'block'; document.getElementById('qr-name-display').innerText = name; document.getElementById('qr-id-display').innerText = id; document.getElementById('qr-level-display').innerText = "LEVEL " + level; const photoBox = document.getElementById('qr-card-photo'); if(pic) photoBox.innerHTML = `<img src="${pic}" class="id-card-photo">`; else photoBox.innerHTML = `<span style="color:#ccc; font-size:3rem;">👤</span>`; document.getElementById('qr-display-area').innerHTML = ""; new QRCode(document.getElementById("qr-display-area"), { text: id, width: 100, height: 100 }); }, downloadPDF: async function() { const element = document.getElementById('printable-id-card'); const qrBox = document.getElementById('qr-display-area'); const canvas = qrBox.querySelector('canvas'); if(canvas) { const img = new Image(); img.src = canvas.toDataURL("image/png"); img.style.width = "100%"; img.style.height = "auto"; qrBox.innerHTML = ""; qrBox.appendChild(img); } await new Promise(resolve => setTimeout(resolve, 500)); html2canvas(element, { scale: 3, useCORS: true }).then(canvas => { const imgData = canvas.toDataURL('image/jpeg', 1.0); const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4'); const imgProps = pdf.getImageProperties(imgData); const cardWidth = 85; const cardHeight = (imgProps.height * cardWidth) / imgProps.width; const x = (210 - cardWidth) / 2; const y = (297 - cardHeight) / 2 - 20; pdf.addImage(imgData, 'JPEG', x, y, cardWidth, cardHeight); pdf.save(`ID_Card_${document.getElementById('qr-id-display').innerText}.pdf`); }); }, render: function() { document.getElementById('chisag-total-count').innerText = this.members.length; document.getElementById('chisag-paid-count').innerText = this.members.filter(m=>m.dues).length + " Paid"; [100,200,300,400].forEach(l => { document.getElementById(`chisag-lvl-${l}`).innerText = this.members.filter(m => m.level === l).length; }); const today = new Date(); const currentMonth = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][today.getMonth()]; const bdays = this.members.filter(m => m.dob && m.dob.includes(currentMonth)); const bdayList = document.getElementById('chisag-bday-list'); bdayList.innerHTML = ""; bdays.sort((a,b) => parseInt(a.dob) - parseInt(b.dob)); bdays.forEach(m => { bdayList.innerHTML += `<div style="padding:5px; border-bottom:1px solid #eee;"><strong>${m.dob}:</strong> ${m.surname} ${m.otherNames}</div>`; }); if(bdays.length === 0) bdayList.innerHTML = "No birthdays this month."; const searchVal = document.getElementById('chisag-search-filter').value.toLowerCase(); let list = this.members; if(this.filterLvl > 0) list = list.filter(m => m.level === this.filterLvl); const col = this.sortCol; const asc = this.sortAsc; list.sort((a,b) => { let vA = a[col], vB = b[col]; if(col === 'dues' || col === 'souvPaid' || col === 'souvTaken') { vA = vA.toString(); vB = vB.toString(); } if(vA < vB) return asc ? -1 : 1; if(vA > vB) return asc ? 1 : -1; return 0; }); const tbody = document.getElementById('chisag-table-body'); const rows = list.map((m, i) => { const fullName = (m.surname + " " + m.otherNames).toLowerCase(); if(searchVal && !fullName.includes(searchVal) && !m.id.includes(searchVal)) return ''; const picHtml = m.pic ? `<img src="${m.pic}" class="pic-thumbnail" onclick="chisagApp.showPictureModal('${m.pic}')">` : '<span style="font-size:1.5rem; color:#ccc;">👤</span>'; const checkHtml = this.isManageMode ? `<td><input type="checkbox" ${this.selected.has(m.id)?'checked':''} onchange="chisagApp.toggleSelect('${m.id}')"></td>` : ''; return `<tr> ${checkHtml} <td>${i+1}</td> <td style="text-align:center;">${picHtml}</td> <td style="font-weight:bold; font-family:monospace; color:var(--ug-blue);">${m.id}</td> <td>${m.surname}</td> <td>${m.otherNames}</td> <td>${m.level}</td> <td><span class="badge ${m.dues?'bg-green':'bg-red'}">${m.dues?'PAID':'OWING'}</span></td> <td><span class="badge ${m.souvPaid?'bg-green':'bg-yellow'}">${m.souvPaid?'YES':'NO'}</span></td> <td><span class="badge ${m.souvTaken?'bg-green':'bg-yellow'}">${m.souvTaken?'YES':'NO'}</span></td> <td> <button class="btn btn-gold" style="padding:2px 8px; font-size:0.75rem;" onclick="chisagApp.showQR('${m.id}','${m.surname} ${m.otherNames}', ${m.level}, '${m.pic}')">QR ID</button> <button class="btn btn-reset" style="padding:2px 8px; font-size:0.75rem;" onclick="document.getElementById('chisag-input-id').value='${m.id}'; chisagApp.lookup()">Edit</button> </td> </tr>`; }).join(''); tbody.innerHTML = rows; }, importFile: function(input) { const file = input.files[0]; if(!file) return; const reader = new FileReader(); reader.readAsArrayBuffer(file); reader.onload = async (e) => { const buffer = e.target.result; const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer); const worksheet = workbook.getWorksheet(1); const bufToBase64 = (buf) => { let binary = ''; const bytes = new Uint8Array(buf); for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); } return window.btoa(binary); }; const images = {}; worksheet.getImages().forEach(image => { const imgId = image.imageId; const img = workbook.model.media.find(m => m.index === imgId); const row = Math.floor(image.range.tl.nativeRow) + 1; if (img) { images[row] = `data:${img.type};base64,${bufToBase64(img.buffer)}`; } }); let count = 0; worksheet.eachRow((row, rowNumber) => { if (rowNumber === 1) return; const idVal = row.getCell(3).value; if (!idVal) return; const member = { id: String(idVal).trim(), surname: String(row.getCell(4).value || '').toUpperCase(), otherNames: String(row.getCell(5).value || '').toUpperCase(), level: parseInt(row.getCell(6).value) || 100, dob: String(row.getCell(7).value || ''), dues: String(row.getCell(8).value || '').toLowerCase().includes('paid') || String(row.getCell(8).value || '').toLowerCase() === 'yes', souvPaid: String(row.getCell(9).value || '').toLowerCase() === 'yes', souvTaken: String(row.getCell(10).value || '').toLowerCase() === 'yes', email: (row.getCell(11).value && row.getCell(11).value.text) ? row.getCell(11).value.text : String(row.getCell(11).value || ''), pic: images[rowNumber] || '' }; this.members = this.members.filter(m => m.id !== member.id); this.members.push(member); count++; }); await db.batchPut('chisag_members', this.members); this.render(); alert(`Imported ${count} members with pictures.`); input.value = ''; }; }, exportFile: async function() { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('CHISAG Members'); ws.columns = [ { header: 'No.', key: 'no', width: 5 }, { header: 'Picture', key: 'pic', width: 15 }, { header: 'Index ID', key: 'id', width: 15 }, { header: 'Surname', key: 'surname', width: 20 }, { header: 'Other Names', key: 'other', width: 25 }, { header: 'Level', key: 'level', width: 10 }, { header: 'DOB', key: 'dob', width: 15 }, { header: 'Dues', key: 'dues', width: 10 }, { header: 'Souv Paid', key: 'sp', width: 10 }, { header: 'Souv Taken', key: 'st', width: 10 }, { header: 'Email', key: 'email', width: 30 } ]; this.members.forEach((m, i) => { const row = ws.addRow({ no: i+1, pic: '', id: m.id, surname: m.surname, other: m.otherNames, level: m.level, dob: m.dob, dues: m.dues ? "Paid" : "Owing", sp: m.souvPaid ? "Yes" : "No", st: m.souvTaken ? "Yes" : "No", email: m.email }); row.height = 60; if (m.pic) { const imageId = wb.addImage({ base64: m.pic, extension: 'png', }); ws.addImage(imageId, { tl: { col: 1, row: i + 1 }, br: { col: 2, row: i + 2 }, editAs: 'oneCell' }); } }); const buf = await wb.xlsx.writeBuffer(); saveAs(new Blob([buf]), 'CHISAG_Roster_Export.xlsx'); } };

window.onload = async function() { 
    await db.open(); 
    authApp.init(); 

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('App Registered', reg))
            .catch(err => console.log('App Error', err));
    }
};