'use strict';

// ---------- Dados ----------

const COLUNAS = 'abcdefgh';
const NOME = { k: 'Rei', q: 'Rainha', r: 'Torre', b: 'Bispo', n: 'Cavalo', p: 'Peão' };
const PLURAL = { k: 'Reis', q: 'Rainhas', r: 'Torres', b: 'Bispos', n: 'Cavalos', p: 'Peões' };
const FEMININO = { q: true, r: true };
const VALOR = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
// Como a voz deve pronunciar cada coluna (evita "e4" virar "i quatro")
const LETRA_FALADA = { a: 'á', b: 'bê', c: 'cê', d: 'dê', e: 'é', f: 'éfe', g: 'gê', h: 'agá' };
const NOTACAO_PT = { K: 'R', Q: 'D', R: 'T', B: 'B', N: 'C' };

// Força aproximada: Skill Level do Stockfish + profundidade + chance de lance aleatório
const NIVEIS = [
  { elo: 400,  skill: 0,  depth: 1,  random: 0.35, time: 300,  desc: 'Acabou de aprender. Erra muito e entrega peças.' },
  { elo: 600,  skill: 0,  depth: 2,  random: 0.22, time: 400,  desc: 'Iniciante. Ainda deixa peças sem defesa.' },
  { elo: 800,  skill: 1,  depth: 3,  random: 0.14, time: 500,  desc: 'Casual. Vê ameaças simples, mas cai em táticas.' },
  { elo: 1000, skill: 3,  depth: 4,  random: 0.09, time: 600,  desc: 'Jogador de fim de semana. Pune peças soltas.' },
  { elo: 1200, skill: 5,  depth: 5,  random: 0.05, time: 700,  desc: 'Intermediário. Acha táticas de um lance.' },
  { elo: 1400, skill: 7,  depth: 6,  random: 0.03, time: 800,  desc: 'Intermediário firme. Poucos erros grosseiros.' },
  { elo: 1600, skill: 9,  depth: 8,  random: 0.01, time: 900,  desc: 'Forte de clube. Calcula táticas de dois lances.' },
  { elo: 1800, skill: 12, depth: 10, random: 0,    time: 1000, desc: 'Avançado. Bom cálculo e bom jogo posicional.' },
  { elo: 2000, skill: 15, depth: 12, random: 0,    time: 1200, desc: 'Expert. Muito difícil de surpreender.' },
  { elo: 2200, skill: 18, depth: 14, random: 0,    time: 1500, desc: 'Candidato a mestre.' },
  { elo: 2500, skill: 20, depth: 18, random: 0,    time: 2000, desc: 'Força de mestre. Quase não erra.' },
];

// Classificação dos lances na análise, na ordem da tabela de resumo
const CLASSES = {
  brilhante:  { nome: 'Brilhante',      simbolo: '!!', cor: '#1fae9b', frase: s => `${s} é brilhante!` },
  otimo:      { nome: 'Ótimo',          simbolo: '!',  cor: '#5f8fbd', frase: s => `${s} é um ótimo lance.` },
  melhor:     { nome: 'Melhor',         simbolo: '★',  cor: '#7fb04a', frase: s => `${s} é o melhor lance.` },
  excelente:  { nome: 'Excelente',      simbolo: '✓',  cor: '#96bc4b', frase: s => `${s} é excelente.` },
  bom:        { nome: 'Bom',            simbolo: '✓',  cor: '#8fa882', frase: s => `${s} é um bom lance.` },
  forcado:    { nome: 'Único lance',    simbolo: '→',  cor: '#8b8f86', frase: s => `${s} era o único lance possível.` },
  imprecisao: { nome: 'Imprecisão',     simbolo: '?!', cor: '#e8b93c', frase: s => `${s} é uma imprecisão.` },
  erro:       { nome: 'Erro',           simbolo: '?',  cor: '#e88a2a', frase: s => `${s} é um erro.` },
  perdida:    { nome: 'Chance perdida', simbolo: '✕',  cor: '#e0644f', frase: s => `${s} deixou passar uma chance.` },
  capivarada: { nome: 'Capivarada',     simbolo: '??', cor: '#c9302c', frase: s => `${s} é uma capivarada.` },
};
const DETALHE = {
  brilhante: 'Um sacrifício que funciona.',
  otimo: 'Era o único lance que mantinha a sua situação.',
  perdida: 'O adversário tinha errado e você não aproveitou.',
};

const MOTIVO = {
  'Xeque-mate': 'por xeque-mate', 'Afogamento': 'por afogamento', 'Repetição de posição': 'por repetição de posição',
  'Material insuficiente': 'por material insuficiente', 'Regra dos 50 lances': 'pela regra dos 50 lances', 'Desistência': 'por desistência',
};

// Reconhecimento: palavras (sem acento) que valem como coluna, número e peça
const LETRAS = { a: 'a', ah: 'a', ha: 'a', b: 'b', be: 'b', bi: 'b', c: 'c', ce: 'c', se: 'c', si: 'c', d: 'd', de: 'd', di: 'd',
  e: 'e', eh: 'e', f: 'f', ef: 'f', efe: 'f', g: 'g', ge: 'g', je: 'g', gue: 'g', h: 'h', aga: 'h', haga: 'h' };
const NUMEROS = { 1: 1, um: 1, uma: 1, hum: 1, 2: 2, dois: 2, duas: 2, 3: 3, tres: 3, 4: 4, quatro: 4, 5: 5, cinco: 5,
  6: 6, seis: 6, 7: 7, sete: 7, 8: 8, oito: 8 };
const PECAS = { rei: 'k', rainha: 'q', raina: 'q', dama: 'q', torre: 'r', bispo: 'b', cavalo: 'n', peao: 'p', piao: 'p', peoes: 'p' };

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const store = {
  get(k, padrao) { try { const v = localStorage.getItem('xv:' + k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } },
  set(k, v) { try { localStorage.setItem('xv:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('xv:' + k); } catch {} },
};

const config = Object.assign({ elo: 800, cor: 'w', falar: true, ouvirAuto: true, eco: true, voz: '', vel: 1.02, tom: 1 }, store.get('config', {}));
const salvarConfig = () => store.set('config', config);
// Vozes gravadas no ElevenLabs (uma pasta de trechos por voz). A Lax vira a padrão uma única vez, depois respeita a escolha
const VOZES_GRAVADAS = {
  __lax__: { nome: 'Lax Whisper', pasta: 'audio' },
  __carla__: { nome: 'Carla', pasta: 'carla' },
};
const VOZ_GRAVADA = '__lax__';
if (!config.vozLax) { config.voz = VOZ_GRAVADA; config.vozLax = true; salvarConfig(); }

let game = null, minhaCor = 'w', nivel = NIVEIS[2];
let pensando = false, fimDeJogo = false, emJogo = false, buscaId = 0;
let selecionada = null, dicaCasas = null, ultimaFala = '', confirmarDesistencia = false, wakeLock = null;
let vendo = null; // lance sendo revisto durante a partida (null = posição atual)

// ---------- Motor ----------

const motor = {
  worker: null, fila: [],
  iniciar() {
    if (this.worker) return;
    try {
      this.worker = new Worker('vendor/stockfish.js');
      this.worker.onmessage = e => {
        const linha = typeof e.data === 'string' ? e.data : '';
        const atual = this.fila[0];
        if (!atual) return;
        if (linha.startsWith('info') && atual.info) atual.info(linha);
        else if (linha.startsWith('bestmove')) { this.fila.shift(); atual.fim(linha.split(' ')[1]); }
      };
      this.worker.onerror = () => { this.worker = null; this.fila.splice(0).forEach(x => x.fim(null)); };
      this.enviar('uci');
      this.enviar('setoption name Hash value 16');
      this.enviar('isready');
    } catch { this.worker = null; }
  },
  enviar(cmd) { if (this.worker) this.worker.postMessage(cmd); },
  // Cada "go" gera exatamente um bestmove, então a fila sempre fica alinhada
  pedir(cmds, info, limite) {
    if (!this.worker) return Promise.resolve(null);
    const resposta = new Promise(res => { this.fila.push({ fim: res, info }); cmds.forEach(c => this.enviar(c)); });
    return Promise.race([resposta, sleep(limite).then(() => null)]);
  },
  buscar(fen, { skill, depth, time }) {
    return this.pedir([
      'setoption name MultiPV value 1', 'setoption name Skill Level value ' + skill,
      'position fen ' + fen, `go depth ${depth} movetime ${time}`,
    ], null, time + 8000);
  },
  async analisar(fen, { depth = 13, time = 800, multipv = 2 } = {}) {
    const linhas = [];
    const info = l => {
      const m = l.match(/ multipv (\d+) .*?score (cp|mate) (-?\d+).*? pv (\S+)/);
      if (m) linhas[+m[1] - 1] = { tipo: m[2], valor: +m[3], lance: m[4] };
    };
    const best = await this.pedir([
      'setoption name Skill Level value 20', `setoption name MultiPV value ${multipv}`,
      'position fen ' + fen, `go depth ${depth} movetime ${time}`,
    ], info, time + 10000);
    if (!best || best === '(none)') return null;
    return { best, linhas: linhas.filter(Boolean) };
  },
  parar() { this.enviar('stop'); },
  novoJogo() { this.enviar('ucinewgame'); this.enviar('isready'); },
};

// ---------- Voz: falar ----------

// Uma fala tem o texto (voz do celular) e, quando dá, a sequência de trechos gravados
const F = (texto, clipes = null) => ({ texto, clipes });
// Pausa depois de cada trecho gravado: maior depois de rótulos como "Você:" e frases completas
const PAUSA_LONGA = /^(voce|computador|dica|qual_peca|brancas|pretas|xeque|xeque_mate|cl_|det_|joga_|nivel_|continuando|meu_ultimo|fim_)/;

let audioCtx = null;
const ctxAudio = () => (audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)());

const cacheAudio = new Map();
function carregarAudio(url) {
  if (!cacheAudio.has(url)) {
    cacheAudio.set(url, fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then(b => ctxAudio().decodeAudioData(b))
      .catch(() => { cacheAudio.delete(url); return null; }));
  }
  return cacheAudio.get(url);
}

const clipes = {
  carregar: id => carregarAudio(`vozes/${VOZES_GRAVADAS[config.voz].pasta}/${id}.mp3`),
  async preCarregar() {
    try {
      const lista = await (await fetch('vozes/clips.json')).json();
      for (const id of Object.keys(lista)) this.carregar(id);
    } catch {}
  },
};

const fala = {
  voz: null, fila: Promise.resolve(), pendentes: 0, geracao: 0, fontes: [],
  get falando() { return this.pendentes > 0; },
  get gravada() { return config.voz in VOZES_GRAVADAS; },
  vozes() { return 'speechSynthesis' in window ? speechSynthesis.getVoices() : []; },
  escolherVoz() {
    const vozes = this.vozes();
    const pt = vozes.filter(v => (v.lang || '').replace('_', '-').toLowerCase().startsWith('pt-br'));
    this.voz = (config.voz && vozes.find(v => v.name === config.voz))
      || pt.find(v => /google/i.test(v.name)) || pt[0] || vozes.find(v => (v.lang || '').startsWith('pt')) || null;
  },
  dizer(frase, forcar = false) {
    if (typeof frase === 'string') frase = F(frase);
    if ((!config.falar && !forcar) || !frase || !frase.texto) return Promise.resolve();
    const usarClipes = this.gravada && frase.clipes && frase.clipes.length;
    if (!usarClipes && !('speechSynthesis' in window)) return Promise.resolve();
    ouvinte.parar();
    const geracao = this.geracao;
    this.pendentes++;
    this.fila = this.fila.then(async () => {
      if (geracao !== this.geracao) return;
      if (usarClipes && await this.tocarClipes(frase.clipes)) return;
      if (geracao !== this.geracao || !('speechSynthesis' in window)) return;
      // Frases curtas: o Chrome do Android às vezes corta falas longas
      for (const p of frase.texto.split(/(?<=[.;!?])\s+/).filter(Boolean)) {
        if (geracao !== this.geracao) return;
        await this.falarUma(p);
      }
    }).finally(() => { this.pendentes--; });
    return this.fila;
  },
  async tocarClipes(ids) {
    const buffers = await Promise.all(ids.map(id => clipes.carregar(id)));
    if (buffers.some(b => !b)) return false;
    const ctx = ctxAudio();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
    let t = ctx.currentTime + 0.05;
    this.fontes = buffers.map((b, i) => {
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(t);
      t += b.duration + (i < ids.length - 1 ? (PAUSA_LONGA.test(ids[i]) ? 0.28 : 0.06) : 0);
      return s;
    });
    const ultima = this.fontes[this.fontes.length - 1];
    await new Promise(res => { ultima.onended = res; setTimeout(res, (t - ctx.currentTime) * 1000 + 600); });
    this.fontes = [];
    return true;
  },
  falarUma(texto) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      if (this.voz) { u.voice = this.voz; u.lang = this.voz.lang; }
      u.rate = config.vel;
      u.pitch = config.tom;
      let feito = false;
      const fim = () => { if (!feito) { feito = true; res(); } };
      u.onend = fim; u.onerror = fim;
      speechSynthesis.speak(u);
      setTimeout(fim, 2500 + texto.length * 110 / config.vel);
    });
  },
  calar() {
    this.geracao++;
    for (const s of this.fontes) { try { s.stop(); } catch {} }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  },
};
if (fala.gravada) clipes.preCarregar();
if ('speechSynthesis' in window) {
  fala.escolherVoz();
  speechSynthesis.addEventListener('voiceschanged', () => { fala.escolherVoz(); preencherVozes(); });
}

// ---------- Voz: ouvir ----------

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const ouvinte = {
  rec: null, ativo: false, falhas: 0, bloqueado: false,
  iniciar(manual = false) {
    if (!SR || this.ativo || fala.falando || !emJogo || fimDeJogo || this.bloqueado) return;
    if (manual) this.falhas = 0;
    const r = new SR();
    r.lang = 'pt-BR';
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = false;
    let recebeu = false;
    r.onresult = e => {
      const res = e.results[e.results.length - 1];
      if (!res.isFinal) { mostrarOuvido(res[0].transcript, true); return; }
      recebeu = true;
      processarFala(Array.from(res, a => a.transcript));
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.bloqueado = true;
        avisar('Microfone bloqueado. Libere o microfone para este site nas configurações do Chrome.');
      }
    };
    r.onend = () => {
      if (this.rec === r) { this.rec = null; this.ativo = false; }
      atualizarMic();
      if (recebeu || r.abortado || this.bloqueado) return;
      this.falhas++;
      if (config.ouvirAuto && podeJogar() && this.falhas < 3) setTimeout(() => this.iniciar(), 300);
      else if (podeJogar()) avisar('Toque no microfone para falar seu lance.');
    };
    try { r.start(); this.rec = r; this.ativo = true; } catch {}
    atualizarMic();
  },
  parar() {
    if (!this.rec) return;
    this.rec.abortado = true;
    try { this.rec.abort(); } catch {}
    this.rec = null; this.ativo = false;
    atualizarMic();
  },
};

// ---------- Entender o que foi falado ----------

function normalizar(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function interpretar(texto) {
  const n = normalizar(texto);
  const tokens = n.split(' ').filter(Boolean);

  if (confirmarDesistencia && /\b(sim|confirmo|desisto|desistir)\b/.test(n)) return { tipo: 'comando', nome: 'desistirConfirmado' };
  if (/\b(repet\w*|de novo|nao ouvi)\b/.test(n)) return { tipo: 'comando', nome: 'repetir' };
  if (/\bposica\w*|\bonde estao\b/.test(n)) return { tipo: 'comando', nome: 'posicao' };
  if (/\bdica\b|\bsugest\w*/.test(n)) return { tipo: 'comando', nome: 'dica' };
  if (/\bdesfaz\w*|\bvoltar\b|\bvolta\b/.test(n)) return { tipo: 'comando', nome: 'desfazer' };
  if (/\bdesist\w*|\babandon\w*/.test(n)) return { tipo: 'comando', nome: 'desistir' };
  if (/\bajuda\b|\bcomo (eu )?falo\b/.test(n)) return { tipo: 'comando', nome: 'ajuda' };

  if (!podeJogar()) return { tipo: 'espera' };
  const legais = game.moves({ verbose: true });

  if (/\broque\b|\broc\w*/.test(n)) {
    const lado = /pequen|curt|menor/.test(n) ? 'k' : /grand|long|maior/.test(n) ? 'q' : null;
    return resolver(legais.filter(m => lado ? m.flags.includes(lado) : /[kq]/.test(m.flags)));
  }

  const casas = [];
  let peca = null, promocao = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (LETRAS[t] && NUMEROS[tokens[i + 1]]) { casas.push(LETRAS[t] + NUMEROS[tokens[i + 1]]); i++; continue; }
    if (PECAS[t]) { if (!casas.length) peca = peca || PECAS[t]; else promocao = PECAS[t]; }
  }
  if (!casas.length) return { tipo: 'desconhecido' };

  const destino = casas[casas.length - 1];
  let cands;
  if (casas.length >= 2) {
    cands = legais.filter(m => m.from === casas[0] && m.to === destino);
    // Origem mal ouvida: aceita se a peça falada só tem um jeito de chegar ao destino
    if (!cands.length && peca) cands = legais.filter(m => m.to === destino && m.piece === peca);
  } else {
    cands = legais.filter(m => m.to === destino && (!peca || m.piece === peca));
    // Como na notação, "e4" sem peça é lance de peão
    if (!peca && cands.some(m => m.piece === 'p')) cands = cands.filter(m => m.piece === 'p');
  }
  if (cands.some(m => m.promotion)) {
    const p = promocao && 'qrbn'.includes(promocao) ? promocao : 'q';
    cands = cands.filter(m => m.promotion === p);
  }
  return resolver(cands);
}

function resolver(cands) {
  if (cands.length === 1) return { tipo: 'lance', lance: cands[0] };
  if (cands.length > 1) return { tipo: 'ambiguo', opcoes: cands };
  return { tipo: 'ilegal' };
}

const PRIORIDADE = { lance: 0, comando: 1, espera: 1, ambiguo: 2, ilegal: 3, desconhecido: 4 };

function processarFala(alternativas) {
  let melhor = null;
  for (const t of alternativas) {
    const r = interpretar(t);
    r.texto = t;
    if (!melhor || PRIORIDADE[r.tipo] < PRIORIDADE[melhor.tipo]) melhor = r;
    if (r.tipo === 'lance') break;
  }
  if (melhor) executar(melhor);
}

async function executar(r) {
  mostrarOuvido(r.texto);
  if (r.tipo !== 'comando' || r.nome !== 'desistirConfirmado') confirmarDesistencia = r.tipo === 'comando' && r.nome === 'desistir';
  switch (r.tipo) {
    case 'lance': return jogarMeuLance(r.lance, true);
    case 'comando': return comando(r.nome);
    case 'espera': avisar('Espere a jogada do computador.'); return;
    case 'ambiguo': {
      const quais = juntar(r.opcoes.map(m => `${NOME[m.piece].toLowerCase()} de ${falarCasa(m.from)}`), 'ou');
      avisar('Qual peça? ' + juntar(r.opcoes.map(m => `${NOME[m.piece]} de ${m.from}`), 'ou'));
      const cl = ['qual_peca'];
      r.opcoes.forEach((m, i) => { if (i) cl.push('ou'); cl.push(`amb_${PECA_ID[m.piece]}`, 'c_' + m.from); });
      await fala.dizer(F('Qual peça? O ' + quais + '?', r.opcoes.some(m => m.piece === 'k') ? null : cl), true);
      return reouvir();
    }
    case 'ilegal':
      avisar('Esse lance não é possível nesta posição.');
      await fala.dizer(F('Esse lance não é possível. Repita, por favor.', ['ilegal']), true);
      return reouvir();
    default:
      avisar('Não entendi. Ex.: “peão de e2 para e4”.');
      await fala.dizer(F('Não entendi. Repita o lance.', ['nao_entendi']), true);
      return reouvir();
  }
}

function reouvir() { if (config.ouvirAuto && podeJogar()) ouvinte.iniciar(true); }

// ---------- Texto dos lances ----------

const falarCasa = sq => `${LETRA_FALADA[sq[0]]} ${sq[1]}`;
const casaEscrita = sq => sq;
const juntar = (itens, conj = 'e') => itens.length < 2 ? itens.join('') : itens.slice(0, -1).join(', ') + ` ${conj} ` + itens[itens.length - 1];
const sanPt = san => san.replace(/[KQRBN]/g, c => NOTACAO_PT[c]);

function textoDoLance(m, casa = falarCasa) {
  let t;
  if (m.flags.includes('k')) t = 'Roque pequeno';
  else if (m.flags.includes('q')) t = 'Roque grande';
  else {
    t = `${NOME[m.piece]} de ${casa(m.from)}`;
    t += m.captured
      ? ` captura ${FEMININO[m.captured] ? 'a' : 'o'} ${NOME[m.captured].toLowerCase()} em ${casa(m.to)}`
      : ` para ${casa(m.to)}`;
    if (m.flags.includes('e')) t += ', en passant';
    if (m.promotion) t += `, promove a ${NOME[m.promotion]}`;
  }
  if (m.san.includes('#')) t += '. Xeque-mate!';
  else if (m.san.includes('+')) t += '. Xeque.';
  return t;
}

const PECA_ID = { k: 'rei', q: 'rainha', r: 'torre', b: 'bispo', n: 'cavalo', p: 'peao' };
const MOTIVO_ID = {
  'Xeque-mate': 'por_mate', 'Afogamento': 'por_afogamento', 'Repetição de posição': 'por_repeticao',
  'Material insuficiente': 'por_material', 'Regra dos 50 lances': 'por_50', 'Desistência': 'por_desistencia',
};

function clipesLance(m) {
  let c;
  if (m.flags.includes('k')) c = ['roque_pequeno'];
  else if (m.flags.includes('q')) c = ['roque_grande'];
  else {
    c = [`${PECA_ID[m.piece]}_de`, 'c_' + m.from, m.captured ? `cap_${PECA_ID[m.captured]}` : 'para', 'c_' + m.to];
    if (m.flags.includes('e')) c.push('en_passant');
    if (m.promotion) c.push('promove_' + m.promotion);
  }
  if (m.san.includes('#')) c.push('xeque_mate');
  else if (m.san.includes('+')) c.push('xeque');
  return c;
}
const fraseLance = m => F(textoDoLance(m), clipesLance(m));

function clipesPosicao() {
  const c = [];
  for (const cor of ['w', 'b']) {
    c.push(cor === 'w' ? 'brancas' : 'pretas');
    for (const t of 'kqrbnp') {
      const cs = [];
      for (const f of COLUNAS) for (let r = 1; r <= 8; r++) {
        const p = game.get(f + r);
        if (p && p.color === cor && p.type === t) cs.push(f + r);
      }
      if (!cs.length) continue;
      c.push(cs.length > 1 && t !== 'k' ? `pos_${t}s` : `pos_${t}`);
      cs.forEach((sq, i) => { if (i && i === cs.length - 1) c.push('e'); c.push('c_' + sq); });
    }
  }
  return c;
}

function textoPosicao(casa = falarCasa) {
  const lados = { w: {}, b: {} };
  for (const f of COLUNAS) for (let r = 1; r <= 8; r++) {
    const p = game.get(f + r);
    if (p) (lados[p.color][p.type] = lados[p.color][p.type] || []).push(f + r);
  }
  const descrever = cor => 'kqrbnp'.split('').filter(t => lados[cor][t])
    .map(t => { const cs = lados[cor][t]; return `${cs.length > 1 ? PLURAL[t] : NOME[t]} em ${juntar(cs.map(casa))}`; })
    .join('; ');
  return `Brancas: ${descrever('w')}. Pretas: ${descrever('b')}.`;
}

function posicaoApos(lances, k) {
  const g = new Chess();
  for (let i = 0; i < k; i++) g.move(lances[i].san);
  return g;
}

// ---------- Partida ----------

const podeJogar = () => emJogo && !fimDeJogo && !pensando && game && game.turn() === minhaCor;

async function jogarMeuLance(m, porVoz) {
  const feito = game.move(m.san);
  if (!feito) return;
  selecionada = null; dicaCasas = null; confirmarDesistencia = false; vendo = null;
  desenharJogo(feito); tocarLance(feito); atualizarLances(); salvarPartida();
  const res = resultado();
  const eco = config.eco && porVoz ? fala.dizer(F('Você: ' + textoDoLance(feito), ['voce', ...clipesLance(feito)])) : null;
  if (res) { await eco; return finalizar(res); }
  vezDoComputador();
}

async function vezDoComputador() {
  pensando = true; atualizarStatus();
  const id = ++buscaId;
  const inicio = performance.now();
  let uci = Math.random() < nivel.random ? lanceAleatorio() : await motor.buscar(game.fen(), nivel);
  if (id !== buscaId || !emJogo) return;
  if (!uci || uci === '(none)') uci = lanceAleatorio();
  // O computador sempre leva 1,5 s para responder, dá tempo de mexer a peça no tabuleiro
  const espera = 1500 - (performance.now() - inicio);
  if (espera > 0) await sleep(espera);
  if (id !== buscaId || !emJogo) return;

  const feito = uci && game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
  pensando = false;
  if (!feito) { atualizarStatus(); return; }
  dicaCasas = null; vendo = null;
  desenharJogo(feito); tocarLance(feito); atualizarLances(); salvarPartida();
  ultimaFala = fraseLance(feito);
  avisar(textoDoLance(feito, casaEscrita));
  const res = resultado();
  atualizarStatus();
  await fala.dizer(ultimaFala);
  if (id !== buscaId || !emJogo) return;
  if (res) return finalizar(res);
  if (config.ouvirAuto) ouvinte.iniciar(true);
}

function lanceAleatorio() {
  const ms = game.moves({ verbose: true });
  if (!ms.length) return null;
  const capturas = ms.filter(m => m.captured);
  const lista = capturas.length && Math.random() < 0.4 ? capturas : ms;
  const m = lista[Math.floor(Math.random() * lista.length)];
  return m.from + m.to + (m.promotion || '');
}

function resultado() {
  if (!game.game_over()) return null;
  if (game.in_checkmate()) {
    const vencedor = game.turn() === 'w' ? 'b' : 'w';
    return { r: vencedor === minhaCor ? 'v' : 'd', motivo: 'Xeque-mate' };
  }
  if (game.in_stalemate()) return { r: 'e', motivo: 'Afogamento' };
  if (game.in_threefold_repetition()) return { r: 'e', motivo: 'Repetição de posição' };
  if (game.insufficient_material()) return { r: 'e', motivo: 'Material insuficiente' };
  return { r: 'e', motivo: 'Regra dos 50 lances' };
}

async function finalizar({ r, motivo }) {
  if (fimDeJogo) return;
  fimDeJogo = true; pensando = false; buscaId++;
  ouvinte.parar();
  const placar = store.get('placar', {});
  const s = placar[nivel.elo] || { v: 0, e: 0, d: 0 };
  s[r]++; placar[nivel.elo] = s;
  store.set('placar', placar);
  store.del('partida');
  store.set('ultima', { sans: game.history(), cor: minhaCor, elo: nivel.elo, r, motivo });
  atualizarStatus();
  setTimeout(() => tocarSom({ v: 'vitoria', d: 'derrota', e: 'empate' }[r]), 350);

  const titulo = { v: 'Você venceu!', e: 'Empate', d: 'Você perdeu' }[r];
  const porque = MOTIVO[motivo] || '';
  const jogos = s.v + s.e + s.d;
  let texto = `Contra o nível ${nivel.elo}: ${s.v} ${s.v === 1 ? 'vitória' : 'vitórias'}, ${s.e} ${s.e === 1 ? 'empate' : 'empates'} e ${s.d} ${s.d === 1 ? 'derrota' : 'derrotas'}.`;
  const proximo = NIVEIS[NIVEIS.indexOf(nivel) + 1];
  if (proximo && jogos >= 3 && (s.v + s.e / 2) / jogos >= 0.6) texto += ` Que tal tentar o nível ${proximo.elo}?`;

  const rei = r === 'e' ? 'wK' : (r === 'v') === (minhaCor === 'w') ? 'wK' : 'bK';
  const botoes = [
    { rotulo: 'Jogar novamente', principal: true, acao: () => { fecharModal(); comecar(false); } },
    { rotulo: 'Analisar partida', acao: () => { fecharModal(); abrirAnalise(store.get('ultima', null)); } },
    { rotulo: 'Escolher nível', acao: () => { fecharModal(); irParaInicio(); } },
  ];
  // Fechando o popup, a partida fica na tela com esta barra no lugar do microfone
  const tituloBarra = $('#barraFimTitulo');
  tituloBarra.textContent = `${titulo.replace('!', '')} ${porque}`;
  tituloBarra.className = r;
  $('#barraFimBotoes').replaceChildren(...botoes.map(b => {
    const el = document.createElement('button');
    el.className = b.principal ? 'botao-principal' : 'botao-secundario';
    el.textContent = b.rotulo;
    el.addEventListener('click', b.acao);
    return el;
  }));
  $('.voz').hidden = true;
  $('#barraFim').hidden = false;
  abrirModal({ titulo, motivo: porque, texto, tipo: r, img: `pieces/${rei}.svg`, fechavel: true, botoes });
  await fala.dizer(F(`${titulo.replace('!', '')} ${porque}.`, [`fim_${r}`, MOTIVO_ID[motivo]]), true);
}

async function comando(nome) {
  switch (nome) {
    case 'repetir':
      if (ultimaFala) await fala.dizer(ultimaFala, true);
      else await fala.dizer(F('Ainda não joguei nesta partida.', ['ainda_nao']), true);
      return reouvir();
    case 'posicao':
      avisar(textoPosicao(casaEscrita));
      await fala.dizer(F(textoPosicao(), clipesPosicao()), true);
      return reouvir();
    case 'dica': return dica();
    case 'desfazer': return desfazer();
    case 'desistir':
      confirmarDesistencia = true;
      avisar('Diga “sim” para desistir.');
      await fala.dizer(F('Quer mesmo desistir? Diga sim para confirmar.', ['desistir']), true);
      return ouvinte.iniciar(true);
    case 'desistirConfirmado':
      confirmarDesistencia = false;
      return finalizar({ r: 'd', motivo: 'Desistência' });
    case 'ajuda':
      await fala.dizer(F('Fale a peça, a casa de saída e a casa de chegada. Por exemplo: cavalo de gê 1 para éfe 3. Você também pode dizer repetir, posição, dica ou desfazer.', ['ajuda']), true);
      return reouvir();
  }
}

async function dica() {
  if (!podeJogar()) return;
  const fen = game.fen();
  avisar('Procurando um bom lance…');
  const uci = await motor.buscar(fen, { skill: 20, depth: 12, time: 1500 });
  if (!uci || game.fen() !== fen || !emJogo) return;
  const m = game.moves({ verbose: true }).find(x => x.from === uci.slice(0, 2) && x.to === uci.slice(2, 4));
  if (!m) return;
  dicaCasas = [m.from, m.to]; vendo = null;
  desenharJogo();
  avisar('Dica: ' + textoDoLance(m, casaEscrita));
  await fala.dizer(F('Dica: ' + textoDoLance(m), ['dica', ...clipesLance(m)]), true);
  reouvir();
}

async function desfazer() {
  if (!emJogo || fimDeJogo) return;
  buscaId++;
  if (pensando) { motor.parar(); pensando = false; game.undo(); }
  else if (game.turn() === minhaCor) {
    if (game.history().length < 2) { avisar('Nada para desfazer.'); return; }
    game.undo(); game.undo();
  } else return;
  selecionada = null; dicaCasas = null; vendo = null;
  const ultimo = game.history({ verbose: true }).pop();
  ultimaFala = ultimo && ultimo.color !== minhaCor ? fraseLance(ultimo) : null;
  desenharJogo(); atualizarLances(); salvarPartida(); atualizarStatus();
  avisar('Lance desfeito. Volte as peças no tabuleiro.');
  await fala.dizer(F('Lance desfeito. Volte as peças no tabuleiro. Sua vez.', ['desfeito']), true);
  reouvir();
}

function salvarPartida() {
  if (game && !fimDeJogo) store.set('partida', { pgn: game.pgn(), cor: minhaCor, elo: nivel.elo });
}

async function comecar(continuar) {
  analise.id++;
  try { ctxAudio().resume(); } catch {}
  if (fala.gravada) clipes.preCarregar();
  for (const s of ['mover', 'capturar', 'xeque', 'vitoria', 'derrota', 'empate']) carregarAudio(`sons/${s}.mp3`);
  $('#barraFim').hidden = true;
  $('.voz').hidden = false;
  const salva = continuar ? store.get('partida', null) : null;
  game = new Chess();
  if (salva && game.load_pgn(salva.pgn)) {
    minhaCor = salva.cor;
    nivel = NIVEIS.find(n => n.elo === salva.elo) || nivel;
  } else {
    game = new Chess();
    minhaCor = config.cor === 'x' ? (Math.random() < 0.5 ? 'w' : 'b') : config.cor;
    nivel = NIVEIS.find(n => n.elo === config.elo) || NIVEIS[2];
    store.del('partida');
  }
  motor.iniciar(); motor.novoJogo();
  emJogo = true; fimDeJogo = false; pensando = false; buscaId++;
  selecionada = null; dicaCasas = null; confirmarDesistencia = false; ouvinte.falhas = 0; vendo = null;
  const ultimo = game.history({ verbose: true }).pop();
  ultimaFala = ultimo && ultimo.color !== minhaCor ? fraseLance(ultimo) : null;

  mostrarTela('jogo');
  $('#nomeOponente').textContent = `Computador ${nivel.elo}`;
  $('#infoPartida').textContent = `Você joga de ${minhaCor === 'w' ? 'brancas' : 'pretas'}`;
  mostrarOuvido('');
  desenharJogo(); atualizarLances(); atualizarMic();
  manterTelaLigada();
  if (!motor.worker) avisar('Não consegui iniciar o motor. O computador vai jogar lances aleatórios.');

  const corTexto = `Você joga de ${minhaCor === 'w' ? 'brancas' : 'pretas'}.`;
  const saudacao = salva
    ? F(`Continuando. ${corTexto}` + (ultimaFala ? ` Meu último lance foi: ${ultimaFala.texto}` : ''),
      ['continuando', 'joga_' + minhaCor, ...(ultimaFala ? ['meu_ultimo', ...ultimaFala.clipes] : [])])
    : F(`Nível ${nivel.elo}. ${corTexto}`, ['nivel_' + nivel.elo, 'joga_' + minhaCor]);
  await fala.dizer(saudacao, true);
  if (!emJogo) return;
  if (game.turn() !== minhaCor) vezDoComputador();
  else reouvir();
}

function irParaInicio() {
  emJogo = false; buscaId++; pensando = false; analise.id++;
  if (motor.worker) motor.parar();
  ouvinte.parar(); fala.calar();
  liberarTela();
  mostrarTela('inicio');
  desenharInicio();
}

function mostrarTela(qual) {
  for (const id of ['inicio', 'jogo', 'analise']) $('#' + id).hidden = id !== qual;
  window.scrollTo(0, 0);
}

// ---------- Tabuleiro ----------

function casaDoRei(pos, cor) {
  for (const f of COLUNAS) for (let r = 1; r <= 8; r++) {
    const p = pos.get(f + r);
    if (p && p.type === 'k' && p.color === cor) return f + r;
  }
  return null;
}

function posTela(sq, virar) {
  const f = COLUNAS.indexOf(sq[0]), r = +sq[1];
  return virar ? [7 - f, r - 1] : [f, 8 - r];
}

function desenharTabuleiro(tab, { pos, ultimo, virar, selecionada: sel = null, alvos = [], marcadas = null, selo = null, seta = null, animarLance = null }) {
  const xeque = pos.in_check() ? casaDoRei(pos, pos.turn()) : null;
  const frag = document.createDocumentFragment();

  for (let lin = 0; lin < 8; lin++) for (let col = 0; col < 8; col++) {
    const f = virar ? 7 - col : col, r = virar ? lin + 1 : 8 - lin;
    const sq = COLUNAS[f] + r;
    const el = document.createElement('div');
    el.className = 'casa ' + ((f + r) % 2 ? 'escura' : 'clara');
    el.dataset.casa = sq;
    if (ultimo && (sq === ultimo.from || sq === ultimo.to)) el.classList.add('ultimo');
    if (sq === sel) el.classList.add('sel');
    if (marcadas && marcadas.includes(sq)) el.classList.add('dica');
    if (sq === xeque) el.classList.add('xeque');
    const alvo = alvos.find(m => m.to === sq);
    if (alvo) el.classList.add(alvo.captured ? 'alvo-captura' : 'alvo');
    if (col === 0) el.insertAdjacentHTML('beforeend', `<span class="coord r">${r}</span>`);
    if (lin === 7) el.insertAdjacentHTML('beforeend', `<span class="coord f">${COLUNAS[f]}</span>`);
    const p = pos.get(sq);
    if (p) {
      const img = document.createElement('img');
      img.src = `pieces/${p.color}${p.type.toUpperCase()}.svg`;
      img.alt = NOME[p.type];
      img.draggable = false;
      el.appendChild(img);
    }
    if (selo && selo.casa === sq) {
      const c = CLASSES[selo.classe];
      el.insertAdjacentHTML('beforeend', `<span class="selo" style="background:${c.cor}" title="${c.nome}">${c.simbolo}</span>`);
    }
    frag.appendChild(el);
  }
  if (seta) frag.appendChild(desenharSeta(seta.from, seta.to, virar));
  tab.replaceChildren(frag);
  if (animarLance && !matchMedia('(prefers-reduced-motion: reduce)').matches) animar(tab, animarLance, virar);
}

function desenharSeta(de, para, virar) {
  const [x1, y1] = posTela(de, virar).map(v => v + 0.5);
  const [x2, y2] = posTela(para, virar).map(v => v + 0.5);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const haste = 0.11, cabecaL = 0.28, cabecaC = 0.42;
  const bx = x2 - ux * cabecaC, by = y2 - uy * cabecaC;
  const sx = x1 + ux * 0.25, sy = y1 + uy * 0.25;
  const pts = [
    [sx + px * haste, sy + py * haste], [bx + px * haste, by + py * haste], [bx + px * cabecaL, by + py * cabecaL],
    [x2, y2], [bx - px * cabecaL, by - py * cabecaL], [bx - px * haste, by - py * haste], [sx - px * haste, sy - py * haste],
  ];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 8 8');
  svg.setAttribute('class', 'seta');
  svg.innerHTML = `<path d="M${pts.map(p => p.map(v => v.toFixed(3)).join(' ')).join('L')}Z"/>`;
  return svg;
}

function animar(tab, m, virar) {
  const pares = [[m.from, m.to]];
  const fileira = m.color === 'w' ? '1' : '8';
  if (m.flags.includes('k')) pares.push(['h' + fileira, 'f' + fileira]);
  if (m.flags.includes('q')) pares.push(['a' + fileira, 'd' + fileira]);
  for (const [de, para] of pares) {
    const el = tab.querySelector(`[data-casa="${para}"]`);
    const img = el && el.querySelector('img');
    if (!img) continue;
    const [x1, y1] = posTela(de, virar), [x2, y2] = posTela(para, virar);
    el.style.zIndex = 3;
    img.style.transition = 'none';
    img.style.transform = `translate(${(x1 - x2) * 100}%, ${(y1 - y2) * 100}%)`;
    img.getBoundingClientRect();
    img.style.transition = 'transform 260ms cubic-bezier(.2,.8,.25,1)';
    img.style.transform = 'translate(0, 0)';
    img.addEventListener('transitionend', () => { el.style.zIndex = ''; }, { once: true });
  }
}

function desenharJogo(animarLance) {
  const lances = game.history({ verbose: true });
  const k = vendo == null ? lances.length : vendo;
  const aoVivo = vendo == null;
  desenharTabuleiro($('#tabuleiro'), {
    pos: aoVivo ? game : posicaoApos(lances, k),
    ultimo: lances[k - 1],
    virar: minhaCor === 'b',
    selecionada: aoVivo ? selecionada : null,
    alvos: aoVivo && selecionada ? game.moves({ square: selecionada, verbose: true }) : [],
    marcadas: aoVivo ? dicaCasas : null,
    animarLance,
  });
  const aviso = $('#vendoAviso');
  aviso.hidden = aoVivo;
  if (!aoVivo) aviso.textContent = `Revendo o lance ${k} de ${lances.length}. Toque no tabuleiro para voltar à posição atual.`;
  atualizarNav($('#navJogo'), k, lances.length);
  marcarLanceAtual($('#lances'), k);
}

function irParaJogo(destino) {
  const n = game.history().length;
  const atual = vendo == null ? n : vendo;
  const k = { inicio: 0, anterior: atual - 1, proximo: atual + 1, fim: n }[destino] ?? +destino;
  const alvo = Math.max(0, Math.min(n, k));
  if (alvo === atual) return;
  vendo = alvo >= n ? null : alvo;
  const lances = game.history({ verbose: true });
  desenharJogo(alvo === atual + 1 ? lances[alvo - 1] : null);
  if (alvo === atual + 1) tocarLance(lances[alvo - 1]);
}

function atualizarNav(nav, k, n) {
  nav.querySelector('[data-ir="inicio"]').disabled = k <= 0;
  nav.querySelector('[data-ir="anterior"]').disabled = k <= 0;
  nav.querySelector('[data-ir="proximo"]').disabled = k >= n;
  nav.querySelector('[data-ir="fim"]').disabled = k >= n;
}

function marcarLanceAtual(ol, k) {
  let atual = null;
  ol.querySelectorAll('button[data-k]').forEach(b => {
    const sim = +b.dataset.k === k;
    b.setAttribute('aria-current', String(sim));
    if (sim) atual = b;
  });
  if (atual) atual.scrollIntoView({ block: 'nearest', inline: 'center' });
  else if (k === 0) ol.scrollLeft = 0;
}

$('#tabuleiro').addEventListener('click', e => {
  if (vendo != null) { vendo = null; desenharJogo(); return; }
  const el = e.target.closest('.casa');
  if (!el || !podeJogar()) return;
  const sq = el.dataset.casa;
  if (selecionada) {
    const ms = game.moves({ square: selecionada, verbose: true }).filter(m => m.to === sq);
    if (ms.length) { ouvinte.parar(); return jogarMeuLance(ms.find(m => !m.promotion || m.promotion === 'q'), false); }
  }
  const p = game.get(sq);
  selecionada = p && p.color === minhaCor && sq !== selecionada ? sq : null;
  desenharJogo();
});

// ---------- Análise ----------

const analise = { id: 0, lances: [], posicoes: [], avals: [], classes: [], indice: 0, cor: 'w', elo: 0, pronta: false };

// Chance de vitória (0–100) a partir da avaliação em centipeões, como no Lichess
function chance(s) {
  if (s.tipo === 'mate') return s.valor > 0 ? 100 : 0;
  const cp = Math.max(-2000, Math.min(2000, s.valor));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

async function avaliarPosicao(fen) {
  const g = new Chess(fen);
  const vezBrancas = g.turn() === 'w';
  if (g.in_checkmate()) return { brancas: vezBrancas ? 0 : 100, nota: { tipo: 'mate', valor: 0, vencedorBrancas: !vezBrancas }, legais: 0 };
  if (g.game_over()) return { brancas: 50, nota: { tipo: 'cp', valor: 0 }, legais: g.moves().length };
  const r = await motor.analisar(fen);
  if (!r || !r.linhas.length) return null;
  const [l1, l2] = r.linhas;
  const c1 = chance(l1);
  return {
    brancas: vezBrancas ? c1 : 100 - c1,
    segunda: l2 ? chance(l2) : null, // do ponto de vista de quem joga
    melhor: r.best,
    nota: { tipo: l1.tipo, valor: vezBrancas ? l1.valor : -l1.valor },
    legais: g.moves().length,
  };
}

function ehSacrificio(fen, m) {
  if (m.piece === 'p' || m.piece === 'k') return false;
  const g = new Chess(fen);
  g.move(m.san);
  const v = VALOR[m.promotion || m.piece];
  const ganho = m.captured ? VALOR[m.captured] : 0;
  const capturas = g.moves({ verbose: true }).filter(x => x.to === m.to);
  if (!capturas.length) return false;
  const menor = capturas.reduce((a, b) => (VALOR[a.piece] <= VALOR[b.piece] ? a : b));
  g.move(menor.san);
  const retoma = g.moves({ verbose: true }).some(x => x.to === m.to);
  return ganho - v + (retoma ? VALOR[menor.piece] : 0) <= -2;
}

function classificar(i) {
  const { lances, posicoes, avals, classes } = analise;
  const m = lances[i], a = avals[i], d = avals[i + 1];
  const brancas = m.color === 'w';
  const antes = brancas ? a.brancas : 100 - a.brancas;
  const depois = brancas ? d.brancas : 100 - d.brancas;
  const perda = Math.max(0, antes - depois);
  const jogouMelhor = a.melhor === m.from + m.to + (m.promotion || '');
  const anterior = classes[i - 1] && classes[i - 1].k;
  let k;
  if (a.legais === 1) k = 'forcado';
  else if (jogouMelhor || perda < 1) {
    const recaptura = i > 0 && m.captured && lances[i - 1].captured && lances[i - 1].to === m.to;
    if (ehSacrificio(posicoes[i], m) && depois >= 45 && antes < 97) k = 'brilhante';
    else if (jogouMelhor && !recaptura && a.segunda != null && antes - a.segunda >= 15 && antes < 97) k = 'otimo';
    else k = jogouMelhor ? 'melhor' : 'excelente';
  }
  else if (perda < 2) k = 'excelente';
  else if (perda < 5) k = 'bom';
  else if (perda < 10) k = 'imprecisao';
  else if (perda < 20) k = 'erro';
  else k = 'capivarada';
  if (perda >= 10 && depois >= 40 && (anterior === 'erro' || anterior === 'capivarada')) k = 'perdida';
  return { k, perda };
}

function precisao(cor) {
  const ps = analise.classes.filter((c, i) => c && analise.lances[i].color === cor);
  if (!ps.length) return null;
  const soma = ps.reduce((t, c) => t + Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * c.perda) - 3.1669)), 0);
  return soma / ps.length;
}

async function abrirAnalise(partida) {
  if (!partida || !partida.sans || !partida.sans.length) return;
  emJogo = false; buscaId++; ouvinte.parar(); fala.calar(); liberarTela();
  const id = ++analise.id;
  const g = new Chess();
  const posicoes = [g.fen()];
  const lances = [];
  for (const san of partida.sans) { const m = g.move(san); if (!m) break; lances.push(m); posicoes.push(g.fen()); }
  Object.assign(analise, { lances, posicoes, avals: [], classes: [], indice: lances.length, cor: partida.cor, elo: partida.elo, pronta: false });

  mostrarTela('analise');
  const res = partida.r ? { v: 'Vitória', e: 'Empate', d: 'Derrota' }[partida.r] + ' ' + (MOTIVO[partida.motivo] || '') : '';
  $('#anInfo').textContent = `Contra o ${partida.elo}${res ? ' · ' + res : ''}`;
  $('#precPcNome').textContent = `Computador ${partida.elo}`;
  $('#anProgresso').hidden = false; $('#anPrecisao').hidden = true;
  desenharAnalise();
  motor.iniciar();

  for (let i = 0; i < posicoes.length; i++) {
    $('#anProgressoTexto').textContent = `Analisando lance ${i} de ${lances.length}…`;
    $('#anProgressoBarra').style.width = `${(i / posicoes.length) * 100}%`;
    let a = await avaliarPosicao(posicoes[i]);
    if (id !== analise.id) return;
    if (!a) a = { brancas: analise.avals[i - 1] ? analise.avals[i - 1].brancas : 50, nota: null, legais: 2 };
    analise.avals[i] = a;
    if (i > 0) analise.classes[i - 1] = classificar(i - 1);
    desenharAnalise();
  }
  analise.pronta = true;
  $('#anProgresso').hidden = true; $('#anPrecisao').hidden = false;
  const minha = precisao(analise.cor), dele = precisao(analise.cor === 'w' ? 'b' : 'w');
  $('#precVoce').textContent = minha == null ? '–' : minha.toFixed(1).replace('.', ',');
  $('#precPc').textContent = dele == null ? '–' : dele.toFixed(1).replace('.', ',');
  desenharAnalise();
  if (minha != null) fala.dizer(F(`Análise pronta. Sua precisão foi de ${Math.round(minha)} por cento.`, ['analise_pronta']));
}

function textoNota(nota) {
  if (!nota) return '';
  if (nota.tipo === 'mate') {
    if (nota.valor === 0) return nota.vencedorBrancas ? '1-0' : '0-1';
    return (nota.valor > 0 ? '' : '-') + 'M' + Math.abs(nota.valor);
  }
  const v = nota.valor / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',');
}

function comentarioAtual() {
  const k = analise.indice;
  if (k === 0) return { titulo: 'Posição inicial', detalhe: 'Use as setas para ver cada lance.' };
  const m = analise.lances[k - 1];
  const c = analise.classes[k - 1];
  const quem = m.color === analise.cor ? 'Você' : 'Computador';
  if (!c) return { titulo: `${sanPt(m.san)}`, detalhe: 'Ainda analisando este lance…' };
  const info = CLASSES[c.k];
  let detalhe = (quem === 'Você' ? 'Seu lance.' : 'Lance do computador.') + (DETALHE[c.k] ? ' ' + DETALHE[c.k] : '');
  const a = analise.avals[k - 1];
  const naoFoiMelhor = a && a.melhor && a.melhor !== m.from + m.to + (m.promotion || '');
  let melhor = null;
  if (naoFoiMelhor && !['brilhante', 'melhor', 'forcado'].includes(c.k)) {
    const g = new Chess(analise.posicoes[k - 1]);
    melhor = g.move({ from: a.melhor.slice(0, 2), to: a.melhor.slice(2, 4), promotion: a.melhor[4] || 'q' });
    if (melhor) detalhe += ` O melhor era ${sanPt(melhor.san)}.`;
  }
  return { titulo: info.frase(sanPt(m.san)), detalhe: detalhe.trim(), classe: c.k, quem, melhor };
}

function desenharAnalise() {
  const { lances, posicoes, avals, classes, indice: k, cor } = analise;
  const virar = cor === 'b';
  const c = classes[k - 1];
  const a = avals[k - 1];
  const m = lances[k - 1];
  let seta = null;
  if (m && c && a && a.melhor && !['brilhante', 'melhor', 'forcado'].includes(c.k) && a.melhor !== m.from + m.to + (m.promotion || '')) {
    seta = { from: a.melhor.slice(0, 2), to: a.melhor.slice(2, 4) };
  }
  desenharTabuleiro($('#anTabuleiro'), {
    pos: new Chess(posicoes[k]), ultimo: m, virar,
    selo: m && c ? { casa: m.to, classe: c.k } : null, seta,
  });

  // Barra de avaliação
  const av = avals[k];
  const barra = $('#barraAval');
  barra.classList.toggle('virada', virar);
  barra.firstElementChild.style.height = `${av ? av.brancas : 50}%`;
  const nota = $('#anAval');
  nota.hidden = !av || !av.nota;
  if (av && av.nota) nota.textContent = textoNota(av.nota);

  const com = comentarioAtual();
  $('#anTitulo').textContent = com.titulo;
  $('#anDetalhe').textContent = com.detalhe;
  const selo = $('#anSelo');
  selo.hidden = !com.classe;
  if (com.classe) { selo.textContent = CLASSES[com.classe].simbolo; selo.style.background = CLASSES[com.classe].cor; }

  // Lista de lances com selos
  let html = '';
  for (let i = 0; i < lances.length; i += 2) {
    html += `<li><b>${i / 2 + 1}.</b>`;
    for (const j of [i, i + 1]) {
      if (!lances[j]) continue;
      const cj = classes[j] && CLASSES[classes[j].k];
      const s = cj && !['melhor', 'excelente', 'bom', 'forcado'].includes(classes[j].k)
        ? `<span class="selo selo-mini" style="background:${cj.cor}">${cj.simbolo}</span>` : '';
      html += `<button data-k="${j + 1}">${s}${esc(sanPt(lances[j].san))}</button>`;
    }
    html += '</li>';
  }
  const ol = $('#anLances');
  ol.innerHTML = html;
  marcarLanceAtual(ol, k);
  atualizarNav($('#navAnalise'), k, lances.length);
  $('#navAnalise [data-ir="destaque"]').disabled = proximoDestaque() == null;
  desenharGrafico();
  desenharResumo();
}

function desenharGrafico() {
  const { avals, classes, indice, lances } = analise;
  const svg = $('#grafico');
  const W = 300, H = 72, n = lances.length;
  const x = i => (n ? (i / n) * W : 0);
  const y = v => H - (v / 100) * H;
  const pts = avals.map((a, i) => `${x(i).toFixed(1)},${y(a.brancas).toFixed(1)}`);
  let s = `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#6b7066" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  if (pts.length) s += `<polygon points="0,${H} ${pts.join(' ')} ${x(avals.length - 1).toFixed(1)},${H}" fill="#f2f0ea"/>`;
  classes.forEach((c, i) => {
    if (!c || !['erro', 'capivarada', 'perdida', 'brilhante'].includes(c.k)) return;
    s += `<circle cx="${x(i + 1).toFixed(1)}" cy="${y(avals[i + 1].brancas).toFixed(1)}" r="3.2" fill="${CLASSES[c.k].cor}" stroke="#20241e" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  });
  s += `<line x1="${x(indice).toFixed(1)}" y1="0" x2="${x(indice).toFixed(1)}" y2="${H}" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--acento').trim()}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  svg.innerHTML = s;
}

function desenharResumo() {
  const { classes, lances, cor } = analise;
  const conta = { w: {}, b: {} };
  classes.forEach((c, i) => { if (c) conta[lances[i].color][c.k] = (conta[lances[i].color][c.k] || 0) + 1; });
  const outra = cor === 'w' ? 'b' : 'w';
  let html = '<tr><td>Você</td><td></td><td>PC</td></tr>';
  for (const [k, info] of Object.entries(CLASSES)) {
    const a = conta[cor][k] || 0, b = conta[outra][k] || 0;
    const atual = analise.classes[analise.indice - 1];
    const marcada = atual && atual.k === k ? ' atual' : '';
    html += (a || b
      ? `<tr data-classe="${k}" class="clicavel${marcada}" title="Ver os lances: ${info.nome}">`
      : '<tr class="zero">')
      + `<td style="color:${a ? info.cor : ''}">${a}</td>`
      + `<td class="nome-cel"><span class="nome"><span class="selo selo-mini" style="background:${info.cor}">${info.simbolo}</span>${info.nome}</span></td>`
      + `<td style="color:${b ? info.cor : ''}">${b}</td></tr>`;
  }
  $('#anTabela').innerHTML = html;
}

// Lances que merecem atenção na revisão (a seta "próximo destaque" e os toques na tabela pulam para eles)
const DESTAQUES = ['brilhante', 'otimo', 'imprecisao', 'erro', 'perdida', 'capivarada'];

function proximoDestaque() {
  const i = analise.classes.findIndex((c, j) => j >= analise.indice && c && DESTAQUES.includes(c.k));
  return i < 0 ? null : i + 1;
}

function irParaAnalise(destino) {
  const n = analise.lances.length, atual = analise.indice;
  const k = { inicio: 0, anterior: atual - 1, proximo: atual + 1, fim: n, destaque: proximoDestaque() ?? atual }[destino] ?? +destino;
  const alvo = Math.max(0, Math.min(n, k));
  if (alvo === atual) return;
  analise.indice = alvo;
  desenharAnalise();
  if (alvo === atual + 1) animar($('#anTabuleiro'), analise.lances[alvo - 1], analise.cor === 'b');
  if (alvo > 0 && alvo !== atual - 1) tocarLance(analise.lances[alvo - 1]);
}

// Toque numa linha da tabela: vai ao primeiro lance daquele tipo; tocando de novo, ao seguinte
function irParaClasse(k) {
  const lista = [];
  analise.classes.forEach((c, i) => { if (c && c.k === k) lista.push(i + 1); });
  if (!lista.length) return;
  const alvo = lista.find(i => i > analise.indice) ?? lista[0];
  irParaAnalise(String(alvo));
  $('#anTabuleiro').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
}

$('#navAnalise').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) irParaAnalise(b.dataset.ir); });
$('#anTabela').addEventListener('click', e => { const tr = e.target.closest('tr[data-classe]'); if (tr) irParaClasse(tr.dataset.classe); });
$('#anLances').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) irParaAnalise(b.dataset.k); });
$('#grafico').addEventListener('click', e => {
  const r = e.currentTarget.getBoundingClientRect();
  irParaAnalise(String(Math.round(((e.clientX - r.left) / r.width) * analise.lances.length)));
});
$('#anFalar').addEventListener('click', () => {
  const c = comentarioAtual();
  const m = analise.lances[analise.indice - 1];
  fala.calar();
  if (!m || !c.classe) { fala.dizer(c.titulo + '. ' + c.detalhe, true); return; }
  const partes = [`${c.quem}: ${textoDoLance(m)}.`, `${CLASSES[c.classe].nome}.`, DETALHE[c.classe] || ''];
  const cl = [c.quem === 'Você' ? 'voce' : 'computador', ...clipesLance(m), 'cl_' + c.classe];
  if (DETALHE[c.classe]) cl.push('det_' + c.classe);
  if (c.melhor) { partes.push(`O melhor era ${textoDoLance(c.melhor)}.`); cl.push('o_melhor_era', ...clipesLance(c.melhor)); }
  fala.dizer(F(partes.join(' '), cl), true);
});
$('#sairAnalise').addEventListener('click', irParaInicio);

// Setas do teclado (no computador) para navegar
document.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.target.closest('input, select')) return;
  const d = { ArrowLeft: 'anterior', ArrowRight: 'proximo', Home: 'inicio', End: 'fim' }[e.key];
  if (!$('#analise').hidden) irParaAnalise(d);
  else if (!$('#jogo').hidden && game) irParaJogo(d);
});

// ---------- Som ----------

// Efeitos gravados em sons/*.mp3; sem o arquivo, cai no "toc" sintetizado
async function tocarSom(nome) {
  const ctx = ctxAudio();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
  const b = await carregarAudio(`sons/${nome}.mp3`);
  if (!b) { if (['mover', 'capturar', 'xeque'].includes(nome)) tocar(nome === 'capturar'); return; }
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start();
}
const tocarLance = m => tocarSom(/[+#]/.test(m.san) ? 'xeque' : m.captured ? 'capturar' : 'mover');

function tocar(captura) {
  try {
    const audio = ctxAudio();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(captura ? 560 : 330, t);
    o.frequency.exponentialRampToValueAtTime(captura ? 160 : 110, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(captura ? 0.6 : 0.45, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (captura ? 0.18 : 0.12));
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + 0.2);
  } catch {}
}

// ---------- Interface ----------

function avisar(msg) { const el = $('#ouvido'); el.classList.remove('parcial'); el.textContent = msg; }
function mostrarOuvido(t, parcial = false) {
  const el = $('#ouvido');
  el.classList.toggle('parcial', parcial);
  el.textContent = t ? `Ouvi: “${t}”` : '';
}

function atualizarStatus() {
  let s;
  if (fimDeJogo) s = 'Fim de partida';
  else if (pensando) s = 'Computador pensando…';
  else if (game && game.turn() === minhaCor) s = ouvinte.ativo ? 'Pode falar seu lance' : 'Sua vez';
  else s = 'Vez do computador';
  $('#status').textContent = s;
  const bloqueado = !emJogo || fimDeJogo;
  for (const id of ['#aDica', '#aDesfazer', '#aDesistir']) $(id).disabled = bloqueado;
}

function atualizarMic() {
  const mic = $('#mic');
  mic.setAttribute('aria-pressed', String(ouvinte.ativo));
  mic.setAttribute('aria-label', ouvinte.ativo ? 'Parar de ouvir' : 'Falar lance');
  mic.disabled = !SR;
  if (emJogo) atualizarStatus();
}

function atualizarLances() {
  const h = game.history();
  let html = '';
  for (let i = 0; i < h.length; i += 2) {
    html += `<li><b>${i / 2 + 1}.</b><button data-k="${i + 1}">${esc(sanPt(h[i]))}</button>`;
    if (h[i + 1]) html += `<button data-k="${i + 2}">${esc(sanPt(h[i + 1]))}</button>`;
    html += '</li>';
  }
  const ol = $('#lances');
  ol.innerHTML = html;
  marcarLanceAtual(ol, vendo == null ? h.length : vendo);
  atualizarNav($('#navJogo'), vendo == null ? h.length : vendo, h.length);
}

function abrirModal({ titulo, motivo, texto, tipo, img, botoes, fechavel = false }) {
  $('#modalFechar').hidden = !fechavel;
  $('#modal').dataset.fechavel = fechavel ? '1' : '';
  const t = $('#modalTitulo');
  t.textContent = titulo;
  t.className = tipo || '';
  $('#modalMotivo').textContent = motivo ? motivo[0].toUpperCase() + motivo.slice(1) : '';
  $('#modalTexto').textContent = texto;
  $('#modalImg').src = img;
  const box = $('#modalBotoes');
  box.replaceChildren(...botoes.map(b => {
    const el = document.createElement('button');
    el.className = b.principal ? 'botao-principal' : 'botao-secundario';
    el.textContent = b.rotulo;
    el.addEventListener('click', b.acao);
    return el;
  }));
  $('#modal').hidden = false;
}
function fecharModal() { $('#modal').hidden = true; }
$('#modalFechar').addEventListener('click', fecharModal);
// Tocar fora do popup ou apertar Esc também fecha, quando ele pode ser fechado
$('#modal').addEventListener('click', e => { if (e.target === e.currentTarget && e.currentTarget.dataset.fechavel) fecharModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden && $('#modal').dataset.fechavel) fecharModal(); });

async function manterTelaLigada() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function liberarTela() { try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && emJogo) manterTelaLigada();
});

// ---------- Tela inicial ----------

function preencherVozes() {
  const sel = $('#optVoz');
  const todas = fala.vozes();
  const pt = todas.filter(v => /^pt/i.test(v.lang || ''));
  const lista = pt.length ? pt : todas;
  sel.innerHTML = Object.entries(VOZES_GRAVADAS).map(([id, v]) => `<option value="${id}">${v.nome} (gravada)</option>`).join('')
    + `<option value="">Voz do celular: automática</option>`
    + lista.map(v => `<option value="${esc(v.name)}">${esc(v.name)}${v.lang ? ' · ' + esc(v.lang) : ''}</option>`).join('');
  sel.value = fala.gravada || lista.some(v => v.name === config.voz) ? config.voz : '';
  // Velocidade e tom só mudam as vozes do celular
  $('#optVel').closest('label').hidden = fala.gravada;
  $('#optTom').closest('label').hidden = fala.gravada;
}

function desenharInicio() {
  const placar = store.get('placar', {});
  $('#niveis').innerHTML = NIVEIS.map(n => {
    const s = placar[n.elo];
    const rec = s ? `${s.v}V ${s.e}E ${s.d}D` : '—';
    return `<button class="nivel" data-elo="${n.elo}" aria-pressed="${n.elo === config.elo}"><strong>${n.elo}</strong><small>${rec}</small></button>`;
  }).join('');
  const sel = NIVEIS.find(n => n.elo === config.elo) || NIVEIS[2];
  $('#nivelDesc').textContent = sel.desc;
  document.querySelectorAll('#cores button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cor === config.cor)));
  $('#optFalar').checked = config.falar;
  $('#optOuvir').checked = config.ouvirAuto;
  $('#optEco').checked = config.eco;
  $('#optVel').value = config.vel; $('#valVel').textContent = Number(config.vel).toFixed(2).replace('.', ',') + '×';
  $('#optTom').value = config.tom; $('#valTom').textContent = Number(config.tom).toFixed(2).replace('.', ',');
  preencherVozes();

  const salva = store.get('partida', null);
  const cont = $('#continuar');
  cont.hidden = !salva;
  if (salva) cont.textContent = `Continuar partida contra o ${salva.elo} (${salva.cor === 'w' ? 'brancas' : 'pretas'})`;
  const ultima = store.get('ultima', null);
  $('#analisarUltima').hidden = !(ultima && ultima.sans && ultima.sans.length);

  const avisos = [];
  if (!SR) avisos.push('Este navegador não reconhece voz. No celular, abra no Google Chrome.');
  if (!window.isSecureContext) avisos.push('O microfone só funciona em endereço https.');
  const box = $('#avisoNavegador');
  box.hidden = !avisos.length;
  box.textContent = avisos.join(' ');
}

$('#niveis').addEventListener('click', e => {
  const b = e.target.closest('.nivel');
  if (!b) return;
  config.elo = +b.dataset.elo; salvarConfig(); desenharInicio();
});
$('#cores').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  config.cor = b.dataset.cor; salvarConfig(); desenharInicio();
});
$('#optFalar').addEventListener('change', e => { config.falar = e.target.checked; salvarConfig(); });
$('#optOuvir').addEventListener('change', e => { config.ouvirAuto = e.target.checked; salvarConfig(); });
$('#optEco').addEventListener('change', e => { config.eco = e.target.checked; salvarConfig(); });
$('#optVoz').addEventListener('change', e => {
  config.voz = e.target.value; salvarConfig(); fala.escolherVoz(); preencherVozes();
  if (fala.gravada) clipes.preCarregar();
});
$('#optVel').addEventListener('input', e => { config.vel = +e.target.value; salvarConfig(); $('#valVel').textContent = config.vel.toFixed(2).replace('.', ',') + '×'; });
$('#optTom').addEventListener('input', e => { config.tom = +e.target.value; salvarConfig(); $('#valTom').textContent = config.tom.toFixed(2).replace('.', ','); });
$('#testarVoz').addEventListener('click', () => {
  fala.calar();
  try { ctxAudio().resume(); } catch {}
  fala.dizer(F('Cavalo de gê 1 para éfe 3. Xeque.', ['cavalo_de', 'c_g1', 'para', 'c_f3', 'xeque']), true);
});
$('#comecar').addEventListener('click', () => comecar(false));
$('#continuar').addEventListener('click', () => comecar(true));
$('#analisarUltima').addEventListener('click', () => abrirAnalise(store.get('ultima', null)));

// ---------- Botões do jogo ----------

$('#mic').addEventListener('click', () => {
  if (ouvinte.ativo) { ouvinte.parar(); return; }
  fala.calar();
  ouvinte.bloqueado = false;
  ouvinte.iniciar(true);
});
$('#voltar').addEventListener('click', irParaInicio);
$('#cego').addEventListener('click', e => {
  const b = e.currentTarget;
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on));
  $('#tabuleiro').classList.toggle('cego', on);
});
$('#navJogo').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b && game) irParaJogo(b.dataset.ir); });
$('#lances').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b && game) irParaJogo(b.dataset.k); });
$('#aRepetir').addEventListener('click', () => comando('repetir'));
$('#aPosicao').addEventListener('click', () => comando('posicao'));
$('#aDica').addEventListener('click', dica);
$('#aDesfazer').addEventListener('click', desfazer);
$('#aDesistir').addEventListener('click', () => {
  abrirModal({ titulo: 'Desistir?', motivo: '', texto: 'A partida conta como derrota neste nível.', tipo: 'd', img: `pieces/${minhaCor}K.svg`, fechavel: true, botoes: [
    { rotulo: 'Continuar jogando', principal: true, acao: fecharModal },
    { rotulo: 'Desistir', acao: () => { fecharModal(); finalizar({ r: 'd', motivo: 'Desistência' }); } },
  ] });
});

desenharInicio();
