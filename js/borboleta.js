/* Borboleta iridescente: uma única borboleta em canvas que se forma na abertura,
   voa até o hero e pousa nos elementos [data-pouso] conforme a rolagem.
   A cor depende do ângulo da asa e da posição do mouse, como a asa da morfo. */
(function () {
  var tela = document.getElementById('asas');
  if (!tela) return;
  var ctx = tela.getContext('2d');
  var reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fino = matchMedia('(hover: hover) and (pointer: fine)').matches;

  var FRENTE = new Path2D('M3 -12C34 -118 150 -214 292 -226C318 -228 330 -210 322 -186C306 -136 262 -66 206 -28C150 6 70 16 3 8Z');
  var TRAS = new Path2D('M3 8C66 12 150 16 206 58C246 90 242 150 206 190C176 224 126 236 96 214C56 186 20 104 3 30Z');
  var NERVURAS_F = [[318, -200], [300, -150], [268, -96], [228, -50], [176, -14]];
  var NERVURAS_T = [[214, 86], [214, 150], [176, 208], [122, 222]];
  var PONTOS_F = [[286, -196], [290, -166], [274, -130], [250, -96], [220, -62]];
  var PONTOS_T = [[202, 96], [204, 140], [178, 182], [134, 208]];

  var PALETA = [[34, 88, 224], [112, 58, 214], [214, 36, 132], [238, 96, 112], [240, 182, 92], [214, 36, 132], [112, 58, 214]];
  var TONS = 64;
  var CORES = [];
  (function () {
    for (var i = 0; i < TONS; i++) CORES.push(cor(i / TONS));
    function cor(v) {
      var p = v * PALETA.length, a = Math.floor(p), f = p - a;
      var x = PALETA[a], y = PALETA[(a + 1) % PALETA.length];
      return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * f) + ',' + Math.round(x[1] + (y[1] - x[1]) * f) + ',' + Math.round(x[2] + (y[2] - x[2]) * f) + ')';
    }
  })();
  function tom(v) { v = v % 1; if (v < 0) v += 1; return CORES[Math.floor(v * TONS) % TONS]; }

  /* Escamas: amostradas dentro das asas em grade com desvio */
  var escamas = [];
  (function () {
    var passo = fino ? 8 : 11;
    var aux = document.createElement('canvas').getContext('2d');
    aux.lineWidth = 22;
    for (var x = 0; x < 340; x += passo) for (var y = -240; y < 240; y += passo) {
      var px = x + Math.random() * passo, py = y + Math.random() * passo;
      var dentro = aux.isPointInPath(FRENTE, px, py) ? 1 : aux.isPointInPath(TRAS, px, py) ? 2 : 0;
      if (!dentro) continue;
      if (aux.isPointInStroke(dentro === 1 ? FRENTE : TRAS, px, py)) continue;
      escamas.push({ x: px, y: py, r: Math.hypot(px, py) / 340, n: Math.random(), a: dentro, ox: [0, 0], oy: [0, 0] });
    }
  })();
  var baldes = [];
  for (var b = 0; b < TONS; b++) baldes.push([]);

  var po = [];
  var W = 1, H = 1, dpr = 1;
  var X = 0, Y = 0, E = .5, G = 0, vx = 0, vy = 0;
  var modo = 'solta', progresso = 1, batida = 0, abertura = .6, relogio = 0;
  var ponteiro = { x: -999, y: -999, fase: 0, faseAlvo: 0, perto: 0 };
  var guinada = 0, matiz = 0, matizAlvo = 0;
  var pouso = null, visita = null, pousos = [], ultimoPo = 0;

  function medir() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    tela.width = W * dpr; tela.height = H * dpr;
    pousos = [].slice.call(document.querySelectorAll('[data-pouso]')).filter(function (e) { return e.offsetParent !== null; });
    if (reduz && !modoCarga()) escolherPouso(true);
  }
  function modoCarga() { return modo === 'carga'; }

  function alvoDe(e) {
    var r = e.getBoundingClientRect();
    var pequeno = W < 760;
    return {
      x: r.left + r.width * +(e.dataset.ax || .5),
      y: r.top + r.height * +(e.dataset.ay || .5),
      e: pequeno ? +(e.dataset.em || e.dataset.e) : +(e.dataset.e || .3) * Math.max(.72, Math.min(1, W / 1440)),
      g: (+(e.dataset.g || 0)) * Math.PI / 180
    };
  }

  function escolherPouso(imediato) {
    if (modoCarga() || !pousos.length) return;
    var meio = H * .46, melhor = null, dist = 1e9, atual = 1e9;
    pousos.forEach(function (e) {
      var r = e.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - meio);
      if (d < dist) { dist = d; melhor = e; }
      if (e === pouso) atual = d;
    });
    if (melhor !== pouso && (dist < atual - 90 || !pouso)) {
      pouso = melhor;
      if (modo === 'pousada') modo = 'voo';
    }
    if (imediato && pouso) {
      var a = alvoDe(pouso);
      X = a.x; Y = a.y; E = a.e; G = a.g; modo = 'pousada'; desenhar();
    }
  }

  function soltarPo(x, y, n, forca, fase) {
    for (var i = 0; i < n && po.length < 240; i++) {
      var a = Math.random() * 6.283, v = (.3 + Math.random()) * forca;
      po.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .2, v: 1, t: fase + Math.random() * .2, s: 1.2 + Math.random() * 2.2 });
    }
  }

  function movimento() {
    relogio += 1;
    ponteiro.fase += (ponteiro.faseAlvo - ponteiro.fase) * .06;
    matiz += (matizAlvo - matiz) * .05;
    var velBatida = .035, base = .55, amp = .2;

    if (modo === 'carga') {
      velBatida = .03; base = .5; amp = .12;
    } else if (modo === 'pousada' && pouso) {
      var a = alvoDe(pouso);
      X += (a.x - X) * .3; Y += (a.y - Y) * .3; E += (a.e - E) * .08;
      G += (a.g + (ponteiro.x > 0 ? (ponteiro.x - X) / W * .16 : 0) - G) * .06;
      var d = Math.hypot(ponteiro.x - X, ponteiro.y - Y);
      ponteiro.perto += ((d < 330 * E ? 1 : 0) - ponteiro.perto) * .1;
      velBatida = .035 + ponteiro.perto * .1; amp = .2 + ponteiro.perto * .12;
    } else {
      var alvo = visita || (pouso ? alvoDe(pouso) : { x: W / 2, y: H / 2, e: E, g: 0 });
      var ax = alvo.x + Math.sin(relogio * .05) * 26, ay = alvo.y + Math.cos(relogio * .067) * 18;
      vx += (ax - X) * .0055; vy += (ay - Y) * .0055;
      vx *= .93; vy *= .93;
      X += vx; Y += vy;
      if (alvo.e) E += (alvo.e - E) * .035;
      G += (Math.max(-.7, Math.min(.7, vx * .018)) + (alvo.g || 0) * .3 - G) * .08;
      velBatida = .34; base = .78; amp = .56;
      if (relogio % 3 === 0) soltarPo(X, Y, 1, .5, ponteiro.fase + matiz);
      if (visita && visita.ate < relogio) visita = null;
      if (!visita && pouso) {
        var fim = alvoDe(pouso);
        if (Math.hypot(fim.x - X, fim.y - Y) < 26) { modo = 'pousada'; vx = vy = 0; }
      }
    }
    batida += velBatida;
    abertura = base + Math.sin(batida) * amp;
    guinada += ((ponteiro.x > 0 ? (ponteiro.x - X) / W : 0) * .6 - guinada) * .05;

    for (var i = po.length - 1; i >= 0; i--) {
      var p = po[i];
      p.x += p.vx; p.y += p.vy; p.vy += .012; p.vx *= .985; p.v -= .012;
      if (p.v <= 0) po.splice(i, 1);
    }
  }

  function linhasDaAsa(pontos, oy) {
    pontos.forEach(function (p) {
      ctx.moveTo(3, oy);
      ctx.quadraticCurveTo(p[0] * .5, p[1] * .3 + oy * .5, p[0], p[1]);
    });
  }

  function asa(lado, angulo, fase) {
    var c = Math.cos(angulo), s = Math.sin(angulo);
    var cheio = progresso >= 1;
    ctx.save();
    ctx.transform(lado * Math.max(.06, c), -.2 * s, 0, 1, 0, 0);

    [[TRAS, 2, 210, 200, NERVURAS_T, 8, PONTOS_T], [FRENTE, 1, 320, -220, NERVURAS_F, -2, PONTOS_F]].forEach(function (m) {
      var caminho = m[0];
      ctx.save();
      if (!cheio) { ctx.beginPath(); ctx.arc(0, 0, 18 + 360 * progresso, 0, 6.3); ctx.clip(); }
      var g = ctx.createLinearGradient(0, 0, m[2], m[3]);
      for (var k = 0; k <= 4; k++) g.addColorStop(k / 4, tom(fase + k * .085 + (m[1] === 2 ? .06 : 0)));
      ctx.fillStyle = g;
      ctx.fill(caminho);
      ctx.clip(caminho);

      /* Escamas soltas dão a textura; só desenhamos quando o tamanho compensa */
      if (E > .12) {
        var i, q, pulo = E < .2 ? 2 : 1;
        for (i = 0; i < TONS; i++) baldes[i].length = 0;
        var li = lado > 0 ? 0 : 1;
        for (i = 0; i < escamas.length; i += pulo) {
          q = escamas[i];
          if (q.a !== m[1]) continue;
          var v = (fase + q.r * .42 + q.n * .13) % 1; if (v < 0) v += 1;
          baldes[Math.floor(v * TONS) % TONS].push(q);
        }
        ctx.globalAlpha = .62;
        var lado2 = 3.4 / Math.max(E, .5) + 2;
        for (i = 0; i < TONS; i++) {
          var lista = baldes[i];
          if (!lista.length) continue;
          ctx.fillStyle = CORES[i];
          ctx.beginPath();
          for (var j = 0; j < lista.length; j++) {
            q = lista[j];
            ctx.rect(q.x + q.ox[li], q.y + q.oy[li], lado2, lado2 * .72);
          }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* Brilho que corre pela asa conforme o ângulo */
      var luz = (Math.sin(angulo * 2.2 + ponteiro.fase * 6.28) + 1) / 2;
      var bx = m[2] * luz, by = m[3] * luz;
      var b = ctx.createRadialGradient(bx, by, 4, bx, by, 150);
      b.addColorStop(0, 'rgba(255,255,255,.5)');
      b.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = b;
      ctx.fillRect(-10, -240, 350, 480);

      ctx.strokeStyle = '#15111A';
      ctx.lineWidth = 22;
      ctx.stroke(caminho);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(21,17,26,.55)';
      ctx.beginPath();
      linhasDaAsa(m[4], m[5]);
      ctx.stroke();
      ctx.fillStyle = '#EBCB95';
      ctx.beginPath();
      m[6].forEach(function (p) { ctx.moveTo(p[0] + 4, p[1]); ctx.arc(p[0], p[1], 3.6, 0, 6.3); });
      ctx.fill();
      ctx.restore();

      /* Fio dourado do logo: na abertura ele se desenha antes da cor chegar */
      ctx.strokeStyle = '#EBCB95';
      ctx.lineWidth = Math.min(3.4, 1.5 / E);
      if (!cheio) ctx.setLineDash([1000 * Math.min(1, progresso * 1.5), 1000]);
      ctx.stroke(caminho);
      ctx.setLineDash([]);
    });
    ctx.restore();
  }

  function corpo() {
    ctx.fillStyle = '#15111A';
    ctx.beginPath(); ctx.ellipse(0, -2, 8, 30, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 52, 5.4, 42, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -38, 8, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#15111A'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-2, -44); ctx.quadraticCurveTo(-18, -110, -58, -138);
    ctx.moveTo(2, -44); ctx.quadraticCurveTo(18, -110, 58, -138);
    ctx.stroke();
    ctx.fillStyle = '#EBCB95';
    ctx.beginPath();
    ctx.arc(-58, -138, 3.4, 0, 6.3); ctx.moveTo(61, -138); ctx.arc(58, -138, 3.4, 0, 6.3);
    ctx.fill();
  }

  function afetarEscamas() {
    if (ponteiro.x < 0 || E < .12) return;
    var dx = ponteiro.x - X, dy = ponteiro.y - Y;
    var co = Math.cos(-G), si = Math.sin(-G);
    var lx = (dx * co - dy * si) / E, ly = (dx * si + dy * co) / E;
    var perto = Math.abs(lx) < 420 && Math.abs(ly) < 300;
    var c = Math.max(.06, Math.cos(abertura));
    for (var i = 0; i < escamas.length; i++) {
      var q = escamas[i];
      for (var k = 0; k < 2; k++) {
        if (perto) {
          var ex = q.x * c * (k ? -1 : 1) - lx, ey = q.y - ly, d = ex * ex + ey * ey;
          if (d < 7000) {
            var f = (1 - d / 7000) * 2.4 / (Math.sqrt(d) + 8);
            q.ox[k] += ex * f; q.oy[k] += ey * f;
          }
        }
        q.ox[k] *= .9; q.oy[k] *= .9;
      }
    }
  }

  function desenhar() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var fase = .02 + ponteiro.fase + abertura * .16 + matiz + relogio * .0006;
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(G);
    ctx.scale(E, E);

    if (modo === 'pousada' && E > .2) {
      ctx.save();
      ctx.translate(10 / E, 16 / E);
      ctx.globalAlpha = .07;
      ctx.fillStyle = '#15111A';
      [-1, 1].forEach(function (l) {
        ctx.save();
        ctx.scale(l * Math.cos(abertura), 1);
        ctx.fill(FRENTE); ctx.fill(TRAS);
        ctx.restore();
      });
      ctx.restore();
    }

    if (progresso > 0) {
      asa(1, abertura + guinada, fase);
      asa(-1, abertura - guinada, fase + .03);
    }
    ctx.globalAlpha = Math.min(1, progresso * 6);
    corpo();
    ctx.restore();

    for (var i = 0; i < po.length; i++) {
      var p = po[i];
      ctx.globalAlpha = Math.max(0, p.v) * .85;
      ctx.fillStyle = tom(p.t);
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  /* Passo fixo de 60 Hz: o voo tem a mesma velocidade em qualquer tela */
  var PASSO = 1000 / 60, anterior = 0, acumulado = 0;
  function quadro(agora) {
    acumulado += Math.min(100, agora - (anterior || agora));
    anterior = agora;
    while (acumulado >= PASSO) {
      movimento();
      afetarEscamas();
      acumulado -= PASSO;
    }
    desenhar();
    requestAnimationFrame(quadro);
  }

  var ultimoX = 0, ultimoY = 0;
  addEventListener('pointermove', function (e) {
    ponteiro.x = e.clientX; ponteiro.y = e.clientY;
    ponteiro.faseAlvo = (e.clientX / W) * .34 + (e.clientY / H) * .22;
    if (reduz) return;
    var d = Math.hypot(e.clientX - ultimoX, e.clientY - ultimoY);
    if (fino && d > 18 && modo !== 'carga') {
      soltarPo(e.clientX, e.clientY, 1, .35, ponteiro.fase + matiz);
      ultimoX = e.clientX; ultimoY = e.clientY;
    }
  }, { passive: true });

  addEventListener('pointerdown', function (e) {
    if (reduz || modo === 'carga') return;
    if (e.target.closest && e.target.closest('a,button,[data-sem-voo]')) return;
    soltarPo(e.clientX, e.clientY, 26, 2.2, ponteiro.fase + matiz);
    visita = { x: e.clientX, y: e.clientY, e: Math.min(E, .24), ate: relogio + 110 };
    modo = 'voo';
  });

  addEventListener('scroll', function () { reduz ? escolherPouso(true) : escolherPouso(); }, { passive: true });
  addEventListener('resize', medir);

  window.Borboleta = {
    carregar: function () {
      modo = 'carga'; progresso = 0;
      X = W / 2; Y = H * (W < 760 ? .36 : .4);
      E = Math.min(W, H * 1.1) / (W < 760 ? 1050 : 1750);
    },
    progresso: function (p) {
      progresso = p;
      if (p > .04 && Math.random() < .5) {
        var a = Math.random() * 6.283, r = 340 * E * p;
        soltarPo(X + Math.cos(a) * r * .9, Y + Math.sin(a) * r * .6, 1, .7, .05 + p * .4);
      }
    },
    soltar: function () {
      progresso = 1;
      soltarPo(X, Y, 90, 3.4, .1);
      vy = -5; modo = 'voo';
      pousos = [].slice.call(document.querySelectorAll('[data-pouso]')).filter(function (e) { return e.offsetParent !== null; });
      pouso = null; escolherPouso();
      if (!pouso) pouso = pousos[0];
    },
    matiz: function (v) {
      matizAlvo = v;
      if (reduz) { matiz = v; desenhar(); }
    }
  };

  medir();
  if (reduz) {
    escolherPouso(true);
    addEventListener('load', function () { medir(); escolherPouso(true); });
  } else {
    requestAnimationFrame(quadro);
  }
})();
