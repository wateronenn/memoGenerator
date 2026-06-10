
const DOCX_SERVER = "/generate-docx";
let state = {
  scenario: null, hasTTA: null, needsSetRuang: false,
  currentStep: 1, aiSubject: '', aiContext: '',
};
 
const scenarioNames = {
  new_store: 'New Stores Opening', renovation: 'Stores Renovation',
  listing_fee: 'Listing Fee (NPD)', display_rent: 'Display ค่าเช่าพื้นที่',
  other_support: 'Other Support',
};
 
const scenarioFields = {
  new_store:     ['qty_amt','model_categories','period','amount_branch'],
  renovation:    ['qty_amt','model_categories','period','amount_branch'],
  listing_fee:   ['qty_amt','model_categories','period','amount_branch'],
  display_rent:  ['period','amount_branch'],
  other_support: ['qty_amt','model_categories','period'],
};
 
const fieldDefs = {
  qty_amt:          { label: 'จำนวน / มูลค่า (Qty/Amt)',         placeholder: 'เช่น 100 ชิ้น / 500,000 บาท' },
  model_categories: { label: 'รุ่น / หมวดหมู่ (Model/Categories)', placeholder: 'เช่น iPhone 16 Pro, Accessories' },
  period:           { label: 'ระยะเวลา (Period)',                  placeholder: 'เช่น Q3 2026 / ม.ค. - มิ.ย. 2026' },
  amount_branch:    { label: 'จำนวน / สาขา (Amount/Branch)',       placeholder: 'เช่น 50,000 บาท/สาขา' },
};
 
function goStep(n) {
  if (n === 2 && !state.scenario) return;
  if (n === 3) { generateAI(); }
  if (n === 4) { syncEdited(); updateDlSummary(); }
  state.currentStep = n;
  document.querySelectorAll('.section').forEach((s,i) => s.classList.toggle('active', i === n-1));
  document.querySelectorAll('.step').forEach((s,i) => {
    s.classList.remove('active','done');
    if (i+1 === n) s.classList.add('active');
    else if (i+1 < n) s.classList.add('done');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
 
function resetAll() {
  state = { scenario: null, hasTTA: null, needsSetRuang: false, currentStep: 1, aiSubject: '', aiContext: '' };
  document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('tta_section').style.display = 'none';
  document.getElementById('btn_next1').disabled = true;
  goStep(1);
}
 
function selectScenario(sc) {
  state.scenario = sc; state.hasTTA = null;
  document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('sc_' + sc).classList.add('selected');
  const needsTTA = sc !== 'other_support';
  document.getElementById('tta_section').style.display = needsTTA ? 'block' : 'none';
  document.getElementById('tta_yes').className = 'tta-btn';
  document.getElementById('tta_no').className = 'tta-btn';
  document.getElementById('tta_notice').style.display = 'none';
  if (sc === 'other_support') {
    state.hasTTA = false; state.needsSetRuang = true;
    document.getElementById('btn_next1').disabled = false;
  } else {
    document.getElementById('btn_next1').disabled = true;
  }
  toggleDealNoField();
  renderMemoFields();
}
 
function setTTA(hasTTA) {
  state.hasTTA = hasTTA;
  state.needsSetRuang = !hasTTA || state.scenario === 'other_support';
  document.getElementById('tta_yes').className = 'tta-btn' + (hasTTA ? ' selected-yes' : '');
  document.getElementById('tta_no').className = 'tta-btn' + (!hasTTA ? ' selected-no' : '');
  const notice = document.getElementById('tta_notice');
  notice.style.display = 'block';
  if (hasTTA) {
    notice.className = 'tta-notice ok';
    notice.textContent = '✓ ไม่ต้องตั้งเรื่อง — สามารถดำเนินการได้เลย';
  } else {
    notice.className = 'tta-notice need';
    notice.textContent = '⚠ ต้องตั้งเรื่อง (ตั้งเรื่อง required) ก่อนดำเนินการ';
  }
  document.getElementById('btn_next1').disabled = false;
  toggleDealNoField();
}
 
function toggleDealNoField() {
  const showField = state.hasTTA === false || state.scenario === 'other_support';
  const dealField = document.getElementById('f_deal_no')?.closest('.field');
  if (!dealField) return;
  dealField.style.display = showField ? '' : 'none';
  if (!showField) document.getElementById('f_deal_no').value = '';
}
 
function renderMemoFields() {
  const sc = state.scenario; if (!sc) return;
  const fields = scenarioFields[sc] || [];
  document.getElementById('memo_fields_title').textContent = 'ข้อมูล Memo — ' + scenarioNames[sc];
  let html = '<div class="form-grid">';
  fields.forEach(f => {
    const def = fieldDefs[f];
    html += `<div class="field"><label>${def.label} <span class="required-dot">*</span></label><input type="text" id="mf_${f}" placeholder="${def.placeholder}" /></div>`;
  });
  html += '</div>';
  document.getElementById('memo_fields').innerHTML = html;
}
 
function collectData() {
  const sc = state.scenario;
  const fields = scenarioFields[sc] || [];
  const memo = {};
  fields.forEach(f => { const el = document.getElementById('mf_' + f); memo[f] = el ? el.value.trim() : ''; });
  return {
    scenario: sc, scenarioName: scenarioNames[sc],
    hasTTA: state.hasTTA, needsSetRuang: state.needsSetRuang,
    date: document.getElementById('f_date').value,
    dealNo: document.getElementById('f_deal_no').value.trim(),
    attention: document.getElementById('f_attention').value.trim(),
    cc: document.getElementById('f_cc').value.trim(),
    from: document.getElementById('f_from').value.trim(),
    channel: document.getElementById('f_channel').value.trim(),
    glNo: document.getElementById('f_gl').value.trim(),
    budget: document.getElementById('f_budget').value.trim(),
    memo,
  };
}
 
async function generateAI() {
  const data = collectData();
  const subjectEl = document.getElementById('ai_subject');
  const contextEl = document.getElementById('ai_context');
  subjectEl.className = 'ai-content';
  subjectEl.innerHTML = 'กำลังสร้าง <span class="dot-anim"><span></span><span></span><span></span></span>';
  contextEl.className = 'ai-content';
  contextEl.innerHTML = 'กำลังสร้าง <span class="dot-anim"><span></span><span></span><span></span></span>';

  const memo = data.memo;
  const ttaInfo = data.scenario === 'other_support' ? 'ต้องตั้งเรื่องเสมอ'
    : data.hasTTA ? 'มี TTAs อยู่แล้ว ไม่ต้องตั้งเรื่อง' : 'ไม่มี TTAs ต้องตั้งเรื่อง';
  let memoDetails = '';
  if (memo.qty_amt) memoDetails += `\n- จำนวน/มูลค่า: ${memo.qty_amt}`;
  if (memo.model_categories) memoDetails += `\n- รุ่น/หมวดหมู่: ${memo.model_categories}`;
  if (memo.period) memoDetails += `\n- ระยะเวลา: ${memo.period}`;
  if (memo.amount_branch) memoDetails += `\n- จำนวน/สาขา: ${memo.amount_branch}`;

  const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการเขียนหนังสือ Memorandum อย่างเป็นทางการในภาษาไทย สำหรับบริษัทขายสินค้าเทคโนโลยี

ประเภท Memo: ${data.scenarioName}
สถานะ TTA: ${ttaInfo}
เรียน: ${data.attention}
จาก: ${data.from}
Channel: ${data.channel}
ข้อมูลประกอบ:${memoDetails || '\n(ไม่มีข้อมูลเพิ่มเติม)'}

กรุณาสร้างเนื้อหา Memorandum ที่เป็นทางการ ภาษาไทย สุภาพ กระชับ ครบถ้วน

ตอบกลับเป็น JSON เท่านั้น ห้ามมี markdown backticks หรือข้อความอื่นนอก JSON:
{"subject":"หัวข้อ memo กระชับ 1 บรรทัด","context":"เนื้อหาหลัก 3-5 ประโยค เป็นทางการ ระบุรายละเอียดทั้งหมด ปิดท้ายด้วย จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      })
    });
    const result = await res.json();
    const text = result.content?.map(b => b.text || '').join('') || '';
    let parsed;
    try { parsed = JSON.parse(text.replace(/```json|```/g,'').trim()); }
    catch { parsed = { subject: data.scenarioName + ' — ขออนุมัติงบประมาณ', context: text }; }
    state.aiSubject = parsed.subject || '';
    state.aiContext = parsed.context || '';
  } catch {
    state.aiSubject = `ขออนุมัติงบประมาณ ${data.scenarioName}`;
    state.aiContext = `เรียน ${data.attention}\n\nตามที่ ${data.from} ได้เสนอขออนุมัติงบประมาณสำหรับ ${data.scenarioName}${memo.period ? ' ระยะเวลา ' + memo.period : ''}${memo.amount_branch ? ' จำนวน ' + memo.amount_branch : ''} ผ่านช่องทาง ${data.channel}\n\nจึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ`;
  }

  subjectEl.className = 'ai-content filled';
  subjectEl.textContent = state.aiSubject;
  contextEl.className = 'ai-content filled';
  contextEl.textContent = state.aiContext;
  document.getElementById('edit_subject').value = state.aiSubject;
  document.getElementById('edit_context').value = state.aiContext;
  buildPreview();
}

function syncEdited() {
  const s = document.getElementById('edit_subject').value.trim();
  const c = document.getElementById('edit_context').value.trim();
  if (s) state.aiSubject = s;
  if (c) state.aiContext = c;
}

function buildPreview() {
  const data = collectData();
  const subject = document.getElementById('edit_subject').value || state.aiSubject;
  const context = document.getElementById('edit_context').value || state.aiContext;
  const dateStr = data.date
    ? new Date(data.date + 'T12:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  document.getElementById('preview_box').innerHTML = `
    <div class="preview-title">MEMORANDUM</div>
    <table class="preview-table">
      <tr><td class="lbl">DATE:</td><td>${dateStr}</td><td class="lbl">SALES DEAL NO:</td><td>${data.dealNo||'—'}</td></tr>
      <tr><td class="lbl">ATTENTION:</td><td colspan="3">${data.attention}</td></tr>
      <tr><td class="lbl">CC:</td><td>${data.cc}</td><td class="lbl">GL NO.</td><td>${data.glNo||'#######'}</td></tr>
      <tr><td class="lbl">REQUEST FROM:</td><td>${data.from}</td><td class="lbl">BUDGET:</td><td>${data.budget||'—'}</td></tr>
      <tr><td class="lbl">SUBJECT:</td><td colspan="2">${subject}</td><td>CHANNEL: ${data.channel}</td></tr>
    </table>
    <div class="preview-context">${context}</div>
    <p>☐ เห็นควรอนุมัติ &nbsp;&nbsp; ☐ ไม่เห็นควรอนุมัติ</p>
    <div style="display:flex;gap:40px;flex-wrap:wrap;margin-top:16px;text-align:center;">
      <div>(................................)<br/>คุณ ABCD</div>
      <div>(................................)<br/>คุณ ABC</div>
    </div>
    <div style="margin-top:20px;">รับรองเอกสารโดย
      <div style="display:flex;gap:40px;flex-wrap:wrap;margin-top:10px;text-align:center;">
        <div>(................................)<br/>ผู้จัดการแผนกขาย 2</div>
        <div>(................................)<br/>ตำแหน่ง</div>
      </div>
    </div>
    <p style="margin-top:20px;">ขอแสดงความนับถือ<br/><br/>(................................)<br/>ผู้แทนขาย</p>`;
}

function updateDlSummary() {
  syncEdited();
  const data = collectData();
  document.getElementById('dl_summary').textContent = `${data.scenarioName} — ${state.aiSubject||'Memo'}`;
}

// Live preview sync
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f_date').value = new Date().toISOString().split('T')[0];
  ['edit_subject','edit_context'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      state.aiSubject = document.getElementById('edit_subject').value;
      state.aiContext = document.getElementById('edit_context').value;
      buildPreview();
    });
  });
});

// ── DOCX via Node server ──────────────────────────────
async function downloadDocx() {
  const btn = document.getElementById('btn_docx');
  const errBox = document.getElementById('dl_error');
  syncEdited();
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';
  errBox.style.display = 'none';

  try {
    const data = collectData();
    const res = await fetch(`${DOCX_SERVER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, subject: state.aiSubject, context: state.aiContext }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Memo_${(data.scenarioName||'').replace(/\s+/g,'_')}_${Date.now()}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) {
    errBox.style.display = 'block';
    errBox.textContent = '❌ ไม่สามารถสร้าง DOCX ได้: ' + e.message + `กรุณาตรวจสอบว่า server กำลังทำงานอยู่ที่ ${DOCX_SERVER}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📝 ดาวน์โหลด .docx';
  }
}

// ── PDF via print dialog ──────────────────────────────
function downloadPDF() {
  syncEdited();
  const data = collectData();
  const subject = state.aiSubject;
  const context = state.aiContext;
  const dateStr = data.date
    ? new Date(data.date + 'T12:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><title>Memorandum</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sarabun','TH Sarabun New','TH SarabunPSK',sans-serif;font-size:11pt;line-height:1.8;color:#000;background:#fff;padding:20mm 25mm}
h1{text-align:center;font-size:14pt;font-weight:700;letter-spacing:4px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
td{border:1px solid #aaa;padding:5px 10px;vertical-align:top}
td.lbl{font-weight:700;background:#eef1ff;white-space:nowrap;}
.ctx{font-weight:400;margin-bottom:24px;white-space:pre-wrap;text-align:justify}
.sig-line{display:block;width:180px;margin:0 auto 4px;border-bottom:1px solid #333;}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{margin:0;padding:12mm 18mm;}
}
</style></head><body>
<h1>MEMORANDUM</h1>
<table>
  <tr><td class="lbl">DATE:</td><td>${dateStr}</td><td class="lbl">SALES DEAL NO:</td><td>${data.dealNo||''}</td></tr>
  <tr><td class="lbl">ATTENTION:</td><td colspan="3">${data.attention}</td></tr>
  <tr><td class="lbl">CC:</td><td>${data.cc}</td><td class="lbl">GL NO.</td><td>${data.glNo||'#######'}</td></tr>
  <tr><td class="lbl">REQUEST FROM:</td><td>${data.from}</td><td class="lbl">BUDGET:</td><td>${data.budget||''}</td></tr>
  <tr><td class="lbl">SUBJECT:</td><td colspan="2">${subject}</td><td>CHANNEL: ${data.channel}</td></tr>
</table>
<div class="ctx">${context}</div>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:24px;gap:20px;">

  <!-- LEFT: ขอแสดงความนับถือ + รับรองเอกสารโดย stacked -->
  <div style="display:flex;flex-direction:column;gap:32px;">
    <div>
      <p style="margin-bottom:28px;">ขอแสดงความนับถือ</p>
      <div style="display:flex;gap:60px;">
        <div style="text-align:center;">
          <span class="sig-line"></span>
          <p>ผู้แทนขาย</p>
        </div>
        <div style="text-align:center;">
          <span class="sig-line"></span>
          <p>รับรองเอกสารโดย</p>
          <p style="font-size:12pt;color:#555;">ผู้จัดการแผนกขาย 2</p>
        </div>
      </div>
    </div>
    <div>
      <p style="margin-bottom:28px;">รับรองเอกสารโดย</p>
      <div style="display:flex;gap:60px;">
        <div style="text-align:center;">
          <span class="sig-line"></span>
          <p>ตำแหน่ง</p>
        </div>
      </div>
    </div>
  </div>

  <!-- RIGHT: two approval boxes stacked -->
  <div style="display:flex;flex-direction:column;gap:16px;flex-shrink:0;">
    <div style="border:1px solid #333;padding:16px 20px;min-width:220px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="display:inline-block;width:28px;height:28px;border:1.5px solid #333;flex-shrink:0;"></span>
        <span>เห็นควรอนุมัติ</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <span style="display:inline-block;width:28px;height:28px;border:1.5px solid #333;flex-shrink:0;"></span>
        <span>ไม่เห็นควรอนุมัติ</span>
      </div>
      <p style="text-align:center;margin-bottom:4px;">(................................)</p>
      <p style="text-align:center;">คุณ ABC</p>
    </div>
    <div style="border:1px solid #333;padding:16px 20px;min-width:220px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="display:inline-block;width:28px;height:28px;border:1.5px solid #333;flex-shrink:0;"></span>
        <span>เห็นควรอนุมัติ</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <span style="display:inline-block;width:28px;height:28px;border:1.5px solid #333;flex-shrink:0;"></span>
        <span>ไม่เห็นควรอนุมัติ</span>
      </div>
      <p style="text-align:center;margin-bottom:4px;">(................................)</p>
      <p style="text-align:center;">คุณ ABCD</p>
    </div>
  </div>

</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`);
  win.document.close();
}
