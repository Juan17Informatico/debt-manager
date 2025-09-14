const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'debt_manager',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Function to initialize the database
const initializeDatabase = async () => {
    try {
        console.log('Connecting to PostgreSQL...');

        // Test connection
        const client = await pool.connect();
        console.log('Connection to PostgreSQL established');
        client.release();

        // Create tables if they do not exist
        await createTables();
        console.log('Tables verified/created successfully');

    } catch (error) {
        console.error('Error connecting to the database:', error);
        throw error;
    }
};

// Crear tablas
const createTables = async () => {
    const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    const createDebtsTable = `
    CREATE TABLE IF NOT EXISTS debts (
      id SERIAL PRIMARY KEY,
      creditor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      debtor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
      description TEXT NOT NULL,
      is_paid BOOLEAN DEFAULT FALSE,
      paid_at TIMESTAMP WITH TIME ZONE NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_debts_creditor ON debts(creditor_id);
    CREATE INDEX IF NOT EXISTS idx_debts_debtor ON debts(debtor_id);
    CREATE INDEX IF NOT EXISTS idx_debts_paid ON debts(is_paid);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `;

    const updateTimestampFunction = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;

    const createTriggers = `
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
    CREATE TRIGGER update_debts_updated_at 
      BEFORE UPDATE ON debts 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `;

    try {
        await pool.query(createUsersTable);
        await pool.query(createDebtsTable);
        await pool.query(createIndexes);
        await pool.query(updateTimestampFunction);
        await pool.query(createTriggers);
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
};

// Helper function to execute queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Exec query:', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Error in query:', { text, error: error.message });
        throw error;
    }
};

// Function to get a client from the pool
const getClient = async () => {
    return await pool.connect();
};

module.exports = {
    pool,
    query,
    getClient,
    initializeDatabase
};