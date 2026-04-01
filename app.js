// ===== API Key (localStorage only, never in code) =====
function getKey(){ return localStorage.getItem('stock_ai_key')||''; }
function setKey(k){ localStorage.setItem('stock_ai_key',k); }
const $=id=>document.getElementById(id);

const API_URL='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
let lastCall=0;

// ===== Init =====
document.addEventListener('DOMContentLoaded',()=>{
  if(getKey()){ showApp(); } else { $('setupScreen').style.display='flex'; }

  // Setup
  $('setupSaveBtn').addEventListener('click',()=>{
    const k=$('setupKeyInput').value.trim();
    if(!k) return;
    setKey(k);
    $('setupScreen').style.display='none';
    showApp();
  });
  $('setupKeyInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('setupSaveBtn').click();});
});

function showApp(){
  $('app').style.display='block';
  bindEvents();
}

// ===== Events =====
function bindEvents(){
  // Tabs
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    $('tab'+t.dataset.tab.charAt(0).toUpperCase()+t.dataset.tab.slice(1)).classList.add('active');
  }));

  // Search
  $('searchBtn').addEventListener('click',doSearch);
  $('stockInput').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('stockInput').value=c.dataset.q;
    doSearch();
  }));

  // Market
  $('marketBtn').addEventListener('click',doMarket);

  // Theme
  document.querySelectorAll('.theme-card').forEach(c=>c.addEventListener('click',()=>doTheme(c)));

  // Settings
  $('settingsBtn').addEventListener('click',()=>{
    $('apiKeyInput').value=getKey();
    $('settingsModal').style.display='flex';
  });
  $('settingsClose').addEventListener('click',()=>$('settingsModal').style.display='none');
  $('settingsModal').addEventListener('click',e=>{if(e.target===$('settingsModal'))$('settingsModal').style.display='none';});
  $('keyToggle').addEventListener('click',()=>{
    const inp=$('apiKeyInput');
    inp.type=inp.type==='password'?'text':'password';
    $('keyToggle').textContent=inp.type==='password'?'보기':'숨기기';
  });
  $('keySaveBtn').addEventListener('click',()=>{
    setKey($('apiKeyInput').value.trim());
    $('settingsModal').style.display='none';
  });
}

// ===== Gemini API Call =====
async function callGemini(prompt){
  const key=getKey();
  if(!key) throw new Error('API 키가 설정되지 않았습니다.');

  // Rate limit
  const now=Date.now(),wait=5000-(now-lastCall);
  if(wait>0) await new Promise(r=>setTimeout(r,wait));
  lastCall=Date.now();

  const body={
    systemInstruction:{parts:[{text:'You are a Korean stock market analyst. Always respond in Korean only. Use markdown formatting. Be specific with numbers and data. Include source references when available.'}]},
    contents:[{parts:[{text:prompt}]}],
    generationConfig:{maxOutputTokens:2048,temperature:0.7,thinkingConfig:{thinkingBudget:512}},
    tools:[{googleSearch:{}}]
  };

  for(let attempt=0;attempt<3;attempt++){
    const res=await fetch(`${API_URL}?key=${key}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    if(res.status===429){
      if(attempt<2){await new Promise(r=>setTimeout(r,(attempt+1)*10000));continue;}
      throw new Error('요청 한도 초과. 잠시 후 다시 시도해주세요.');
    }
    if(res.status===403) throw new Error('API 키가 유효하지 않습니다. 설정에서 확인해주세요.');
    if(!res.ok) throw new Error(`API 오류: ${res.status}`);
    const data=await res.json();
    // Extract text from candidates (may have multiple parts with grounding)
    const parts=data.candidates?.[0]?.content?.parts||[];
    const text=parts.filter(p=>p.text).map(p=>p.text).join('\n');
    return text||'응답을 받지 못했습니다.';
  }
}

// ===== Search =====
async function doSearch(){
  const q=$('stockInput').value.trim();
  if(!q) return;
  const el=$('searchResult');
  $('searchBtn').disabled=true;
  el.innerHTML=loadingHTML('최신 뉴스를 검색하고 분석 중...');

  try{
    const prompt=`오늘 날짜 기준으로 "${q}" 주식 종목에 대한 최신 뉴스와 시장 분석을 해주세요.

다음 형식으로 작성해주세요:

### 📌 핵심 요약
- 현재 주가 동향과 최근 변동 (가능하면 구체적 수치 포함)
- 최근 3일 이내 주요 뉴스 3~5개 요약

### 📊 투자 포인트
- 호재 요인 (있다면)
- 악재 요인 (있다면)
- 기관/외국인 수급 동향 (확인 가능하다면)

### 🔮 단기 전망
- 향후 1~2주 예상 방향성
- 주요 지지선/저항선 (가능하면)
- 주의해야 할 이벤트

### 💡 시장 심리
전체적인 시장 심리를 한 단어로: [강세/약세/중립/혼조]

구체적인 수치와 날짜를 최대한 포함하고, 최신 뉴스 기사를 참고하여 분석해주세요.`;

    const result=await callGemini(prompt);
    el.innerHTML=renderAnalysis(q+' 분석',result);
  }catch(e){
    el.innerHTML=errorHTML(e.message);
  }
  $('searchBtn').disabled=false;
}

// ===== Market Overview =====
async function doMarket(){
  const el=$('marketResult');
  $('marketBtn').disabled=true;
  el.innerHTML=loadingHTML('오늘의 시장 동향을 분석 중...');

  try{
    const prompt=`오늘 날짜 기준으로 한국 주식시장의 전체적인 동향을 분석해주세요.

다음 형식으로 작성해주세요:

### 📈 오늘의 시장 요약
- 코스피/코스닥 지수 현황 (가능하면 수치)
- 전일 대비 등락
- 거래대금 규모

### 🌍 글로벌 시장
- 미국 증시 (S&P 500, 나스닥) 동향
- 환율 (원/달러) 현황
- 유가, 금 등 원자재 동향

### 🔥 오늘의 핵심 이슈 3가지
각 이슈별로 관련 종목과 영향을 설명

### 📊 업종별 동향
- 상승 업종 TOP 3
- 하락 업종 TOP 3

### 🔮 내일 시장 전망
- 주요 체크포인트
- 관심 종목/업종

### 💡 시장 심리: [강세/약세/중립/혼조]

구체적인 수치를 최대한 포함하고, 오늘의 최신 뉴스를 참고해주세요.`;

    const result=await callGemini(prompt);
    el.innerHTML=renderAnalysis('오늘의 시장 동향',result);
  }catch(e){
    el.innerHTML=errorHTML(e.message);
  }
  $('marketBtn').disabled=false;
}

// ===== Theme Analysis =====
async function doTheme(card){
  const q=card.dataset.q;
  const label=card.querySelector('.theme-label').textContent;
  const el=$('themeResult');
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=true);
  el.innerHTML=loadingHTML(`${label} 테마를 분석 중...`);

  try{
    const prompt=`오늘 날짜 기준으로 한국 주식시장에서 "${q}"을 분석해주세요.

다음 형식으로 작성해주세요:

### 📌 ${label} 테마 핵심 요약
- 최근 테마 동향과 시장 관심도
- 주요 뉴스 3~5개 요약

### 🏢 주요 관련 종목 (5~8개)
각 종목별로:
- 종목명
- 최근 주가 동향 (가능하면 수치)
- 관련 이유

### 📊 테마 투자 포인트
- 단기 호재/악재
- 정책/규제 변화
- 글로벌 트렌드 연관성

### 🔮 향후 전망
- 테마 지속 가능성
- 관련 이벤트/일정
- 추천 관심 종목 2~3개

### 💡 테마 심리: [과열/관심 증가/보합/관심 감소]

구체적인 수치를 최대한 포함하고, 최신 뉴스를 참고해주세요.`;

    const result=await callGemini(prompt);
    el.innerHTML=renderAnalysis(label+' 테마 분석',result);
  }catch(e){
    el.innerHTML=errorHTML(e.message);
  }
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=false);
}

// ===== Rendering =====
function loadingHTML(text){
  return `<div class="loading"><div class="loading-spinner"></div><p class="loading-text">${text}</p></div>`;
}

function errorHTML(msg){
  return `<div class="error-card">${msg}</div>`;
}

function renderAnalysis(title, markdown){
  // Detect sentiment
  let badge='';
  const lower=markdown.toLowerCase();
  if(lower.includes('강세')) badge='<span class="analysis-badge badge-bullish">강세</span>';
  else if(lower.includes('약세')) badge='<span class="analysis-badge badge-bearish">약세</span>';
  else if(lower.includes('혼조')||lower.includes('중립')) badge='<span class="analysis-badge badge-neutral">혼조</span>';
  else if(lower.includes('과열')) badge='<span class="analysis-badge badge-bullish">과열</span>';
  else if(lower.includes('관심 증가')) badge='<span class="analysis-badge badge-bullish">관심↑</span>';

  const now=new Date();
  const time=`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  return `
    <div class="analysis-card">
      <div class="analysis-header">
        <span class="analysis-title">${title}</span>
        ${badge}
      </div>
      <div class="analysis-body">${parseMarkdown(markdown)}</div>
      <div class="analysis-footer">
        <span class="analysis-time">${time} 분석</span>
        <span class="analysis-disclaimer">투자 참고용이며 투자 권유가 아닙니다</span>
      </div>
    </div>
  `;
}

function parseMarkdown(md){
  return md
    .replace(/### (.+)/g,'<h3>$1</h3>')
    .replace(/## (.+)/g,'<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/^\* (.+)/gm,'<li>$1</li>')
    .replace(/^- (.+)/gm,'<li>$1</li>')
    .replace(/^\d+\. (.+)/gm,'<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g,'')
    .replace(/\n\n/g,'</p><p>')
    .replace(/\n/g,'<br>');
}
