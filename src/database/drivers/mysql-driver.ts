import mysql from 'mysql2/promise';
import { BaseDatabaseDriver } from '../base.js';
import { DatabaseConfig } from '../../types/config.js';
import { QueryResult, TableSchema, ColumnInfo, ForeignKeyInfo, IndexInfo } from '../../types/database.js';
import { DatabaseConnectionError, QueryExecutionError } from '../../utils/exceptions.js';
import { logger } from '../../utils/logger.js';

export class MySQLDriver extends BaseDatabaseDriver {
  private pool?: mysql.Pool;
  private connection?: mysql.PoolConnection;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      // Create connection pool
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        connectionLimit: this.config.maxConnections || 10,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      });

      // Test the connection
      this.connection = await this.pool.getConnection();
      await this.connection.execute('SELECT 1');
      
      this.setConnected(true);
      
      logger.info('MySQL connection established', {
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
      if (this.connection) {
        this.connection.release();
        this.connection = undefined;
      }

      if (this.pool) {
        await this.pool.end();
        this.pool = undefined;
      }

      this.setConnected(false);
    } catch (error) {
      logger.error('Error disconnecting from MySQL', error as Error);
      throw new DatabaseConnectionError(`Failed to disconnect: ${(error as Error).message}`);
    }
  }

  async executeQuery(query: string, parameters?: unknown[]): Promise<QueryResult> {
    this.validateConnection();
    
    if (!this.connection) {
      throw new QueryExecutionError('No active connection');
    }

    try {
      const startTime = Date.now();
      const [rows, fields] = await this.connection.execute(query, parameters);
      const executionTime = Date.now() - startTime;
      
      const resultRows = Array.isArray(rows) ? rows : [];
      const fieldInfo = Array.isArray(fields) ? fields : [];
      
      return {
        rows: resultRows as Record<string, unknown>[],
        rowCount: resultRows.length,
        fields: fieldInfo.map(field => ({
          name: field.name,
          type: field.type?.toString() || 'unknown',
          nullable: !((field as any).flags & 1), // NOT_NULL flag check
        })),
        executionTime,
      };
    } catch (error) {
      throw new QueryExecutionError(`MySQL query failed: ${(error as Error).message}`);
    }
  }

  async listTables(): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => row.table_name || row.TABLE_NAME);
  }

  async listDatabases(): Promise<Array<{ name: string; type: string }>> {
    const query = `
      SELECT 
        SCHEMA_NAME as name,
        'DATABASE' as type
      FROM information_schema.SCHEMATA
      WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
      ORDER BY SCHEMA_NAME;
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => ({
      name: row.name || row.NAME,
      type: row.type || row.TYPE,
    }));
  }

  async listAllDatabases(): Promise<Array<{ name: string; type: string }>> {
    const query = `
      SELECT 
        SCHEMA_NAME as name,
        CASE 
          WHEN SCHEMA_NAME IN ('information_schema', 'performance_schema', 'mysql', 'sys') 
          THEN 'SYSTEM SCHEMA' 
          ELSE 'BASE DATABASE' 
        END as type
      FROM information_schema.SCHEMATA
      ORDER BY SCHEMA_NAME;
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => ({
      name: row.name || row.NAME,
      type: row.type || row.TYPE,
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
        extra
      FROM information_schema.columns 
      WHERE table_schema = DATABASE()
      AND table_name = ?
      ORDER BY ordinal_position;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    
    const columns: ColumnInfo[] = result.rows.map((row: any) => ({
      name: row.column_name || row.COLUMN_NAME,
      type: row.data_type || row.DATA_TYPE,
      nullable: (row.is_nullable || row.IS_NULLABLE) === 'YES',
      defaultValue: row.column_default || row.COLUMN_DEFAULT,
      autoIncrement: (row.extra || row.EXTRA || '').toLowerCase().includes('auto_increment'),
      maxLength: row.character_maximum_length || row.CHARACTER_MAXIMUM_LENGTH,
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
    if (!this.connection) {
      throw new QueryExecutionError('No active connection');
    }
    await this.connection.execute('START TRANSACTION');
  }

  async commitTransaction(): Promise<void> {
    this.validateConnection();
    if (!this.connection) {
      throw new QueryExecutionError('No active connection');
    }
    await this.connection.execute('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    this.validateConnection();
    if (!this.connection) {
      throw new QueryExecutionError('No active connection');
    }
    await this.connection.execute('ROLLBACK');
  }

  private async getPrimaryKeys(tableName: string): Promise<string[]> {
    const query = `
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND constraint_name = 'PRIMARY'
      ORDER BY ordinal_position;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    return result.rows.map((row: any) => row.column_name || row.COLUMN_NAME);
  }

  private async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT 
        kcu.column_name as column_name,
        kcu.referenced_table_name as referenced_table,
        kcu.referenced_column_name as referenced_column
      FROM information_schema.key_column_usage kcu
      WHERE kcu.table_schema = DATABASE()
        AND kcu.table_name = ?
        AND kcu.referenced_table_name IS NOT NULL;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    return result.rows.map((row: any) => ({
      columnName: row.column_name || row.COLUMN_NAME,
      referencedTable: row.referenced_table || row.REFERENCED_TABLE,
      referencedColumn: row.referenced_column || row.REFERENCED_COLUMN,
    }));
  }

  private async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const query = `
      SELECT 
        index_name,
        column_name,
        non_unique
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name != 'PRIMARY'
      ORDER BY index_name, seq_in_index;
    `;
    
    const result = await this.executeQuery(query, [tableName]);
    
    // Group columns by index name
    const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
    
    result.rows.forEach((row: any) => {
      const indexName = row.index_name || row.INDEX_NAME;
      const columnName = row.column_name || row.COLUMN_NAME;
      const isUnique = (row.non_unique || row.NON_UNIQUE) === 0;
      
      if (!indexMap.has(indexName)) {
        indexMap.set(indexName, { columns: [], unique: isUnique });
      }
      
      indexMap.get(indexName)!.columns.push(columnName);
    });
    
    return Array.from(indexMap.entries()).map(([name, info]) => ({
      name,
      columns: info.columns,
      unique: info.unique,
      type: info.unique ? 'unique' : 'btree',
    }));
  }
} 