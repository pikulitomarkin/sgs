// Configuração do painel de chamadas (TV / monitor)
window.SGS_PAINEL_CONFIG = {
  // Vazio = mesma origem via proxy nginx /api
  apiBase: "",

  // OAuth (Admin NovoSGA → API / Clientes)
  clientId: "painel",
  clientSecret: "painelsecret",
  username: "admin",
  password: "00351master",

  // Unidade e serviços exibidos
  unidadeId: 1,
  unidadeNome: "Cartório SGS",
  // IDs separados por vírgula. Vazio = todos os serviços da unidade
  servicos: "",

  // Atualização
  pollIntervalMs: 3000,
  useMercure: true,
  // IP do servidor na LAN (TV/guichês)
  mercureUrl: "http://192.168.18.176:3000/.well-known/mercure",

  // Exibição
  showAtendente: true,
  speak: true,
  sound: true,

  // Prefixo do local na tela (ex.: Guichê 1)
  localPrefixFallback: "Guichê"
};
