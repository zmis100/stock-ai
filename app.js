// ===== API Key (localStorage only) =====
function getKey(){ return localStorage.getItem('stock_ai_key')||''; }
function setKey(k){ localStorage.setItem('stock_ai_key',k); }
const $=id=>document.getElementById(id);

const API_URL='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ===== Themes (expanded) =====
const THEMES=[
  {icon:'🤖',label:'AI/반도체',q:'AI 반도체 HBM 관련주'},
  {icon:'🔋',label:'2차전지',q:'2차전지 배터리 리튬 관련주'},
  {icon:'💊',label:'바이오',q:'바이오 제약 신약 관련주'},
  {icon:'🚗',label:'자동차/EV',q:'자동차 전기차 자율주행 관련주'},
  {icon:'🎮',label:'엔터/게임',q:'엔터테인먼트 게임 K-POP 관련주'},
  {icon:'🛡️',label:'방산',q:'방산 방위산업 관련주'},
  {icon:'🦾',label:'로봇',q:'로봇 자동화 스마트팩토리 관련주'},
  {icon:'⚡',label:'원자력',q:'원자력 SMR 에너지 관련주'},
  {icon:'🏗️',label:'건설/부동산',q:'건설 부동산 인프라 관련주'},
  {icon:'🚢',label:'조선/해운',q:'조선 해운 LNG 관련주'},
  {icon:'💸',label:'금융/은행',q:'은행 금융 보험 증권 관련주'},
  {icon:'📡',label:'통신/5G',q:'통신 5G 6G 관련주'},
  {icon:'🌾',label:'농업/식품',q:'농업 식품 음료 관련주'},
  {icon:'☁️',label:'클라우드/SaaS',q:'클라우드 SaaS 소프트웨어 관련주'},
  {icon:'🏥',label:'헬스케어',q:'디지털헬스케어 원격의료 관련주'},
  {icon:'♻️',label:'친환경/ESG',q:'친환경 탄소중립 ESG 관련주'},
];

// ===== Time helpers =====
function nowStr(){
  const d=new Date();
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${d.getHours()}시 ${d.getMinutes()}분`;
}
function nowShort(){
  const d=new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ===== Init =====
document.addEventListener('DOMContentLoaded',()=>{
  if(getKey()) showApp();
  else $('setupScreen').style.display='flex';

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
  renderThemeGrid();
  bindEvents();
}

function renderThemeGrid(){
  $('themeGrid').innerHTML=THEMES.map(t=>
    `<button class="theme-card" data-q="${t.q}" data-label="${t.label}">
      <span class="theme-icon">${t.icon}</span><span class="theme-label">${t.label}</span>
    </button>`
  ).join('');
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

  $('searchBtn').addEventListener('click',doSearch);
  $('stockInput').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('stockInput').value=c.dataset.q; doSearch();
  }));

  $('marketBtn').addEventListener('click',doMarket);

  $('themeGrid').addEventListener('click',e=>{
    const card=e.target.closest('.theme-card');
    if(card) doTheme(card);
  });

  // Settings
  $('settingsBtn').addEventListener('click',()=>{$('apiKeyInput').value=getKey();$('settingsModal').style.display='flex';});
  $('settingsClose').addEventListener('click',()=>$('settingsModal').style.display='none');
  $('settingsModal').addEventListener('click',e=>{if(e.target===$('settingsModal'))$('settingsModal').style.display='none';});
  $('keyToggle').addEventListener('click',()=>{
    const i=$('apiKeyInput');i.type=i.type==='password'?'text':'password';
    $('keyToggle').textContent=i.type==='password'?'보기':'숨기기';
  });
  $('keySaveBtn').addEventListener('click',()=>{setKey($('apiKeyInput').value.trim());$('settingsModal').style.display='none';});
}

// ===== Gemini API =====
async function callGemini(prompt){
  const key=getKey();
  if(!key) throw new Error('API 키가 설정되지 않았습니다.');

  const body={
    systemInstruction:{parts:[{text:'You are a Korean stock market analyst. Always respond in Korean only. Use markdown formatting with ### headers. Be specific with numbers, dates, and data. When referencing news, include the article title and source name.'}]},
    contents:[{parts:[{text:prompt}]}],
    generationConfig:{maxOutputTokens:4096,temperature:0.7,thinkingConfig:{thinkingBudget:0}},
    tools:[{googleSearch:{}}]
  };

  for(let attempt=0;attempt<3;attempt++){
    const res=await fetch(`${API_URL}?key=${key}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    if(res.status===429){
      if(attempt<2){await new Promise(r=>setTimeout(r,(attempt+1)*8000));continue;}
      throw new Error('요청 한도 초과. 잠시 후 다시 시도해주세요.');
    }
    if(res.status===403) throw new Error('API 키가 유효하지 않습니다. 설정(⚙)에서 확인해주세요.');
    if(!res.ok) throw new Error(`API 오류: ${res.status}`);
    const data=await res.json();

    // Extract text
    const parts=data.candidates?.[0]?.content?.parts||[];
    const text=parts.filter(p=>p.text).map(p=>p.text).join('\n');

    // Extract grounding sources (news article links)
    let sources=[];
    const meta=data.candidates?.[0]?.groundingMetadata;
    if(meta?.groundingChunks){
      sources=meta.groundingChunks
        .filter(c=>c.web)
        .map(c=>({title:c.web.title||'',url:c.web.uri||''}))
        .filter(s=>s.url)
        .slice(0,5);
    }
    // Fallback: search entry point
    if(!sources.length && meta?.searchEntryPoint?.renderedContent){
      // no individual sources available
    }

    return {text: text||'응답을 받지 못했습니다.', sources};
  }
}

// ===== Stock Search =====
async function doSearch(){
  const q=$('stockInput').value.trim();
  if(!q) return;
  const el=$('searchResult');
  const time=nowStr();
  $('searchBtn').disabled=true;
  el.innerHTML=loadingHTML(`"${q}" 최신 뉴스 분석 중...`);

  try{
    const prompt=`현재 시각은 ${time}입니다. "${q}" 주식 종목에 대해 지금 이 시점 기준으로 최신 뉴스와 시장 분석을 해주세요.

반드시 다음 형식으로 작성:

### 📌 핵심 요약
- 현재 주가와 등락률 (구체적 수치)
- 오늘/최근 주요 뉴스 3~5개 (기사 제목과 출처 포함)

### 📊 투자 포인트
- 호재 요인
- 악재 요인
- 기관/외국인 수급 동향

### 🔮 단기 전망
- 1~2주 예상 방향
- 지지선/저항선
- 주의 이벤트

### 📰 관련 뉴스 기사
최근 주요 기사 5개를 다음 형식으로 나열:
1. **기사 제목** — 출처명
2. **기사 제목** — 출처명
(이하 동일)

### 💡 시장 심리: [강세/약세/중립/혼조]

반드시 오늘 날짜 기준 최신 정보를 사용하세요.`;

    const {text,sources}=await callGemini(prompt);
    el.innerHTML=renderAnalysis(q+' 분석',text,sources);
  }catch(e){ el.innerHTML=errorHTML(e.message); }
  $('searchBtn').disabled=false;
}

// ===== Market =====
async function doMarket(){
  const el=$('marketResult');
  const time=nowStr();
  $('marketBtn').disabled=true;
  el.innerHTML=loadingHTML('시장 동향 분석 중...');

  try{
    const prompt=`현재 시각은 ${time}입니다. 지금 이 시점 기준으로 한국 주식시장 전체 동향을 분석해주세요.

반드시 다음 형식으로 작성:

### 📈 시장 요약
- 코스피/코스닥 지수 (수치, 등락률)
- 거래대금

### 🌍 글로벌 시장
- 미국 증시 (S&P500, 나스닥, 다우)
- 환율 (원/달러)
- 유가, 금 가격

### 🔥 핵심 이슈 3가지
각 이슈별 관련 종목과 영향

### 📊 업종별 동향
- 상승 TOP 3
- 하락 TOP 3

### 🔮 전망
- 체크포인트
- 관심 종목

### 📰 주요 뉴스
오늘 주요 시장 뉴스 5개:
1. **기사 제목** — 출처명
(이하 동일)

### 💡 시장 심리: [강세/약세/중립/혼조]

반드시 오늘 시점 최신 데이터를 사용하세요.`;

    const {text,sources}=await callGemini(prompt);
    el.innerHTML=renderAnalysis('시장 동향',text,sources);
  }catch(e){ el.innerHTML=errorHTML(e.message); }
  $('marketBtn').disabled=false;
}

// ===== Theme =====
async function doTheme(card){
  const q=card.dataset.q, label=card.dataset.label;
  const el=$('themeResult');
  const time=nowStr();
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=true);
  el.innerHTML=loadingHTML(`${label} 테마 분석 중...`);

  try{
    const prompt=`현재 시각은 ${time}입니다. 한국 주식시장에서 "${q}" 테마를 지금 시점 기준으로 분석해주세요.

반드시 다음 형식으로 작성:

### 📌 ${label} 핵심 요약
- 최근 테마 동향
- 주요 뉴스 3~5개 (기사 제목과 출처)

### 🏢 주요 관련 종목 (5~8개)
종목명, 주가 동향(수치), 관련 이유

### 📊 투자 포인트
- 호재/악재
- 정책/규제 변화
- 글로벌 연관성

### 🔮 전망
- 지속 가능성
- 주요 이벤트
- 관심 종목 3개

### 📰 관련 뉴스
최근 기사 5개:
1. **기사 제목** — 출처명
(이하 동일)

### 💡 테마 심리: [과열/관심 증가/보합/관심 감소]

반드시 오늘 시점 최신 정보를 사용하세요.`;

    const {text,sources}=await callGemini(prompt);
    el.innerHTML=renderAnalysis(label+' 테마 분석',text,sources);
  }catch(e){ el.innerHTML=errorHTML(e.message); }
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=false);
}

// ===== Rendering =====
function loadingHTML(t){
  return `<div class="loading"><div class="loading-spinner"></div><p class="loading-text">${t}</p></div>`;
}
function errorHTML(m){
  return `<div class="error-card">${m}</div>`;
}

function renderAnalysis(title, markdown, sources){
  // Sentiment badge
  let badge='';
  const l=markdown;
  if(l.includes('강세'))badge='<span class="badge bull">강세</span>';
  else if(l.includes('약세'))badge='<span class="badge bear">약세</span>';
  else if(l.includes('혼조')||l.includes('중립'))badge='<span class="badge neutral">혼조</span>';
  else if(l.includes('과열'))badge='<span class="badge bull">과열</span>';
  else if(l.includes('관심 증가'))badge='<span class="badge bull">관심↑</span>';
  else if(l.includes('관심 감소'))badge='<span class="badge bear">관심↓</span>';

  // Sources HTML
  let srcHTML='';
  if(sources && sources.length>0){
    srcHTML=`<div class="sources-section">
      <h4 class="sources-title">📎 원문 기사</h4>
      ${sources.map((s,i)=>`<a href="${s.url}" target="_blank" rel="noopener" class="source-link">
        <span class="source-num">${i+1}</span>
        <span class="source-text">${s.title||s.url}</span>
        <span class="source-arrow">↗</span>
      </a>`).join('')}
    </div>`;
  }

  return `
    <div class="analysis-card">
      <div class="analysis-header">
        <span class="analysis-title">${title}</span>
        ${badge}
      </div>
      <div class="analysis-body">${parseMD(markdown)}</div>
      ${srcHTML}
      <div class="analysis-footer">
        <span class="analysis-time">${nowShort()} 기준 분석</span>
        <span class="analysis-disc">투자 참고용 · 투자 권유 아님</span>
      </div>
    </div>`;
}

function parseMD(md){
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
