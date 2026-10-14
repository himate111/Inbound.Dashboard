import mysql.connector
import pyodbc
from datetime import timedelta, time


# ==========================================
# CONFIGURATION
# ==========================================

MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_USER = "root"

# Put your MySQL root password between the quotes
MYSQL_PASSWORD = "Siva@mysql10#"

MYSQL_DATABASE = "call_center_dashboard"

SQL_SERVER = r"LENOVO\SQLEXPRESS"
SQL_DATABASE = "call_center_dashboard"

BATCH_SIZE = 1000


# ==========================================
# HELPER FOR MYSQL TIME VALUES
# ==========================================

def convert_value(value):
    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())

        total_seconds %= 24 * 60 * 60

        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60

        return time(hours, minutes, seconds)

    return value


# ==========================================
# CONNECT TO MYSQL
# ==========================================

print("Connecting to MySQL...")

mysql_conn = mysql.connector.connect(
    host=MYSQL_HOST,
    port=MYSQL_PORT,
    user=MYSQL_USER,
    password=MYSQL_PASSWORD,
    database=MYSQL_DATABASE
)

mysql_cursor = mysql_conn.cursor()

print("MySQL connected.")


# ==========================================
# CONNECT TO SQL SERVER
# ==========================================

print("Connecting to SQL Server...")

sql_conn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={SQL_SERVER};"
    f"DATABASE={SQL_DATABASE};"
    "Trusted_Connection=yes;"
    "Encrypt=yes;"
    "TrustServerCertificate=yes;"
)

sql_cursor = sql_conn.cursor()

print("SQL Server connected.")


# ==========================================
# SAFETY CHECK
# TARGET TABLE MUST BE EMPTY
# ==========================================

sql_cursor.execute(
    "SELECT COUNT(*) FROM dbo.inbound_calls"
)

target_count = sql_cursor.fetchone()[0]

print(f"Current SQL Server rows: {target_count:,}")

if target_count != 0:
    raise RuntimeError(
        "STOPPED: dbo.inbound_calls is not empty. "
        "Migration will not continue because this could create duplicates."
    )


# ==========================================
# GET MYSQL COLUMN NAMES
# ==========================================

mysql_cursor.execute(
    """
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = %s
      AND TABLE_NAME = 'inbound_calls'
    ORDER BY ORDINAL_POSITION
    """,
    (MYSQL_DATABASE,)
)

mysql_columns = [
    row[0]
    for row in mysql_cursor.fetchall()
]


# ==========================================
# GET SQL SERVER COLUMN NAMES
# ==========================================

sql_cursor.execute(
    """
    SELECT c.name
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.inbound_calls')
    ORDER BY c.column_id
    """
)

sql_columns = [
    row[0]
    for row in sql_cursor.fetchall()
]


# ==========================================
# FIND MATCHING COLUMNS
# ==========================================

mysql_lookup = {
    column.lower(): column
    for column in mysql_columns
}

common_columns = []

for sql_column in sql_columns:

    if sql_column.lower() in mysql_lookup:

        common_columns.append(
            (
                mysql_lookup[sql_column.lower()],
                sql_column
            )
        )


if not common_columns:
    raise RuntimeError(
        "No matching columns found between MySQL and SQL Server."
    )


print()
print(f"Matching columns found: {len(common_columns)}")

for mysql_column, sql_column in common_columns:
    print(
        f"  {mysql_column} -> {sql_column}"
    )


# ==========================================
# BUILD MYSQL SELECT
# ==========================================

mysql_select_columns = ", ".join(
    f"`{mysql_column}`"
    for mysql_column, _ in common_columns
)

mysql_select_sql = f"""
SELECT {mysql_select_columns}
FROM inbound_calls
ORDER BY id
"""


# ==========================================
# BUILD SQL SERVER INSERT
# ==========================================

sql_insert_columns = ", ".join(
    f"[{sql_column}]"
    for _, sql_column in common_columns
)

placeholders = ", ".join(
    "?"
    for _ in common_columns
)

sql_insert_sql = f"""
INSERT INTO dbo.inbound_calls
(
    {sql_insert_columns}
)
VALUES
(
    {placeholders}
)
"""


# ==========================================
# GET MYSQL SOURCE ROW COUNT
# ==========================================

mysql_cursor.execute(
    "SELECT COUNT(*) FROM inbound_calls"
)

source_count = mysql_cursor.fetchone()[0]

print()
print(f"MySQL source rows: {source_count:,}")
print()


if source_count == 0:
    raise RuntimeError(
        "MySQL inbound_calls contains 0 rows. Nothing to migrate."
    )


# ==========================================
# START MIGRATION
# ==========================================

print("Starting migration...")
print()


# Preserve the original MySQL ID values
sql_cursor.execute(
    "SET IDENTITY_INSERT dbo.inbound_calls ON"
)

sql_conn.commit()


mysql_cursor.execute(mysql_select_sql)

sql_cursor.fast_executemany = True

migrated = 0


try:

    while True:

        rows = mysql_cursor.fetchmany(BATCH_SIZE)

        if not rows:
            break

        cleaned_rows = []

        for row in rows:

            cleaned_row = tuple(
                convert_value(value)
                for value in row
            )

            cleaned_rows.append(cleaned_row)


        sql_cursor.executemany(
            sql_insert_sql,
            cleaned_rows
        )

        sql_conn.commit()

        migrated += len(cleaned_rows)

        percent = (
            migrated / source_count
        ) * 100

        print(
            f"Migrated {migrated:,} / "
            f"{source_count:,} rows "
            f"({percent:.2f}%)"
        )


finally:

    sql_cursor.execute(
        "SET IDENTITY_INSERT dbo.inbound_calls OFF"
    )

    sql_conn.commit()


# ==========================================
# VERIFY MIGRATION
# ==========================================

sql_cursor.execute(
    """
    SELECT
        COUNT(*) AS total_rows,
        MIN(id) AS minimum_id,
        MAX(id) AS maximum_id
    FROM dbo.inbound_calls
    """
)

result = sql_cursor.fetchone()


print()
print("======================================")
print("MIGRATION COMPLETE")
print("======================================")

print(
    f"SQL Server rows : {result[0]:,}"
)

print(
    f"Minimum ID      : {result[1]}"
)

print(
    f"Maximum ID      : {result[2]}"
)

print()


if result[0] == source_count:

    print(
        "SUCCESS: MySQL and SQL Server row counts match."
    )

else:

    print(
        "WARNING: MySQL and SQL Server row counts do NOT match."
    )


# ==========================================
# CLOSE CONNECTIONS
# ==========================================

mysql_cursor.close()
mysql_conn.close()

sql_cursor.close()
sql_conn.close()

print()
print("Connections closed.")