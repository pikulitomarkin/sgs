// Totem — 2º Ofício de Notas e Registro de Imóveis (Tabuleiro do Norte - CE)
window.SGS_TOTEM_CONFIG = {
  apiBase: "",

  clientId: "de68badb6f990b5ec99d5fad8f441d50",
  clientSecret: "57355874b476cf0f3fdc0088b6661b334336fa5485ece87744c63da020d7681b4ed0aa7ad1e886e9c67d41b2d78a369f5a25223d28a979e87ea3626f090cdb27",
  username: "admin",
  password: "00351master",

  unidadeId: 2,
  // Normal = A (serviço 6) | Preferencial = P (serviço 7)
  servicoId: 6,
  servicoNormalId: 6,
  servicoPreferencialId: 7,
  prioridadeNormalId: 3,
  prioridadePreferencialId: 4,

  autoPrint: true,
  // rawbt = impressão direta no tablet (sem tela do Chrome)
  // browser = abre o diálogo de impressão
  printMode: "rawbt",
  autoCloseMs: 8000,
  // Exibir/imprimir como A001, P001 (3 dígitos)
  senhaDigitos: 3,
  // Papel térmico Bematech (80mm) — margem ~3mm cada lado
  papelMm: 80,
  margemMm: 3,
  logoUrl: "assets/logo-cartorio.png",
  // RawBT: não manda imagem (evita logo enorme). Desative também o logo no app RawBT.
  printShowLogo: false,
  unidadeNome: "2º Ofício de Notas e Registro de Imóveis",
  unidadeNomeCurto: "2o Oficio - Tabuleiro do Norte/CE"
};
