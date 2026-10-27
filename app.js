'use strict';

// ---------- Dados ----------

const COLUNAS = 'abcdefgh';
const NOME = { k: 'Rei', q: 'Rainha', r: 'Torre', b: 'Bispo', n: 'Cavalo', p: 'Peão' };
const PLURAL = { k: 'Reis', q: 'Rainhas', r: 'Torres', b: 'Bispos', n: 'Cavalos', p: 'Peões' };
const FEMININO = { q: true, r: true };
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

// Reconhecimento: palavras (sem acento) que valem como coluna, número e peça
const LETRAS = { a: 'a', ah: 'a', ha: 'a', b: 'b', be: 'b', bi: 'b', c: 'c', ce: 'c', se: 'c', si: 'c', d: 'd', de: 'd', di: 'd',
  e: 'e', eh: 'e', f: 'f', ef: 'f', efe: 'f', g: 'g', ge: 'g', je: 'g', gue: 'g', h: 'h', aga: 'h', haga: 'h' };
const NUMEROS = { 1: 1, um: 1, uma: 1, hum: 1, 2: 2, dois: 2, duas: 2, 3: 3, tres: 3, 4: 4, quatro: 4, 5: 5, cinco: 5,
  6: 6, seis: 6, 7: 7, sete: 7, 8: 8, oito: 8 };
const PECAS = { rei: 'k', rainha: 'q', raina: 'q', dama: 'q', torre: 'r', bispo: 'b', cavalo: 'n', peao: 'p', piao: 'p', peoes: 'p' };

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const store = {
  get(k, padrao) { try { const v = localStorage.getItem('xv:' + k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } },
  set(k, v) { try { localStorage.setItem('xv:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('xv:' + k); } catch {} },
};

const config = Object.assign({ elo: 800, cor: 'w', falar: true, ouvirAuto: true, eco: true }, store.get('config', {}));
const salvarConfig = () => store.set('config', config);

let game = null, minhaCor = 'w', nivel = NIVEIS[2];
let pensando = false, fimDeJogo = false, emJogo = false, buscaId = 0;
let selecionada = null, dicaCasas = null, ultimaFala = '', confirmarDesistencia = false, wakeLock = null;

// ---------- Motor ----------

const motor = {
  worker: null, fila: [],
  iniciar() {
    if (this.worker) return;
    try {
      this.worker = new Worker('vendor/stockfish.js');
      this.worker.onmessage = e => {
        const linha = typeof e.data === 'string' ? e.data : '';
        if (linha.startsWith('bestmove')) { const cb = this.fila.shift(); if (cb) cb(linha.split(' ')[1]); }
      };
      this.worker.onerror = () => { this.worker = null; this.fila.splice(0).forEach(cb => cb(null)); };
      this.enviar('uci');
      this.enviar('setoption name Hash value 16');
      this.enviar('isready');
    } catch { this.worker = null; }
  },
  enviar(cmd) { if (this.worker) this.worker.postMessage(cmd); },
  buscar(fen, { skill, depth, time }) {
    if (!this.worker) return Promise.resolve(null);
    const resposta = new Promise(res => {
      this.fila.push(res);
      this.enviar('setoption name Skill Level value ' + skill);
      this.enviar('position fen ' + fen);
      this.enviar(`go depth ${depth} movetime ${time}`);
    });
    return Promise.race([resposta, sleep(time + 8000).then(() => null)]);
  },
  parar() { this.enviar('stop'); },
  novoJogo() { this.enviar('ucinewgame'); this.enviar('isready'); },
};

// ---------- Voz: falar ----------

const fala = {
  voz: null, fila: Promise.resolve(), pendentes: 0,
  get falando() { return this.pendentes > 0; },
  escolherVoz() {
    const vozes = speechSynthesis.getVoices();
    const pt = vozes.filter(v => (v.lang || '').replace('_', '-').toLowerCase().startsWith('pt-br'));
    this.voz = pt.find(v => /google/i.test(v.name)) || pt[0] || vozes.find(v => (v.lang || '').startsWith('pt')) || null;
  },
  dizer(texto, forcar = false) {
    if (!('speechSynthesis' in window) || (!config.falar && !forcar) || !texto) return Promise.resolve();
    ouvinte.parar();
    // Frases curtas: o Chrome do Android às vezes corta falas longas
    const partes = texto.split(/(?<=[.;!?])\s+/).filter(Boolean);
    this.pendentes++;
    this.fila = this.fila.then(async () => {
      for (const p of partes) await this.falarUma(p);
    }).finally(() => { this.pendentes--; });
    return this.fila;
  },
  falarUma(texto) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      if (this.voz) u.voice = this.voz;
      u.rate = 1.02;
      let feito = false;
      const fim = () => { if (!feito) { feito = true; res(); } };
      u.onend = fim; u.onerror = fim;
      speechSynthesis.speak(u);
      setTimeout(fim, 2500 + texto.length * 110);
    });
  },
  calar() { if ('speechSynthesis' in window) speechSynthesis.cancel(); },
};
if ('speechSynthesis' in window) {
  fala.escolherVoz();
  speechSynthesis.addEventListener('voiceschanged', () => fala.escolherVoz());
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
      await fala.dizer('Qual peça? O ' + quais + '?', true);
      return reouvir();
    }
    case 'ilegal':
      avisar('Esse lance não é possível nesta posição.');
      await fala.dizer('Esse lance não é possível. Repita, por favor.', true);
      return reouvir();
    default:
      avisar('Não entendi. Ex.: “peão de e2 para e4”.');
      await fala.dizer('Não entendi. Repita o lance.', true);
      return reouvir();
  }
}

function reouvir() { if (config.ouvirAuto && podeJogar()) ouvinte.iniciar(true); }

// ---------- Texto dos lances ----------

const falarCasa = sq => `${LETRA_FALADA[sq[0]]} ${sq[1]}`;
const juntar = (itens, conj = 'e') => itens.length < 2 ? itens.join('') : itens.slice(0, -1).join(', ') + ` ${conj} ` + itens[itens.length - 1];

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

// ---------- Partida ----------

const podeJogar = () => emJogo && !fimDeJogo && !pensando && game && game.turn() === minhaCor;

async function jogarMeuLance(m, porVoz) {
  const feito = game.move(m.san);
  if (!feito) return;
  selecionada = null; dicaCasas = null; confirmarDesistencia = false;
  desenhar(feito); tocar(feito.captured); atualizarLances(); salvarPartida();
  const res = resultado();
  const eco = config.eco && porVoz ? fala.dizer('Você: ' + textoDoLance(feito)) : null;
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
  const espera = 700 + Math.random() * 600 - (performance.now() - inicio);
  if (espera > 0) await sleep(espera);
  if (id !== buscaId || !emJogo) return;

  const feito = uci && game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
  pensando = false;
  if (!feito) { atualizarStatus(); return; }
  dicaCasas = null;
  desenhar(feito); tocar(feito.captured); atualizarLances(); salvarPartida();
  ultimaFala = textoDoLance(feito);
  avisar(textoDoLance(feito, c => c));
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
  atualizarStatus();

  const titulo = { v: 'Você venceu!', e: 'Empate', d: 'Você perdeu' }[r];
  const jogos = s.v + s.e + s.d;
  let texto = `${motivo}. Contra o nível ${nivel.elo} você tem ${s.v} ${s.v === 1 ? 'vitória' : 'vitórias'}, ${s.e} ${s.e === 1 ? 'empate' : 'empates'} e ${s.d} ${s.d === 1 ? 'derrota' : 'derrotas'}.`;
  const proximo = NIVEIS[NIVEIS.indexOf(nivel) + 1];
  if (proximo && jogos >= 3 && (s.v + s.e / 2) / jogos >= 0.6) texto += ` Que tal tentar o nível ${proximo.elo}?`;

  abrirFolha(titulo, texto, r, [
    { rotulo: 'Mudar nível', acao: () => { fecharFolha(); irParaInicio(); } },
    { rotulo: 'Jogar de novo', principal: true, acao: () => { fecharFolha(); comecar(false); } },
  ]);
  await fala.dizer(`${motivo}. ${titulo}`, true);
}

async function comando(nome) {
  switch (nome) {
    case 'repetir':
      if (ultimaFala) await fala.dizer(ultimaFala, true);
      else await fala.dizer('Ainda não joguei nesta partida.', true);
      return reouvir();
    case 'posicao':
      avisar(textoPosicao(c => c));
      await fala.dizer(textoPosicao(), true);
      return reouvir();
    case 'dica': return dica();
    case 'desfazer': return desfazer();
    case 'desistir':
      confirmarDesistencia = true;
      avisar('Diga “sim” para desistir.');
      await fala.dizer('Quer mesmo desistir? Diga sim para confirmar.', true);
      return ouvinte.iniciar(true);
    case 'desistirConfirmado':
      confirmarDesistencia = false;
      return finalizar({ r: 'd', motivo: 'Desistência' });
    case 'ajuda':
      await fala.dizer('Fale a peça, a casa de saída e a casa de chegada. Por exemplo: cavalo de gê 1 para éfe 3. Você também pode dizer repetir, posição, dica ou desfazer.', true);
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
  dicaCasas = [m.from, m.to];
  desenhar();
  avisar('Dica: ' + textoDoLance(m, c => c));
  await fala.dizer('Dica: ' + textoDoLance(m), true);
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
  selecionada = null; dicaCasas = null;
  const ultimo = game.history({ verbose: true }).pop();
  ultimaFala = ultimo && ultimo.color !== minhaCor ? textoDoLance(ultimo) : '';
  desenhar(); atualizarLances(); salvarPartida(); atualizarStatus();
  avisar('Lance desfeito. Volte as peças no tabuleiro.');
  await fala.dizer('Lance desfeito. Volte as peças no tabuleiro. Sua vez.', true);
  reouvir();
}

function salvarPartida() {
  if (game && !fimDeJogo) store.set('partida', { pgn: game.pgn(), cor: minhaCor, elo: nivel.elo });
}

async function comecar(continuar) {
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
  selecionada = null; dicaCasas = null; confirmarDesistencia = false; ouvinte.falhas = 0;
  const ultimo = game.history({ verbose: true }).pop();
  ultimaFala = ultimo && ultimo.color !== minhaCor ? textoDoLance(ultimo) : '';

  $('#inicio').hidden = true; $('#jogo').hidden = false;
  $('#nomeOponente').textContent = `Computador ${nivel.elo}`;
  $('#infoPartida').textContent = `Você joga de ${minhaCor === 'w' ? 'brancas' : 'pretas'}`;
  mostrarOuvido('');
  desenhar(); atualizarLances(); atualizarMic();
  manterTelaLigada();
  if (!motor.worker) avisar('Não consegui iniciar o motor. O computador vai jogar lances aleatórios.');

  const saudacao = salva
    ? `Continuando. Você joga de ${minhaCor === 'w' ? 'brancas' : 'pretas'}.` + (ultimaFala ? ` Meu último lance foi: ${ultimaFala}` : '')
    : `Nível ${nivel.elo}. Você joga de ${minhaCor === 'w' ? 'brancas' : 'pretas'}.`;
  await fala.dizer(saudacao, true);
  if (!emJogo) return;
  if (game.turn() !== minhaCor) vezDoComputador();
  else reouvir();
}

function irParaInicio() {
  emJogo = false; buscaId++; pensando = false;
  if (motor.worker) motor.parar();
  ouvinte.parar(); fala.calar();
  liberarTela();
  $('#jogo').hidden = true; $('#inicio').hidden = false;
  desenharInicio();
}

// ---------- Tabuleiro ----------

function casaDoRei(cor) {
  for (const f of COLUNAS) for (let r = 1; r <= 8; r++) {
    const p = game.get(f + r);
    if (p && p.type === 'k' && p.color === cor) return f + r;
  }
  return null;
}

function posTela(sq, virar) {
  const f = COLUNAS.indexOf(sq[0]), r = +sq[1];
  return virar ? [7 - f, r - 1] : [f, 8 - r];
}

function desenhar(animarLance) {
  const tab = $('#tabuleiro');
  const virar = minhaCor === 'b';
  const ultimo = game.history({ verbose: true }).pop();
  const xeque = game.in_check() ? casaDoRei(game.turn()) : null;
  const alvos = selecionada ? game.moves({ square: selecionada, verbose: true }) : [];
  const frag = document.createDocumentFragment();

  for (let lin = 0; lin < 8; lin++) for (let col = 0; col < 8; col++) {
    const f = virar ? 7 - col : col, r = virar ? lin + 1 : 8 - lin;
    const sq = COLUNAS[f] + r;
    const el = document.createElement('div');
    el.className = 'casa ' + ((f + r) % 2 ? 'escura' : 'clara');
    el.dataset.casa = sq;
    if (ultimo && (sq === ultimo.from || sq === ultimo.to)) el.classList.add('ultimo');
    if (sq === selecionada) el.classList.add('sel');
    if (dicaCasas && dicaCasas.includes(sq)) el.classList.add('dica');
    if (sq === xeque) el.classList.add('xeque');
    const alvo = alvos.find(m => m.to === sq);
    if (alvo) el.classList.add(alvo.captured ? 'alvo-captura' : 'alvo');
    if (col === 0) el.insertAdjacentHTML('beforeend', `<span class="coord r">${r}</span>`);
    if (lin === 7) el.insertAdjacentHTML('beforeend', `<span class="coord f">${COLUNAS[f]}</span>`);
    const p = game.get(sq);
    if (p) {
      const img = document.createElement('img');
      img.src = `pieces/${p.color}${p.type.toUpperCase()}.svg`;
      img.alt = NOME[p.type];
      img.draggable = false;
      el.appendChild(img);
    }
    frag.appendChild(el);
  }
  tab.replaceChildren(frag);
  if (animarLance && !matchMedia('(prefers-reduced-motion: reduce)').matches) animar(animarLance, virar);
}

function animar(m, virar) {
  const pares = [[m.from, m.to]];
  const fileira = m.color === 'w' ? '1' : '8';
  if (m.flags.includes('k')) pares.push(['h' + fileira, 'f' + fileira]);
  if (m.flags.includes('q')) pares.push(['a' + fileira, 'd' + fileira]);
  for (const [de, para] of pares) {
    const el = document.querySelector(`[data-casa="${para}"]`);
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

$('#tabuleiro').addEventListener('click', e => {
  const el = e.target.closest('.casa');
  if (!el || !podeJogar()) return;
  const sq = el.dataset.casa;
  if (selecionada) {
    const ms = game.moves({ square: selecionada, verbose: true }).filter(m => m.to === sq);
    if (ms.length) { ouvinte.parar(); return jogarMeuLance(ms.find(m => !m.promotion || m.promotion === 'q'), false); }
  }
  const p = game.get(sq);
  selecionada = p && p.color === minhaCor && sq !== selecionada ? sq : null;
  desenhar();
});

// ---------- Som ----------

let audio = null;
function tocar(captura) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
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
  const h = game.history().map(san => san.replace(/[KQRBN]/g, c => NOTACAO_PT[c]));
  let html = '';
  for (let i = 0; i < h.length; i += 2) html += `<li><b>${i / 2 + 1}.</b> ${h[i]}${h[i + 1] ? ' ' + h[i + 1] : ''}</li>`;
  const ol = $('#lances');
  ol.innerHTML = html;
  ol.scrollLeft = ol.scrollWidth;
}

function abrirFolha(titulo, texto, tipo, botoes) {
  const t = $('#folhaTitulo');
  t.textContent = titulo;
  t.className = tipo || '';
  $('#folhaTexto').textContent = texto;
  const box = $('#folhaBotoes');
  box.replaceChildren(...botoes.map(b => {
    const el = document.createElement('button');
    el.className = b.principal ? 'botao-principal' : 'botao-secundario';
    el.textContent = b.rotulo;
    el.addEventListener('click', b.acao);
    return el;
  }));
  $('#folha').hidden = false;
}
function fecharFolha() { $('#folha').hidden = true; }

async function manterTelaLigada() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function liberarTela() { try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && emJogo) manterTelaLigada();
});

// ---------- Tela inicial ----------

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

  const salva = store.get('partida', null);
  const cont = $('#continuar');
  cont.hidden = !salva;
  if (salva) cont.textContent = `Continuar partida contra o ${salva.elo} (${salva.cor === 'w' ? 'brancas' : 'pretas'})`;

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
$('#comecar').addEventListener('click', () => comecar(false));
$('#continuar').addEventListener('click', () => comecar(true));

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
$('#aRepetir').addEventListener('click', () => comando('repetir'));
$('#aPosicao').addEventListener('click', () => comando('posicao'));
$('#aDica').addEventListener('click', dica);
$('#aDesfazer').addEventListener('click', desfazer);
$('#aDesistir').addEventListener('click', () => {
  abrirFolha('Desistir da partida?', 'Conta como derrota neste nível.', 'd', [
    { rotulo: 'Continuar jogando', acao: fecharFolha },
    { rotulo: 'Desistir', principal: true, acao: () => { fecharFolha(); finalizar({ r: 'd', motivo: 'Desistência' }); } },
  ]);
});

desenharInicio();
