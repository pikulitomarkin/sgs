# Impressão silenciosa no tablet (RawBT)

O totem usa `printMode: "rawbt"` para **não abrir** a tela de impressão do Chrome.

## No tablet Android

1. Instale o app **RawBT**  
   https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter
2. Abra o RawBT e configure a impressora (Bematech / Bluetooth / USB / rede).
3. Em **Settings / Configurações** do RawBT, ative:
   - **Start printing automatically** / Imprimir automaticamente
   - **Default printer** = sua Bematech
4. Abra o totem no Chrome: `http://IP:8082/?v=13`
5. Na primeira impressão, se o Android perguntar, escolha **RawBT** e marque **Sempre**.

## Voltar ao diálogo do Chrome

Em `totem/config.js`:

```js
printMode: "browser",
```

## Se não imprimir

- Confirme que o RawBT está aberto e a impressora online.
- Teste no RawBT o botão de impressão de teste.
- Se precisar do diálogo antigo: `printMode: "browser"`.
