import { Pool, PoolClient, QueryResult } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../middleware/logging.js';

export interface DatabaseConfig {
  type: 'postgresql' | 'supabase';
  postgresql?: {
    connectionString: string;
    maxConnections?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
  supabase?: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
}

export interface DatabaseQueryOptions {
  timeout?: number;
  retries?: number;
  transaction?: boolean;
}

export interface DatabaseResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: any[];
}

export class DatabaseService {
  private static instance: DatabaseService;
  private config: DatabaseConfig;
  private pgPool?: Pool;
  private supabaseClient?: SupabaseClient;
  private isConnected: boolean = false;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  public static getInstance(config?: DatabaseConfig): DatabaseService {
    if (!DatabaseService.instance) {
      if (!config) {
        throw new Error('Database configuration required for first initialization');
      }
      DatabaseService.instance = new DatabaseService(config);
    }
    return DatabaseService.instance;
  }

  public static initialize(config: DatabaseConfig): DatabaseService {
    DatabaseService.instance = new DatabaseService(config);
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to database', {
        type: this.config.type,
        timestamp: new Date().toISOString()
      });

      if (this.config.type === 'postgresql') {
        await this.connectPostgreSQL();
      } else if (this.config.type === 'supabase') {
        await this.connectSupabase();
      } else {
        throw new Error(`Unsupported database type: ${this.config.type}`);
      }

      this.isConnected = true;
      logger.info('Database connection established successfully', {
        type: this.config.type
      });

    } catch (error) {
      logger.error('Database connection failed', {
        type: this.config.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pgPool) {
        await this.pgPool.end();
        logger.info('PostgreSQL connection pool closed');
      }

      this.isConnected = false;
      logger.info('Database disconnected');

    } catch (error) {
      logger.error('Error disconnecting from database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async query<T = any>(
    sql: string,
    params: any[] = [],
    options: DatabaseQueryOptions = {}
  ): Promise<DatabaseResult<T>> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const startTime = Date.now();

    try {
      logger.info('Executing database query', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        params_count: params.length,
        timeout: options.timeout,
        transaction: options.transaction
      });

      let result: DatabaseResult<T>;

      if (this.config.type === 'postgresql' && this.pgPool) {
        result = await this.executePostgreSQLQuery<T>(sql, params, options);
      } else if (this.config.type === 'supabase' && this.supabaseClient) {
        result = await this.executeSupabaseQuery<T>(sql, params, options);
      } else {
        throw new Error('No database connection available');
      }

      const duration = Date.now() - startTime;
      logger.info('Query executed successfully', {
        duration_ms: duration,
        row_count: result.rowCount
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query execution failed', {
        sql: sql.substring(0, 100),
        params_count: params.length,
        duration_ms: duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async transaction<T>(
    callback: (query: (sql: string, params?: any[]) => Promise<DatabaseResult>) => Promise<T>
  ): Promise<T> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    if (this.config.type === 'postgresql' && this.pgPool) {
      return await this.executePostgreSQLTransaction(callback);
    } else if (this.config.type === 'supabase') {
      // Supabase doesn't support explicit transactions in the same way
      // We'll execute the callback with regular query method
      logger.warn('Supabase does not support explicit transactions, executing as regular queries');
      return await callback(this.query.bind(this));
    } else {
      throw new Error('No database connection available for transaction');
    }
  }

  async healthCheck(): Promise<{
    connected: boolean;
    type: string;
    response_time_ms?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      if (!this.isConnected) {
        return {
          connected: false,
          type: this.config.type,
          error: 'Not connected'
        };
      }

      // Simple query to test connection
      await this.query('SELECT 1 as health_check');

      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        type: this.config.type,
        response_time_ms: responseTime
      };

    } catch (error) {
      return {
        connected: false,
        type: this.config.type,
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // PostgreSQL specific methods
  private async connectPostgreSQL(): Promise<void> {
    if (!this.config.postgresql?.connectionString) {
      throw new Error('PostgreSQL connection string is required');
    }

    this.pgPool = new Pool({
      connectionString: this.config.postgresql.connectionString,
      max: this.config.postgresql.maxConnections || 20,
      idleTimeoutMillis: this.config.postgresql.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: this.config.postgresql.connectionTimeoutMillis || 5000,
    });

    // Test connection
    const client = await this.pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();
  }

  private async executePostgreSQLQuery<T>(
    sql: string,
    params: any[],
    options: DatabaseQueryOptions
  ): Promise<DatabaseResult<T>> {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const client = await this.pgPool.connect();

    try {
      let result: QueryResult;

      if (options.timeout) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), options.timeout)
        );

        result = await Promise.race([
          client.query(sql, params),
          timeoutPromise
        ]);
      } else {
        result = await client.query(sql, params);
      }

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        fields: result.fields
      };

    } finally {
      client.release();
    }
  }

  private async executePostgreSQLTransaction<T>(
    callback: (query: (sql: string, params?: any[]) => Promise<DatabaseResult>) => Promise<T>
  ): Promise<T> {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const client = await this.pgPool.connect();

    try {
      await client.query('BEGIN');

      const transactionQuery = async (sql: string, params: any[] = []): Promise<DatabaseResult> => {
        const result = await client.query(sql, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          fields: result.fields
        };
      };

      const result = await callback(transactionQuery);

      await client.query('COMMIT');
      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Supabase specific methods
  private async connectSupabase(): Promise<void> {
    if (!this.config.supabase?.url || !this.config.supabase?.serviceRoleKey) {
      throw new Error('Supabase URL and service role key are required');
    }

    this.supabaseClient = createClient(
      this.config.supabase.url,
      this.config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Test connection with a simple query
    const { error } = await this.supabaseClient
      .from('users')
      .select('count', { count: 'exact', head: true })
      .limit(0);

    if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
      throw new Error(`Supabase connection test failed: ${error.message}`);
    }
  }

  private async executeSupabaseQuery<T>(
    sql: string,
    params: any[],
    options: DatabaseQueryOptions
  ): Promise<DatabaseResult<T>> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // For raw SQL queries, we use rpc or direct SQL execution
      // This is a simplified implementation - in practice, you'd want to use Supabase's query builder
      const { data, error, count } = await this.supabaseClient.rpc('execute_sql', {
        query: sql,
        params: params
      });

      if (error) {
        throw new Error(`Supabase query error: ${error.message}`);
      }

      return {
        rows: data || [],
        rowCount: count || (data ? data.length : 0)
      };

    } catch (error) {
      // If rpc doesn't exist, we'll need to use the query builder
      // For now, throw an informative error
      throw new Error(
        `Raw SQL execution not supported. Use Supabase query builder methods or create an RPC function. Error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Helper methods for common operations
  async findById<T>(table: string, id: string | number, columns: string[] = ['*']): Promise<T | null> {
    const columnsStr = columns.join(', ');
    const result = await this.query<T>(
      `SELECT ${columnsStr} FROM ${table} WHERE id = $1 LIMIT 1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findMany<T>(
    table: string,
    whereClause: string = '1=1',
    params: any[] = [],
    columns: string[] = ['*'],
    orderBy?: string,
    limit?: number,
    offset?: number
  ): Promise<T[]> {
    const columnsStr = columns.join(', ');
    let sql = `SELECT ${columnsStr} FROM ${table} WHERE ${whereClause}`;

    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  async insert<T>(
    table: string,
    data: Record<string, any>,
    returning: string[] = ['*']
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const returningStr = returning.join(', ');

    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING ${returningStr}
    `;

    const result = await this.query<T>(sql, values);

    if (result.rows.length === 0) {
      throw new Error(`Insert into ${table} failed - no rows returned`);
    }

    return result.rows[0];
  }

  async update<T>(
    table: string,
    id: string | number,
    data: Record<string, any>,
    returning: string[] = ['*']
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const returningStr = returning.join(', ');

    const sql = `
      UPDATE ${table}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING ${returningStr}
    `;

    const result = await this.query<T>(sql, [...values, id]);

    if (result.rows.length === 0) {
      throw new Error(`Update ${table} with id ${id} failed - no rows found`);
    }

    return result.rows[0];
  }

  async delete(table: string, id: string | number): Promise<boolean> {
    const sql = `DELETE FROM ${table} WHERE id = $1`;
    const result = await this.query(sql, [id]);
    return (result.rowCount || 0) > 0;
  }

  async count(table: string, whereClause: string = '1=1', params: any[] = []): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`;
    const result = await this.query<{count: string}>(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  getClient(): Pool | SupabaseClient | undefined {
    return this.pgPool || this.supabaseClient;
  }
}

// Configuration factory
export const createDatabaseConfig = (): DatabaseConfig => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const postgresUrl = process.env.DATABASE_URL;

  if (supabaseUrl && supabaseServiceKey) {
    return {
      type: 'supabase',
      supabase: {
        url: supabaseUrl,
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        serviceRoleKey: supabaseServiceKey
      }
    };
  } else if (postgresUrl) {
    return {
      type: 'postgresql',
      postgresql: {
        connectionString: postgresUrl,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10)
      }
    };
  } else {
    throw new Error(
      'Database configuration missing. Please provide either SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL'
    );
  }
};