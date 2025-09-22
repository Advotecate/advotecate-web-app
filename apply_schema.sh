#!/bin/bash

# FluidPay Payments Schema Application Script
# Applies the schema through Hasura GraphQL Engine

set -e

# Configuration
HASURA_ENDPOINT="http://100.107.103.5:3000"
SCHEMA_FILE="fluidpay_payments_schema.sql"
LOG_FILE="schema_application.log"

echo "FluidPay Payments Schema Application"
echo "===================================="
echo "Timestamp: $(date)"
echo "Hasura Endpoint: $HASURA_ENDPOINT"
echo "Schema File: $SCHEMA_FILE"
echo ""

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if schema file exists
if [[ ! -f "$SCHEMA_FILE" ]]; then
    log_message "ERROR: Schema file $SCHEMA_FILE not found!"
    exit 1
fi

log_message "INFO: Starting schema application process..."

# Method 1: Try direct SQL execution through Hasura
log_message "INFO: Attempting Method 1 - Direct Hasura SQL API"

# Create a JSON payload for the SQL API
cat > temp_sql_payload.json << EOF
{
  "type": "run_sql",
  "args": {
    "source": "default",
    "sql": "$(cat $SCHEMA_FILE | sed 's/"/\\"/g' | tr '\n' ' ')"
  }
}
EOF

# Try to execute through Hasura API
RESPONSE=$(curl -s -X POST "$HASURA_ENDPOINT/v2/query" \
  -H "Content-Type: application/json" \
  -d @temp_sql_payload.json 2>&1)

if echo "$RESPONSE" | grep -q "success\|result"; then
    log_message "SUCCESS: Schema applied successfully through Hasura SQL API"
    echo "$RESPONSE" >> "$LOG_FILE"
    rm -f temp_sql_payload.json
    exit 0
elif echo "$RESPONSE" | grep -q "error"; then
    log_message "WARNING: Hasura SQL API returned errors:"
    echo "$RESPONSE" >> "$LOG_FILE"
fi

# Clean up temporary file
rm -f temp_sql_payload.json

# Method 2: Try psql direct connection
log_message "INFO: Attempting Method 2 - Direct PostgreSQL connection"

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "Please provide PostgreSQL connection details:"
    read -p "Database host (default: 100.107.103.5): " DB_HOST
    DB_HOST=${DB_HOST:-100.107.103.5}

    read -p "Database port (default: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}

    read -p "Database name: " DB_NAME
    read -p "Database user: " DB_USER

    if [[ -n "$DB_NAME" && -n "$DB_USER" ]]; then
        log_message "INFO: Attempting direct PostgreSQL connection..."

        if PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"; then
            log_message "SUCCESS: Schema applied successfully through direct PostgreSQL connection"
            exit 0
        else
            log_message "ERROR: Failed to apply schema through PostgreSQL"
        fi
    else
        log_message "INFO: Skipping PostgreSQL method - insufficient connection details"
    fi
else
    log_message "INFO: psql not available, skipping PostgreSQL method"
fi

# Method 3: Manual application instructions
log_message "INFO: Providing manual application instructions"

cat << EOF

Manual Schema Application Instructions
=====================================

Since automatic application failed, please apply the schema manually using one of these methods:

Method A: Hasura Console SQL Runner
-----------------------------------
1. Open your web browser and navigate to: $HASURA_ENDPOINT/console
2. Go to the "Data" tab
3. Select "SQL" from the left sidebar
4. Copy and paste the contents of '$SCHEMA_FILE' into the SQL editor
5. Click "Run!" to execute the schema

Method B: Direct PostgreSQL Connection
-------------------------------------
If you have direct database access:
1. Connect to your PostgreSQL database using your preferred client
2. Execute the contents of '$SCHEMA_FILE'

Method C: Hasura CLI (if installed)
----------------------------------
1. Set up your Hasura project configuration
2. Run: hasura migrate apply --database-name default
3. Run: hasura metadata apply

Post-Application Steps
=====================
After successfully applying the schema:

1. Verify tables were created:
   - payment_methods
   - donations
   - transaction_events
   - refunds
   - contribution_limits
   - donor_contributions
   - fec_reports

2. Check that indexes and triggers were created

3. Verify initial FEC contribution limits data was inserted

4. Test basic functionality with sample queries

Troubleshooting
===============
If you encounter issues:
- Check database connection settings
- Verify user has CREATE TABLE privileges
- Ensure PostgreSQL extensions are available
- Review schema application logs in: $LOG_FILE

For additional support, review the comprehensive schema documentation in the SQL file.

EOF

log_message "INFO: Manual application instructions provided"
echo ""
echo "Schema file ready at: $(pwd)/$SCHEMA_FILE"
echo "Application log: $(pwd)/$LOG_FILE"
echo ""
echo "Next steps: Follow the manual application instructions above"