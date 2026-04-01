// ===== Config (localStorage only) =====
function getKey(){ return localStorage.getItem('stock_ai_key')||''; }
function setKey(k){ localStorage.setItem('stock_ai_key',k); }
function getNaverId(){ return localStorage.getItem('stock_naver_id')||''; }
function setNaverId(v){ localStorage.setItem('stock_naver_id',v); }
function getNaverSecret(){ return localStorage.getItem('stock_naver_secret')||''; }
function setNaverSecret(v){ localStorage.setItem('stock_naver_secret',v); }
const $=id=>document.getElementById(id);

const GEMINI_URL='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const NAVER_NEWS_URL='https://openapi.naver.com/v1/search/news.json';
const CORS_PROXY='https://api.allorigins.win/raw?url=';

// ===== Themes =====
const THEMES=[
  {icon:'🤖',label:'AI/반도체',q:'AI 반도체 HBM 관련주'},
  {icon:'🔋',label:'2차전지',q:'2차전지 배터리 관련주'},
  {icon:'💊',label:'바이오',q:'바이오 제약 신약 관련주'},
  {icon:'🚗',label:'자동차/EV',q:'전기차 자율주행 관련주'},
  {icon:'🎮',label:'엔터/게임',q:'엔터테인먼트 게임 관련주'},
  {icon:'🛡️',label:'방산',q:'방산 방위산업 관련주'},
  {icon:'🦾',label:'로봇',q:'로봇 자동화 관련주'},
  {icon:'⚡',label:'원자력',q:'원자력 SMR 에너지 관련주'},
  {icon:'🏗️',label:'건설',q:'건설 부동산 관련주'},
  {icon:'🚢',label:'조선',q:'조선 해운 LNG 관련주'},
  {icon:'💸',label:'금융',q:'은행 금융 증권 관련주'},
  {icon:'📡',label:'통신/5G',q:'통신 5G 6G 관련주'},
  {icon:'🌾',label:'농업/식품',q:'농업 식품 관련주'},
  {icon:'☁️',label:'클라우드',q:'클라우드 SaaS 관련주'},
  {icon:'🏥',label:'헬스케어',q:'디지털헬스케어 관련주'},
  {icon:'♻️',label:'친환경',q:'친환경 탄소중립 ESG 관련주'},
];

// ===== Helpers =====
function nowStr(){
  const d=new Date();
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${d.getHours()}시 ${d.getMinutes()}분`;
}
function nowShort(){
  const d=new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function cleanHTML(t){ return t.replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

// ===== Init =====
document.addEventListener('DOMContentLoaded',()=>{
  if(getKey() && getNaverId()) showApp();
  else $('setupScreen').style.display='flex';

  $('setupSaveBtn').addEventListener('click',saveSetup);
  $('setupGeminiKey').addEventListener('keydown',e=>{if(e.key==='Enter')$('setupNaverId').focus();});
  $('setupNaverSecret').addEventListener('keydown',e=>{if(e.key==='Enter')saveSetup();});
});

function saveSetup(){
  const gk=$('setupGeminiKey').value.trim();
  const ni=$('setupNaverId').value.trim();
  const ns=$('setupNaverSecret').value.trim();
  if(!gk||!ni||!ns){return;}
  setKey(gk); setNaverId(ni); setNaverSecret(ns);
  $('setupScreen').style.display='none';
  showApp();
}

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
  document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('stockInput').value=c.dataset.q; doSearch();
  }));
  $('marketBtn').addEventListener('click',doMarket);
  $('themeGrid').addEventListener('click',e=>{
    const card=e.target.closest('.theme-card');
    if(card) doTheme(card);
  });

  // Settings
  $('settingsBtn').addEventListener('click',()=>{
    $('sGeminiKey').value=getKey();
    $('sNaverId').value=getNaverId();
    $('sNaverSecret').value=getNaverSecret();
    $('settingsModal').style.display='flex';
  });
  $('settingsClose').addEventListener('click',()=>$('settingsModal').style.display='none');
  $('settingsModal').addEventListener('click',e=>{if(e.target===$('settingsModal'))$('settingsModal').style.display='none';});
  $('sSaveBtn').addEventListener('click',()=>{
    setKey($('sGeminiKey').value.trim());
    setNaverId($('sNaverId').value.trim());
    setNaverSecret($('sNaverSecret').value.trim());
    $('settingsModal').style.display='none';
  });
}

// ===== Naver News API =====
async function fetchNaverNews(query, count=10){
  const nid=getNaverId(), ns=getNaverSecret();
  if(!nid||!ns) throw new Error('네이버 API 키가 설정되지 않았습니다.');

  const params=new URLSearchParams({query, display:count, sort:'date'});
  const targetUrl=`${NAVER_NEWS_URL}?${params}`;

  // CORS 프록시 경유
  const res=await fetch(CORS_PROXY+encodeURIComponent(targetUrl),{
    headers:{'X-Naver-Client-Id':nid,'X-Naver-Client-Secret':ns}
  });

  if(!res.ok){
    // 프록시가 헤더를 전달 못할 수 있음 → 직접 호출 시도
    const res2=await fetch(targetUrl,{
      headers:{'X-Naver-Client-Id':nid,'X-Naver-Client-Secret':ns}
    });
    if(!res2.ok) throw new Error(`뉴스 검색 실패: ${res2.status}`);
    const data=await res2.json();
    return parseNaverNews(data);
  }

  const data=await res.json();
  return parseNaverNews(data);
}

function parseNaverNews(data){
  if(!data.items) return [];
  return data.items.map(item=>({
    title: cleanHTML(item.title),
    link: item.originallink || item.link,
    description: cleanHTML(item.description),
    pubDate: formatPubDate(item.pubDate),
  }));
}

function formatPubDate(dateStr){
  try{
    const d=new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }catch{return dateStr;}
}

// ===== Gemini API =====
async function callGemini(prompt){
  const key=getKey();
  if(!key) throw new Error('Gemini API 키가 설정되지 않았습니다.');

  const body={
    systemInstruction:{parts:[{text:'You are a top Korean stock market analyst. Always respond in Korean only. Use markdown with ### headers. Be very specific with numbers, percentages, dates. Structure your analysis clearly.'}]},
    contents:[{parts:[{text:prompt}]}],
    generationConfig:{maxOutputTokens:8192,temperature:0.7,thinkingConfig:{thinkingBudget:256}}
  };

  for(let attempt=0;attempt<3;attempt++){
    const res=await fetch(`${GEMINI_URL}?key=${key}`,{
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
    const parts=data.candidates?.[0]?.content?.parts||[];
    return parts.filter(p=>p.text).map(p=>p.text).join('\n')||'응답을 받지 못했습니다.';
  }
}

// ===== Core: Fetch News + AI Analysis =====
async function analyzeWithNews(query, mode, el, label){
  const time=nowStr();

  // 1. 네이버 뉴스 가져오기
  el.innerHTML=loadingHTML('네이버 뉴스 검색 중...');
  let news=[];
  try{
    news=await fetchNaverNews(query, 10);
  }catch(e){
    // 뉴스 실패해도 AI 분석은 진행
    console.warn('뉴스 검색 실패:',e);
  }

  // 2. 뉴스 텍스트 조합
  const newsText=news.length>0
    ? news.map((n,i)=>`[${i+1}] ${n.title}\n${n.description}\n발행: ${n.pubDate}`).join('\n\n')
    : '(뉴스를 가져오지 못했습니다. 가능한 범위에서 분석해주세요.)';

  // 3. 프롬프트 구성
  let prompt;
  if(mode==='stock'){
    prompt=`현재 시각: ${time}

아래는 "${query}"에 대한 최신 네이버 뉴스 ${news.length}건입니다:

${newsText}

위 뉴스를 바탕으로 "${query}" 종목을 분석해주세요.

### 📌 핵심 요약
- 현재 주가 동향과 최근 변동 (구체적 수치)
- 주요 뉴스 핵심 내용 정리

### 📊 투자 포인트
- 호재 요인
- 악재 요인
- 기관/외국인 수급 동향 (뉴스에서 확인 가능하면)

### 🔮 단기 전망
- 향후 1~2주 예상 방향
- 주의해야 할 이벤트

### 💡 시장 심리: [강세/약세/중립/혼조]`;
  } else if(mode==='market'){
    prompt=`현재 시각: ${time}

아래는 오늘의 주요 시장 뉴스 ${news.length}건입니다:

${newsText}

위 뉴스를 바탕으로 오늘의 한국 주식시장 전체 동향을 분석해주세요.

### 📈 시장 요약
- 코스피/코스닥 지수 현황 (수치, 등락률)
- 거래대금

### 🌍 글로벌 시장
- 미국 증시 동향
- 환율 (원/달러)
- 유가, 금 등

### 🔥 핵심 이슈 3가지
각 이슈별 관련 종목과 영향

### 📊 업종별 동향
- 상승 TOP 3
- 하락 TOP 3

### 🔮 내일 전망
- 체크포인트
- 관심 종목/업종

### 💡 시장 심리: [강세/약세/중립/혼조]`;
  } else {
    prompt=`현재 시각: ${time}

아래는 "${query}" 테마 관련 최신 뉴스 ${news.length}건입니다:

${newsText}

위 뉴스를 바탕으로 "${label}" 테마를 분석해주세요.

### 📌 ${label} 핵심 요약
- 최근 테마 동향
- 주요 뉴스 핵심 정리

### 🏢 주요 관련 종목 (5~8개)
종목명, 주가 동향(수치), 관련 이유

### 📊 투자 포인트
- 호재/악재
- 정책/규제 변화
- 글로벌 연관성

### 🔮 전망
- 테마 지속 가능성
- 관련 이벤트
- 관심 종목 3개

### 💡 테마 심리: [과열/관심 증가/보합/관심 감소]`;
  }

  // 4. AI 분석
  el.innerHTML=loadingHTML('AI가 뉴스를 분석 중...');
  const analysis=await callGemini(prompt);

  // 5. 결과 렌더링
  el.innerHTML=renderAnalysis(label||query+' 분석', analysis, news.slice(0,5));
}

// ===== Actions =====
async function doSearch(){
  const q=$('stockInput').value.trim();
  if(!q) return;
  $('searchBtn').disabled=true;
  try{ await analyzeWithNews(q,'stock',$('searchResult'), q+' 분석'); }
  catch(e){ $('searchResult').innerHTML=errorHTML(e.message); }
  $('searchBtn').disabled=false;
}

async function doMarket(){
  $('marketBtn').disabled=true;
  const queries=['코스피 증시','코스닥 시장','미국증시 나스닥','환율 원달러'];
  const el=$('marketResult');
  el.innerHTML=loadingHTML('시장 뉴스 수집 중...');

  try{
    // 여러 키워드 뉴스 수집
    let allNews=[];
    const seen=new Set();
    for(const q of queries){
      try{
        const news=await fetchNaverNews(q,5);
        news.forEach(n=>{if(!seen.has(n.title)){seen.add(n.title);allNews.push(n);}});
      }catch{}
    }

    const newsText=allNews.length>0
      ? allNews.slice(0,15).map((n,i)=>`[${i+1}] ${n.title}\n${n.description}\n발행: ${n.pubDate}`).join('\n\n')
      : '(뉴스를 가져오지 못했습니다.)';

    el.innerHTML=loadingHTML('AI가 시장 동향을 분석 중...');

    const prompt=`현재 시각: ${nowStr()}

아래는 오늘의 주요 시장 뉴스 ${allNews.length}건입니다:

${newsText}

위 뉴스를 바탕으로 오늘의 한국 주식시장 전체 동향을 분석해주세요.

### 📈 시장 요약
- 코스피/코스닥 지수 현황 (수치, 등락률)

### 🌍 글로벌 시장
- 미국 증시, 환율, 유가/금

### 🔥 핵심 이슈 3가지
각 이슈별 관련 종목과 영향

### 📊 업종별 동향
- 상승/하락 TOP 3

### 🔮 내일 전망

### 💡 시장 심리: [강세/약세/중립/혼조]`;

    const analysis=await callGemini(prompt);
    el.innerHTML=renderAnalysis('오늘의 시장 동향', analysis, allNews.slice(0,5));
  }catch(e){ el.innerHTML=errorHTML(e.message); }
  $('marketBtn').disabled=false;
}

async function doTheme(card){
  const q=card.dataset.q, label=card.dataset.label;
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=true);
  try{ await analyzeWithNews(q,'theme',$('themeResult'),label+' 테마 분석'); }
  catch(e){ $('themeResult').innerHTML=errorHTML(e.message); }
  document.querySelectorAll('.theme-card').forEach(c=>c.disabled=false);
}

// ===== Rendering =====
function loadingHTML(t){
  return `<div class="loading"><div class="loading-spinner"></div><p class="loading-text">${t}</p></div>`;
}
function errorHTML(m){ return `<div class="error-card">${m}</div>`; }

function renderAnalysis(title, markdown, news){
  let badge='';
  if(markdown.includes('강세'))badge='<span class="badge bull">강세</span>';
  else if(markdown.includes('약세'))badge='<span class="badge bear">약세</span>';
  else if(markdown.includes('혼조')||markdown.includes('중립'))badge='<span class="badge neutral">혼조</span>';
  else if(markdown.includes('과열'))badge='<span class="badge bull">과열</span>';
  else if(markdown.includes('관심 증가'))badge='<span class="badge bull">관심↑</span>';
  else if(markdown.includes('관심 감소'))badge='<span class="badge bear">관심↓</span>';

  // 뉴스 링크
  let newsHTML='';
  if(news && news.length>0){
    newsHTML=`<div class="sources-section">
      <h4 class="sources-title">📰 원문 기사</h4>
      ${news.map((n,i)=>`<a href="${n.link}" target="_blank" rel="noopener" class="source-link">
        <span class="source-num">${i+1}</span>
        <div class="source-info">
          <span class="source-text">${n.title}</span>
          <span class="source-date">${n.pubDate}</span>
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
      ${newsHTML}
      <div class="analysis-footer">
        <span class="analysis-time">${nowShort()} 기준</span>
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
