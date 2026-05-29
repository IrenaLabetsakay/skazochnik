// --- Stars ---
const starsEl = document.getElementById('stars');
const layerSpeeds = [0.08, 0.14, 0.22];
const layerEls = layerSpeeds.map(() => {
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;inset:0;will-change:transform;';
  starsEl.appendChild(div);
  return div;
});

for (let i = 0; i < 120; i++) {
  const s = document.createElement('div');
  s.className = 'star';
  const size = Math.random() * 2.5 + 0.5;
  s.style.cssText = `
    left:${Math.random()*100}%;top:${Math.random()*100}%;
    width:${size}px;height:${size}px;
    --d:${8+Math.random()*12}s;--delay:${Math.random()*10}s;
    --base:${(Math.random()*0.4+0.3).toFixed(2)}
  `;
  layerEls[i < 40 ? 0 : i < 80 ? 1 : 2].appendChild(s);
}

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  layerEls.forEach((el, li) => {
    el.style.transform = `translateY(${y * layerSpeeds[li]}px)`;
  });
}, { passive: true });

// --- Shooting stars ---
function spawnShootingStar() {
  const el = document.createElement('div');
  el.className = 'shooting-star';
  const length = 80 + Math.random() * 120;
  const angle = -(15 + Math.random() * 25); // degrees, left-downward
  const dur = 0.6 + Math.random() * 0.5;
  el.style.cssText = `
    width:${length}px;
    top:${Math.random() * 55}%;
    left:${20 + Math.random() * 55}%;
    --angle:${angle}deg;
    --dur:${dur}s;
    --travel:-${length + 60}px;
  `;
  starsEl.appendChild(el);
  setTimeout(() => el.remove(), dur * 1000 + 100);
  scheduleShootingStar();
}

function scheduleShootingStar() {
  setTimeout(spawnShootingStar, 3000 + Math.random() * 9000);
}

scheduleShootingStar();

// --- State ---
let apiKey = localStorage.getItem('claude_api_key') || '';
let elevenlabsApiKey = localStorage.getItem('elevenlabs_api_key') || '';
let selectedInterests = [];
let selectedMoral = 'Дружба побеждает всё';
let currentStoryText = '';
let ttsUtterance = null;
let ttsSpeaking = false;
let ttsPaused = false;
let ttsResumeInterval = null;
let ttsAudio = null;
let ttsAudioUrl = null;

const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — multilingual female
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

if (apiKey) {
  document.getElementById('apiNotice').style.display = 'none';
  document.getElementById('apiKeyInput').value = apiKey;
}

if (elevenlabsApiKey) {
  document.getElementById('elevenlabsKeyInput').value = elevenlabsApiKey;
  document.getElementById('ttsQuality').textContent = 'ElevenLabs AI голос ✨';
}

function saveApiKey() {
  const val = document.getElementById('apiKeyInput').value.trim();
  if (!val) return;
  apiKey = val;
  localStorage.setItem('claude_api_key', apiKey);
  document.getElementById('apiNotice').style.display = 'none';
}

function saveElevenlabsKey() {
  const val = document.getElementById('elevenlabsKeyInput').value.trim();
  elevenlabsApiKey = val;
  if (val) {
    localStorage.setItem('elevenlabs_api_key', val);
    document.getElementById('ttsQuality').textContent = 'ElevenLabs AI голос ✨';
  } else {
    localStorage.removeItem('elevenlabs_api_key');
    document.getElementById('ttsQuality').textContent = 'Браузерный голос';
  }
}

function toggleInterest(btn) {
  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    selectedInterests = selectedInterests.filter(i => i !== btn.textContent.trim());
  } else {
    if (selectedInterests.length >= 3) return;
    btn.classList.add('active');
    selectedInterests.push(btn.textContent.trim());
  }
}

function selectMoral(btn) {
  document.querySelectorAll('.moral-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedMoral = btn.textContent.trim();
}

const loadingPhrases = [
  'Сказочник придумывает историю...',
  'Зажигаем звёзды в сказке...',
  'Герои готовятся к приключению...',
  'Рисуем волшебный мир...',
  'Почти готово, осталось чуть-чуть...'
];
let loadingInterval = null;
let loadingIdx = 0;

function startLoading() {
  const loadingEl = document.getElementById('loading');
  const textEl = document.getElementById('loadingText');
  loadingEl.classList.add('show');
  loadingIdx = 0;
  textEl.textContent = loadingPhrases[0];
  loadingInterval = setInterval(() => {
    loadingIdx = (loadingIdx + 1) % loadingPhrases.length;
    textEl.textContent = loadingPhrases[loadingIdx];
  }, 2200);
}

function stopLoading() {
  document.getElementById('loading').classList.remove('show');
  if (loadingInterval) clearInterval(loadingInterval);
}

async function generateStory() {
  const name = document.getElementById('childName').value.trim();
  const age = document.getElementById('childAge').value;

  if (!apiKey) {
    showError('Введите API ключ Claude в поле выше.');
    return;
  }
  if (!name) {
    showError('Пожалуйста, введите имя ребёнка.');
    return;
  }
  if (selectedInterests.length === 0) {
    showError('Выберите хотя бы один интерес ребёнка.');
    return;
  }

  hideError();
  document.getElementById('genBtn').disabled = true;
  document.getElementById('storyCard').classList.remove('show');
  startLoading();

  const interestsList = selectedInterests.map(i => i.replace(/^[^\s]+\s/, '')).join(', ');

  const prompt = `Ты добрый и талантливый сказочник. Напиши волшебную сказку на ночь для ребёнка ${age} лет.

Главного героя зовут ${name}. Он/она очень любит: ${interestsList}.
Мораль сказки: "${selectedMoral}".

Требования:
- Структура: яркая завязка → небольшое приключение → добрая тёплая развязка
- Длина: 350-450 слов
- Язык: простой, тёплый, образный, без страшных и жестоких сцен
- В финале: плавный переход ко сну, фраза "Закрывай глазки..." и красивое завершение
- Разбей текст на 4-5 абзацев

После сказки, на новой строке напиши точно в таком формате:
SCENE: [одно предложение на английском, описывающее самую красивую сцену для детской иллюстрации, в стиле watercolor children's book illustration]

Напиши только сказку и SCENE, никаких вступлений и комментариев.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const fullText = data.content[0].text;

    const sceneMatch = fullText.match(/SCENE:\s*(.+)/);
    const storyOnly = fullText.replace(/SCENE:.*$/s, '').trim();
    const sceneDesc = sceneMatch ? sceneMatch[1].trim() : null;

    currentStoryText = storyOnly;

    stopLoading();
    renderStory(storyOnly, name);

    if (sceneDesc) {
      generateIllustration(sceneDesc);
    }

  } catch (err) {
    stopLoading();
    showError(`Ошибка: ${err.message}. Проверьте API ключ и попробуйте снова.`);
    document.getElementById('genBtn').disabled = false;
  }
}

function renderStory(text, name) {
  const paragraphs = text.split('\n').filter(p => p.trim());
  const html = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
  document.getElementById('storyText').innerHTML = html;

  document.getElementById('illustrationImg').classList.remove('loaded');
  document.getElementById('illustrationImg').src = '';
  document.getElementById('illustrationPlaceholder').style.display = 'flex';
  document.getElementById('illustrationPlaceholder').style.flexDirection = 'column';
  document.getElementById('illustrationPlaceholder').style.alignItems = 'center';

  document.getElementById('storyCard').classList.add('show');
  document.getElementById('genBtn').disabled = false;
  document.getElementById('storyCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function generateIllustration(sceneDesc) {
  const prompt = encodeURIComponent(`${sceneDesc}, watercolor children's book illustration, soft warm colors, magical, dreamy`);
  const imgUrl = `https://image.pollinations.ai/prompt/${prompt}?width=800&height=450&seed=${Math.floor(Math.random()*9999)}&nologo=true`;

  const img = document.getElementById('illustrationImg');
  img.onload = () => {
    img.classList.add('loaded');
    document.getElementById('illustrationPlaceholder').style.display = 'none';
  };
  img.onerror = () => {
    document.getElementById('illustrationPlaceholder').innerHTML = `
      <span style="font-size:36px;display:block;margin-bottom:8px">🖼️</span>
      <span>Иллюстрация недоступна</span>
    `;
  };
  img.src = imgUrl;
}

function stopTTS() {
  if (ttsResumeInterval) { clearInterval(ttsResumeInterval); ttsResumeInterval = null; }
  speechSynthesis.cancel();
  if (ttsAudio) {
    ttsAudio.pause();
    ttsAudio.src = '';
    ttsAudio = null;
  }
  if (ttsAudioUrl) {
    URL.revokeObjectURL(ttsAudioUrl);
    ttsAudioUrl = null;
  }
  ttsSpeaking = false;
  ttsPaused = false;
  updateTTSBtn('stopped');
}

async function speakWithElevenLabs(text) {
  updateTTSBtn('loading');

  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenlabsApiKey
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true }
    })
  });

  if (!resp.ok) {
    let msg = `ElevenLabs ошибка ${resp.status}`;
    try { const e = await resp.json(); msg = e.detail?.message || e.detail?.status || msg; } catch {}
    throw new Error(msg);
  }

  const blob = await resp.blob();
  if (ttsAudioUrl) { URL.revokeObjectURL(ttsAudioUrl); ttsAudioUrl = null; }
  ttsAudioUrl = URL.createObjectURL(blob);

  ttsAudio = new Audio(ttsAudioUrl);
  ttsAudio.onended = () => stopTTS();
  ttsAudio.onerror = () => stopTTS();
  await ttsAudio.play();

  ttsSpeaking = true;
  ttsPaused = false;
  updateTTSBtn('playing');
}

function startBrowserTTS() {
  const startSpeaking = () => {
    ttsUtterance = new SpeechSynthesisUtterance(currentStoryText);
    ttsUtterance.lang = 'ru-RU';
    ttsUtterance.rate = 0.85;
    ttsUtterance.pitch = 1.05;

    const voices = speechSynthesis.getVoices();
    const ruVoice = voices.find(v => v.lang.startsWith('ru') && v.name.includes('Female'))
      || voices.find(v => v.lang.startsWith('ru'));
    if (ruVoice) ttsUtterance.voice = ruVoice;

    ttsUtterance.onend = () => { stopTTS(); };
    ttsUtterance.onerror = () => { stopTTS(); };

    speechSynthesis.speak(ttsUtterance);
    ttsSpeaking = true;
    ttsPaused = false;
    updateTTSBtn('playing');

    // Chrome stops speaking after ~15s on long texts; Firefox doesn't need this and it breaks there
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);
    if (isChrome) {
      ttsResumeInterval = setInterval(() => {
        if (ttsPaused) return;
        if (!speechSynthesis.speaking) { stopTTS(); return; }
        speechSynthesis.pause();
        speechSynthesis.resume();
      }, 10000);
    }
  };

  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    startSpeaking();
  } else {
    speechSynthesis.onvoiceschanged = () => {
      speechSynthesis.onvoiceschanged = null;
      startSpeaking();
    };
    // Firefox sometimes never fires onvoiceschanged — fall back after a short delay
    setTimeout(() => { if (!ttsSpeaking) startSpeaking(); }, 500);
  }
}

function toggleTTS() {
  if (!currentStoryText) return;

  if (ttsPaused) {
    if (ttsAudio) { ttsAudio.play(); } else { speechSynthesis.resume(); }
    ttsPaused = false;
    updateTTSBtn('playing');
    return;
  }

  if (ttsSpeaking) {
    if (ttsAudio) { ttsAudio.pause(); } else { speechSynthesis.pause(); }
    ttsPaused = true;
    updateTTSBtn('paused');
    return;
  }

  if (elevenlabsApiKey) {
    speakWithElevenLabs(currentStoryText).catch(err => {
      updateTTSBtn('stopped');
      const label = document.getElementById('ttsQuality');
      label.textContent = '⚠ ' + err.message;
      setTimeout(() => { label.textContent = 'ElevenLabs AI голос ✨'; }, 5000);
    });
  } else {
    startBrowserTTS();
  }
}

function updateTTSBtn(state) {
  const btn = document.getElementById('ttsBtn');
  btn.disabled = state === 'loading';
  if (state === 'playing') {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Пауза`;
  } else if (state === 'paused') {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg> Продолжить`;
  } else if (state === 'loading') {
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Генерирую...`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg> Озвучить`;
  }
}

function newStory() {
  if (ttsSpeaking) { stopTTS(); }
  document.getElementById('storyCard').classList.remove('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('show');
}

function hideError() {
  document.getElementById('errorBox').classList.remove('show');
}

// Pre-load voices list on page start
speechSynthesis.getVoices();
