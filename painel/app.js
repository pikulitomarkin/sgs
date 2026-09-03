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
    var s = String(n == null ? "" : n);
    while (s.length < (size || 3)) s = "0" + s;
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
    var sigla = item.siglaSenha || item.sigla || "";
    var num = item.numeroSenha != null ? item.numeroSenha : item.numero;
    if (num == null && item.senha) {
      sigla = item.senha.sigla || sigla;
      num = item.senha.numero;
    }
    return String(sigla || "") + pad(num, 3);
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
    // Preferência: detalhe do atendimento
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
      console.warn("Não foi possível obter atendente", e);
      return extractAtendente(null, item) || "—";
    }
  }

  function speakCall(senha, guiche, atendente) {
    if (!cfg.speak || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      var texto = "Senha " + senha.split("").join(" ") + ". " + guiche;
      if (atendente && atendente !== "—") {
        texto += ". Atendente " + atendente;
      }
      var utter = new SpeechSynthesisUtterance(texto);
      utter.lang = "pt-BR";
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn(e);
    }
  }

  function playSound() {
    if (!cfg.sound) return;
    var a = $("alertSound");
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play().catch(function () {});
    } catch (e) {}
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
      playSound();
      speakCall(senha, guiche, atendente);
    }

    // histórico
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

      // preencher histórico com o restante
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
      if (!url) {
        console.warn("Mercure URL não disponível; usando polling.");
        return;
      }

      // Assina tópicos comuns do NovoSGA; se falhar, polling cobre
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
      eventSource.onmessage = function () {
        refresh(true);
      };
      eventSource.onerror = function () {
        console.warn("Mercure desconectado; mantendo polling.");
      };
    } catch (e) {
      console.warn("Mercure indisponível", e);
    }
  }

  function boot() {
    if (cfg.unidadeNome) $("unityName").textContent = cfg.unidadeNome;
    nowClock();
    setInterval(nowClock, 1000);
    refresh(false);
    setInterval(function () { refresh(false); }, cfg.pollIntervalMs || 3000);
    connectMercure();
  }

  boot();
})();
