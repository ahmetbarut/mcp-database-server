import Database from 'better-sqlite3';
import { BaseDatabaseDriver } from '../base.js';
import { DatabaseConfig } from '../../types/config.js';
import { QueryResult, TableSchema, ColumnInfo, ForeignKeyInfo, IndexInfo } from '../../types/database.js';
import { DatabaseConnectionError, QueryExecutionError } from '../../utils/exceptions.js';
import { logger } from '../../utils/logger.js';

export class SQLiteDriver extends BaseDatabaseDriver {
  private db?: Database.Database;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    try {
      const dbPath = this.config.path || ':memory:';
      
      this.db = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
        timeout: this.config.timeout || 30000,
      });

      // Enable foreign keys
      this.db.exec('PRAGMA foreign_keys = ON');
      
      // Test the connection
      this.db.exec('SELECT 1');
      
      this.setConnected(true);
      
      logger.info('SQLite connection established', {
        database: this.config.name,
        path: dbPath,
      });
    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = undefined;
      }

      this.setConnected(false);
    } catch (error) {
      logger.error('Error disconnecting from SQLite', error as Error);
      throw new DatabaseConnectionError(`Failed to disconnect: ${(error as Error).message}`);
    }
  }

  async executeQuery(query: string, parameters?: unknown[]): Promise<QueryResult> {
    this.validateConnection();
    
    if (!this.db) {
      throw new QueryExecutionError('No active connection');
    }

    try {
      const startTime = Date.now();
      
      // Determine if it's a SELECT query or a modification query
      const trimmedQuery = query.trim().toUpperCase();
      const isSelect = trimmedQuery.startsWith('SELECT') || 
                      trimmedQuery.startsWith('WITH') ||
                      trimmedQuery.startsWith('PRAGMA');
      
      let result;
      if (isSelect) {
        const stmt = this.db.prepare(query);
        // Only pass parameters if they exist and are not empty
        const rows = (parameters && parameters.length > 0) ? stmt.all(parameters) : stmt.all();
        const columns = stmt.columns();
        
        result = {
          rows: rows as Record<string, unknown>[],
          rowCount: rows.length,
          fields: columns.map((col: any) => ({
            name: col.name,
            type: col.type || 'unknown',
            nullable: true, // SQLite doesn't enforce NOT NULL in result metadata
          })),
          executionTime: Date.now() - startTime,
        };
      } else {
        const stmt = this.db.prepare(query);
        // Only pass parameters if they exist and are not empty
        const info = (parameters && parameters.length > 0) ? stmt.run(parameters) : stmt.run();
        
        result = {
          rows: [],
          rowCount: info.changes,
          fields: [],
          executionTime: Date.now() - startTime,
        };
      }
      
      return result;
    } catch (error) {
      throw new QueryExecutionError(`SQLite query failed: ${(error as Error).message}`);
    }
  }

  async listTables(): Promise<string[]> {
    const query = `
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => row.name);
  }

  async listDatabases(): Promise<Array<{ file: string; size: string; tables_count: string; note: string }>> {
    const dbPath = this.config.path || ':memory:';
    
    // For SQLite, there's only one "database" (the file itself)
    // We can get some basic info about it
    const tablesQuery = "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
    const tablesResult = await this.executeQuery(tablesQuery, []);
    const tableCount = tablesResult.rows[0]?.count || 0;
    
    return [{
      file: dbPath,
      size: 'Unknown (file not accessed for size)',
      tables_count: tableCount.toString(),
      note: 'SQLite is a single-file database. Use list_tables to see tables within this database.',
    }];
  }

  async describeTable(tableName: string): Promise<TableSchema> {
    // Get column information
    const pragmaQuery = `PRAGMA table_info(${tableName})`;
    const result = await this.executeQuery(pragmaQuery);
    
    const columns: ColumnInfo[] = result.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.notnull === 0,
      defaultValue: row.dflt_value,
      autoIncrement: false, // We'll check this separately
      maxLength: undefined,
    }));

    // Check for autoincrement
    const autoIncrementQuery = `
      SELECT sql FROM sqlite_master 
      WHERE type = 'table' AND name = ?
    `;
    const schemaResult = await this.executeQuery(autoIncrementQuery, [tableName]);
    const createSQL = schemaResult.rows[0]?.sql?.toString().toUpperCase() || '';
    
    // Update autoIncrement flag for INTEGER PRIMARY KEY columns
    columns.forEach(col => {
      if (col.type.toUpperCase() === 'INTEGER' && 
          createSQL.includes('AUTOINCREMENT')) {
        col.autoIncrement = true;
      }
    });

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
    if (!this.db) {
      throw new QueryExecutionError('No active connection');
    }
    this.db.exec('BEGIN TRANSACTION');
  }

  async commitTransaction(): Promise<void> {
    this.validateConnection();
    if (!this.db) {
      throw new QueryExecutionError('No active connection');
    }
    this.db.exec('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    this.validateConnection();
    if (!this.db) {
      throw new QueryExecutionError('No active connection');
    }
    this.db.exec('ROLLBACK');
  }

  private async getPrimaryKeys(tableName: string): Promise<string[]> {
    const query = `PRAGMA table_info(${tableName})`;
    const result = await this.executeQuery(query);
    
    return result.rows
      .filter((row: any) => row.pk > 0)
      .sort((a: any, b: any) => a.pk - b.pk)
      .map((row: any) => row.name);
  }

  private async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const query = `PRAGMA foreign_key_list(${tableName})`;
    const result = await this.executeQuery(query);
    
    return result.rows.map((row: any) => ({
      columnName: row.from,
      referencedTable: row.table,
      referencedColumn: row.to,
      onDelete: row.on_delete,
      onUpdate: row.on_update,
    }));
  }

  private async getIndexes(tableName: string): Promise<IndexInfo[]> {
    // Get all indexes for the table
    const indexListQuery = `PRAGMA index_list(${tableName})`;
    const indexListResult = await this.executeQuery(indexListQuery);
    
    const indexes: IndexInfo[] = [];
    
    for (const indexRow of indexListResult.rows) {
      const indexName = (indexRow as any).name;
      const isUnique = (indexRow as any).unique === 1;
      
      // Skip auto-generated primary key indexes
      if (indexName.startsWith('sqlite_autoindex_')) {
        continue;
      }
      
      // Get columns for this index
      const indexInfoQuery = `PRAGMA index_info(${indexName})`;
      const indexInfoResult = await this.executeQuery(indexInfoQuery);
      
      const columns = indexInfoResult.rows
        .sort((a: any, b: any) => a.seqno - b.seqno)
        .map((row: any) => row.name);
      
      indexes.push({
        name: indexName,
        columns,
        unique: isUnique,
        type: isUnique ? 'unique' : 'btree',
      });
    }
    
    return indexes;
  }
} 