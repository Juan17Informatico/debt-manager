const { query } = require("../config/database");

const BASE_QUERY = `
  SELECT d.*,
         c.name as creditor_name, c.email as creditor_email,
         deb.name as debtor_name, deb.email as debtor_email
  FROM debts d
  JOIN users c ON d.creditor_id = c.id
  JOIN users deb ON d.debtor_id = deb.id
`;

class Debt {
    constructor({
        id,
        creditor_id,
        debtor_id,
        amount,
        description,
        is_paid,
        paid_at,
        created_at,
        updated_at,
        creditor_name,
        creditor_email,
        debtor_name,
        debtor_email,
    }) {
        this.id = id;
        this.creditorId = creditor_id;
        this.debtorId = debtor_id;
        this.amount = Number(amount);
        this.description = description;
        this.isPaid = is_paid;
        this.paidAt = paid_at;
        this.createdAt = created_at;
        this.updatedAt = updated_at;

        this.creditor = creditor_name
            ? { id: creditor_id, name: creditor_name, email: creditor_email }
            : null;
        this.debtor = debtor_name
            ? { id: debtor_id, name: debtor_name, email: debtor_email }
            : null;
    }

    static async checkDebtExists(id) {
        const debt = await Debt.findById(id);
        if (!debt) throw new Error("Debt not found");
        return debt;
    }

    static validatePermission(debt, userId, action) {
        if (action === "update" && debt.isPaid) throw new Error("Cannot update a paid debt");
        if (action === "delete" && debt.isPaid) throw new Error("Cannot delete a paid debt");
        if (action === "markPaid" && debt.isPaid) throw new Error("Debt is already paid");

        if (action === "delete" && debt.creditorId !== userId)
            throw new Error("Only the creditor can delete a debt");
        if (action === "markPaid" && debt.debtorId !== userId)
            throw new Error("Only the debtor can mark a debt as paid");
        if (action === "update" && debt.creditorId !== userId && debt.debtorId !== userId) {
            throw new Error("You do not have permission to update this debt");
        }
    }

    // CRUD

    static async create({ creditorId, debtorId, amount, description }) {
        if (creditorId === debtorId)
            throw new Error("Creditor and debtor cannot be the same person");

        const sql = `
      INSERT INTO debts (creditor_id, debtor_id, amount, description)
      VALUES ($1, $2, $3, $4) RETURNING *`;
        const result = await query(sql, [creditorId, debtorId, amount, description]);

        return new Debt(result.rows[0]);
    }

    static async findById(id) {
        const sql = `${BASE_QUERY} WHERE d.id = $1`;
        const result = await query(sql, [id]);
        return result.rows[0] ? new Debt(result.rows[0]) : null;
    }

    static async findByUserId(userId, { status, type, limit = 50, offset = 0 } = {}) {
        let sql = `${BASE_QUERY} WHERE (d.creditor_id = $1 OR d.debtor_id = $1)`;
        const params = [userId];

        if (status === "paid") sql += " AND d.is_paid = true";
        if (status === "pending") sql += " AND d.is_paid = false";
        if (type === "owed_to_me") sql += " AND d.creditor_id = $1";
        if (type === "i_owe") sql += " AND d.debtor_id = $1";

        sql += " ORDER BY d.created_at DESC LIMIT $2 OFFSET $3";
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map((row) => new Debt(row));
    }

    static async update(id, { amount, description }, userId) {
        const debt = await Debt.checkDebtExists(id);
        Debt.validatePermission(debt, userId, "update");

        const sql = `
      UPDATE debts SET amount = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 RETURNING *`;
        const result = await query(sql, [amount, description, id]);

        return new Debt(result.rows[0]);
    }

    static async markAsPaid(id, userId) {
        const debt = await Debt.checkDebtExists(id);
        Debt.validatePermission(debt, userId, "markPaid");

        const sql = `
      UPDATE debts SET is_paid = true, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`;
        const result = await query(sql, [id]);

        return new Debt(result.rows[0]);
    }

    static async delete(id, userId) {
        const debt = await Debt.checkDebtExists(id);
        Debt.validatePermission(debt, userId, "delete");

        const result = await query("DELETE FROM debts WHERE id = $1", [id]);
        return result.rowCount > 0;
    }

    toJSON() {
        const {
            id,
            creditorId,
            debtorId,
            amount,
            description,
            isPaid,
            paidAt,
            createdAt,
            updatedAt,
            creditor,
            debtor,
        } = this;
        return {
            id,
            creditorId,
            debtorId,
            amount,
            description,
            isPaid,
            paidAt,
            createdAt,
            updatedAt,
            creditor,
            debtor,
        };
    }
}

module.exports = Debt;
