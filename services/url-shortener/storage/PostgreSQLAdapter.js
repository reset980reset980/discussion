/**
 * PostgreSQL 스토리지 어댑터
 */

const BaseAdapter = require('./BaseAdapter');
const { Pool } = require('pg');

class PostgreSQLAdapter extends BaseAdapter {
    constructor(options = {}) {
        super(options);

        // PostgreSQL 연결 풀 생성
        const password = options.password || process.env.DB_PASSWORD;

        this.pool = new Pool({
            host: options.host || process.env.DB_HOST || 'localhost',
            port: parseInt(options.port || process.env.DB_PORT || 5432),
            user: options.user || process.env.DB_USER || 'postgres',
            password: password ? String(password) : undefined,
            database: options.database || process.env.DB_NAME || 'postgres',
            max: options.maxConnections || 10,
            idleTimeoutMillis: options.idleTimeout || 30000,
            connectionTimeoutMillis: options.connectionTimeout || 2000
        });

        this.tableName = options.tableName || 'short_urls';
        this.clicksTableName = options.clicksTableName || 'url_clicks';
    }

    async connect() {
        try {
            // 테이블 생성
            await this.createTables();
            this.connected = true;
            console.log('PostgreSQL adapter connected');
        } catch (error) {
            console.error('PostgreSQL connection error:', error);
            throw error;
        }
    }

    async disconnect() {
        await this.pool.end();
        this.connected = false;
        console.log('PostgreSQL adapter disconnected');
    }

    async createTables() {
        // 단축 URL 테이블
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS ${this.tableName} (
                id SERIAL PRIMARY KEY,
                short_code VARCHAR(20) UNIQUE NOT NULL,
                custom_alias VARCHAR(50) UNIQUE,
                original_url TEXT NOT NULL,
                qr_code TEXT,
                entry_code VARCHAR(20),
                metadata JSONB,
                click_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                last_accessed_at TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            )
        `);

        // 인덱스 생성
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.tableName}_short_code ON ${this.tableName}(short_code);
        `);
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.tableName}_custom_alias ON ${this.tableName}(custom_alias);
        `);
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.tableName}_original_url ON ${this.tableName}(original_url);
        `);
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires_at ON ${this.tableName}(expires_at);
        `);

        // 클릭 기록 테이블 (분석용)
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS ${this.clicksTableName} (
                id SERIAL PRIMARY KEY,
                short_code VARCHAR(20) NOT NULL,
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                referer TEXT,
                user_agent TEXT,
                ip_address VARCHAR(45),
                country VARCHAR(2),
                FOREIGN KEY (short_code) REFERENCES ${this.tableName}(short_code) ON DELETE CASCADE
            )
        `);

        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.clicksTableName}_short_code ON ${this.clicksTableName}(short_code);
        `);
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.clicksTableName}_clicked_at ON ${this.clicksTableName}(clicked_at);
        `);
    }

    async create(data) {
        const {
            shortCode,
            originalUrl,
            customAlias,
            expiresAt,
            entryCode,
            metadata,
            qrCode
        } = data;

        const result = await this.pool.query(
            `INSERT INTO ${this.tableName}
            (short_code, original_url, custom_alias, expires_at, entry_code, metadata, qr_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                shortCode,
                originalUrl,
                customAlias || null,
                expiresAt || null,
                entryCode || null,
                metadata ? JSON.stringify(metadata) : null,
                qrCode || null
            ]
        );

        return this.formatResult(result.rows[0]);
    }

    async findByShortCode(shortCode) {
        const result = await this.pool.query(
            `SELECT * FROM ${this.tableName}
            WHERE short_code = $1 AND is_active = true
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            [shortCode]
        );

        return result.rows.length > 0 ? this.formatResult(result.rows[0]) : null;
    }

    async findByAlias(alias) {
        const result = await this.pool.query(
            `SELECT * FROM ${this.tableName}
            WHERE custom_alias = $1 AND is_active = true
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            [alias]
        );

        return result.rows.length > 0 ? this.formatResult(result.rows[0]) : null;
    }

    async findByOriginalUrl(originalUrl) {
        const result = await this.pool.query(
            `SELECT * FROM ${this.tableName}
            WHERE original_url = $1 AND is_active = true
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY created_at DESC
            LIMIT 1`,
            [originalUrl]
        );

        return result.rows.length > 0 ? this.formatResult(result.rows[0]) : null;
    }

    async incrementClickCount(shortCode) {
        await this.pool.query(
            `UPDATE ${this.tableName}
            SET click_count = click_count + 1,
                last_accessed_at = CURRENT_TIMESTAMP
            WHERE short_code = $1`,
            [shortCode]
        );
    }

    async recordClick(data) {
        const { shortCode, referer, userAgent, ipAddress, country } = data;

        await this.pool.query(
            `INSERT INTO ${this.clicksTableName}
            (short_code, referer, user_agent, ip_address, country)
            VALUES ($1, $2, $3, $4, $5)`,
            [shortCode, referer || null, userAgent || null, ipAddress || null, country || null]
        );
    }

    async deleteExpired() {
        const result = await this.pool.query(
            `UPDATE ${this.tableName}
            SET is_active = false
            WHERE expires_at IS NOT NULL
            AND expires_at < CURRENT_TIMESTAMP
            AND is_active = true
            RETURNING id`
        );

        return result.rows.length;
    }

    async delete(shortCode) {
        const result = await this.pool.query(
            `UPDATE ${this.tableName}
            SET is_active = false
            WHERE short_code = $1
            RETURNING id`,
            [shortCode]
        );

        return result.rows.length > 0;
    }

    async update(shortCode, updates) {
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (updates.originalUrl) {
            fields.push(`original_url = $${paramIndex++}`);
            values.push(updates.originalUrl);
        }

        if (updates.customAlias !== undefined) {
            fields.push(`custom_alias = $${paramIndex++}`);
            values.push(updates.customAlias);
        }

        if (updates.expiresAt !== undefined) {
            fields.push(`expires_at = $${paramIndex++}`);
            values.push(updates.expiresAt);
        }

        if (updates.entryCode !== undefined) {
            fields.push(`entry_code = $${paramIndex++}`);
            values.push(updates.entryCode);
        }

        if (updates.metadata !== undefined) {
            fields.push(`metadata = $${paramIndex++}`);
            values.push(JSON.stringify(updates.metadata));
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        values.push(shortCode);

        const result = await this.pool.query(
            `UPDATE ${this.tableName}
            SET ${fields.join(', ')}
            WHERE short_code = $${paramIndex}
            RETURNING *`,
            values
        );

        return result.rows.length > 0 ? this.formatResult(result.rows[0]) : null;
    }

    async getStats(shortCode) {
        const [urlResult, clicksResult, timeSeriesResult] = await Promise.all([
            // 기본 정보
            this.pool.query(
                `SELECT * FROM ${this.tableName} WHERE short_code = $1`,
                [shortCode]
            ),

            // 총 클릭 수 및 고유 IP 수
            this.pool.query(
                `SELECT
                    COUNT(*) as total_clicks,
                    COUNT(DISTINCT ip_address) as unique_visitors
                FROM ${this.clicksTableName}
                WHERE short_code = $1`,
                [shortCode]
            ),

            // 시간대별 클릭 수 (최근 7일)
            this.pool.query(
                `SELECT
                    DATE(clicked_at) as date,
                    COUNT(*) as clicks
                FROM ${this.clicksTableName}
                WHERE short_code = $1
                AND clicked_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
                GROUP BY DATE(clicked_at)
                ORDER BY date DESC`,
                [shortCode]
            )
        ]);

        if (urlResult.rows.length === 0) {
            return null;
        }

        return {
            ...this.formatResult(urlResult.rows[0]),
            totalClicks: parseInt(clicksResult.rows[0].total_clicks),
            uniqueVisitors: parseInt(clicksResult.rows[0].unique_visitors),
            clicksOverTime: timeSeriesResult.rows
        };
    }

    async getOverallStats() {
        const [totalResult, clicksResult, recentResult] = await Promise.all([
            // 총 단축 URL 수
            this.pool.query(
                `SELECT COUNT(*) as total FROM ${this.tableName} WHERE is_active = true`
            ),

            // 총 클릭 수
            this.pool.query(
                `SELECT SUM(click_count) as total_clicks FROM ${this.tableName} WHERE is_active = true`
            ),

            // 최근 생성된 URL (10개)
            this.pool.query(
                `SELECT * FROM ${this.tableName}
                WHERE is_active = true
                ORDER BY created_at DESC
                LIMIT 10`
            )
        ]);

        return {
            totalUrls: parseInt(totalResult.rows[0].total),
            totalClicks: parseInt(clicksResult.rows[0].total_clicks || 0),
            recentUrls: recentResult.rows.map(row => this.formatResult(row))
        };
    }

    async list(options = {}) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const offset = (page - 1) * limit;
        const sortBy = options.sortBy || 'created_at';
        const order = options.order === 'asc' ? 'ASC' : 'DESC';

        const allowedSortFields = ['created_at', 'click_count', 'last_accessed_at'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

        const [itemsResult, countResult] = await Promise.all([
            this.pool.query(
                `SELECT * FROM ${this.tableName}
                WHERE is_active = true
                ORDER BY ${sortField} ${order}
                LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),

            this.pool.query(
                `SELECT COUNT(*) as total FROM ${this.tableName} WHERE is_active = true`
            )
        ]);

        return {
            items: itemsResult.rows.map(row => this.formatResult(row)),
            total: parseInt(countResult.rows[0].total),
            page,
            limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        };
    }

    async healthCheck() {
        try {
            await this.pool.query('SELECT 1');
            return true;
        } catch (error) {
            console.error('PostgreSQL health check failed:', error);
            return false;
        }
    }

    formatResult(row) {
        if (!row) return null;

        return {
            id: row.id,
            shortCode: row.short_code,
            customAlias: row.custom_alias,
            originalUrl: row.original_url,
            qrCode: row.qr_code,
            entryCode: row.entry_code,
            metadata: row.metadata,
            clickCount: row.click_count,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            lastAccessedAt: row.last_accessed_at,
            isActive: row.is_active
        };
    }
}

module.exports = PostgreSQLAdapter;
