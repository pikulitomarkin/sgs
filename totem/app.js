(function () {
  "use strict";

  var cfg = window.SGS_TOTEM_CONFIG || {};
  var busy = false;
  var tokenCache = { accessToken: null, expiresAt: 0 };
  var closeTimer = null;

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
      throw new Error("Falha na autenticação (" + resp.status + "). Cadastre o cliente OAuth no admin. " + errText);
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
      var payload = {
        unidade: Number(cfg.unidadeId || 1),
        servico: Number(servicoId || cfg.servicoId || 1),
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
      mostrarTicket(atendimento, tipoLabel);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Erro ao emitir senha", true);
    } finally {
      setBusy(false);
    }
  }

  function extrairSenha(atendimento) {
    if (!atendimento) return "—";
    if (atendimento.senha && typeof atendimento.senha === "object") {
      var s = atendimento.senha;
      if (s.sigla || s.numero != null) {
        return String(s.sigla || "") + String(s.numero != null ? s.numero : "");
      }
      if (s.numeroFormatado) return s.numeroFormatado;
    }
    if (typeof atendimento.senha === "string") return atendimento.senha;
    if (atendimento.numero) return String(atendimento.numero);
    return "—";
  }

  function extrairServico(atendimento) {
    if (atendimento && atendimento.servico) {
      if (typeof atendimento.servico === "string") return atendimento.servico;
      return atendimento.servico.nome || atendimento.servico.name || "";
    }
    return "";
  }

  function mostrarTicket(atendimento, tipoLabel) {
    var numero = extrairSenha(atendimento);
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
      }, 250);
    }

    if (closeTimer) clearTimeout(closeTimer);
    if (cfg.autoCloseMs > 0) {
      closeTimer = setTimeout(fecharTicket, cfg.autoCloseMs);
    }
  }

  function montarImpressao(numero, tipo, servico, hora) {
    var area = $("printArea");
    if (!area) return;
    area.innerHTML =
      '<div class="print-ticket">' +
      "<div><strong>" + (cfg.unidadeNome || "SGS") + "</strong></div>" +
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

  // Funções usadas pelos botões (corrige o erro emitirTabletNormal is not defined)
  window.emitirTabletNormal = function emitirTabletNormal() {
    return emitirSenha(
      cfg.prioridadeNormalId || 1,
      "Normal",
      cfg.servicoNormalId || cfg.servicoId || 1
    );
  };

  window.emitirTabletPreferencial = function emitirTabletPreferencial() {
    return emitirSenha(
      cfg.prioridadePreferencialId || 2,
      "Preferencial",
      cfg.servicoPreferencialId || cfg.servicoId || 1
    );
  };

  // aliases
  window.emitirTabletPrioritario = window.emitirTabletPreferencial;
})();
