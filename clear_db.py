#!/usr/bin/env python3
"""
Database Reset Script for LeadHunt.

Clears all stored campaign, lead, target, approval, and chat history records from:
  - data/leadhunt.db
  - data/manager_memory.db

Usage:
  python3 clear_db.py
"""

import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"

LEADHUNT_DB = DATA_DIR / "leadhunt.db"
MEMORY_DB = DATA_DIR / "manager_memory.db"


def clear_leadhunt_db():
    if not LEADHUNT_DB.exists():
        print(f"ℹ️ {LEADHUNT_DB.name} does not exist yet.")
        return

    conn = sqlite3.connect(str(LEADHUNT_DB))
    cursor = conn.cursor()

    # Disable foreign keys temporarily during drop/cleanup
    cursor.execute("PRAGMA foreign_keys = OFF;")

    tables = ["pending_approvals", "targets", "leads", "campaigns"]
    cleared_counts = {}

    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            cursor.execute(f"DELETE FROM {table};")
            cleared_counts[table] = count
        except sqlite3.OperationalError:
            # Table might not exist yet
            pass

    cursor.execute("PRAGMA foreign_keys = ON;")
    conn.commit()
    conn.close()

    print("✅ Main LeadHunt Database (leadhunt.db) Cleared:")
    for table, count in cleared_counts.items():
        print(f"   - {table}: {count} records removed")


def clear_memory_db():
    if not MEMORY_DB.exists():
        print(f"ℹ️ {MEMORY_DB.name} does not exist yet.")
        return

    conn = sqlite3.connect(str(MEMORY_DB))
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM chat_history")
        count = cursor.fetchone()[0]
        cursor.execute("DELETE FROM chat_history;")
        conn.commit()
        print(f"✅ Manager Memory Database (manager_memory.db) Cleared: {count} chat history messages removed")
    except sqlite3.OperationalError:
        pass
    finally:
        conn.close()


def main():
    print("==================================================")
    print("    LeadHunt Fresh Start - Resetting Databases   ")
    print("==================================================")
    clear_leadhunt_db()
    clear_memory_db()
    print("==================================================")
    print("✨ Database reset complete! Ready for fresh frontend uploads.")
    print("==================================================")


if __name__ == "__main__":
    main()
