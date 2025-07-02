import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import { BaseDatabaseDriver } from '../base.js';
import { DatabaseConfig } from '../../types/config.js';
import { QueryResult, TableSchema, ColumnInfo, ForeignKeyInfo, IndexInfo } from '../../types/database.js';
import { DatabaseConnectionError, QueryExecutionError } from '../../utils/exceptions.js';
import { logger } from '../../utils/logger.js';

export class PostgreSQLDriver extends BaseDatabaseDriver {
  private pool?: Pool;
  private client?: PoolClient;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      // Create connection pool
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        max: this.config.maxConnections || 10,
        connectionTimeoutMillis: this.config.timeout || 30000,
        idleTimeoutMillis: 30000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      // Test the connection
      this.client = await this.pool.connect();
      await this.client.query('SELECT 1');
      
      this.setConnected(true);
      
      logger.info('PostgreSQL connection established', {
        database: this.config.name,
        host: this.config.host,
        port: this.config.port,
        databaseName: this.config.database,
      });
    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        this.client.release();
        this.client = undefined;
      }

      if (this.pool) {
        await this.pool.end();
        this.pool = undefined;
      }

      this.setConnected(false);
    } catch (error) {
      logger.error('Error disconnecting from PostgreSQL', error as Error);
      throw new DatabaseConnectionError(`Failed to disconnect: ${(error as Error).message}`);
    }
  }

  async executeQuery(query: string, parameters?: unknown[]): Promise<QueryResult> {
    this.validateConnection();
    
    if (!this.client) {
      throw new QueryExecutionError('No active connection');
    }

    try {
      const startTime = Date.now();
      const result: PgQueryResult = await this.client.query(query, parameters);
      const executionTime = Date.now() - startTime;
      
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        fields: result.fields?.map(field => ({
          name: field.name,
          type: this.mapPostgreSQLType(field.dataTypeID),
          nullable: true, // PostgreSQL doesn't provide this in query result fields
        })) || [],
        executionTime,
      };
    } catch (error) {
      throw new QueryExecutionError(`PostgreSQL query failed: ${(error as Error).message}`);
    }
  }

  async listTables(): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => row.table_name);
  }

  async listDatabases(): Promise<Array<{ name: string; owner: string; encoding: string; size?: string }>> {
    const query = `
      SELECT 
        d.datname as name,
        pg_catalog.pg_get_userbyid(d.datdba) as owner,
        pg_catalog.pg_encoding_to_char(d.encoding) as encoding,
        pg_size_pretty(pg_database_size(d.datname)) as size
      FROM pg_catalog.pg_database d
      WHERE d.datistemplate = false
      ORDER BY d.datname;
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => ({
      name: row.name,
      owner: row.owner,
      encoding: row.encoding,
      size: row.size,
    }));
  }

  async describeTable(tableName: string): Promise<TableSchema> {
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    
    const columns: ColumnInfo[] = result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      autoIncrement: row.column_default?.includes('nextval') || false,
      maxLength: row.character_maximum_length,
    }));

    return {
      name: tableName,
      columns,
      primaryKeys: await this.getPrimaryKeys(tableName),
      foreignKeys: await this.getForeignKeys(tableName),
      indexes: await this.getIndexes(tableName),
    };
  }

  async beginTransaction(): Promise<void> {
    this.validateConnection();
    if (!this.client) {
      throw new QueryExecutionError('No active connection');
    }
    await this.client.query('BEGIN');
  }

  async commitTransaction(): Promise<void> {
    this.validateConnection();
    if (!this.client) {
      throw new QueryExecutionError('No active connection');
    }
    await this.client.query('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    this.validateConnection();
    if (!this.client) {
      throw new QueryExecutionError('No active connection');
    }
    await this.client.query('ROLLBACK');
  }

  private async getPrimaryKeys(tableName: string): Promise<string[]> {
    const query = `
      SELECT column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
      ORDER BY kcu.ordinal_position;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    return result.rows.map((row: any) => row.column_name);
  }

  private async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT 
        kcu.column_name as column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc 
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    return result.rows.map((row: any) => ({
      columnName: row.column_name,
      referencedTable: row.referenced_table,
      referencedColumn: row.referenced_column,
    }));
  }

  private async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const query = `
      SELECT 
        i.relname as index_name,
        array_agg(a.attname ORDER BY c.ordinality) as columns,
        ix.indisunique as is_unique
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE t.relname = $1
        AND t.relkind = 'r'
        AND i.relname NOT LIKE '%_pkey'
      GROUP BY i.relname, ix.indisunique
      ORDER BY i.relname;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    return result.rows.map((row: any) => ({
      name: row.index_name,
      columns: row.columns,
      unique: row.is_unique,
      type: row.is_unique ? 'unique' : 'btree',
    }));
  }

  private mapPostgreSQLType(dataTypeID: number): string {
    const typeMap: { [key: number]: string } = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'real',
      701: 'double precision',
      1043: 'varchar',
      1114: 'timestamp',
      1184: 'timestamptz',
      1700: 'numeric',
    };
    
    return typeMap[dataTypeID] || 'unknown';
  }
} 