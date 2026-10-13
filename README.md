# EditLab AI

Landing page da EditLab AI com identidade visual preta e verde neon, vídeo vertical na Hero e contagem de R$ 1.200 até R$ 97 em 2 segundos.

## Executar

Use Node.js 22 ou 24 e npm 10 ou superior.

```sh
npm ci
npm run build
npm start
```

Abra `http://localhost:3000`. `PORT` altera a porta; `HOST` altera o endereço de escuta. `npm run dev` também prepara e inicia a página.

## Editar a página

Os arquivos de origem ficam em `public/`:

- `index.html`: conteúdo e oferta.
- `brand.css`: identidade visual e layout responsivo.
- `app.js`: navegação, player, FAQ e demonstrações.
- `price-countdown.js`: animação do preço.
- `config.js`: checkout e vídeo da Hero.
- `assets/`: logotipo, fontes, imagens e vídeo.

O vídeo da Hero é a versão otimizada do arquivo fornecido pelo cliente, com resolução 1080 × 1920, 24 fps e áudio. O player tem reprodução, pausa, som e tela cheia. O checkout fica pendente em `public/config.js`.

Preço, garantia e grade de aulas devem ser revisados antes da abertura das inscrições. As prévias dos estilos são ilustrações interativas.

## EasyPanel

O repositório inclui `Dockerfile` e configuração Nixpacks para Node 22. Use a branch `main` e porta HTTP **3000**. Em Nixpacks, os comandos são `npm ci`, `npm run build` e `npm start`.

`npm run build` copia os arquivos de `public/` para `dist/`. A pasta gerada fica fora do Git. O servidor oferece suporte a requisições parciais para navegação e reprodução do vídeo.
