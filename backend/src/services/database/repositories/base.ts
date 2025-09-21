import { DatabaseService, DatabaseResult } from '../index.js';
import { PaginationOptions, PaginatedResult } from '../types.js';
import { logger } from '../../../middleware/logging.js';

export abstract class BaseRepository<T, CreateData, UpdateData, Filters = Record<string, any>> {
  protected db: DatabaseService;
  protected tableName: string;

  constructor(tableName: string, db?: DatabaseService) {
    this.tableName = tableName;
    this.db = db || DatabaseService.getInstance();
  }

  async findById(id: string | number, columns?: string[]): Promise<T | null> {
    try {
      logger.info(`Finding ${this.tableName} by id`, { id, table: this.tableName });

      return await this.db.findById<T>(this.tableName, id, columns);
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by id`, {
        id,
        table: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findMany(
    filters?: Filters,
    pagination?: PaginationOptions,
    columns?: string[]
  ): Promise<PaginatedResult<T>> {
    try {
      logger.info(`Finding many ${this.tableName}`, {
        table: this.tableName,
        filters,
        pagination
      });

      const { whereClause, params } = this.buildWhereClause(filters || {} as Filters);
      const orderBy = this.buildOrderBy(pagination);

      const page = pagination?.page || 1;
      const perPage = Math.min(pagination?.per_page || 20, 100); // Max 100 items per page
      const offset = (page - 1) * perPage;

      // Get total count
      const total = await this.db.count(this.tableName, whereClause, params);

      // Get data
      const data = await this.db.findMany<T>(
        this.tableName,
        whereClause,
        params,
        columns,
        orderBy,
        perPage,
        offset
      );

      const totalPages = Math.ceil(total / perPage);

      return {
        data,
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      };
    } catch (error) {
      logger.error(`Error finding many ${this.tableName}`, {
        table: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async create(data: CreateData): Promise<T> {
    try {
      logger.info(`Creating ${this.tableName}`, {
        table: this.tableName,
        data: this.sanitizeLogData(data)
      });

      const processedData = this.preprocessCreateData(data);
      return await this.db.insert<T>(this.tableName, processedData);
    } catch (error) {
      logger.error(`Error creating ${this.tableName}`, {
        table: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async update(id: string | number, data: UpdateData): Promise<T> {
    try {
      logger.info(`Updating ${this.tableName}`, {
        id,
        table: this.tableName,
        data: this.sanitizeLogData(data)
      });

      const processedData = this.preprocessUpdateData(data);
      return await this.db.update<T>(this.tableName, id, processedData);
    } catch (error) {
      logger.error(`Error updating ${this.tableName}`, {
        id,
        table: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      logger.info(`Deleting ${this.tableName}`, {
        id,
        table: this.tableName
      });

      return await this.db.delete(this.tableName, id);
    } catch (error) {
      logger.error(`Error deleting ${this.tableName}`, {
        id,
        table: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async count(filters?: Filters): Promise<number> {
    try {
      const { whereClause, params } = this.buildWhereClause(filters || {} as Filters);
      return await this.db.count(this.tableName, whereClause, params);
    } catch (error) {
      logger.error(`Error counting ${this.tableName}`, {
        table: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async exists(id: string | number): Promise<boolean> {
    try {
      const item = await this.findById(id, ['id']);
      return item !== null;
    } catch (error) {
      logger.error(`Error checking existence of ${this.tableName}`, {
        id,
        table: this.tableName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async query<R = any>(sql: string, params: any[] = []): Promise<DatabaseResult<R>> {
    try {
      return await this.db.query<R>(sql, params);
    } catch (error) {
      logger.error(`Custom query error on ${this.tableName}`, {
        table: this.tableName,
        sql: sql.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract buildWhereClause(filters: Filters): { whereClause: string; params: any[] };

  // Optional methods that can be overridden
  protected preprocessCreateData(data: CreateData): Record<string, any> {
    return data as Record<string, any>;
  }

  protected preprocessUpdateData(data: UpdateData): Record<string, any> {
    return data as Record<string, any>;
  }

  protected buildOrderBy(pagination?: PaginationOptions): string | undefined {
    if (!pagination?.sort_by) {
      return 'created_at DESC'; // Default sorting
    }

    const sortOrder = pagination.sort_order || 'asc';
    return `${pagination.sort_by} ${sortOrder.toUpperCase()}`;
  }

  protected sanitizeLogData(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };

    // Remove sensitive fields from logs
    const sensitiveFields = [
      'password',
      'password_hash',
      'mfa_secret',
      'mfa_backup_codes',
      'bank_account_info',
      'payment_method_details',
      'verification_documents'
    ];

    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  // Utility methods for common query patterns
  protected addAndCondition(
    whereClause: string,
    params: any[],
    condition: string,
    value: any
  ): { whereClause: string; params: any[] } {
    const currentIndex = params.length + 1;
    const separator = whereClause === '1=1' ? ' AND ' : ' AND ';

    return {
      whereClause: whereClause + separator + condition.replace('?', `$${currentIndex}`),
      params: [...params, value]
    };
  }

  protected addInCondition(
    whereClause: string,
    params: any[],
    column: string,
    values: any[]
  ): { whereClause: string; params: any[] } {
    if (!values || values.length === 0) {
      return { whereClause, params };
    }

    const startIndex = params.length + 1;
    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(', ');
    const separator = whereClause === '1=1' ? ' AND ' : ' AND ';

    return {
      whereClause: whereClause + separator + `${column} IN (${placeholders})`,
      params: [...params, ...values]
    };
  }

  protected addDateRangeCondition(
    whereClause: string,
    params: any[],
    column: string,
    startDate?: string,
    endDate?: string
  ): { whereClause: string; params: any[] } {
    let result = { whereClause, params };

    if (startDate) {
      result = this.addAndCondition(result.whereClause, result.params, `${column} >= ?`, startDate);
    }

    if (endDate) {
      result = this.addAndCondition(result.whereClause, result.params, `${column} <= ?`, endDate);
    }

    return result;
  }

  protected addLikeCondition(
    whereClause: string,
    params: any[],
    column: string,
    value?: string
  ): { whereClause: string; params: any[] } {
    if (!value) {
      return { whereClause, params };
    }

    return this.addAndCondition(whereClause, params, `${column} ILIKE ?`, `%${value}%`);
  }

  protected addNumericRangeCondition(
    whereClause: string,
    params: any[],
    column: string,
    min?: number,
    max?: number
  ): { whereClause: string; params: any[] } {
    let result = { whereClause, params };

    if (min !== undefined) {
      result = this.addAndCondition(result.whereClause, result.params, `${column} >= ?`, min);
    }

    if (max !== undefined) {
      result = this.addAndCondition(result.whereClause, result.params, `${column} <= ?`, max);
    }

    return result;
  }
}