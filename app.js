// ===== Config (localStorage only) =====
function getKey(){ return localStorage.getItem('stock_ai_key')||''; }
function setKey(k){ localStorage.setItem('stock_ai_key',k); }
const $=id=>document.getElementById(id);

const GEMINI_URL='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ===== Themes =====
const THEMES=[
  {icon:'🤖',label:'AI/반도체',q:'AI 반도체 HBM'},
  {icon:'🔋',label:'2차전지',q:'2차전지 배터리 리튬'},
  {icon:'💊',label:'바이오',q:'바이오 제약 신약'},
  {icon:'🚗',label:'자동차/EV',q:'전기차 자율주행'},
  {icon:'🎮',label:'엔터/게임',q:'엔터테인먼트 게임 K-POP'},
  {icon:'🛡️',label:'방산',q:'방산 방위산업'},
  {icon:'🦾',label:'로봇',q:'로봇 자동화'},
  {icon:'⚡',label:'원자력',q:'원자력 SMR'},
  {icon:'🏗️',label:'건설',q:'건설 부동산 인프라'},
  {icon:'🚢',label:'조선',q:'조선 해운 LNG'},
  {icon:'💸',label:'금융',q:'은행 금융 증권'},
  {icon:'📡',label:'통신/5G',q:'통신 5G 6G'},
  {icon:'🌾',label:'농업/식품',q:'농업 식품'},
  {icon:'☁️',label:'클라우드',q:'클라우드 SaaS'},
  {icon:'🏥',label:'헬스케어',q:'디지털헬스케어 원격의료'},
  {icon:'♻️',label:'친환경',q:'친환경 탄소중립 ESG'},
];

// ===== Helpers =====
function nowKST(){
  const d=new Date(Date.now()+9*60*60*1000-(new Date().getTimezoneOffset()*60*1000));
  return {
    full: `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${d.getHours()}시 ${d.getMinutes()}분 (한국시간)`,
    short: `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
    date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  };
}

// ===== Init =====
document.addEventListener('DOMContentLoaded',()=>{
  if(getKey()) showApp();
  else $('setupScreen').style.display='flex';
  $('setupSaveBtn').addEventListener('click',()=>{
    const k=$('setupKeyInput').value.trim();
    if(!k) return;
    setKey(k);$('setupScreen').style.display='none';showApp();
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
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    $('tab'+t.dataset.tab.charAt(0).toUpperCase()+t.dataset.tab.slice(1)).classList.add('active');
  }));
  $('searchBtn').addEventListener('click',doSearch);
  $('stockInput').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{$('stockInput').value=c.dataset.q;doSearch();}));
  $('marketBtn').addEventListener('click',doMarket);
  $('themeGrid').addEventListener('click',e=>{const c=e.target.closest('.theme-card');if(c)doTheme(c);});
  $('settingsBtn').addEventListener('click',()=>{$('apiKeyInput').value=getKey();$('settingsModal').style.display='flex';});
  $('settingsClose').addEventListener('click',()=>$('settingsModal').style.display='none');
  $('settingsModal').addEventListener('click',e=>{if(e.target===$('settingsModal'))$('settingsModal').style.display='none';});
  $('keyToggle').addEventListener('click',()=>{const i=$('apiKeyInput');i.type=i.type==='password'?'text':'password';$('keyToggle').textContent=i.type==='password'?'보기':'숨기기';});
  $('keySaveBtn').addEventListener('click',()=>{setKey($('apiKeyInput').value.trim());$('settingsModal').style.display='none';});
}

// ===== Gemini API (with Google Search grounding) =====
async function callGemini(prompt){
  const key=getKey();
  if(!key) throw new Error('API 키가 설정되지 않았습니다.');

  const body={
    systemInstruction:{parts:[{text:`You are a top Korean stock market analyst providing REAL-TIME analysis.
CRITICAL RULES:
- ALWAYS respond in Korean only
- You MUST use Google Search to find TODAY's actual data. Do NOT use training data.
- Today is ${nowKST().date}. ONLY cite data from today or yesterday.
- Include SPECIFIC numbers: exact stock prices, index levels, percentage changes
- If you cannot find today's data, explicitly say "오늘 데이터 확인 불가"
- Use ### markdown headers for sections
- Be concise but data-rich`}]},
    contents:[{parts:[{text:prompt}]}],
    generationConfig:{maxOutputTokens:8192,temperature:0.5,thinkingConfig:{thinkingBudget:512}},
    tools:[{googleSearch:{}}]
  };

  for(let attempt=0;attempt<3;attempt++){
    const res=await fetch(`${GEMINI_URL}?key=${key}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    if(res.status===429){
      if(attempt<2){await new Promise(r=>setTimeout(r,(attempt+1)*8000));continue;}
      throw new Error('요청 한도 초과. 30초 후 다시 시도해주세요.');
    }
    if(res.status===403) throw new Error('API 키가 유효하지 않습니다. 설정(⚙)에서 확인해주세요.');
    if(!res.ok) throw new Error(`API 오류: ${res.status}`);
    const data=await res.json();

    // Extract text
    const parts=data.candidates?.[0]?.content?.parts||[];
    const text=parts.filter(p=>p.text).map(p=>p.text).join('\n');

    // Extract grounding sources
    let sources=[];
    const meta=data.candidates?.[0]?.groundingMetadata;
    if(meta?.groundingChunks){
      const seen=new Set();
      meta.groundingChunks.forEach(c=>{
        if(c.web && c.web.uri && !seen.has(c.web.uri)){
          seen.add(c.web.uri);
          sources.push({title:c.web.title||'기사 링크',url:c.web.uri});
        }
      });
    }
    // Fallback: supportSearchResults
    if(!sources.length && meta?.groundingSupports){
      meta.groundingSupports.forEach(s=>{
        if(s.groundingChunkIndices){
          s.groundingChunkIndices.forEach(idx=>{
            if(meta.groundingChunks?.[idx]?.web){
              const w=meta.groundingChunks[idx].web;
              if(w.uri && !sources.find(x=>x.url===w.uri)){
                sources.push({title:w.title||'기사 링크',url:w.uri});
              }
            }
          });
        }
      });
    }

    return {text: text||'응답을 받지 못했습니다.', sources: sources.slice(0,5)};
  }
}

// ===== Stock Search =====
async function doSearch(){
  const q=$('stockInput').value.trim();
  if(!q) return;
  const el=$('searchResult');
  $('searchBtn').disabled=true;
  el.innerHTML=loadingHTML(`"${q}" 실시간 뉴스 분석 중...`);

  try{
    const t=nowKST();
    const prompt=`현재 한국시간: ${t.full}

"${q}" 주식 종목에 대해 구글 검색으로 지금 이 시점의 최신 뉴스와 데이터를 찾아서 분석해주세요.

반드시 오늘(${t.date}) 기준 실시간 데이터를 검색해서 사용하세요.

### 📌 핵심 요약
- 현재 주가 (정확한 수치, 전일대비 등락률 %)
- 오늘 주요 뉴스 3~5개 핵심 요약

### 📊 투자 포인트
- 호재 요인 (구체적으로)
- 악재 요인 (구체적으로)
- 기관/외국인 수급 동향

### 🔮 단기 전망
- 향후 1~2주 예상 방향
- 주의 이벤트/일정

### 💡 시장 심리: [강세/약세/중립/혼조]`;

    const {text,sources}=await callGemini(prompt);
    el.innerHTML=renderAnalysis(q+' 분석',text,sources,t.short);
  }catch(e){ el.innerHTML=errorHTML(e.message); }
  $('searchBtn').disabled=false;
}

// ===== Market =====
async function doMarket(){
  const el=$('marketResult');
  $('marketBtn').disabled=true;
  el.innerHTML=loadingHTML('실시간 시장 데이터 수집 중...');

  try{
    const t=nowKST();
    const prompt=`현재 한국시간: ${t.full}

구글 검색으로 오늘(${t.date}) 한국 주식시장의 실시간 데이터를 찾아서 분석해주세요.

"코스피 지수 오늘", "코스닥 지수 오늘", "원달러 환율 오늘", "나스닥 지수" 등을 검색하여 정확한 최신 수치를 사용하세요.

### 📈 시장 요약
- 코스피 지수 (정확한 수치, 등락 포인트, 등락률 %)
- 코스닥 지수 (정확한 수치, 등락 포인트, 등락률 %)

### 🌍 글로벌 시장
- 미국 증시: S&P500, 나스닥, 다우 (각각 수치와 등락률)
- 원/달러 환율 (정확한 수치)
- 유가, 금 가격

### 🔥 핵심 이슈 3가지
각 이슈별 배경, 관련 종목, 시장 영향

### 📊 업종별 동향
- 상승 업종 TOP 3 (구체적 종목 포함)
- 하락 업종 TOP 3 (구체적 종목 포함)

### 🔮 내일 전망
- 체크포인트
- 관심 종목/업종

### 💡 시장 심리: [강세/약세/중립/혼조]`;

    const {text,sources}=await callGemini(prompt);
    el.innerHTML=renderAnalysis('오늘의 시장 동향',text,sources,t.short);
  }catch(e){ el.innerHTML=errorHTML(e.message); }
  $('marketBtn').disabled=false;
}

// ===== Theme =====
async function doTheme(card){
  const q=card.dataset.q, label=card.dataset.label;
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=true);
  const el=$('themeResult');
  el.innerHTML=loadingHTML(`${label} 테마 실시간 분석 중...`);

  try{
    const t=nowKST();
    const prompt=`현재 한국시간: ${t.full}

구글 검색으로 오늘(${t.date}) 기준 한국 주식시장 "${q}" 테마 관련 최신 뉴스와 데이터를 찾아서 분석해주세요.

### 📌 ${label} 핵심 요약
- 오늘 테마 동향과 시장 관심도
- 주요 뉴스 3~5개 핵심 요약

### 🏢 주요 관련 종목 (5~8개)
각 종목: 이름, 현재가/등락률(정확한 수치), 관련 이유

### 📊 투자 포인트
- 호재/악재
- 정책/규제 변화
- 글로벌 트렌드 연관성

### 🔮 전망
- 테마 지속 가능성
- 주요 이벤트/일정
- 관심 종목 3개

### 💡 테마 심리: [과열/관심 증가/보합/관심 감소]`;

    const {text,sources}=await callGemini(prompt);
    el.innerHTML=renderAnalysis(label+' 테마 분석',text,sources,t.short);
  }catch(e){ el.innerHTML=errorHTML(e.message); }
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=false);
}

// ===== Rendering =====
function loadingHTML(t){
  return `<div class="loading"><div class="loading-spinner"></div><p class="loading-text">${t}</p></div>`;
}
function errorHTML(m){ return `<div class="error-card">${m}</div>`; }

function renderAnalysis(title, markdown, sources, timeStr){
  let badge='';
  if(markdown.includes('강세'))badge='<span class="badge bull">강세</span>';
  else if(markdown.includes('약세'))badge='<span class="badge bear">약세</span>';
  else if(markdown.includes('혼조')||markdown.includes('중립'))badge='<span class="badge neutral">혼조</span>';
  else if(markdown.includes('과열'))badge='<span class="badge bull">과열</span>';
  else if(markdown.includes('관심 증가'))badge='<span class="badge bull">관심↑</span>';
  else if(markdown.includes('관심 감소'))badge='<span class="badge bear">관심↓</span>';

  let srcHTML='';
  if(sources && sources.length>0){
    srcHTML=`<div class="sources-section">
      <h4 class="sources-title">📰 참고 기사</h4>
      ${sources.map((s,i)=>`<a href="${s.url}" target="_blank" rel="noopener" class="source-link">
        <span class="source-num">${i+1}</span>
        <div class="source-info">
          <span class="source-text">${s.title}</span>
        </div>
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
        <span class="analysis-time">${timeStr} 기준</span>
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
