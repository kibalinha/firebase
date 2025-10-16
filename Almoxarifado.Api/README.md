# Backend ASP.NET Core para Almoxarifado

Este projeto contém a API RESTful construída com ASP.NET Core 8 e Entity Framework Core para servir o frontend Angular do sistema de controle de estoque.

## Guia de Configuração Rápida

Siga estes passos para colocar o backend no ar.

### Pré-requisitos

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Um servidor de banco de dados [PostgreSQL](https://www.postgresql.org/download/).

### 1. Crie o Projeto (se ainda não o fez)

Se você está começando do zero, pode criar a estrutura do projeto com este comando:
```sh
dotnet new webapi -n Almoxarifado.Api
```

### 2. Adicione os Arquivos

Copie todos os arquivos C# gerados para as suas respectivas pastas dentro do projeto `Almoxarifado.Api`.

### 3. Instale as Dependências

Navegue até a pasta raiz do projeto (`Almoxarifado.Api`) e instale os pacotes NuGet necessários do Entity Framework Core.

```sh
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
```

### 4. Configure a Conexão com o Banco de Dados

Abra o arquivo `appsettings.Development.json` e atualize a `DefaultConnection` com os seus dados do PostgreSQL.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=almoxarifado_db;Username=postgres;Password=sua_senha_aqui"
  }
}
```

### 5. Crie o Banco de Dados (Migrations)

Execute os seguintes comandos no terminal, na raiz do projeto, para criar as tabelas no seu banco de dados.

Primeiro, crie o arquivo de migração:
```sh
dotnet ef migrations add InitialCreate
```

Depois, aplique a migração ao banco de dados:
```sh
dotnet ef database update
```

### 6. Execute a Aplicação

Inicie o servidor de backend com o comando:

```sh
dotnet run
```

A API estará rodando (geralmente em `https://localhost:7001` ou `http://localhost:5001`). Você pode ver todos os endpoints disponíveis acessando a URL do Swagger, por exemplo: `https://localhost:7001/swagger`.

### 7. Conecte o Frontend

No seu projeto frontend Angular:
1.  Descomente o conteúdo do arquivo `src/services/http.provider.ts`.
2.  Ajuste a constante `API_BASE_URL` nesse arquivo para a URL correta do seu backend.
3.  No arquivo `index.tsx`, comente a linha do `LocalStorageProvider` e descomente a linha do `HttpProvider`.
