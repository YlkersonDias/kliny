# Kliny no seu PC, com a Cloudflare

O Kliny inteiro roda em containers Docker no seu PC: o MySQL, a API, o nginx (que serve o site e repassa `/api` para a API) e o `cloudflared`. O `cloudflared` abre uma conexão **de saída** até a Cloudflare, e quem acessa `https://kliny.app.br` chega por ela. Nenhuma porta do PC fica aberta para a internet, e o seu IP de casa não aparece.

Todos os comandos abaixo são no PowerShell, **dentro da pasta `deploy`** do repositório.

## 1. Uma vez só: preparar o PC

1. No Docker Desktop, em *Settings → General*, ligue **"Start Docker Desktop when you sign in"**. Assim o Kliny volta sozinho quando o PC liga (os containers têm `restart: unless-stopped`).
2. Recomendado: **BitLocker** ligado no disco do Windows. O banco guarda dados financeiros de pessoas reais.
3. Gere as senhas e a chave do JWT. Nenhum valor aparece na tela:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\criar-segredos.ps1
   ```

   Isso cria o `deploy\.env` (fora do Git, só o seu usuário do Windows lê) e a pasta de backups `C:\Users\<você>\Kliny-backups`. **Não apague nem perca o `.env`**: sem ele, a API não entra no banco.

## 2. Uma vez só: Cloudflare

1. Crie uma conta gratuita em [cloudflare.com](https://dash.cloudflare.com/sign-up) e adicione o site **`kliny.app.br`** (plano Free).
2. A Cloudflare mostra **dois nameservers**. No [Registro.br](https://registro.br), em *kliny.app.br → DNS → Alterar servidores DNS*, troque pelos dois da Cloudflare. A troca leva de minutos a algumas horas; a Cloudflare avisa por e-mail quando o site ficar ativo.
3. Na Cloudflare, em *SSL/TLS → Edge Certificates*, ligue **"Always Use HTTPS"**.
4. Em *Networking → Tunnels*, **Create a tunnel** (tipo *Cloudflared*), com o nome `kliny`.
5. Na tela de instalação, escolha **Docker** e copie **só o token** (o texto longo depois de `--token`). **Não rode o comando que a Cloudflare mostra**: o `docker-compose.yml` já faz isso. Cole o token no `deploy\.env`, na linha `TUNNEL_TOKEN=`.
6. Na aba *Routes* do túnel, **Add route → Published application**:
   - Subdomain: vazio; Domain: `kliny.app.br`
   - Service URL: `http://web:8080`

## 3. Primeira vez: subir o Kliny

```powershell
docker compose up -d --wait mysql
docker compose --profile migrate run --rm migrate
docker compose --profile tunnel up -d --build
```

O primeiro cria o banco e os usuários (`kliny_app`, `kliny_migrator` e `kliny_backup`), o segundo aplica as migrations com o `kliny_migrator`, e o terceiro sobe a API, o site e o túnel. Depois, abra `https://kliny.app.br`.

Para conferir: `docker compose --profile tunnel ps` (tudo `Up`) e, no painel da Cloudflare, o túnel `kliny` como *Healthy*.

## Backup do banco

Os backups saem **cifrados**: só a chave privada, guardada fora do PC, abre. Antes do primeiro backup, crie a chave (abaixo).

### Chave dos backups (uma vez só)

Com o pen drive (com BitLocker) conectado, na pasta `deploy`, troque `D:` pela letra dele:

```powershell
powershell -ExecutionPolicy Bypass -File .\criar-chave-backup.ps1 -Pasta D:\Kliny-chave
```

- Pede uma **frase-senha** (pelo menos 12 caracteres), duas vezes; ela não aparece na tela e não fica salva em lugar nenhum.
- Cria a **chave pública** em `deploy\chave-backup\publica.asc` (fora do Git). Ela só cifra: quem a pegar não abre nada.
- Cria a **chave privada** em `D:\Kliny-chave\kliny-backup-chave-privada.asc`, protegida pela frase-senha. O script recusa uma pasta no mesmo disco do Kliny.
- **Guarde uma segunda cópia da chave privada** longe do PC (outro pen drive, ou um gerenciador de senhas). **Sem a chave privada e a frase-senha, nenhum backup abre**: perder as duas é perder os backups.
- Depois de criar, confira um backup com `-Conferir` (em "Restaurar").

Para trocar a chave (por exemplo, se a frase-senha vazar): apague o `publica.asc` e rode o script de novo. Os backups antigos continuam abrindo só com a chave privada antiga.

### Fazer um backup

```powershell
powershell -ExecutionPolicy Bypass -File .\backup.ps1
```

Gera `kliny-AAAAMMDD-HHMMSS.sql.gz.gpg` na pasta de backups (o horário do nome é o UTC: 14h é 11h em Brasília). Dentro do container do MySQL, confere o dump (gzip inteiro, tabelas principais e o dump até o fim) e cifra com a chave pública; **o arquivo em claro nunca chega à pasta de backups**. Sem a chave pública, o backup falha (`FALHA` no log), em vez de sair em claro. Apaga os que têm mais de 14 dias, o prazo dito na política de privacidade. Com `BACKUP_COPY_DIR` no `.env` (outro disco, como `H:\Kliny-backups`), copia cada backup para lá, com o mesmo prazo. Cada execução escreve uma linha no `backup.log` da pasta de backups (`OK` ou `FALHA` e o motivo): é ali que se confere se o backup do dia rodou.

O script espera o Docker ficar pronto (até 15 minutos) e tenta até 3 vezes.

### Rodar sozinho todo dia

No PowerShell (comum, sem ser administrador), uma vez só:

```powershell
$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "<pasta do Kliny>\deploy\backup.ps1"'
$quando = New-ScheduledTaskTrigger -Daily -At 21:00
$opcoes = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'Kliny - backup do banco' -Action $acao -Trigger $quando -Settings $opcoes -Description 'Backup diário do banco do Kliny (deploy/backup.ps1).'
```

- Roda todo dia às 21h. Com o PC desligado nesse horário, roda assim que ele ligar (`StartWhenAvailable`).
- Roda com o seu usuário e só com ele conectado, porque o Docker Desktop precisa da sua sessão.
- Para conferir: `Get-ScheduledTaskInfo 'Kliny - backup do banco'` (o `LastTaskResult` 0 é sucesso) e o `backup.log`. Para rodar agora: `Start-ScheduledTask 'Kliny - backup do banco'`. Para tirar: `Unregister-ScheduledTask 'Kliny - backup do banco'`.

### Cópia fora do PC

O SSD e o HD ficam no mesmo PC: um roubo, um incêndio, um raio na rede elétrica ou um vírus que criptografa arquivos levam os dois. **Uma vez por semana**, copie o backup mais recente para um pen drive ou HD externo e guarde-o desligado do PC:

```powershell
Get-ChildItem $env:USERPROFILE\Kliny-backups\kliny-*.sql.gz.gpg | Sort-Object LastWriteTime | Select-Object -Last 1 | Copy-Item -Destination E:\Kliny-backups\
```

(troque `E:` pela letra do pen drive). Os backups já vão cifrados, mas:
- use um pen drive com **BitLocker To Go** (no Explorador, botão direito no pen drive → *Ativar o BitLocker*);
- **apague do pen drive os backups com mais de 14 dias**, como no PC: é o prazo prometido na política de privacidade;
- a chave privada pode ficar no mesmo pen drive dos backups só se ele tiver BitLocker; a segunda cópia dela, em outro lugar.

### Restaurar

Com o pen drive da chave conectado, na pasta `deploy`. **Só conferir** que um backup abre e está completo, sem tocar no banco (bom de fazer de vez em quando):

```powershell
powershell -ExecutionPolicy Bypass -File .\restaurar-backup.ps1 -Arquivo kliny-AAAAMMDD-HHMMSS.sql.gz.gpg -Chave D:\Kliny-chave\kliny-backup-chave-privada.asc -Conferir
```

**Restaurar** (apaga o que estiver no banco e põe o backup no lugar): o mesmo comando, sem o `-Conferir`. Ele pede para digitar `RESTAURAR` e a frase-senha.

- `-Arquivo` é o nome de um backup da pasta de backups, ou o caminho completo de um backup em outro lugar (o pen drive).
- Tudo roda num container descartável: o backup é aberto e conferido inteiro **antes** de tocar no banco, e o conteúdo aberto some com o container.

## Atualizar o Kliny (depois de um merge no main)

```powershell
git pull
docker compose --profile migrate build
docker compose --profile migrate run --rm migrate
docker compose --profile tunnel up -d
```

**Os quatro, nesta ordem.** O `build` remonta as imagens da API, do site **e das migrations**: sem ele, o `migrate` usa a imagem antiga e não aplica a migration nova (aconteceu na publicação da v1.2.0, corrigido na hora).

Para publicar uma versão marcada em vez do `main` atualizado, troque o `git pull` por `git fetch --tags` e `git checkout vX.Y.Z`. Para voltar a uma versão anterior, o mesmo, com a versão anterior (ver "Versões e como voltar" no `CLAUDE.md`).

O `migrate` não faz nada se não houver migration nova. O site fica fora do ar por alguns segundos, enquanto os containers são trocados; quem estiver com o app aberto vê o aviso de nova versão.

## Parar e voltar

- Parar tudo, **sem perder dados**: `docker compose --profile tunnel down`
- Voltar: `docker compose --profile tunnel up -d`
- **Nunca** use `docker compose down -v`: o `-v` apaga o volume do banco, com todos os dados.

## Testar no PC, sem a Cloudflare

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Abre o site em `http://localhost:8080`, só para este computador. O login com o Google não funciona nesse endereço (ele não está nas origens autorizadas do Google).

## Segurança, em resumo

- Nenhuma porta publicada no PC; só o túnel. O MySQL não é acessível de fora dos containers, e o `root` do MySQL só existe dentro do próprio container.
- A API conecta com o `kliny_app` (só `SELECT`, `INSERT`, `UPDATE` e `DELETE`); as migrations, com o `kliny_migrator`; o backup, com o `kliny_backup` (só leitura).
- API e nginx rodam sem root e sem nenhuma *capability* do Linux.
- O IP real de quem acessa vem da Cloudflare e chega à API pelo nginx; só a rede interna dos containers pode informá-lo, então ninguém foge do limite de tentativas trocando cabeçalhos.
