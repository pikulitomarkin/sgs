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

## Importante — logo enorme no papel

Se ainda sair um **bloco preto grande** com a logo no topo, isso vem do **RawBT**, não do totem.

No app RawBT:
1. Settings / Configurações
2. Desative **Print logo** / **Cabeçalho** / imagem padrão
3. Salve e teste de novo

O totem agora imprime só texto (sem imagem) + senha grande + avanço de papel antes do corte.
