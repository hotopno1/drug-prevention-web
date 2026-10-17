const PADLET_URL = 'https://padlet.com/coral015_1/drug-prevention-vaiw44tho95pydet';
const API_URL    = 'https://script.google.com/macros/s/AKfycbyAQps2t3Xqgh6jhJc64t552SgPuPW3XtmygRd0Ghdd1mtFvtlL6NBQ2n0fOFCLvVzO/exec';
let currentCase   = null;
let messages      = [];
let rapportScore  = 0;
let currentStage  = 0;
let foundKeywords = [];
let isWaiting     = false;
let studentId     = '';
const STAGE_TIPS = [
  { title:'🔰 1단계 · 마음 열기', text:'비난하지 말고 <strong>"그랬구나"</strong>, <strong>"많이 힘들었겠다"</strong> 같은 공감 표현을 사용해 보세요. 한두 번만 공감해도 대상자가 마음을 열기 시작해요.' },
  { title:'💬 2단계 · 속마음 나누기', text:'<strong>"판단하려는 게 아니야"</strong>, <strong>"네 편이 되고 싶어"</strong> 같은 신뢰의 말과 함께, <strong>"언제부터 그랬어?"</strong>, <strong>"몸은 괜찮아?"</strong> 같은 구체적인 질문을 해보세요.' },
  { title:'🙏 3단계 · 고백과 도움 요청', text:'핵심 사실을 끌어내고, 도움 기관을 자연스럽게 소개해 보세요. <strong>"같이 해결할 수 있어, 혼자가 아니야"</strong>' }
];
window.addEventListener('DOMContentLoaded', () => {
  const params  = new URLSearchParams(window.location.search);
  const caseNum = parseInt(params.get('case')) || 1;
  currentCase   = CASES[caseNum];
  if (!currentCase) {
    alert('잘못된 사례 번호입니다.');
    location.href = 'index.html';
    return;
  }
  studentId = getStudentId();
  if (!studentId) return;
  const modal = document.getElementById('apiModal');
  if (modal) modal.style.display = 'none';
  applyTheme();
  renderHeader();
  renderKeywords();
  startChat();
});
// 학번 입력 (같은 창에서는 한 번만 물어봄)
function getStudentId() {
  let id = '';
  try { id = sessionStorage.getItem('studentId') || ''; } catch (e) {}
  while (!id) {
    const input = prompt('학번을 입력하세요 (예: 10305)');
    if (input === null) { location.href = 'index.html'; return null; }
    id = input.trim();
  }
  try { sessionStorage.setItem('studentId', id); } catch (e) {}
  return id;
}
function applyTheme() {
  document.documentElement.style.setProperty('--accent-bg',     currentCase.accentBg);
  document.documentElement.style.setProperty('--accent-border', currentCase.accentBorder);
  document.documentElement.style.setProperty('--accent-color',  currentCase.accentColor);
}
function renderHeader() {
  const topAv = document.getElementById('topAvatar');
  const typAv = document.getElementById('typingAvatar');
  if (currentCase.avatarImg) {
    topAv.innerHTML = `<img src="${currentCase.avatarImg}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    typAv.innerHTML = `<img src="${currentCase.avatarImg}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
  } else {
    topAv.textContent = currentCase.avatar;
    typAv.textContent = currentCase.avatar;
  }
  document.getElementById('topName').textContent      = currentCase.name;
  document.getElementById('topSub').textContent       = currentCase.age + ' · ' + currentCase.sub;
  const drugTag = document.getElementById('topDrugTag');
  if (drugTag) {
    drugTag.textContent      = '💊 ' + currentCase.drug;
    drugTag.style.background = currentCase.accentBg;
    drugTag.style.border     = '1px solid ' + currentCase.accentBorder;
    drugTag.style.color      = currentCase.accentColor;
  }
  const kwArea = document.getElementById('topKeywords');
  if (kwArea) {
    kwArea.innerHTML = '';
    kwArea.style.display  = 'flex';
    kwArea.style.flexWrap = 'wrap';
    kwArea.style.gap      = '4px';
    currentCase.keywords.slice(0, 4).forEach(kw => {
      const span       = document.createElement('span');
      span.className   = 'keyword-tag';
      span.textContent = '# ' + kw;
      kwArea.appendChild(span);
    });
  }
}
function renderKeywords() {
  const container = document.getElementById('foundKeywords');
  container.innerHTML = '';
  currentCase.keywords.forEach((kw, i) => {
    const span       = document.createElement('span');
    span.className   = 'found-kw locked';
    span.id          = 'kw_' + i;
    span.textContent = kw;
    container.appendChild(span);
  });
  foundKeywords = new Array(currentCase.keywords.length).fill(false);
}
function startChat() {
  messages = [{ role: 'system', content: currentCase.systemPrompt }];
  addSystemMessage('📋 ' + currentCase.name + ' 면담을 시작합니다. 면담 기록지를 준비하세요.');
  showTyping(true);
  setTimeout(() => {
    showTyping(false);
    const opener = getOpeningMessage();
    addBotMessage(opener);
    messages.push({ role: 'assistant', content: opener });
  }, 1500);
}
function getOpeningMessage() {
  const params  = new URLSearchParams(window.location.search);
  const caseNum = parseInt(params.get('case')) || 1;
  const openers = {
    1: '...네.',
    2: '...안녕하세요.',
    3: '...어, 왔어요.'
  };
  return openers[caseNum] || '...안녕하세요.';
}
async function sendMessage() {
  if (isWaiting) return;
  const input = document.getElementById('userInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value        = '';
  input.style.height = 'auto';
  addUserMessage(text);
  messages.push({ role: 'user', content: text });
  analyzeUserMessage(text);
  isWaiting = true;
  document.getElementById('sendBtn').disabled = true;
  showTyping(true);
  scrollToBottom();
  try {
    const reply = await callServer();
    showTyping(false);
    addBotMessage(reply);
    messages.push({ role: 'assistant', content: reply });
    analyzeAIReply(reply);
  } catch (err) {
    showTyping(false);
    addSystemMessage('⚠ 오류: ' + err.message);
  }
  isWaiting = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
  scrollToBottom();
}
async function callServer() {
  // Apps Script로 요청 (text/plain으로 보내야 브라우저 보안(CORS) 문제가 생기지 않음)
  const res = await fetch(API_URL, {
    method  : 'POST',
    headers : { 'Content-Type': 'text/plain;charset=utf-8' },
    body    : JSON.stringify({
      messages : messages,
      student  : studentId,
      caseNum  : parseInt(new URLSearchParams(window.location.search).get('case')) || 1
    })
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || 'API 호출 실패');
  }
  return data.reply;
}
function analyzeUserMessage(text) {
  const empathy  = ['힘들었겠다','그랬구나','많이 힘들었','이해해','괜찮아','걱정돼','판단 안 해','네 편','혼자 아니','같이','어떤 느낌','어떻게 됐어','많이 무섭','용기','말해줘서 고마','힘내','응원','도와주고 싶'];
  const negative = ['왜 그랬어','멍청','잘못','신고','경찰','처벌','범죄자','문제야','나쁜'];
  let delta = 0;
  empathy.forEach(w  => { if (text.includes(w)) delta += 12; });
  negative.forEach(w => { if (text.includes(w)) delta -= 10; });
  if (delta > 0) updateRapport(delta);
}
function analyzeAIReply(text) {
  const params  = new URLSearchParams(window.location.search);
  const caseNum = parseInt(params.get('case')) || 1;
  const triggerMap = {
    1: {
      0: ['식욕억제제','나비약','다이어트약','처방'],
      1: ['프로아나','커뮤니티','인스타','살 빼','처음'],
      2: ['심장','두근','손 떨','숨이','어지'],
      3: ['잠','못 자','불면','피곤','금단'],
      4: ['명의','엄마 이름','처방전','병원 여러'],
      5: ['병원 쇼핑','여러 병원','돌아다','다른 병원'],
      6: ['부모','엄마','아빠','가족','집'],
      7: ['도와','그만','병원','상담','벗어','살고 싶']
    },
    2: {
      0: ['ADHD','치료제','스마트 알약','약'],
      1: ['SNS','광고','텔레그램','성적','처음'],
      2: ['이가','치아','잇몸','입이 말라','아파'],
      3: ['잠','못 자','수면','피곤','환각'],
      4: ['던지기','알바','심부름','운반','배달'],
      5: ['사기','중고','돈','빚'],
      6: ['부모','엄마','아빠','가족','집'],
      7: ['도와','그만','병원','상담','벗어','살고 싶']
    },
    3: {
      0: ['펜타닐','패치','약'],
      1: ['틱톡','SNS','영상','친구','처음','좀비'],
      2: ['멍','어지','모르겠','기억','말이'],
      3: ['뼈','통증','오한','설사','금단'],
      4: ['훔쳤','가져갔','보건실','절도'],
      5: ['따돌림','친구 없','혼자','무시','괴롭'],
      6: ['부모','엄마','아빠','가족','집'],
      7: ['도와','그만','병원','상담','벗어','살고 싶']
    }
  };
  const triggers = triggerMap[caseNum] || triggerMap[1];
  Object.keys(triggers).forEach(idx => {
    const i = parseInt(idx);
    if (!foundKeywords[i]) {
      const hit = triggers[idx].some(w => text.includes(w));
      if (hit) unlockKeyword(i);
    }
  });
}
function unlockKeyword(idx) {
  if (foundKeywords[idx]) return;
  foundKeywords[idx] = true;
  const el = document.getElementById('kw_' + idx);
  if (el) {
    el.classList.remove('locked');
    el.classList.add('unlocked');
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = 'msgIn 0.4s ease'; });
  }
  updateRapport(8);
}
function updateRapport(delta) {
  rapportScore = Math.min(100, Math.max(0, rapportScore + delta));
  document.getElementById('rapportFill').style.width = rapportScore + '%';
  document.getElementById('rapportPct').textContent  = rapportScore + '%';
  const newStage = rapportScore < 35 ? 0 : rapportScore < 70 ? 1 : 2;
  if (newStage !== currentStage) { currentStage = newStage; updateStage(newStage); }
}
function updateStage(stage) {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('stage' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < stage)   el.classList.add('done');
    if (i === stage) el.classList.add('active');
  }
  document.getElementById('tipTitle').textContent = STAGE_TIPS[stage].title;
  document.getElementById('tipText').innerHTML    = STAGE_TIPS[stage].text;
}
function addBotMessage(text) {
  const isSymptom = /잠깐|잠시|어지|아파|말라|두근|화장실|가렵|욱신|못 잤|멍|손이 떨|머리|뼈가|오한/.test(text);
  const div       = document.createElement('div');
  div.className   = 'msg ' + (isSymptom ? 'symptom' : 'bot');
  const avHtml = currentCase.avatarImg
    ? `<div class="msg-avatar" style="overflow:hidden;padding:0;"><img src="${currentCase.avatarImg}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" /></div>`
    : `<div class="msg-avatar">${currentCase.avatar}</div>`;
  div.innerHTML   = avHtml + `<div class="msg-bubble">${escapeHtml(text)}</div>`;
  document.getElementById('chatMessages').appendChild(div);
  scrollToBottom();
}
function addUserMessage(text) {
  const div     = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `<div class="msg-avatar">🧑‍💼</div><div class="msg-bubble">${escapeHtml(text)}</div>`;
  document.getElementById('chatMessages').appendChild(div);
  scrollToBottom();
}
function addSystemMessage(text) {
  const div         = document.createElement('div');
  div.className     = 'msg';
  div.style.cssText = 'align-self:center;max-width:92%;';
  div.innerHTML     = `<div class="msg-bubble" style="background:rgba(80,100,200,0.06);border:1px solid rgba(80,100,200,0.15);color:rgba(30,30,80,0.45);font-size:12px;border-radius:20px;padding:6px 16px;">${text}</div>`;
  document.getElementById('chatMessages').appendChild(div);
  scrollToBottom();
}
function showTyping(show) {
  const el = document.getElementById('typingIndicator');
  if (!el) return;
  el.classList.toggle('hidden', !show);
  if (show) scrollToBottom();
}
function scrollToBottom() {
  const el = document.getElementById('chatMessages');
  if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function endSession() {
  if (!confirm('면담을 종료하고 결과를 확인하시겠습니까?')) return;
  const total = currentCase.keywords.length;
  const found = foundKeywords.filter(Boolean).length;
  const score = Math.round((found / total) * 100);
  document.getElementById('resultSub').textContent = `${currentCase.name} (${currentCase.age}) 와의 상담 결과입니다.`;
  document.getElementById('resultScoreNum').textContent = score + '점';
  const msgs = [
    '대상자의 마음을 여는 데 실패했습니다. 공감과 경청이 중요해요.',
    '아쉬운 부분이 있네요. 다음엔 더 깊은 대화를 나눠보세요.',
    '좋은 상담이었습니다. 대부분의 정보를 얻으셨네요.',
    '훌륭한 상담가시네요! 거의 모든 정보를 파악했습니다.',
    '완벽합니다! 모든 정보를 파악했어요. 🎉'
  ];
  const msgIdx = score < 20 ? 0 : score < 40 ? 1 : score < 70 ? 2 : score < 100 ? 3 : 4;
  document.getElementById('resultScoreLabel').textContent = msgs[msgIdx];
  const foundEl  = document.getElementById('resultFoundList');
  const missedEl = document.getElementById('resultMissedList');
  foundEl.innerHTML  = '';
  missedEl.innerHTML = '';
  currentCase.keywords.forEach((kw, i) => {
    const el = document.createElement('span');
    el.textContent = kw;
    if (foundKeywords[i]) { el.className = 'result-kw'; foundEl.appendChild(el); }
    else { el.className = 'result-kw missed'; missedEl.appendChild(el); }
  });
  if (!foundEl.children.length)  foundEl.innerHTML  = '<span style="color:rgba(30,30,80,0.3);font-size:13px;">발견한 정보가 없습니다.</span>';
  if (!missedEl.children.length) missedEl.innerHTML = '<span style="color:rgba(0,150,80,0.7);font-size:13px;">놓친 정보 없음! 완벽합니다 🎉</span>';
  document.getElementById('resultOverlay').classList.remove('hidden');
}
function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
async function saveResultImage() {
  const btn = document.getElementById('saveImgBtn');
  const target = document.querySelector('.result-box');
  if (!target || typeof html2canvas === 'undefined') {
    alert('이미지 저장 기능을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
    return;
  }
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 저장 중...';
  // 캡처 시에는 저장/공유 버튼이 이미지에 함께 찍히지 않도록 잠깐 숨김
  const actionRow      = document.querySelector('.result-action-row');
  const backBtn        = document.querySelector('.result-back-btn');
  const transcriptBtn  = document.querySelector('.transcript-btn');
  if (actionRow)     actionRow.style.visibility     = 'hidden';
  if (backBtn)       backBtn.style.visibility       = 'hidden';
  if (transcriptBtn) transcriptBtn.style.visibility = 'hidden';
  // 스크롤된 내부 영역까지 전체가 캡처되도록, 캡처 동안만 스크롤을 풀고 전체 높이를 펼침
  const originalMaxHeight = target.style.maxHeight;
  const originalOverflowY = target.style.overflowY;
  const originalScrollTop = target.scrollTop;
  target.style.maxHeight = 'none';
  target.style.overflowY = 'visible';
  target.scrollTop = 0;
  try {
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      windowHeight: target.scrollHeight,
      height: target.scrollHeight
    });
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const params  = new URLSearchParams(window.location.search);
    const caseNum = parseInt(params.get('case')) || 1;
    // 한글 파일명은 일부 브라우저/환경에서 다운로드 시 깨지는 경우가 있어 영문+숫자로 저장
    link.download = `interview-result-case${caseNum}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('이미지 저장 실패:', err);
    alert('이미지 저장에 실패했습니다: ' + err.message);
  } finally {
    target.style.maxHeight = originalMaxHeight;
    target.style.overflowY = originalOverflowY;
    target.scrollTop = originalScrollTop;
    if (actionRow)     actionRow.style.visibility     = 'visible';
    if (backBtn)       backBtn.style.visibility       = 'visible';
    if (transcriptBtn) transcriptBtn.style.visibility = 'visible';
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}
function openPadlet() {
  window.open(PADLET_URL, '_blank', 'noopener');
}
function showTranscript() {
  const container = document.getElementById('transcriptMessages');
  container.innerHTML = '';
  const convo = messages.filter(m => m.role !== 'system');
  if (!convo.length) {
    container.innerHTML = '<p style="color:rgba(30,30,80,0.4);font-size:13px;text-align:center;">대화 내용이 없습니다.</p>';
  } else {
    convo.forEach(m => {
      const isUser = m.role === 'user';
      const div = document.createElement('div');
      div.className = 'transcript-msg ' + (isUser ? 'user' : 'bot');
      div.innerHTML = `<div class="transcript-bubble">${escapeHtml(m.content)}</div>`;
      container.appendChild(div);
    });
  }
  const sub = document.getElementById('transcriptSub');
  if (sub) {
    sub.textContent = currentCase
      ? `${currentCase.name} (${currentCase.age})와의 대화 · 총 ${convo.length}개 메시지`
      : '';
  }
  document.getElementById('transcriptOverlay').classList.remove('hidden');
}
function closeTranscript() {
  document.getElementById('transcriptOverlay').classList.add('hidden');
}
