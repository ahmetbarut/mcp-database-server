/**
 * Database operation result types
 */
export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: FieldInfo[];
  executionTime: number;
}

/**
 * Field information for query results
 */
export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
}

/**
 * Table schema information
 */
export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

/**
 * Column information for table schemas
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  autoIncrement: boolean;
  maxLength?: number;
}

/**
 * Foreign key relationship information
 */
export interface ForeignKeyInfo {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

/**
 * Index information
 */
export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

/**
 * Database driver interface
 */
export interface DatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  executeQuery(query: string, parameters?: unknown[]): Promise<QueryResult>;
  listTables(): Promise<string[]>;
  describeTable(tableName: string): Promise<TableSchema>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

/**
 * Connection pool interface
 */
export interface ConnectionPool {
  acquire(): Promise<DatabaseDriver>;
  release(connection: DatabaseDriver): Promise<void>;
  destroy(): Promise<void>;
  size(): number;
  available(): number;
} 