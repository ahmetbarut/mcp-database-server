

# Servidor de Base de Datos MCP

Un servidor de Protocolo de Contexto de Modelo (MCP) que proporciona capacidades de ejecución de consultas en múltiples bases de datos con soporte para bases de datos SQLite, PostgreSQL y MySQL. Incluye una interfaz de usuario web (Web UI) integrada para gestionar las conexiones a las bases de datos.

## Paquete NPM

**Disponible en NPM:** [`@ahmetbarut/mcp-database-server`](https://www.npmjs.com/package/@ahmetbarut/mcp-database-server)

```bash
# Use with npx (no installation required)
npx @ahmetbarut/mcp-database-server

# Or install globally
npm install -g @ahmetbarut/mcp-database-server
```

## Características

- **Soporte Multi-BD**: SQLite, PostgreSQL y MySQL con conexiones reales
- **Interfaz Web**: Interfaz integrada en el navegador para gestionar conexiones a bases de datos
- **Almacén de Configuración SQLite**: Todas las configuraciones de conexión se persisten localmente en `~/.mcp-database-server/connections.db`
- **Cumplimiento del Protocolo MCP**: Implementación completa de JSON-RPC con soporte total de herramientas
- **Detección Automática Inteligente**: Selecciona automáticamente la única conexión activa para las consultas
- **Recuperación de Conexiones**: Reintento de conexiones fallidas con informes de error detallados
- **Seguridad Primero**: Consultas parametrizadas, protección contra inyección SQL, registro de auditoría
- **Soporte SSL**: SSL configurable por conexión
- **Seguridad de Tipos**: Implementación completa en TypeScript con validación Zod
- **Compatible con Node.js v23**: Funciona con las últimas versiones de Node.js

## Inicio Rápido

```bash
npx @ahmetbarut/mcp-database-server
```

El servidor se inicia y la interfaz web se abre en **http://localhost:3693**. Añade tus conexiones a bases de datos desde el navegador.

## Interfaz Web

La interfaz web integrada proporciona una interfaz visual para gestionar las conexiones a bases de datos:

- **Agregar/Editar/Eliminar** conexiones a bases de datos (SQLite, PostgreSQL, MySQL)
- **Probar conexiones** antes de guardar
- **Alternancia SSL** para bases de datos en red
- **Almacenamiento persistente** — las conexiones sobreviven a los reinicios del servidor

Accede a ella en `http://localhost:3693` cuando el servidor esté en ejecución.

### Variables de Entorno

| Variable | Predeterminado | Descripción |
|---|---|---|
| `WEB_UI_PORT` | `3693` | Puerto de la interfaz web |
| `WEB_UI_ENABLED` | `true` | Habilitar/deshabilitar interfaz web |
| `LOG_LEVEL` | `info` | Nivel de registro (`debug`, `info`, `warn`, `error`) |

## Configuración del Cliente MCP

### Claude Desktop

Agrega lo siguiente a tu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"]
    }
  }
}
```

### Cursor IDE

Agrega lo siguiente a `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"]
    }
  }
}
```

### Puerto Personalizado

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"],
      "env": {
        "WEB_UI_PORT": "4000"
      }
    }
  }
}
```

Después de iniciar, abre la interfaz web en tu navegador para agregar conexiones a bases de datos.

## Herramientas MCP

### `execute_query`

Ejecuta consultas SQL en una conexión a base de datos con soporte para consultas parametrizadas.

```json
{
  "connection_name": "my-postgres",
  "query": "SELECT * FROM users WHERE status = $1",
  "parameters": ["active"]
}
```

### `list_databases`

Lista las bases de datos de una conexión específica o de todas las conexiones configuradas. Admite detección automática inteligente cuando solo hay una conexión activa.

```json
{
  "connection_name": "my-postgres"
}
```

### `list_connections`

Lista todas las conexiones a bases de datos con su estado y detalles.

```json
{
  "include_credentials": false
}
```

### `retry_failed_connections`

Reintenta las conexiones a bases de datos fallidas.

```json
{
  "connection_name": "my-postgres"
}
```

## Configuración de Conexión

Todas las conexiones a bases de datos se gestionan a través de la **interfaz web** y se almacenan en una base de datos SQLite local en `~/.mcp-database-server/connections.db`.

### Tipos de Base de Datos Compatibles

**SQLite**
- Ruta al archivo de la base de datos

**PostgreSQL**
- Host, puerto, base de datos, usuario, contraseña
- Soporte SSL (opcional)

**MySQL**
- Host, puerto, base de datos, usuario, contraseña
- Soporte SSL (opcional)

### Configuración de Conexión

| Configuración | Predeterminado | Descripción |
|---|---|---|
| `maxConnections` | `10` | Tamaño máximo del grupo de conexiones |
| `timeout` | `30000` | Tiempo de espera de conexión en milisegundos |
| `ssl` | `false` | Habilitar SSL para la conexión |

## Desarrollo

```bash
# Clone the repository
git clone https://github.com/ahmetbarut/mcp-database-server.git
cd mcp-database-server

# Install dependencies
npm install

# Development mode (hot-reload)
npm run dev

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Type check
npm run type-check
```

## Estructura del Proyecto

```
mcp-database-server/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── server/
│   │   └── mcp-server.ts     # MCP server, tool handlers
│   ├── database/
│   │   ├── base.ts           # Abstract base driver
│   │   ├── factory.ts        # Driver factory & connection manager
│   │   └── drivers/          # SQLite, PostgreSQL, MySQL drivers
│   ├── config/
│   │   ├── settings.ts       # Config manager (loads from SQLite store)
│   │   └── config-store.ts   # SQLite-backed connection storage
│   ├── web/
│   │   ├── web-server.ts     # HTTP server for Web UI
│   │   ├── routes.ts         # REST API endpoints
│   │   └── ui.ts             # Embedded HTML/CSS/JS interface
│   ├── types/                # TypeScript types & Zod schemas
│   └── utils/                # Logger, exceptions, helpers
├── tests/unit/               # Jest test suites
└── dist/                     # Compiled output
```

## Arquitectura

```
npx @ahmetbarut/mcp-database-server
    │
    ├── MCPDatabaseServer
    │   ├── MCP stdio transport (JSON-RPC)
    │   ├── DatabaseConnectionManager
    │   └── WebUIServer (http://localhost:3693)
    │
    └── ConnectionConfigStore (~/.mcp-database-server/connections.db)
        └── SQLite database with connection configs
```

1. **Almacén de Configuración** carga las conexiones guardadas desde la base de datos SQLite local
2. **Gestor de Conexiones** inicializa los controladores de base de datos para cada configuración
3. **Servidor MCP** expone herramientas mediante JSON-RPC sobre stdio
4. **Interfaz Web** proporciona operaciones CRUD basadas en navegador para conexiones mediante API REST

## Seguridad

- **Consultas parametrizadas** — previene la inyección SQL
- **Ocultación de credenciales** — contraseñas ocultas en la salida de `list_connections`
- **Registro de auditoría** — todas las operaciones se registran mediante Winston
- **Validación de entrada** — esquemas Zod para toda la configuración

## Pruebas

```
Test Suites: 2 passed, 2 total
Tests:       23 passed, 23 total
```

```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## Solución de Problemas

**Interfaz web no accesible**
- Verifica si el puerto 3693 ya está en uso
- Prueba con otro puerto: `WEB_UI_PORT=4000`

**Conexión fallida**
- Usa el botón "Probar Conexión" en la interfaz web antes de guardar
- Verifica que el servidor de base de datos esté en ejecución y sea accesible
- Revisa las credenciales y la conectividad de red
- Para PostgreSQL: deshabilita SSL si el servidor no lo admite

**El cliente MCP no puede conectarse**
- Asegúrate de que `npx @ahmetbarut/mcp-database-server` se ejecute sin errores
- Reinicia el cliente MCP después de cambiar la configuración
- Revisa los registros del cliente MCP para ver los detalles del error

## Licencia

Licencia MIT - consulta el archivo LICENSE para más detalles.

## Cómo Contribuir

1. Sigue los estándares de codificación de TypeScript
2. Agrega pruebas para las nuevas funcionalidades
3. Actualiza la documentación para los cambios en la API
4. Sigue las directrices de seguridad

## Soporte

Para problemas y preguntas, usa el [rastreador de issues de GitHub](https://github.com/ahmetbarut/mcp-database-server/issues).
