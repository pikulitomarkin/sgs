(function () {
  "use strict";

  var cfg = window.SGS_TOTEM_CONFIG || {};
  var busy = false;
  var tokenCache = { accessToken: null, expiresAt: 0 };
  var closeTimer = null;
  var DIGITS = 3;

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, isError) {
    var el = $("status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("error", !!isError);
  }

  function setBusy(state) {
    busy = state;
    var n = $("btnNormal");
    var p = $("btnPreferencial");
    if (n) n.disabled = state;
    if (p) p.disabled = state;
  }

  function apiUrl(path) {
    var base = (cfg.apiBase || "").replace(/\/$/, "");
    return base + path;
  }

  function pad3(n) {
    var s = String(n == null ? "" : n).replace(/\D/g, "");
    if (!s) s = "0";
    var d = Number(cfg.senhaDigitos != null ? cfg.senhaDigitos : DIGITS);
    while (s.length < d) s = "0" + s;
    return s;
  }

  /** Sempre A001 / P001 — nunca A1 ou P5 */
  function senhaFinal(sigla, numero) {
    var letter = String(sigla || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
    return letter + pad3(numero);
  }

  function normalizarTextoSenha(texto) {
    var raw = String(texto || "").trim().toUpperCase();
    var m = raw.match(/^([A-Z]+)\s*0*(\d+)$/);
    if (m) return senhaFinal(m[1], m[2]);
    return raw || "—";
  }

  function extrairSenha(atendimento) {
    if (!atendimento) return "—";

    // campos soltos do NovoSGA
    if (atendimento.senhaSigla != null || atendimento.senhaNumero != null) {
      return senhaFinal(atendimento.senhaSigla, atendimento.senhaNumero);
    }
    if (atendimento.siglaSenha != null || atendimento.numeroSenha != null) {
      return senhaFinal(atendimento.siglaSenha, atendimento.numeroSenha);
    }

    if (atendimento.senha && typeof atendimento.senha === "object") {
      var s = atendimento.senha;
      if (s.sigla != null || s.numero != null) {
        return senhaFinal(s.sigla, s.numero);
      }
      if (s.numeroFormatado) return normalizarTextoSenha(s.numeroFormatado);
    }

    if (typeof atendimento.senha === "string") {
      return normalizarTextoSenha(atendimento.senha);
    }

    // fallback: às vezes vem no topo
    if (atendimento.sigla || atendimento.numero != null) {
      return senhaFinal(atendimento.sigla, atendimento.numero);
    }

    return "—";
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
      var errText = await resp.text();
      throw new Error("Falha na autenticação (" + resp.status + "). " + errText);
    }

    var data = await resp.json();
    tokenCache.accessToken = data.access_token;
    tokenCache.expiresAt = agora + ((data.expires_in || 3600) * 1000);
    return tokenCache.accessToken;
  }

  async function emitirSenha(prioridadeId, tipoLabel, servicoId) {
    if (busy) return;
    setBusy(true);
    setStatus("Emitindo senha…");

    try {
      var token = await obterToken();
      var sid = Number(servicoId) || Number(cfg.servicoId || 6);
      var payload = {
        unidade: Number(cfg.unidadeId || 2),
        servico: sid,
        prioridade: Number(prioridadeId)
      };

      var resp = await fetch(apiUrl("/api/distribui"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        var detail = await resp.text();
        throw new Error("Não foi possível emitir (" + resp.status + "). " + detail);
      }

      var atendimento = await resp.json();
      console.log("[totem] atendimento", atendimento);
      mostrarTicket(atendimento, tipoLabel);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Erro ao emitir senha", true);
    } finally {
      setBusy(false);
    }
  }

  function extrairServico(atendimento) {
    if (atendimento && atendimento.servico) {
      if (typeof atendimento.servico === "string") return atendimento.servico;
      return atendimento.servico.nome || atendimento.servico.name || "";
    }
    return "";
  }

  function mostrarTicket(atendimento, tipoLabel) {
    var numero = normalizarTextoSenha(extrairSenha(atendimento));
    // se API não trouxe sigla, força pela tipagem do botão
    if (!/^[A-Z]+\d+$/.test(numero)) {
      var fallbackLetter = /preferencial/i.test(tipoLabel) ? "P" : "A";
      var onlyNum = String(numero).replace(/\D/g, "") || "0";
      numero = senhaFinal(fallbackLetter, onlyNum);
    }

    var servico = extrairServico(atendimento);
    var agora = new Date();
    var hora = agora.toLocaleString("pt-BR");

    $("ticketType").textContent = tipoLabel;
    $("ticketNumber").textContent = numero;
    $("ticketService").textContent = servico;
    $("ticketTime").textContent = hora;
    $("ticketOverlay").hidden = false;

    montarImpressao(numero, tipoLabel, servico, hora);

    if (cfg.autoPrint) {
      setTimeout(function () {
        try { window.print(); } catch (err) { console.warn(err); }
      }, 300);
    }

    if (closeTimer) clearTimeout(closeTimer);
    if (cfg.autoCloseMs > 0) {
      closeTimer = setTimeout(fecharTicket, cfg.autoCloseMs);
    }
  }

  function montarImpressao(numero, tipo, servico, hora) {
    var area = $("printArea");
    if (!area) return;
    var titulo = cfg.unidadeNome || "2º Ofício de Notas e Registro de Imóveis";
    area.innerHTML =
      '<div class="print-ticket">' +
      "<div><strong>" + titulo + "</strong></div>" +
      "<div>" + tipo + "</div>" +
      '<div class="num">' + numero + "</div>" +
      (servico ? "<div>" + servico + "</div>" : "") +
      "<div>" + hora + "</div>" +
      "<div>Aguarde ser chamado</div>" +
      "</div>";
  }

  window.fecharTicket = function fecharTicket() {
    if (closeTimer) clearTimeout(closeTimer);
    $("ticketOverlay").hidden = true;
    setStatus("");
  };

  window.emitirTabletNormal = function emitirTabletNormal() {
    return emitirSenha(
      cfg.prioridadeNormalId || 3,
      "Normal",
      cfg.servicoNormalId || cfg.servicoId || 6
    );
  };

  window.emitirTabletPreferencial = function emitirTabletPreferencial() {
    return emitirSenha(
      cfg.prioridadePreferencialId || 4,
      "Preferencial",
      cfg.servicoPreferencialId || cfg.servicoId || 7
    );
  };

  window.emitirTabletPrioritario = window.emitirTabletPreferencial;
})();
