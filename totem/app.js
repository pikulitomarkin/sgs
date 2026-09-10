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
        imprimirSenha(numero, tipoLabel, servico, hora);
      }, 250);
    }

    if (closeTimer) clearTimeout(closeTimer);
    if (cfg.autoCloseMs > 0) {
      closeTimer = setTimeout(fecharTicket, cfg.autoCloseMs);
    }
  }

  function montarTextoCupom(numero, tipo, servico, hora) {
    var titulo = cfg.unidadeNomeCurto || cfg.unidadeNome || "2º Ofício";
    var tipoTxt = String(tipo || "").toUpperCase();
    var linhas = [
      titulo,
      "--------------------------------",
      tipoTxt,
      "",
      numero,
      "",
      servico ? String(servico) : "",
      String(hora || ""),
      "Aguarde ser chamado",
      "",
      "",
      ""
    ];
    return linhas.filter(function (l, i, arr) {
      // mantém linha em branco intencional após a senha
      return true;
    }).join("\n");
  }

  /** ESC/POS: senha grande e centralizada (Bematech / térmicas) */
  function montarEscPosCupom(numero, tipo, servico, hora) {
    var ESC = "\x1B";
    var GS = "\x1D";
    var titulo = cfg.unidadeNomeCurto || cfg.unidadeNome || "2º Ofício";
    var tipoTxt = String(tipo || "").toUpperCase();
    var out = "";
    out += ESC + "@";           // init
    out += ESC + "a\x00";       // left
    out += titulo + "\n";
    out += "--------------------------------\n";
    out += ESC + "a\x01";       // center
    out += ESC + "E\x01";       // bold on
    out += tipoTxt + "\n";
    out += ESC + "E\x00";
    out += GS + "!\x33";        // bem grande (largura/altura)
    out += String(numero) + "\n";
    out += GS + "!\x00";        // tamanho normal
    if (servico) out += String(servico) + "\n";
    out += String(hora || "") + "\n";
    out += ESC + "E\x01";
    out += "Aguarde ser chamado\n";
    out += ESC + "E\x00";
    out += "\n\n\n";
    out += ESC + "i";           // cut parcial (se suportado)
    return out;
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function binaryToBase64(binStr) {
    // ESC/POS: bytes 0-255; títulos UTF-8 podem quebrar — usamos latin1 seguro
    var s = String(binStr);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      out += String.fromCharCode(s.charCodeAt(i) & 0xff);
    }
    return btoa(out);
  }

  function printRawBT(payload, useBase64) {
    try {
      var url;
      if (useBase64) {
        url = "rawbt:base64," + payload;
      } else {
        url =
          "intent:" +
          encodeURI(payload) +
          "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
      }

      // iframe evita “piscar” a página; fallback para location
      var iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;";
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(function () {
        try { document.body.removeChild(iframe); } catch (e) {}
      }, 4000);

      // reforço via location (alguns Chrome só aceitam assim)
      setTimeout(function () {
        try {
          var a = document.createElement("a");
          a.href = url;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            try { document.body.removeChild(a); } catch (e2) {}
          }, 1000);
        } catch (e) {
          window.location.href = url;
        }
      }, 120);

      return true;
    } catch (e) {
      console.warn("RawBT falhou", e);
      return false;
    }
  }

  function imprimirSenha(numero, tipo, servico, hora) {
    var mode = String(cfg.printMode || "rawbt").toLowerCase();

    if (mode === "browser") {
      try { window.print(); } catch (err) { console.warn(err); }
      return;
    }

    // Padrão: RawBT direto (sem diálogo do Chrome)
    // 1) tenta ESC/POS base64 (senha grande)
    var esc = montarEscPosCupom(numero, tipo, servico, hora);
    var ok = printRawBT(binaryToBase64(esc), true);

    if (!ok) {
      // 2) texto UTF-8 via intent
      var txt = montarTextoCupom(numero, tipo, servico, hora);
      ok = printRawBT(txt, false);
    }

    if (!ok && cfg.printFallbackBrowser !== false) {
      try { window.print(); } catch (err) { console.warn(err); }
    }
  }

  function montarImpressao(numero, tipo, servico, hora) {
    var area = $("printArea");
    if (!area) return;
    var titulo = cfg.unidadeNomeCurto || cfg.unidadeNome || "2º Ofício de Notas e Registro de Imóveis";
    var tipoTxt = String(tipo || "").toUpperCase();
    var logoSrc = cfg.logoUrl || "assets/logo-cartorio.png";
    area.innerHTML =
      '<div class="print-ticket">' +
      '<div class="print-head">' +
      '<img class="print-logo" src="' + logoSrc + '" alt="" />' +
      '<p class="print-brand">' + titulo + "</p>" +
      "</div>" +
      '<p class="print-type">' + tipoTxt + "</p>" +
      '<p class="print-num">' + numero + "</p>" +
      (servico ? '<p class="print-svc">' + servico + "</p>" : "") +
      '<p class="print-time">' + hora + "</p>" +
      '<p class="print-msg">Aguarde ser chamado</p>' +
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
