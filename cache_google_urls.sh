#!/bin/bash

# Configuration Variables
API_KEY="AIzaSyDRk6GSn3W_AgpoEN-blxb2PGctvE9UvPY" # <<< REPLACE THIS
# --- UPDATED INPUT FILE NAME ---
INPUT_CSV="restaurant-map/data/restaurants.csv"
OUTPUT_CSV="restaurant-map/data/google_map_url.csv"
LOG_DIR="restaurant-map/data/logs"
LOG_FILE="$LOG_DIR/cache_log_$(date +%Y%m%d_%H%M%S).log"
API_ENDPOINT="https://places.googleapis.com/v1/places:searchText"

# Fixed delay between successful requests (overridden by 60s backoff on 429)
DEFAULT_DELAY=1
MAX_ATTEMPTS=3

# --- Setup Logging and Output ---

mkdir -p "$LOG_DIR"
echo "--- STARTING URL CACHING SCRIPT: $(date) ---" | tee -a "$LOG_FILE"
echo "Reading input from: $INPUT_CSV (Single Column, All Rows)" | tee -a "$LOG_FILE"
echo "Writing cache to: $OUTPUT_CSV" | tee -a "$LOG_FILE"

# --- 1. INITIALIZE CACHE FILE ---
# The header now includes the 'raw response of the api' column
echo "restaurant_key,restaurant google map url,address,raw response of the api" > "$OUTPUT_CSV"
echo "[INFO] Initialized $OUTPUT_CSV with header." >> "$LOG_FILE"

# --- 2. READ RESTAURANT NAMES AND MAKE API CALLS ---
# Read the single-column file line by line
cat "$INPUT_CSV" | while read -r NAME; do

    # Remove any surrounding quotes or leading/trailing whitespace
    CLEAN_NAME=$(echo "$NAME" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')

    if [ -z "$CLEAN_NAME" ]; then
        echo "[DEBUG] $(date +%H:%M:%S) Skipping empty name entry." >> "$LOG_FILE"
        continue
    fi

    REQUEST_ATTEMPTS=0

    # Start retry loop for the current restaurant
    while [ $REQUEST_ATTEMPTS -lt $MAX_ATTEMPTS ]; do

        echo "--- REQUEST: $(date +%H:%M:%S) (Attempt $(($REQUEST_ATTEMPTS + 1))) ---" | tee -a "$LOG_FILE"
        echo "Processing: $CLEAN_NAME" | tee -a "$LOG_FILE"

        REQUEST_BODY=$(jq -n --arg name "$CLEAN_NAME, Los Angeles" '{
            textQuery: $name,
            maxResultCount: 1
        }')
        echo "  [REQUEST BODY]: $REQUEST_BODY" | tee -a "$LOG_FILE"

        # --- DEBUG: PRINT CURL COMMAND BEFORE EXECUTION ---
        CURL_COMMAND="curl -s -X POST \"$API_ENDPOINT\" \
            -H 'Content-Type: application/json' \
            -H \"X-Goog-Api-Key: ${API_KEY}\" \
            -H 'X-Goog-FieldMask: places.googleMapsUri,places.formattedAddress' \
            -d \"$REQUEST_BODY\""
        echo "  [CURL DEBUG COMMAND]: $CURL_COMMAND" | tee -a "$LOG_FILE"
        # --- END DEBUG ---

        RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
            -H 'Content-Type: application/json' \
            -H "X-Goog-Api-Key: $API_KEY" \
            -H 'X-Goog-FieldMask: places.googleMapsUri,places.formattedAddress' \
            -d "$REQUEST_BODY")

        echo "  [RAW RESPONSE]: $RESPONSE" | tee -a "$LOG_FILE"

        # --- SMART BACKOFF: Check for Quota Exceeded error (Code 429) ---
        if echo "$RESPONSE" | grep -q '"code": 429'; then
            echo "[WARNING] QUOTA LIMIT REACHED (429)! Sleeping for 60 seconds to reset quota." | tee -a "$LOG_FILE"
            sleep 60
            REQUEST_ATTEMPTS=$(($REQUEST_ATTEMPTS + 1))
            continue # Try the request again
        fi

        # --- Data Extraction ---
        URL=$(echo "$RESPONSE" | jq -r '.places[0].googleMapsUri // ""')
        ADDRESS=$(echo "$RESPONSE" | jq -r '.places[0].formattedAddress // ""')

        # Create unique restaurant key (Name + last word of address/zip)
        if [ -n "$ADDRESS" ]; then
            KEY_IDENTIFIER=$(echo "$ADDRESS" | awk '{print $NF}' | tr -d ,)
            RESTAURANT_KEY="${CLEAN_NAME} ${KEY_IDENTIFIER}"
        else
            RESTAURANT_KEY="${CLEAN_NAME} - Not Found"
        fi

        # Success or non-429 failure logic
        if [ -n "$URL" ]; then
            echo "[SUCCESS] Found URL for key: $RESTAURANT_KEY" | tee -a "$LOG_FILE"

            # Use tr to remove newlines from the JSON response for safe CSV insertion
            CLEAN_RESPONSE=$(echo "$RESPONSE" | tr -d '\n\r')

            # 4-COLUMN OUTPUT: key, url, address, raw_response (Full JSON)
            echo "\"$RESTAURANT_KEY\",\"$URL\",\"$ADDRESS\",\"$CLEAN_RESPONSE\"" >> "$OUTPUT_CSV"
            break # Success, move to the next restaurant
        else
            echo "[FAILURE] URL Not Found. Response Status: $(echo "$RESPONSE" | jq -r '.error.status // "N/A"')" | tee -a "$LOG_FILE"
            # Still remove newlines before logging the full response
            CLEAN_RESPONSE=$(echo "$RESPONSE" | tr -d '\n\r')
            # Write failure entry to CSV
            echo "\"$RESTAURANT_KEY\",\"\",\"\",\"$CLEAN_RESPONSE\"" >> "$OUTPUT_CSV"
            break # Log the failure and move to the next restaurant (don't retry unless it's a 429)
        fi

        # Delay only if the inner loop finishes due to non-429 success/failure
        sleep $DEFAULT_DELAY

    done # End of REQUEST_ATTEMPTS while loop


done

# --- Final Output to Terminal and Log ---
echo "--- URL CACHING SCRIPT COMPLETE: $(date) ---" | tee -a "$LOG_FILE"

echo ""
echo "--------------------------------------------------------"
echo "SCRIPT FINISHED."
echo "Detailed logs are saved to: $LOG_FILE"
echo "Press [Enter] to close this terminal."
read -r
