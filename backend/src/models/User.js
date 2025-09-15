const bcrypt = require("bcryptjs");
const { query } = require("../config/database");

class User {
    constructor({ id, email, name, password, created_at, updated_at }) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.password = password;
        this.createdAt = created_at;
        this.updatedAt = updated_at;
    }

    static _mapRow(row) {
        return row ? new User(row) : null;
    }

    static async create({ email, password, name }) {
        const hashedPassword = await bcrypt.hash(password, 12);

        const queryText = `
      INSERT INTO users (email, password, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, created_at, updated_at
    `;

        try {
            const { rows } = await query(queryText, [email, hashedPassword, name]);
            return this._mapRow(rows[0]);
        } catch (error) {
            if (error.code === "23505") throw new Error("Email already exists");
            throw error;
        }
    }

    static async findByEmail(email) {
        const { rows } = await query(
            `
      SELECT id, email, name, password, created_at, updated_at
      FROM users WHERE email = $1
    `,
            [email]
        );

        return this._mapRow(rows[0]);
    }

    static async findById(id) {
        const { rows } = await query(
            `
      SELECT id, email, name, created_at, updated_at
      FROM users WHERE id = $1
    `,
            [id]
        );

        return this._mapRow(rows[0]);
    }

    static async findAll(excludeUserId = null) {
        const baseQuery = `
      SELECT id, email, name, created_at, updated_at
      FROM users
    `;
        const whereClause = excludeUserId ? "WHERE id != $1" : "";
        const orderBy = "ORDER BY name ASC";
        const params = excludeUserId ? [excludeUserId] : [];

        const { rows } = await query([baseQuery, whereClause, orderBy].join(" "), params);
        return rows.map(this._mapRow);
    }

    static async update(id, { name }) {
        const { rows } = await query(
            `
      UPDATE users 
      SET name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, name, created_at, updated_at
    `,
            [name, id]
        );

        return this._mapRow(rows[0]);
    }

    static async delete(id) {
        const { rowCount } = await query("DELETE FROM users WHERE id = $1", [id]);
        return rowCount > 0;
    }

    async comparePassword(password) {
        return bcrypt.compare(password, this.password);
    }

    toJSON() {
        const { id, email, name, createdAt, updatedAt } = this;
        return { id, email, name, createdAt, updatedAt };
    }

    static async getUserStats(userId) {
        const { rows } = await query(
            `
      SELECT 
        COUNT(CASE WHEN creditor_id = $1 THEN 1 END) as debts_owed_to_me,
        COUNT(CASE WHEN debtor_id = $1 THEN 1 END) as my_debts,
        COUNT(CASE WHEN creditor_id = $1 AND is_paid = true THEN 1 END) as paid_debts_to_me,
        COUNT(CASE WHEN debtor_id = $1 AND is_paid = true THEN 1 END) as my_paid_debts,
        COALESCE(SUM(CASE WHEN creditor_id = $1 AND is_paid = false THEN amount END), 0) as total_owed_to_me,
        COALESCE(SUM(CASE WHEN debtor_id = $1 AND is_paid = false THEN amount END), 0) as total_i_owe
      FROM debts 
      WHERE creditor_id = $1 OR debtor_id = $1
    `,
            [userId]
        );

        return rows[0];
    }
}

module.exports = User;
