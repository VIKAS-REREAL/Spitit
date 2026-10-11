//! REREAL Spitit v3: SQLite Persistent Storage for Text History & Usage Stats.
//! Complies with Section 4.8: Text history and usage stats are completely decoupled.
//! Text history is capped at 500 rows and respects the privacy toggle.
//! Usage stats contain numbers only (no text) and power honest dashboard analytics.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

fn db_path() -> Result<PathBuf, String> {
    let appdata = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("APPDATA"))
        .ok_or_else(|| "Could not locate AppData directory".to_string())?;
    let dir = PathBuf::from(appdata).join("Spitit");
    let _ = std::fs::create_dir_all(&dir);
    Ok(dir.join("spitit.db"))
}

pub struct DbManager {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryRecord {
    pub id: i64,
    pub text: String,
    pub word_count: usize,
    pub duration_secs: f32,
    pub wpm: u32,
    pub app_name: String,
    pub app_icon: Option<String>,
    pub language: String,
    pub timestamp_ms: i64,
    pub formatted_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyActivity {
    pub day: String,
    pub date: String,
    pub words: usize,
    pub is_today: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_words: usize,
    pub words_today: usize,
    pub words_this_week: usize,
    pub avg_wpm: u32,
    pub time_saved_mins: u32,
    pub avg_words_per_dictation: f32,
    pub daily_activity: Vec<DailyActivity>,
    pub top_apps: Vec<(String, usize)>,
    pub today_audio_seconds: f32,
    pub total_dictations: usize,
    pub is_empty: bool,
}

impl DbManager {
    pub fn init() -> Result<Self, String> {
        let path = db_path()?;
        let conn = Connection::open(&path).map_err(|e| format!("SQLite open error: {e}"))?;

        // 1. Text history table (capped at 500 rows, privacy-sensitive)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS text_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                word_count INTEGER NOT NULL,
                duration_secs REAL NOT NULL,
                wpm INTEGER NOT NULL,
                app_name TEXT NOT NULL,
                app_icon TEXT,
                language TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                formatted_date TEXT NOT NULL
            );",
            [],
        )
        .map_err(|e| format!("Failed to create text_history: {e}"))?;

        // 2. Usage stats table (numbers only, never text)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS usage_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp_ms INTEGER NOT NULL,
                word_count INTEGER NOT NULL,
                duration_secs REAL NOT NULL,
                app_name TEXT NOT NULL,
                language TEXT NOT NULL
            );",
            [],
        )
        .map_err(|e| format!("Failed to create usage_stats: {e}"))?;

        // Index for performance
        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_ts ON text_history (timestamp_ms DESC);",
            [],
        );
        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_stats_ts ON usage_stats (timestamp_ms DESC);",
            [],
        );

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn save_record(
        &self,
        text: &str,
        word_count: usize,
        duration_secs: f32,
        wpm: u32,
        app_name: &str,
        app_icon: Option<&str>,
        language: &str,
        save_history: bool,
        keep_stats: bool,
    ) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        // A) Save text history if enabled
        if save_history {
            let formatted_date = format_timestamp_ms(now_ms);
            conn.execute(
                "INSERT INTO text_history (text, word_count, duration_secs, wpm, app_name, app_icon, language, timestamp_ms, formatted_date)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9);",
                params![
                    text,
                    word_count as i64,
                    duration_secs as f64,
                    wpm as i64,
                    app_name,
                    app_icon,
                    language,
                    now_ms,
                    formatted_date
                ],
            )
            .map_err(|e| format!("Insert text_history error: {e}"))?;

            // Cap at 500 rows: remove older rows
            let _ = conn.execute(
                "DELETE FROM text_history WHERE id NOT IN (
                    SELECT id FROM text_history ORDER BY id DESC LIMIT 500
                );",
                [],
            );
        }

        // B) Save usage stats if enabled (numbers only, never words)
        if keep_stats {
            conn.execute(
                "INSERT INTO usage_stats (timestamp_ms, word_count, duration_secs, app_name, language)
                 VALUES (?1, ?2, ?3, ?4, ?5);",
                params![
                    now_ms,
                    word_count as i64,
                    duration_secs as f64,
                    app_name,
                    language
                ],
            )
            .map_err(|e| format!("Insert usage_stats error: {e}"))?;

            // Trim detailed rows older than 90 days (90 * 86400 * 1000 ms)
            let cutoff_90_days = now_ms - (90i64 * 86400 * 1000);
            let _ = conn.execute(
                "DELETE FROM usage_stats WHERE timestamp_ms < ?1;",
                params![cutoff_90_days],
            );
        }

        Ok(())
    }

    pub fn get_history(&self, search: Option<&str>, limit: usize) -> Result<Vec<HistoryRecord>, String> {
        let conn = self.conn.lock().unwrap();
        let search_term = search.unwrap_or("").trim().to_lowercase();

        let mut stmt = if search_term.is_empty() {
            conn.prepare(
                "SELECT id, text, word_count, duration_secs, wpm, app_name, app_icon, language, timestamp_ms, formatted_date
                 FROM text_history ORDER BY id DESC LIMIT ?1;",
            )
            .map_err(|e| e.to_string())?
        } else {
            conn.prepare(
                "SELECT id, text, word_count, duration_secs, wpm, app_name, app_icon, language, timestamp_ms, formatted_date
                 FROM text_history WHERE LOWER(text) LIKE ?1 OR LOWER(app_name) LIKE ?1
                 ORDER BY id DESC LIMIT ?2;",
            )
            .map_err(|e| e.to_string())?
        };

        let rows = if search_term.is_empty() {
            stmt.query_map(params![limit as i64], map_history_row)
                .map_err(|e| e.to_string())?
        } else {
            let pattern = format!("%{search_term}%");
            stmt.query_map(params![pattern, limit as i64], map_history_row)
                .map_err(|e| e.to_string())?
        };

        let mut records = Vec::new();
        for r in rows {
            if let Ok(rec) = r {
                records.push(rec);
            }
        }
        Ok(records)
    }

    pub fn delete_history_item(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM text_history WHERE id = ?1;", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clear_history(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM text_history;", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn reset_stats(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM usage_stats;", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_dashboard_stats(&self) -> Result<DashboardStats, String> {
        let conn = self.conn.lock().unwrap();
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        // Start of today in local time (or ~24h approximation, but we can compute midnight UTC / local)
        let day_ms = 86_400_000i64;
        let today_start_ms = (now_ms / day_ms) * day_ms;
        let week_start_ms = now_ms - (7 * day_ms);

        let mut total_words: usize = 0;
        let mut words_today: usize = 0;
        let mut words_this_week: usize = 0;
        let mut total_duration_secs: f64 = 0.0;
        let mut today_audio_seconds: f64 = 0.0;
        let mut total_dictations: usize = 0;

        // Query aggregations from usage_stats
        let mut stmt = conn
            .prepare("SELECT timestamp_ms, word_count, duration_secs, app_name FROM usage_stats ORDER BY timestamp_ms ASC;")
            .map_err(|e| e.to_string())?;

        let mut app_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

        // 7-day volume tracking
        let day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        // Prepare 7 days: 6 days ago up to today
        let mut daily_map: Vec<(i64, String, String, usize, bool)> = Vec::new();
        for i in (0..7).rev() {
            let d_start = today_start_ms - (i * day_ms);
            let days_since_epoch = (d_start / day_ms) as usize;
            // Day of week: Jan 1 1970 was Thursday (day index 4)
            let weekday_idx = (days_since_epoch + 4) % 7;
            let day_name = day_names[weekday_idx].to_string();
            // Format simple date e.g. "D-0"
            let date_label = format!("{day_name}");
            daily_map.push((d_start, day_name, date_label, 0, i == 0));
        }

        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for r in rows {
            if let Ok((ts, words, dur, app)) = r {
                total_dictations += 1;
                total_words += words as usize;
                total_duration_secs += dur;

                if ts >= today_start_ms {
                    words_today += words as usize;
                    today_audio_seconds += dur;
                }
                if ts >= week_start_ms {
                    words_this_week += words as usize;
                }

                *app_counts.entry(app).or_insert(0) += 1;

                // Add to daily activity
                for item in daily_map.iter_mut() {
                    let d_start = item.0;
                    let d_end = d_start + day_ms;
                    if ts >= d_start && ts < d_end {
                        item.3 += words as usize;
                        break;
                    }
                }
            }
        }

        let is_empty = total_dictations == 0;

        let avg_wpm = if total_duration_secs >= 1.0 && total_words > 0 {
            ((total_words as f64 / total_duration_secs) * 60.0).round() as u32
        } else {
            0
        };

        let avg_words_per_dictation = if total_dictations > 0 {
            (total_words as f32 / total_dictations as f32 * 10.0).round() / 10.0
        } else {
            0.0
        };

        // Time saved vs 40 WPM typing: typing_time_mins - speaking_time_mins
        let typing_time_mins = total_words as f64 / 40.0;
        let speaking_time_mins = total_duration_secs / 60.0;
        let time_saved_mins = (typing_time_mins - speaking_time_mins).max(0.0).round() as u32;

        let mut top_apps_vec: Vec<(String, usize)> = app_counts.into_iter().collect();
        top_apps_vec.sort_by(|a, b| b.1.cmp(&a.1));
        top_apps_vec.truncate(5);

        let daily_activity = daily_map
            .into_iter()
            .map(|(_, day, date, words, is_today)| DailyActivity {
                day,
                date,
                words,
                is_today,
            })
            .collect();

        Ok(DashboardStats {
            total_words,
            words_today,
            words_this_week,
            avg_wpm,
            time_saved_mins,
            avg_words_per_dictation,
            daily_activity,
            top_apps: top_apps_vec,
            today_audio_seconds: today_audio_seconds as f32,
            total_dictations,
            is_empty,
        })
    }
}

fn map_history_row(row: &rusqlite::Row) -> rusqlite::Result<HistoryRecord> {
    Ok(HistoryRecord {
        id: row.get(0)?,
        text: row.get(1)?,
        word_count: row.get::<_, i64>(2)? as usize,
        duration_secs: row.get::<_, f64>(3)? as f32,
        wpm: row.get::<_, i64>(4)? as u32,
        app_name: row.get(5)?,
        app_icon: row.get(6)?,
        language: row.get(7)?,
        timestamp_ms: row.get(8)?,
        formatted_date: row.get(9)?,
    })
}

fn format_timestamp_ms(ts_ms: i64) -> String {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let diff_secs = (now_ms - ts_ms) / 1000;
    if diff_secs < 60 {
        "Just now".to_string()
    } else if diff_secs < 3600 {
        format!("{} mins ago", diff_secs / 60)
    } else if diff_secs < 86400 {
        format!("{} hours ago", diff_secs / 3600)
    } else {
        let days = diff_secs / 86400;
        if days == 1 {
            "Yesterday".to_string()
        } else {
            format!("{days} days ago")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    impl DbManager {
        pub fn new_in_memory() -> Self {
            let conn = Connection::open_in_memory().unwrap();
            conn.execute(
                "CREATE TABLE text_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text TEXT NOT NULL,
                    word_count INTEGER NOT NULL,
                    duration_secs REAL NOT NULL,
                    wpm INTEGER NOT NULL,
                    app_name TEXT NOT NULL,
                    app_icon TEXT,
                    language TEXT NOT NULL,
                    timestamp_ms INTEGER NOT NULL,
                    formatted_date TEXT NOT NULL
                );",
                [],
            )
            .unwrap();

            conn.execute(
                "CREATE TABLE usage_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp_ms INTEGER NOT NULL,
                    word_count INTEGER NOT NULL,
                    duration_secs REAL NOT NULL,
                    app_name TEXT NOT NULL,
                    language TEXT NOT NULL
                );",
                [],
            )
            .unwrap();

            Self {
                conn: Mutex::new(conn),
            }
        }
    }

    #[test]
    fn test_decoupled_history_and_stats() {
        let db = DbManager::new_in_memory();

        // 1. Save with text history DISABLED, usage stats ENABLED
        db.save_record("Secret private text", 3, 1.5, 120, "Notepad", None, "en", false, true)
            .unwrap();

        let history = db.get_history(None, 10).unwrap();
        assert_eq!(history.len(), 0, "No text should be written when save_history is false");

        let stats = db.get_dashboard_stats().unwrap();
        assert_eq!(stats.total_words, 3, "Stats must count words even with history off");
        assert_eq!(stats.total_dictations, 1);
        assert!(!stats.is_empty);

        // 2. Save with text history ENABLED
        db.save_record("Public notes", 2, 1.0, 120, "VS Code", None, "en", true, true)
            .unwrap();

        let history2 = db.get_history(None, 10).unwrap();
        assert_eq!(history2.len(), 1);
        assert_eq!(history2[0].text, "Public notes");
    }

    #[test]
    fn test_cap_500_entries() {
        let db = DbManager::new_in_memory();
        for i in 0..520 {
            db.save_record(&format!("dictation {i}"), 2, 1.0, 120, "App", None, "en", true, false)
                .unwrap();
        }
        let history = db.get_history(None, 1000).unwrap();
        assert_eq!(history.len(), 500, "Text history must be capped at 500 rows");
    }

    #[test]
    fn test_honest_empty_stats() {
        let db = DbManager::new_in_memory();
        let stats = db.get_dashboard_stats().unwrap();
        assert!(stats.is_empty);
        assert_eq!(stats.total_words, 0);
        assert_eq!(stats.avg_wpm, 0);
    }
}
