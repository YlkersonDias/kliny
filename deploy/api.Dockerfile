# API e migrações do Kliny (S.7). Contexto: a raiz do repositório.
#   api      → a API, como usuário sem privilégios (app), na porta 8080.
#   migrate  → só aplica as migrations, com o kliny_migrator, e termina.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json Kliny.sln ./
COPY backend/Backend.csproj backend/
RUN dotnet restore backend/Backend.csproj
COPY backend/ backend/
RUN dotnet publish backend/Backend.csproj -c Release -o /out/api --no-restore

# Pacote de migrations do EF: um executável que aplica as migrations pendentes e sai.
# A versão do dotnet-ef acompanha a do EF Core (9.0.0). O EF sobe o Program.cs para montar o
# modelo, e a API não sobe sem Jwt:Key: aqui vai uma chave aleatória, descartada no fim do passo.
RUN dotnet tool install --global dotnet-ef --version 9.0.0
ENV PATH="${PATH}:/root/.dotnet/tools"
RUN Jwt__Key="$(head -c 48 /dev/urandom | base64)" \
    dotnet ef migrations bundle --project backend/Backend.csproj -o /out/migrate/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
COPY --from=build /out/api .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Backend.dll"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS migrate
WORKDIR /app
COPY --from=build /out/migrate/efbundle .
COPY --from=build /out/api/appsettings.json .
USER $APP_UID
# A connection string (com o kliny_migrator) vem da variável MIGRATOR_CONNECTION. O pacote sobe o
# Program.cs para montar o modelo, que exige uma connection string e uma Jwt:Key: a mesma conexão
# e uma chave aleatória, que não assina nada e some quando o container termina.
ENTRYPOINT ["sh", "-c", "export ConnectionStrings__DefaultConnection=\"$MIGRATOR_CONNECTION\" Jwt__Key=\"$(head -c 48 /dev/urandom | base64)\"; exec ./efbundle --connection \"$MIGRATOR_CONNECTION\""]
