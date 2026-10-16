# Kliny

Controle financeiro pessoal na web: receitas e gastos, cofres para guardar dinheiro com metas,
orçamento por categoria, lançamentos recorrentes e parcelados, importação de extrato (OFX e CSV),
relatórios com gráficos e um simulador de aportes. Em português e inglês, com modo escuro e
instalável no celular (PWA).

No ar em **[kliny.app.br](https://kliny.app.br)**.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, Recharts, i18next.
- **Backend:** ASP.NET Core Web API (.NET 10), Entity Framework Core 9 com Pomelo (MySQL).
- **Banco:** MySQL 8.4 LTS.
- **Deploy:** Docker Compose (MySQL, API, nginx e `cloudflared`), atrás de um túnel da Cloudflare,
  sem nenhuma porta aberta na máquina.

## Segurança

O Kliny guarda dados financeiros de pessoas reais, então a segurança vem antes de tudo:

- Cada dado pertence a um único usuário, filtrado pelo token em todos os serviços e de novo por um
  filtro global do banco. Testes no CI conferem, endpoint por endpoint, que uma pessoa não acessa
  os dados de outra.
- Senhas com BCrypt, sessões JWT de 60 minutos com revogação ("sair de todos os dispositivos"),
  limite de tentativas no login, no cadastro e na recuperação de senha, e respostas que não revelam
  se um e-mail tem conta.
- CSP sem `unsafe-inline`, cabeçalhos de segurança em toda resposta e nada da API guardado no
  navegador ou no service worker.
- O usuário do banco da aplicação só tem `SELECT`, `INSERT`, `UPDATE` e `DELETE`; as migrations
  rodam com outro usuário.
- Backups cifrados com GPG, com a chave privada fora da máquina.
- No CI: gitleaks no histórico inteiro, actions fixadas pelo SHA e Dependabot.

Encontrou uma falha? Veja o [SECURITY.md](SECURITY.md) para relatar em privado.

## Como rodar

O jeito mais simples é a mesma pilha de produção, só no seu computador, com o Docker. No PowerShell,
dentro da pasta `deploy`:

```powershell
powershell -ExecutionPolicy Bypass -File .\criar-segredos.ps1
docker compose --profile migrate build
docker compose --profile migrate run --rm migrate
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

O site fica em `http://localhost:8080`. O `criar-segredos.ps1` gera o `deploy/.env` com senhas
aleatórias (fora do Git). Sem a chave do [Resend](https://resend.com) no `.env`, nenhum e-mail é
enviado, e o cadastro, que confirma o e-mail por link, não termina. O passo a passo completo,
inclusive o túnel e os backups, está no [deploy/README.md](deploy/README.md).

### Desenvolvimento

- **Frontend** (pasta `frontend`): `npm ci` e `npm run dev`. O Vite repassa `/api` para
  `http://localhost:5228`.
- **Backend** (pasta `backend`): a conexão com o MySQL e a chave do JWT ficam no user-secrets
  (`ConnectionStrings:DefaultConnection` e `Jwt:Key`, com pelo menos 32 caracteres); depois,
  `dotnet run`.
- **Testes:** `npm test` no frontend e `dotnet test --solution Kliny.sln` na raiz. Os testes com
  MySQL precisam da variável `KLINY_TEST_MYSQL`; o `scripts/backend-tests-docker.sh` sobe um MySQL
  descartável e roda tudo num container, como no CI.

## Licença

O código está sob a [GNU Affero General Public License v3.0](LICENSE): você pode usar, estudar,
modificar e redistribuir, e quem colocar uma versão modificada no ar como serviço precisa publicar o
código dela sob a mesma licença.

O nome **Kliny** e o mascote (o hamster, em `frontend/public/mascote/`) identificam o projeto e não
estão incluídos na licença: num fork, use outro nome e outras imagens. A fonte Bricolage Grotesque
segue a própria licença (SIL OFL 1.1, em `frontend/public/licencas/`).
