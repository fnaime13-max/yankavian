(function () {
  var C = window.CONFIG || {};
  var reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raiz = document.documentElement;

  function linkWa(texto) {
    return 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent(texto);
  }

  /* Dados */
  document.querySelectorAll('[data-wa]').forEach(function (a) { a.href = linkWa(C.mensagens[a.dataset.wa]); });
  document.querySelectorAll('[data-ig]').forEach(function (a) { a.href = C.instagram; });
  document.querySelectorAll('[data-dado]').forEach(function (el) {
    var v = C[el.dataset.dado];
    if (v) { el.textContent = v; el.classList.remove('pendente'); }
  });
  if (C.desafio === false) {
    var d = document.getElementById('desafio');
    if (d) d.remove();
  }
  document.getElementById('ano').textContent = new Date().getFullYear();

  /* Foto ausente vira um bloco elegante, sem ícone quebrado */
  document.querySelectorAll('img').forEach(function (img) {
    function falha() { img.parentElement.classList.add('sem-foto'); img.remove(); }
    if (img.complete && !img.naturalWidth) falha(); else img.addEventListener('error', falha);
  });

  /* Abertura */
  var abertura = document.getElementById('abertura');
  (function () {
    if (!abertura) return;
    if (reduz || !window.Borboleta) { abertura.remove(); raiz.classList.remove('carregando'); Movimento.entrar(); return; }

    var num = document.getElementById('abertura-num');
    var itens = abertura.querySelectorAll('li');
    var inicio = performance.now(), duracao = 3600, fechou = false, carregou = false;
    addEventListener('load', function () { carregou = true; });
    setTimeout(function () { carregou = true; }, 5000);

    Borboleta.carregar();

    function encerrar() {
      if (fechou) return;
      fechou = true;
      num.textContent = '100';
      itens.forEach(function (li) { li.classList.add('feito'); });
      Borboleta.progresso(1);
      setTimeout(function () {
        Borboleta.soltar();
        abertura.classList.add('saindo');
        raiz.classList.remove('carregando');
        Movimento.entrar();
        setTimeout(function () { abertura.remove(); }, 1000);
      }, 420);
    }

    function passo(agora) {
      if (fechou) return;
      var t = Math.min(1, (agora - inicio) / duracao);
      if (!carregou) t = Math.min(t, .92);
      var p = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      num.textContent = Math.round(p * 100);
      Borboleta.progresso(p);
      itens.forEach(function (li, i) { li.classList.toggle('feito', p >= (i + 1) / itens.length - .001); });
      if (p >= 1) return encerrar();
      requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
    abertura.addEventListener('pointerdown', encerrar);
    addEventListener('keydown', encerrar, { once: true });
  })();

  /* Menu */
  var botao = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  function alternar(aberto) {
    botao.setAttribute('aria-expanded', aberto);
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    menu.classList.toggle('aberto', aberto);
  }
  botao.addEventListener('click', function () { alternar(botao.getAttribute('aria-expanded') !== 'true'); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) alternar(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') alternar(false); });

  var topo = document.querySelector('.topo');
  addEventListener('scroll', function () { topo.classList.toggle('rolado', scrollY > 24); }, { passive: true });

  /* No celular, o botão fixo espera o botão do hero sair da tela para não duplicar */
  var zap = document.querySelector('.zap');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      zap.classList.toggle('oculto', es[0].isIntersecting && innerWidth < 900);
    }).observe(document.querySelector('.hero .btn'));
  }

  /* Marca o item atual do menu */
  var links = [].slice.call(menu.querySelectorAll('a[href^="#"]'));
  if ('IntersectionObserver' in window) {
    var secoes = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) {
          if (l.getAttribute('href') === '#' + e.target.id) l.setAttribute('aria-current', 'true');
          else l.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (l) {
      var s = document.querySelector(l.getAttribute('href'));
      if (s) secoes.observe(s);
    });

    var surgir = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visivel'); surgir.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv').forEach(function (el) { surgir.observe(el); });
  } else {
    document.querySelectorAll('.rv').forEach(function (el) { el.classList.add('visivel'); });
  }

  /* Os luxos: cada um muda a cor da borboleta e monta a mensagem do WhatsApp */
  var luxos = [].slice.call(document.querySelectorAll('.luxo'));
  function abrirLuxo(item) {
    luxos.forEach(function (l) {
      var ativo = l === item;
      l.classList.toggle('ativo', ativo);
      l.querySelector('button').setAttribute('aria-expanded', ativo);
    });
    if (window.Borboleta) Borboleta.matiz(+item.dataset.matiz);
  }
  luxos.forEach(function (l) {
    var nome = l.querySelector('button').textContent.trim();
    l.querySelector('button').addEventListener('click', function () { abrirLuxo(l); });
    l.querySelector('a').href = linkWa(C.mensagens.luxo + nome.toLowerCase().replace(/\.$/, '') + '.');
  });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    luxos.forEach(function (l) { l.addEventListener('pointerenter', function () { abrirLuxo(l); }); });
  }

  /* Lente: o mouse enxerga o que a balança esconde */
  var palco = document.getElementById('lente');
  if (palco) {
    var alvoX = .3, alvoY = .5, lx = .3, ly = .5, solto = true, rodando = false;
    function pintar() {
      lx += (alvoX - lx) * .14; ly += (alvoY - ly) * .14;
      palco.style.setProperty('--lx', (lx * 100).toFixed(2) + '%');
      palco.style.setProperty('--ly', (ly * 100).toFixed(2) + '%');
      if (Math.abs(alvoX - lx) + Math.abs(alvoY - ly) > .001) requestAnimationFrame(pintar);
      else rodando = false;
    }
    function animar() { if (!rodando) { rodando = true; requestAnimationFrame(pintar); } }
    palco.addEventListener('pointermove', function (e) {
      var r = palco.getBoundingClientRect();
      solto = false;
      alvoX = (e.clientX - r.left) / r.width; alvoY = (e.clientY - r.top) / r.height;
      animar();
    });
    palco.addEventListener('pointerleave', function () { solto = true; });
    /* Sem mouse por perto, a lente passeia sozinha enquanto está na tela */
    if (!reduz) {
      var visivel = false;
      new IntersectionObserver(function (es) {
        visivel = es[0].isIntersecting;
        if (visivel) requestAnimationFrame(passear);
      }).observe(palco);
      function passear(t) {
        if (!visivel) return;
        if (solto) {
          alvoX = .5 + Math.sin(t / 1900) * .36;
          alvoY = .5 + Math.sin(t / 1300) * .26;
          animar();
        }
        requestAnimationFrame(passear);
      }
    }
  }

  /* Trilho de fotos arrastável com o mouse */
  var trilho = document.querySelector('.trilho');
  if (trilho) {
    var preso = false, moveu = 0, inicioX = 0, inicioS = 0;
    trilho.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      preso = true; moveu = 0; inicioX = e.clientX; inicioS = trilho.scrollLeft;
      trilho.classList.add('arrastando');
      trilho.setPointerCapture(e.pointerId);
    });
    trilho.addEventListener('pointermove', function (e) {
      if (!preso) return;
      moveu = e.clientX - inicioX;
      trilho.scrollLeft = inicioS - moveu;
    });
    ['pointerup', 'pointercancel'].forEach(function (n) {
      trilho.addEventListener(n, function () { preso = false; trilho.classList.remove('arrastando'); });
    });
  }
})();
