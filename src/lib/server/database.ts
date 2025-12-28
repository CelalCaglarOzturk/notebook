import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = join(process.cwd(), "planner.db");
export const db = new Database(dbPath);

// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON");

// Initialize database tables
export function initializeDatabase() {
  // Create months table
  db.exec(`
    CREATE TABLE IF NOT EXISTS months (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      monthly_targets TEXT DEFAULT '',
      UNIQUE(year, month)
    )
  `);

  // Create days table with study_status (null = neutral, 'studied' = çalışıldı, 'notStudied' = çalışılmadı)
  db.exec(`
    CREATE TABLE IF NOT EXISTS days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      month_id INTEGER NOT NULL,
      note TEXT DEFAULT '',
      study_status TEXT DEFAULT NULL,
      baslama_saati TEXT DEFAULT '',
      bitis_saati TEXT DEFAULT '',
      is_exam_day INTEGER DEFAULT 0,
      exam_name TEXT DEFAULT '',
      FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_months_year_month ON months(year, month);
    CREATE INDEX IF NOT EXISTS idx_days_date ON days(date);
    CREATE INDEX IF NOT EXISTS idx_days_month_id ON days(month_id);
  `);

  console.log("Database initialized successfully");
}

// Initialize database on import
initializeDatabase();

// Prepared statements for better performance
export const statements = {
  // Month operations
  getMonth: db.prepare("SELECT * FROM months WHERE year = ? AND month = ?"),
  insertMonth: db.prepare(
    "INSERT OR IGNORE INTO months (year, month, monthly_targets) VALUES (?, ?, ?)",
  ),
  updateMonthTargets: db.prepare(
    "UPDATE months SET monthly_targets = ? WHERE year = ? AND month = ?",
  ),
  getAllMonths: db.prepare("SELECT * FROM months ORDER BY year, month"),

  // Day operations
  getDay: db.prepare("SELECT * FROM days WHERE date = ?"),
  getDaysByMonth: db.prepare(`
    SELECT d.* FROM days d
    JOIN months m ON d.month_id = m.id
    WHERE m.year = ? AND m.month = ?
  `),
  insertDay: db.prepare(`
    INSERT OR REPLACE INTO days (
      date, month_id, note, study_status,
      baslama_saati, bitis_saati, is_exam_day, exam_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateDay: db.prepare(`
    UPDATE days SET
      note = ?,
      study_status = ?,
      baslama_saati = ?,
      bitis_saati = ?,
      is_exam_day = ?,
      exam_name = ?
    WHERE date = ?
  `),
  getAllDays: db.prepare("SELECT * FROM days ORDER BY date"),
};

// Helper function to get or create month
export function getOrCreateMonth(year: number, month: number): number {
  statements.insertMonth.run(year, month, "");
  const result = statements.getMonth.get(year, month) as { id: number } | null;
  return result?.id ?? 0;
}
