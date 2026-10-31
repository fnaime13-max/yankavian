/* Motor de movimento: entradas por palavra, revelação de fotos, tudo que acompanha a
   rolagem e as reações ao mouse. Um único laço lê a rolagem e escreve os transforms.
   Parallax usa a propriedade `translate`, para não brigar com o `transform` do CSS. */
(function () {
  var raiz = document.documentElement;
  var reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fino = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function limite(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  /* Quebra um texto em palavras, preservando o <em> e o espaço entre elas */
  function quebrar(el, envolver) {
    var palavras = [];
    (function andar(no) {
      [].slice.call(no.childNodes).forEach(function (f) {
        if (f.nodeType === 1) return andar(f);
        if (f.nodeType !== 3 || !f.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        f.textContent.split(/(\s+)/).forEach(function (t) {
          if (!t) return;
          if (!t.trim()) return frag.appendChild(document.createTextNode(' '));
          var p = envolver(t);
          palavras.push(p);
          frag.appendChild(p);
        });
        no.replaceChild(frag, f);
      });
    })(el);
    return palavras;
  }

  function entrarHero() { raiz.classList.add('entrou'); }

  if (reduz) {
    window.Movimento = { entrar: entrarHero };
    return;
  }

  $$('[data-split]').forEach(function (el) {
    quebrar(el, function (t) {
      var fora = document.createElement('span'), dentro = document.createElement('span');
      fora.className = 'palavra';
      dentro.textContent = t;
      fora.appendChild(dentro);
      return fora;
    }).forEach(function (p, i) { p.firstChild.style.transitionDelay = i * 38 + 'ms'; });
  });

  var acesas = [];
  $$('[data-acende]').forEach(function (el) {
    acesas = quebrar(el, function (t) {
      var s = document.createElement('span');
      s.className = 'acesa';
      s.textContent = t;
      return s;
    });
  });

  /* Grupos entram em cascata */
  $$('.pilares, .passos, .desafio__lado ul, .luxos__lista, .leituras, .sentir').forEach(function (g) {
    [].slice.call(g.children).forEach(function (c, i) {
      c.classList.add('rv');
      c.style.transitionDelay = i * 70 + 'ms';
    });
  });

  /* Quinze dias do Desinflame */
  var dias = document.querySelector('.dias');
  if (dias) for (var d = 0; d < 15; d++) {
    var li = document.createElement('li');
    li.style.transitionDelay = 200 + d * 70 + 'ms';
    dias.appendChild(li);
  }

  var observar = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visivel'); observar.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  $$('[data-split], .rv, .revela, .leituras, .dias, .sublinha').forEach(function (el) {
    if (!el.closest('.hero')) observar.observe(el);
  });

  /* Elementos que acompanham a rolagem */
  var par = $$('[data-par]').map(function (el) {
    return { el: el, ref: el.parentElement, f: +el.dataset.par };
  });
  var fotosTrilho = $$('.trilho figure');
  var trilho = document.querySelector('.trilho');
  var cortinas = $$('[data-cortina]');
  var zoom = document.querySelector('.consulta__foto img');
  var passos = document.querySelector('.passos');
  var fim = document.querySelector('.fim__texto');
  var trilha = document.getElementById('trilha');
  var cheia = trilha && trilha.querySelector('.trilha__cheia');
  var ponta = trilha && trilha.querySelector('.trilha__ponta');
  var svgTrilha = trilha && trilha.querySelector('svg');
  var barra = document.querySelector('.progresso');
  var topo = document.querySelector('.topo');
  var botaoMenu = document.querySelector('.menu-btn');
  var fita = document.querySelector('.fita__trilho');
  var animFita = fita && fita.getAnimations ? fita.getAnimations()[0] : null;

  var alturaPagina = 1, H = innerHeight, W = innerWidth, medidas = new Map();
  function guardar(el) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    medidas.set(el, { y: r.top + scrollY, a: r.height });
  }
  function medir() {
    H = innerHeight; W = innerWidth;
    alturaPagina = Math.max(1, document.documentElement.scrollHeight - H);
    medidas.clear();
    par.forEach(function (p) { guardar(p.ref); });
    cortinas.forEach(guardar);
    [trilho, zoom && zoom.parentElement, passos, fim, trilha].forEach(guardar);
  }
  addEventListener('resize', medir);
  addEventListener('load', medir);
  if (window.ResizeObserver) new ResizeObserver(medir).observe(document.body);
  medir();

  /* Mouse com mola: nada acompanha o ponteiro de forma seca */
  var mx = 0, my = 0, sx = 0, sy = 0, cx = W / 2, cy = H / 2, gx = cx, gy = cy, naHero = false;
  var hero = document.querySelector('.hero');
  var nicho = document.querySelector('.nicho');
  var texto = document.querySelector('.hero__texto');
  var luz = document.querySelector('.hero__brilho');
  var imas = [];

  if (fino) {
    addEventListener('pointermove', function (e) {
      mx = e.clientX / W - .5; my = e.clientY / H - .5;
      cx = e.clientX; cy = e.clientY;
    }, { passive: true });
    hero.addEventListener('pointerenter', function () { naHero = true; });
    hero.addEventListener('pointerleave', function () { naHero = false; });

    $$('.btn, .zap').forEach(function (b) {
      var i = { el: b, ax: 0, ay: 0, x: 0, y: 0 };
      imas.push(i);
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        i.ax = (e.clientX - r.left - r.width / 2) * .28;
        i.ay = (e.clientY - r.top - r.height / 2) * .34;
      });
      b.addEventListener('pointerleave', function () { i.ax = 0; i.ay = 0; });
    });
  }

  var yAnt = scrollY, vel = 0, tAnt = 0, yMenu = scrollY;

  function quadro(t) {
    var dt = limite(t - (tAnt || t), 1, 50); tAnt = t;
    var suave = 1 - Math.pow(.9, dt / 16.67);
    var y = scrollY;
    vel += ((y - yAnt) / dt * 16.67 - vel) * suave * 2;
    yAnt = y;

    barra.style.transform = 'scaleX(' + (y / alturaPagina).toFixed(4) + ')';

    /* O menu sai ao descer e volta ao subir */
    if (Math.abs(y - yMenu) > 6) {
      var aberto = botaoMenu.getAttribute('aria-expanded') === 'true';
      topo.classList.toggle('escondido', y > yMenu && y > 200 && !aberto);
      yMenu = y;
    }

    par.forEach(function (p) {
      var m = medidas.get(p.ref);
      if (!m || m.y - y > H + 120 || m.y + m.a - y < -120) return;
      var d = m.y + m.a / 2 - y - H / 2;
      p.el.style.translate = '0 ' + (d * p.f).toFixed(1) + 'px';
    });

    cortinas.forEach(function (c) {
      var m = medidas.get(c);
      var p = limite((H - (m.y - y)) / (H * .75), 0, 1);
      if (m.y - y > H || p >= 1) { c.style.clipPath = ''; return; }
      var q = 1 - p;
      c.style.clipPath = 'inset(0 ' + (q * 6).toFixed(2) + '% round ' + (q * 56).toFixed(1) + 'px)';
    });

    var mt = medidas.get(trilho);
    if (mt && mt.y - y < H && mt.y + mt.a - y > 0) {
      var torcao = limite(vel * .05, -2.4, 2.4);
      var mp = (mt.y + mt.a / 2 - y - H / 2);
      fotosTrilho.forEach(function (f, i) {
        f.style.translate = '0 ' + (mp * (i % 2 ? -.05 : .05)).toFixed(1) + 'px';
        f.style.transform = 'skewY(' + torcao.toFixed(2) + 'deg)';
      });
    }

    if (zoom) {
      var mz = medidas.get(zoom.parentElement);
      if (mz) zoom.style.scale = (1.14 - limite((y + H - mz.y) / (H * 1.5), 0, 1) * .14).toFixed(4);
    }

    if (passos) {
      var mq = medidas.get(passos);
      passos.style.setProperty('--fio', limite((y + H * .7 - mq.y) / mq.a, 0, 1).toFixed(3));
    }

    if (cheia) {
      var mr = medidas.get(trilha);
      var pr = limite((H * .78 - (mr.y - y)) / (mr.a + H * .28), 0, 1);
      cheia.style.strokeDashoffset = 1 - pr;
      if (pr > 0 && pr < 1) {
        var pt = cheia.getPointAtLength(cheia.getTotalLength() * pr);
        var svg = svgTrilha.getBoundingClientRect(), caixa = svgTrilha.viewBox.baseVal;
        ponta.style.transform = 'translate(' + (pt.x / caixa.width * svg.width).toFixed(1) + 'px,' + (pt.y / caixa.height * svg.height).toFixed(1) + 'px)';
        ponta.style.opacity = 1;
      } else ponta.style.opacity = 0;
    }

    if (acesas.length) {
      var mf = medidas.get(fim);
      var pf = limite((y + H * .92 - mf.y) / (H * .62), 0, 1) * (acesas.length + 2);
      acesas.forEach(function (s, i) {
        var o = (.5 + limite(pf - i, 0, 1) * .5).toFixed(2);
        if (s._o !== o) { s._o = o; s.style.opacity = o; }
      });
    }

    if (animFita) animFita.playbackRate = (vel < -1 ? -1 : 1) * (1 + Math.min(Math.abs(vel) * .08, 5));

    if (fino) {
      sx += (mx - sx) * suave * .7; sy += (my - sy) * suave * .7;
      gx += (cx - gx) * suave * .9; gy += (cy - gy) * suave * .9;
      if (y < H) {
        nicho.style.transform = 'perspective(1100px) rotateY(' + (sx * 9).toFixed(2) + 'deg) rotateX(' + (-sy * 7).toFixed(2) + 'deg)';
        texto.style.translate = (-sx * 14).toFixed(1) + 'px ' + (-sy * 10).toFixed(1) + 'px';
        luz.style.transform = 'translate(' + (gx - 340).toFixed(0) + 'px,' + (gy + y - 340).toFixed(0) + 'px)';
        luz.style.opacity = naHero ? 1 : 0;
      }
      imas.forEach(function (i) {
        i.x += (i.ax - i.x) * suave * 1.6; i.y += (i.ay - i.y) * suave * 1.6;
        if (Math.abs(i.x) + Math.abs(i.y) + Math.abs(i.ax) + Math.abs(i.ay) < .05) return;
        i.el.style.translate = i.x.toFixed(1) + 'px ' + i.y.toFixed(1) + 'px';
      });
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);

  window.Movimento = {
    entrar: function () {
      entrarHero();
      $$('.hero [data-split]').forEach(function (el) { el.classList.add('visivel'); });
      medir();
    }
  };
})();
