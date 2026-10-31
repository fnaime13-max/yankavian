/* Motor de movimento leve: entradas que rodam uma vez (só transform e opacity) e um
   punhado de efeitos ligados à rolagem. Nada roda em laço: sem rolagem, sem trabalho. */
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

  /* A citação final acende em cascata, uma vez */
  $$('[data-acende]').forEach(function (el) {
    quebrar(el, function (t) {
      var s = document.createElement('span');
      s.className = 'acesa';
      s.textContent = t;
      return s;
    }).forEach(function (s, i) { s.style.transitionDelay = i * 55 + 'ms'; });
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
    li.style.transitionDelay = 200 + d * 60 + 'ms';
    dias.appendChild(li);
  }

  var observar = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visivel'); observar.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  $$('[data-split], [data-acende], .rv, .leituras, .dias, .sublinha, .passos').forEach(function (el) {
    if (!el.closest('.hero')) observar.observe(el);
  });

  /* A faixa só corre enquanto está na tela */
  var fita = document.querySelector('.fita');
  if (fita) new IntersectionObserver(function (es) {
    fita.classList.toggle('parada', !es[0].isIntersecting);
  }).observe(fita);

  /* Rolagem: lê a posição uma vez por quadro e só enquanto a página se move */
  var barra = document.querySelector('.progresso');
  var topo = document.querySelector('.topo');
  var botaoMenu = document.querySelector('.menu-btn');
  var trilha = document.getElementById('trilha');
  var cheia = trilha && trilha.querySelector('.trilha__cheia');
  var fotoFim = document.querySelector('[data-par]');
  var H = innerHeight, alturaPagina = 1, topoTrilha = 0, altTrilha = 1, topoFim = 0, altFim = 1;

  function medir() {
    H = innerHeight;
    alturaPagina = Math.max(1, document.documentElement.scrollHeight - H);
    if (trilha) {
      var r = trilha.getBoundingClientRect();
      topoTrilha = r.top + scrollY; altTrilha = r.height;
    }
    if (fotoFim) {
      var f = fotoFim.parentElement.getBoundingClientRect();
      topoFim = f.top + scrollY; altFim = f.height;
    }
    agendar();
  }

  var pedido = false, yMenu = scrollY;
  function agendar() {
    if (pedido) return;
    pedido = true;
    requestAnimationFrame(aplicar);
  }
  function aplicar() {
    pedido = false;
    var y = scrollY;
    barra.style.transform = 'scaleX(' + (y / alturaPagina).toFixed(4) + ')';

    /* O menu sai ao descer e volta ao subir */
    if (Math.abs(y - yMenu) > 6) {
      var aberto = botaoMenu.getAttribute('aria-expanded') === 'true';
      topo.classList.toggle('escondido', y > yMenu && y > 200 && !aberto);
      yMenu = y;
    }

    if (cheia && topoTrilha - y < H && topoTrilha + altTrilha - y > -H * .3) {
      var p = limite((H * .78 - (topoTrilha - y)) / (altTrilha + H * .28), 0, 1);
      cheia.style.strokeDashoffset = (1 - p).toFixed(3);
    }

    if (fotoFim && topoFim - y < H && topoFim + altFim - y > 0) {
      fotoFim.style.transform = 'translate3d(0,' + ((topoFim + altFim / 2 - y - H / 2) * +fotoFim.dataset.par).toFixed(1) + 'px,0)';
    }
  }
  addEventListener('scroll', agendar, { passive: true });
  addEventListener('resize', medir);
  addEventListener('load', medir);
  if (window.ResizeObserver) {
    var espera;
    new ResizeObserver(function () { clearTimeout(espera); espera = setTimeout(medir, 200); }).observe(document.body);
  }
  medir();

  /* Botões com ímã: a transição do CSS faz a suavização, sem laço em JS */
  if (fino) $$('.btn, .zap').forEach(function (b) {
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      b.style.translate = ((e.clientX - r.left - r.width / 2) * .24).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px';
    });
    b.addEventListener('pointerleave', function () { b.style.translate = ''; });
  });

  window.Movimento = {
    entrar: function () {
      entrarHero();
      $$('.hero [data-split]').forEach(function (el) { el.classList.add('visivel'); });
      medir();
    }
  };
})();
