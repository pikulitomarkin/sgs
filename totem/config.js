// Configuração do totem SGS
// Em Docker, API_BASE usa o proxy nginx (/api → novosga)
window.SGS_TOTEM_CONFIG = {
  // URL base da API (vazio = mesma origem via proxy /api)
  apiBase: "",

  // Credenciais OAuth (Admin NovoSGA → API / Clientes)
  clientId: "totem",
  clientSecret: "totemsecret",
  username: "admin",
  password: "00351master",

  // IDs do sistema (confirme no admin após instalar)
  unidadeId: 1,
  servicoId: 1,
  prioridadeNormalId: 1,
  prioridadePreferencialId: 2,

  // Impressão automática após emitir
  autoPrint: true,

  // Tempo (ms) para fechar o cartão da senha automaticamente
  autoCloseMs: 8000,

  // Nome exibido
  unidadeNome: "Cartório SGS"
};
