(function () {
  "use strict";

  var cfg = window.SGS_PAINEL_CONFIG || {};
  var tokenCache = { accessToken: null, expiresAt: 0 };
  var lastCallId = null;
  var history = [];
  var eventSource = null;
  var attendantCache = {};

  function $(id) {
    return document.getElementById(id);
  }

  function apiUrl(path) {
    var base = (cfg.apiBase || "").replace(/\/$/, "");
    return base + path;
  }

  function pad(n, size) {
    var s = String(n == null ? "" : n).replace(/\D/g, "");
    var digits = Number(cfg.senhaDigitos != null ? cfg.senhaDigitos : 3);
    while (s.length < (size || digits)) s = "0" + s;
    return s;
  }

  function nowClock() {
    var d = new Date();
    $("clock").textContent = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async function obterToken() {
    var agora = Date.now();
    if (tokenCache.accessToken && tokenCache.expiresAt > agora + 30000) {
      return tokenCache.accessToken;
    }

    var body = new URLSearchParams();
    body.set("grant_type", "password");
    body.set("client_id", cfg.clientId || "");
    body.set("client_secret", cfg.clientSecret || "");
    body.set("username", cfg.username || "");
    body.set("password", cfg.password || "");

    var resp = await fetch(apiUrl("/api/token"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    if (!resp.ok) {
      throw new Error("Falha OAuth (" + resp.status + "). Cadastre o cliente 'painel' no admin.");
    }

    var data = await resp.json();
    tokenCache.accessToken = data.access_token;
    tokenCache.expiresAt = agora + ((data.expires_in || 3600) * 1000);
    return tokenCache.accessToken;
  }

  async function apiGet(path) {
    var token = await obterToken();
    var resp = await fetch(apiUrl(path), {
      headers: { Authorization: "Bearer " + token }
    });
    if (!resp.ok) {
      var t = await resp.text();
      throw new Error("API " + path + " => " + resp.status + " " + t);
    }
    return resp.json();
  }

  function formatSenha(item) {
    var sigla = item.siglaSenha || item.sigla || item.senhaSigla || "";
    var num = item.numeroSenha != null ? item.numeroSenha : item.numero;
    if (num == null && item.senhaNumero != null) num = item.senhaNumero;
    if (num == null && item.senha) {
      if (typeof item.senha === "object") {
        sigla = item.senha.sigla || sigla;
        num = item.senha.numero;
      } else {
        var m = String(item.senha).toUpperCase().match(/^([A-Z]+)\s*0*(\d+)$/);
        if (m) return String(m[1]) + pad(m[2]);
      }
    }
    var out = String(sigla || "").toUpperCase() + pad(num);
    var m2 = out.match(/^([A-Z]+)(\d+)$/);
    if (m2) return m2[1] + pad(m2[2]);
    return out;
  }

  function formatGuiche(item) {
    var local = item.local || cfg.localPrefixFallback || "Guichê";
    if (typeof local === "object" && local) {
      local = local.nome || local.name || cfg.localPrefixFallback || "Guichê";
    }
    var numero = item.numeroLocal != null ? item.numeroLocal : "";
    if (numero === "" || numero == null) return String(local);
    return String(local) + " " + String(numero);
  }

  function extractAtendente(detail, item) {
    var u = (detail && (detail.usuario || detail.usuarioAtendimento)) || null;
    if (!u && item) {
      u = item.usuario || item.atendente || item.nomeAtendente || null;
    }
    if (!u) return "";
    if (typeof u === "string") return u;
    var nome = [u.nome, u.sobrenome].filter(Boolean).join(" ").trim();
    if (nome) return nome;
    return u.login || u.username || u.name || "";
  }

  async function enrichAtendente(item) {
    if (!cfg.showAtendente) return "";
    var id = item.id;
    if (!id) return extractAtendente(null, item);
    if (attendantCache[id]) return attendantCache[id];
    try {
      var detail = await apiGet("/api/atendimentos/" + id);
      var nome = extractAtendente(detail, item);
      attendantCache[id] = nome || "—";
      return attendantCache[id];
    } catch (e) {
      return extractAtendente(null, item) || "—";
    }
  }

  function speakDigits(numStr) {
    var map = {
      "0": "zero", "1": "um", "2": "dois", "3": "três", "4": "quatro",
      "5": "cinco", "6": "seis", "7": "sete", "8": "oito", "9": "nove"
    };
    return String(numStr).split("").map(function (c) {
      return map[c] || c;
    }).join(", ");
  }

  function speakLetter(letter) {
    var l = String(letter || "").toUpperCase();
    var map = {
      A: "Á", P: "Pê", B: "Bê", C: "Cê", D: "Dê",
      E: "É", F: "Éfe", G: "Gê", N: "Ene", S: "Ésse"
    };
    return map[l] || l;
  }

  function speakSenhaText(senha) {
    var m = String(senha || "").match(/^([A-Za-zÀ-ÿ]+)\s*(\d+)$/);
    if (!m) return String(senha || "");
    return speakLetter(m[1]) + ", " + speakDigits(m[2]);
  }

  function speakGuicheText(guiche) {
    var g = String(guiche || "");
    var m = g.match(/^(.*?)(\d+)\s*$/);
    if (m) return (m[1] || "Guichê ").trim() + " " + speakDigits(m[2]);
    return g;
  }

  var audioUnlocked = false;
  var pendingSpeak = null;
  var audioCtx = null;
  var ttsAudio = null;
  var STORAGE_KEY = "sgs_painel_audio_ok";

  setInterval(function () {
    try {
      if (window.speechSynthesis) window.speechSynthesis.resume();
    } catch (e) {}
  }, 2500);

  function setUnlockUi(ok, msg) {
    var btn = $("audioUnlock");
    var st = $("audioStatus");
    if (ok) {
      if (btn) btn.hidden = true;
      if (st) {
        st.hidden = false;
        st.textContent = msg || "Áudio ativo";
        setTimeout(function () { if (st) st.hidden = true; }, 4500);
      }
    } else if (btn) {
      btn.hidden = false;
      if (msg) btn.textContent = msg;
    }
  }

  function ensureAudioContext() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playBeepWebAudio() {
    return new Promise(function (resolve) {
      try {
        var ctx = ensureAudioContext();
        if (!ctx) return resolve(false);
        var now = ctx.currentTime;
        function tone(freq, start, dur) {
          var o = ctx.createOscillator();
          var g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(start);
          o.stop(start + dur + 0.02);
        }
        tone(880, now, 0.16);
        tone(1320, now + 0.18, 0.22);
        setTimeout(function () { resolve(true); }, 480);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function playBeepFile() {
    return new Promise(function (resolve) {
      var a = $("alertSound");
      if (!a) return resolve(false);
      try {
        a.muted = false;
        a.volume = Number(cfg.soundVolume != null ? cfg.soundVolume : 1);
        a.currentTime = 0;
        var p = a.play();
        if (p && p.then) {
          p.then(function () { resolve(true); }).catch(function () { resolve(false); });
        } else {
          resolve(true);
        }
      } catch (e) {
        resolve(false);
      }
    });
  }

  function playSound() {
    if (!cfg.sound) return Promise.resolve(false);
    return playBeepFile().then(function (ok) {
      return ok ? true : playBeepWebAudio();
    });
  }

  function buildCallText(senha, guiche, atendente) {
    var texto =
      "Atenção. Senha " + speakSenhaText(senha) +
      ". Dirija-se ao " + speakGuicheText(guiche);
    if (cfg.speakAtendente && atendente && atendente !== "—") {
      texto += ". Atendente " + atendente;
    }
    return texto;
  }

  function speakBrowser(texto) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis) return resolve(false);
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        var utter = new SpeechSynthesisUtterance(texto);
        utter.lang = "pt-BR";
        utter.rate = Number(cfg.speakRate || 0.78);
        utter.pitch = 1;
        utter.volume = 1;
        var voices = window.speechSynthesis.getVoices() || [];
        var pt = voices.find(function (v) { return /pt-BR|pt_BR/i.test(v.lang); })
          || voices.find(function (v) { return /pt|Portuguese|Brasil/i.test(v.lang + " " + v.name); });
        if (pt) utter.voice = pt;
        var done = false;
        function finish(ok) {
          if (done) return;
          done = true;
          resolve(!!ok);
        }
        utter.onend = function () { finish(true); };
        utter.onerror = function () { finish(false); };
        window.speechSynthesis.speak(utter);
        setTimeout(function () {
          try { window.speechSynthesis.resume(); } catch (e) {}
        }, 150);
        setTimeout(function () {
          if (!done) finish(window.speechSynthesis.speaking || window.speechSynthesis.pending);
        }, 1500);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function speakGoogleAudio(texto) {
    return new Promise(function (resolve) {
      try {
        if (ttsAudio) {
          try { ttsAudio.pause(); } catch (e) {}
        }
        var parts = [];
        var rest = String(texto);
        while (rest.length > 0) {
          if (rest.length <= 160) {
            parts.push(rest);
            break;
          }
          var cut = rest.lastIndexOf(" ", 150);
          if (cut < 40) cut = 150;
          parts.push(rest.slice(0, cut));
          rest = rest.slice(cut).trim();
        }

        var i = 0;
        function next() {
          if (i >= parts.length) return resolve(true);
          var q = encodeURIComponent(parts[i++]);
          var url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&q=" + q;
          ttsAudio = new Audio(url);
          ttsAudio.volume = Number(cfg.soundVolume != null ? cfg.soundVolume : 1);
          ttsAudio.onended = function () { setTimeout(next, 180); };
          ttsAudio.onerror = function () { resolve(i > 1); };
          ttsAudio.play().then(function () {}).catch(function () { resolve(false); });
        }
        next();
      } catch (e) {
        resolve(false);
      }
    });
  }

  function speakTextOnce(texto) {
    var engine = String(cfg.speakEngine || "google").toLowerCase();
    if (engine === "browser") return speakBrowser(texto);
    if (engine === "auto") {
      return speakBrowser(texto).then(function (ok) {
        if (ok) return true;
        return speakGoogleAudio(texto);
      });
    }
    // google (padrão na TV): só áudio HTML5
    return speakGoogleAudio(texto).then(function (ok) {
      if (ok) return true;
      return speakBrowser(texto);
    });
  }

  function speakCall(senha, guiche, atendente) {
    if (!cfg.speak && !cfg.sound) return;
    if (!audioUnlocked) {
      pendingSpeak = { senha: senha, guiche: guiche, atendente: atendente };
      setUnlockUi(false, "Toque para ativar o som da TV");
      if (cfg.autoUnlock !== false) tryAutoUnlock();
      return;
    }

    var texto = buildCallText(senha, guiche, atendente);
    var repeats = Number(cfg.speakRepeats != null ? cfg.speakRepeats : 2);
    var i = 0;

    function round() {
      if (i >= repeats) return;
      i += 1;
      playSound().then(function () {
        if (!cfg.speak) return null;
        return speakTextOnce(texto);
      }).then(function () {
        if (i < repeats) setTimeout(round, 650);
      });
    }
    round();
  }

  function unlockAudio() {
    ensureAudioContext();
    var btn = $("audioUnlock");
    if (btn) btn.textContent = "Ativando áudio…";

    playSound().then(function (okSound) {
      audioUnlocked = true;
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
      if (!cfg.speak) {
        setUnlockUi(true, "Som ativo");
        return null;
      }
      // Na TV: fala confirmação via áudio HTML5 (Google TTS)
      return speakTextOnce("Som do painel ativado. Pronto para chamar senhas.");
    }).then(function () {
      if (!audioUnlocked) return;
      setUnlockUi(true, "Áudio ativo — pronto para chamar");
      if (pendingSpeak) {
        var p = pendingSpeak;
        pendingSpeak = null;
        setTimeout(function () {
          speakCall(p.senha, p.guiche, p.atendente);
        }, 800);
      }
    }).catch(function () {
      // mesmo se a voz falhar, mantém beep liberado se já tocou
      audioUnlocked = true;
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
      setUnlockUi(true, "Som liberado (voz pode depender da internet)");
    });
  }

  function tryAutoUnlock() {
    var already = false;
    try { already = localStorage.getItem(STORAGE_KEY) === "1"; } catch (e) {}
    if (!(already || cfg.autoUnlock)) return;

    ensureAudioContext();
    playBeepWebAudio().then(function (ok) {
      return ok ? true : playBeepFile();
    }).then(function (ok) {
      if (!ok) return;
      audioUnlocked = true;
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
      setUnlockUi(true, "Áudio automático ativo");
      if (pendingSpeak) {
        var p = pendingSpeak;
        pendingSpeak = null;
        speakCall(p.senha, p.guiche, p.atendente);
      }
    });
  }

  function renderHistory() {
    var ul = $("historyList");
    ul.innerHTML = "";
    history.forEach(function (h) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="h-senha">' + h.senha + "</span>" +
        '<span class="h-guiche">' + h.guiche + "</span>" +
        '<span class="h-atendente">' + (h.atendente || "—") + "</span>";
      ul.appendChild(li);
    });
  }

  async function showCall(item, isNew) {
    if (!item) return;

    var senha = formatSenha(item);
    var guiche = formatGuiche(item);
    var prioridade = item.prioridade || "";
    if (typeof prioridade === "object") prioridade = prioridade.nome || "";
    var peso = Number(item.peso || 0);
    var servico = "";
    if (item.servico) {
      servico = typeof item.servico === "string" ? item.servico : (item.servico.nome || "");
    }

    var atendente = await enrichAtendente(item);

    $("senhaNumero").textContent = senha;
    $("guiche").textContent = guiche;
    $("atendente").textContent = atendente || "—";
    $("servico").textContent = servico;
    $("senhaPrioridade").textContent = peso > 0 ? (prioridade || "Preferencial") : (prioridade === "Normal" ? "" : prioridade);
    $("hint").textContent = "Dirija-se ao " + guiche;

    var main = $("mainCall");
    if (isNew) {
      main.classList.remove("pulse");
      void main.offsetWidth;
      main.classList.add("pulse");
      speakCall(senha, guiche, atendente);
    }

    history = history.filter(function (h) { return h.id !== item.id; });
    history.unshift({
      id: item.id,
      senha: senha,
      guiche: guiche,
      atendente: atendente || "—"
    });
    if (history.length > 8) history.pop();
    renderHistory();
  }

  async function fetchPanelCalls() {
    var unidade = Number(cfg.unidadeId || 1);
    var qs = "";
    if (cfg.servicos) {
      qs = "?servicos=" + encodeURIComponent(String(cfg.servicos).replace(/\s+/g, ""));
    }
    return apiGet("/api/unidades/" + unidade + "/painel" + qs);
  }

  async function refresh(forceSpeak) {
    try {
      var list = await fetchPanelCalls();
      if (!Array.isArray(list) || list.length === 0) {
        $("hint").textContent = "Aguardando chamada…";
        return;
      }
      var current = list[0];
      var isNew = forceSpeak || (current.id !== lastCallId);
      lastCallId = current.id;
      await showCall(current, isNew);

      for (var i = 1; i < Math.min(list.length, 8); i++) {
        var it = list[i];
        if (history.some(function (h) { return h.id === it.id; })) continue;
        var nome = await enrichAtendente(it);
        history.push({
          id: it.id,
          senha: formatSenha(it),
          guiche: formatGuiche(it),
          atendente: nome || "—"
        });
      }
      if (history.length > 8) history = history.slice(0, 8);
      renderHistory();
    } catch (e) {
      console.error(e);
      $("hint").textContent = e.message || "Erro ao atualizar painel";
    }
  }

  async function connectMercure() {
    if (!cfg.useMercure || typeof EventSource === "undefined") return;
    try {
      var info = await apiGet("/api");
      var url = cfg.mercureUrl || info.mercureUrl || info.mercure_url || "";
      if (!url) return;

      var topics = [
        "/unidades/" + (cfg.unidadeId || 1),
        "http://novosga.org/unidades/" + (cfg.unidadeId || 1),
        "*"
      ];
      var hub = new URL(url, window.location.origin);
      topics.forEach(function (t) { hub.searchParams.append("topic", t); });

      if (eventSource) {
        try { eventSource.close(); } catch (e) {}
      }

      eventSource = new EventSource(hub.toString());
      eventSource.onmessage = function () { refresh(true); };
      eventSource.onerror = function () {
        console.warn("Mercure desconectado; mantendo polling.");
      };
    } catch (e) {
      console.warn("Mercure indisponível", e);
    }
  }

  function boot() {
    if (cfg.unidadeNome) $("unityName").textContent = cfg.unidadeNome;

    // Smart TV: voz do navegador quase nunca funciona — força áudio HTML5
    var ua = navigator.userAgent || "";
    if (/SmartTV|Smart-TV|Web0S|WebOS|Tizen|BRAVIA|VIDAA|Vizio|AppleTV|CrKey|AFT|TV /i.test(ua)) {
      if (!cfg.speakEngine || cfg.speakEngine === "auto") {
        cfg.speakEngine = "google";
      }
    }

    var unlockBtn = $("audioUnlock");
    if ((cfg.speak || cfg.sound) && unlockBtn) {
      unlockBtn.hidden = false;
      unlockBtn.focus();

      function onActivate(ev) {
        if (ev) ev.preventDefault();
        unlockAudio();
      }

      unlockBtn.addEventListener("click", onActivate);
      unlockBtn.addEventListener("touchend", onActivate);
      // Controles de TV (OK / Enter / Space / setas + OK)
      document.addEventListener("keydown", function (ev) {
        if (audioUnlocked) return;
        var k = ev.key || "";
        var code = ev.keyCode || 0;
        if (
          k === "Enter" || k === " " || k === "Spacebar" ||
          k === "OK" || k === "Select" ||
          code === 13 || code === 32 || code === 23 || code === 10
        ) {
          onActivate(ev);
        }
      });
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () {
        window.speechSynthesis.getVoices();
      };
    }

    // tenta automático (raro em TV; se falhar, tela de OK permanece)
    setTimeout(tryAutoUnlock, 500);

    nowClock();
    setInterval(nowClock, 1000);
    refresh(false);
    setInterval(function () { refresh(false); }, cfg.pollIntervalMs || 3000);
    connectMercure();
  }

  boot();
})();
