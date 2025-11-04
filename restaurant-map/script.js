// script.js

// --- 1. CORE MAP AND DATA INITIALIZATION ---

let map;
let allMarkers = [];
let markersLayer = L.layerGroup();
const LIST_CONTAINER = document.getElementById('restaurant-list');

/**
 * @type {Map<string, Place>} Stores restaurantName -> Place object
 */
let placeDataMap = new Map();

// ** API Cache: Stores restaurantName -> { lat, lng, mapUri, rawResponse } **
// This structure holds data loaded from the initial cache CSV and will be updated with fresh API results.
let apiCache = {}; 

// --- Configuration Variables ---
// 🛑 CRITICAL: REPLACE 'AIzaSyDRk6GSn3W_AgpoEN-blxb2PGctvE9UvPY' WITH YOUR ACTUAL KEY!
const API_KEY = 'AIzaSyDRk6GSn3W_AgpoEN-blxb2PGctvE9UvPY'; 
const GEOCODING_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const RESTAURANT_LIST_PATH = 'data/restaurants.csv';        
const HAPPY_HOUR_CSV_PATH = 'data/restaurants.csv';         
// RENAMED for clarity: Use this path for the full coordinate data CSV
const COORDINATES_CSV_PATH = 'data/restaurant_coordinates.csv'; 
const LA_CENTER = [34.0522, -118.2437]; 
const STARTING_ZOOM = 14; 
const HAPPY_HOUR_HEADER = "Name,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!";

// --- NEW DATA STRUCTURE: The Place Class (UNCHANGED) ---

/**
 * Comprehensive class to hold all merged data for a single restaurant.
 */
class Place {
    constructor(name) {
        this.name = name;
        // Data from Happy Hour CSV
        this.happyHourData = {}; 
        // Data from Google API Cache
        this.placeId = null;
        this.mapUri = '';
        this.lat = null;
        this.lng = null;
        this.formattedAddress = '';
        this.rawApiResponse = {};
        // DOM Elements
        this.marker = null;
        this.listingItem = null;
        // Full Place Details (optional detailed fetch)
        this.fullDetails = null;
    }
}


// --- 2. GOOGLE API & DATA CACHE FUNCTIONS ---

/**
 * 🆕 API FUNCTION: Calls the Google Geocoding API to convert an address string to lat/lng coordinates.
 * @param {string} address The address string to geocode.
 * @returns {Promise<{lat: number, lng: number} | null>} The coordinates or null on failure.
 */
async function geocodeAddress(address) {
    if (!address || !API_KEY || API_KEY === 'YOUR_GOOGLE_API_KEY_HERE') {
        console.error("Geocoding failed: Missing address or API Key is set to the default placeholder.");
        return null;
    }
    const url = `${GEOCODING_BASE_URL}?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return { lat: location.lat, lng: location.lng };
        } else if (data.status === 'ZERO_RESULTS') {
            console.warn(`Geocoding failed for address: "${address}". No results found.`);
            return null;
        } else {
            console.error(`Geocoding API error: ${data.status} for address: "${address}"`);
            return null;
        }
    } catch (error) {
        console.error(`Geocoding fetch error for "${address}":`, error);
        return null;
    }
}


/**
 * Reads the 'google_map_url.csv' file and extracts all cached API data.
 * NOTE: This function is now ONLY used if the new COORDINATES_CSV_PATH file is missing.
 * @returns {Object} Map of restaurantName -> cached API data
 */
async function loadApiDataCache() {
    console.log(`Loading legacy API cache from ${RESTAURANT_LIST_PATH}...`); // Using original path for old cache
    let cacheMap = {};
    const INVALID_URL_PREFIX = 'http://googleusercontent.com/maps.google.com/';

    try {
        const response = await fetch(RESTAURANT_LIST_PATH); // Using the most likely source for old data
        if (!response.ok) {
            console.warn(`Legacy cache file not found at ${RESTAURANT_LIST_PATH}. Starting with empty cache.`);
            return cacheMap;
        }
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                results.data.forEach(row => {
                    const nameKey = row.Name || ''; // Assuming 'Name' is the key in the legacy CSV
                    if (!nameKey) return;
                    
                    let lat = null;
                    let lng = null;
                    let rawResponse = {};

                    // Attempt to extract existing address from the legacy CSV
                    const formattedAddress = row.Address || ''; 

                    // 1. Trim the URL string to remove whitespace
                    let cleanMapUri = (row['restaurant google map url'] || '').trim(); // Assuming this column name
                    let finalMapUri = cleanMapUri;
                    if (finalMapUri.startsWith(INVALID_URL_PREFIX)) {
                        finalMapUri = ''; 
                    }

                    cacheMap[nameKey] = {
                        mapUri: finalMapUri,
                        formattedAddress: formattedAddress,
                        lat: lat,
                        lng: lng,
                        rawApiResponse: rawResponse // Placeholder
                    };
                });
            }
        });

    } catch (error) {
        console.error(`Error loading legacy API cache:`, error);
    }
    console.log(`Legacy cache loaded with ${Object.keys(cacheMap).length} entries.`);
    return cacheMap;
};


// --- 3. UI/MAP UTILITY FUNCTIONS (UNCHANGED) ---

const EaterIcon = (index) => L.divIcon({
    className: 'eater-marker',
    html: `<span class="marker-number">${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15] 
});

// (PlaceDetails class, renderOpeningHoursHtml, getInitialDetailsHtml, createPopupContent, createListingItem remain here, but are omitted for brevity in this response block)


// --- 4. NEW CSV UTILITY FUNCTIONS ---

/**
 * Escapes values for CSV output (handles commas, quotes, etc.).
 */
function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    let str = String(value).trim();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Converts the array of processed place data into a CSV string.
 */
function convertToCsv(placeData) {
    const headers = [
        "restaurant_key",
        "restaurant google map url",
        "address",
        "latitude",
        "longitude"
    ];
    let csv = headers.map(escapeCsvValue).join(',') + '\n';
    placeData.forEach(data => {
        const row = [
            data.restaurant_key,
            data.mapUri,
            data.formattedAddress,
            data.lat,
            data.lng
        ].map(escapeCsvValue).join(',');
        csv += row + '\n';
    });
    return csv;
}

/**
 * Creates a download link for the generated CSV data (for the user to save).
 */
function createDownloadLink(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadDiv = document.createElement('div');
    downloadDiv.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; background: white; padding: 15px; border: 2px solid red; box-shadow: 0 4px 8px rgba(0,0,0,0.1);';
    downloadDiv.innerHTML = `
        <p style="color: red; font-weight: bold; margin-top: 0; margin-bottom: 5px;">
            ⚠️ COORDINATE CSV FILE CREATED!
        </p>
        <a href="${url}" download="${filename}" class="download-button"
           style="background-color: #d9534f; color: white; padding: 8px 12px; text-align: center; 
                  text-decoration: none; display: inline-block; border-radius: 4px; font-weight: bold;">
            ⬇️ DOWNLOAD ${filename}
        </a>
        <p style="font-size: 11px; color: #555; margin-top: 5px; margin-bottom: 0;">(Save this file to prevent future API charges.)</p>
    `;

    document.body.prepend(downloadDiv);
    console.log(`\n🎉 CSV generated! Please use the download link provided on the page to save ${filename} locally.`);
}


// --- 5. HYBRID DATA LOADING LOGIC ---

/**
 * Core Geocoding Logic: Performs API calls and returns structured data and CSV string.
 */
async function generateCoordinates(restaurantNames, happyHourMap, apiCache) {
    const results = [];

    for (const [index, name] of restaurantNames.entries()) {
        const place = {}; 
        
        // A. Merge existing cache data
        if (apiCache[name]) {
            const cachedData = apiCache[name];
            place.mapUri = cachedData.mapUri;
            place.formattedAddress = cachedData.formattedAddress;
            place.lat = cachedData.lat;
            place.lng = cachedData.lng;
        } else {
            place.mapUri = '';
            // Use the Address from Happy Hour CSV as fallback for geocoding
            place.formattedAddress = happyHourMap.get(name)?.Address || ''; 
            place.lat = null;
            place.lng = null;
        }

        // B. Geocode if coordinates are missing
        let lat = place.lat;
        let lng = place.lng;
        const addressToGeocode = place.formattedAddress;

        if ((!lat || !lng) && addressToGeocode) {
            console.log(`[GEOCODING ${index + 1}/${restaurantNames.length}] API request for ${name}`);
            const coords = await geocodeAddress(addressToGeocode);

            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
            } else {
                console.warn(`[GEOCODING FAILED] for ${name}.`);
            }
        }
        
        // C. Aggregate Data for CSV
        results.push({
            restaurant_key: name,
            mapUri: place.mapUri || '',
            formattedAddress: place.formattedAddress || '',
            lat: lat || '',
            lng: lng || ''
        });
        
        // Throttle API requests
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    
    const finalCsv = convertToCsv(results);
    return { results, finalCsv };
}


/**
 * Attempts to load coordinates CSV, and falls back to Geocoding API if necessary.
 */
async function loadOrGenerateCoordinates(happyHourDetails) {
    // 1. Attempt to load the pre-saved CSV
    try {
        const coordMap = await new Promise((resolve, reject) => {
            Papa.parse(COORDINATES_CSV_PATH, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    const map = new Map();
                    results.data.forEach(row => {
                        const name = row.restaurant_key;
                        if (name) {
                            map.set(name, {
                                mapUri: row['restaurant google map url'] || null,
                                formattedAddress: row.address || null,
                                lat: parseFloat(row.latitude) || null,
                                lng: parseFloat(row.longitude) || null,
                            });
                        }
                    });
                    console.log(`✅ Loaded coordinates from ${COORDINATES_CSV_PATH}. No API calls made.`);
                    resolve(map);
                },
                error: function(error) {
                    // Rejecting here triggers the 'catch' block (API Geocoding)
                    reject(error);
                }
            });
        });
        return coordMap;

    } catch (error) {
        // 2. CSV Load failed: Execute the ONE-TIME Geocoding process
        console.warn(`Could not load ${COORDINATES_CSV_PATH}. Falling back to Geocoding API (Charges apply).`, error);
        
        // Load legacy API Cache for existing data before geocoding
        const apiCache = await loadApiDataCache();
        
        const happyHourMap = happyHourDetails.reduce((map, row) => {
            if (row.Name) map.set(row.Name, row);
            return map;
        }, new Map());
        
        // Get master list for geocoding
        const allUniqueNames = new Set(Object.keys(apiCache));
        happyHourDetails.forEach(row => allUniqueNames.add(row.Name));
        const masterRestaurantNames = Array.from(allUniqueNames);
        
        
        const { results, finalCsv } = await generateCoordinates(masterRestaurantNames, happyHourMap, apiCache);
        
        // Provide download link for the newly created data
        createDownloadLink(finalCsv, COORDINATES_CSV_PATH);

        // Convert results array to a Map for consistent return structure
        const generatedCoordMap = new Map();
        results.forEach(data => {
             generatedCoordMap.set(data.restaurant_key, {
                mapUri: data.mapUri,
                formattedAddress: data.formattedAddress,
                lat: data.lat,
                lng: data.lng,
            });
        });
        return generatedCoordMap;
    }
}


/**
 * Processes the list of names, merges data from CSVs, and creates markers/listings.
 * 🚫 NO LIVE API CALLS HERE. Uses the coordinatesData Map provided by loadOrGenerateCoordinates.
 */
async function processAndMergeData(restaurantNames, happyHourDetails, coordinatesData) {
    const happyHourMap = happyHourDetails.reduce((map, row) => {
        if (row.Name) map.set(row.Name, row);
        return map;
    }, new Map());

    const markerPromises = restaurantNames.map(async (name, index) => {
        const place = new Place(name); 
        placeDataMap.set(name, place);

        // A. Merge Happy Hour Details
        place.happyHourData = happyHourMap.get(name) || {};

        // B. Load Data from Coordinates CSV (The main source of truth)
        const cachedData = coordinatesData.get(name);
        if (cachedData) {
            place.mapUri = cachedData.mapUri;
            place.formattedAddress = cachedData.formattedAddress;
            place.lat = cachedData.lat;
            place.lng = cachedData.lng;
        }
       
        // C. Determine Final Coordinates
        let lat = place.lat;
        let lng = place.lng;

        if (!lat || !lng) {
             lat = LA_CENTER[0];
             lng = LA_CENTER[1];
             console.warn(`[MISSING DATA] No valid coordinates for ${name}. Using LA Center.`);
        }
       
        // D. Create Marker and Listing
        const marker = L.marker([lat, lng], {
            icon: EaterIcon(index), 
            title: name
        }).bindPopup(createPopupContent(place));

        place.marker = marker;
        createListingItem(place, index); 

        marker.on('click', () => {
            document.querySelectorAll('.listing-item').forEach(item => item.classList.remove('active'));
            const correspondingItem = document.querySelector(`.listing-item[data-index="${index}"]`);
            if (correspondingItem) {
                correspondingItem.classList.add('active');
                correspondingItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        allMarkers.push(marker);
        return marker;
    });

    // Wait for all markers to be created before adding them to the map
    Promise.all(markerPromises.filter(p => p !== null)).then(markers => {
        const validMarkers = markers.filter(m => m !== null);
        if (validMarkers.length > 0) {
            markersLayer.addLayer(L.featureGroup(validMarkers));
        }
    });
}


// --- 6. MAIN EXECUTION FUNCTION (UPDATED) ---

async function initializeMapAndData() {
    // 1. Initialize Map
    map = L.map('map', { minZoom: 10 }).setView(LA_CENTER, STARTING_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    markersLayer.addTo(map);

    // 2. Load Happy Hour Details (Still needed for name list and address fallback)
    let happyHourData = [];
    try {
        const response = await fetch(HAPPY_HOUR_CSV_PATH);
        if (!response.ok) {
            console.error(`Error loading Happy Hour CSV: ${response.statusText}`);
            return;
        }
        const csvText = await response.text();
        const lines = csvText.split('\n');
        const dataLines = lines.slice(4).filter(line => line.trim() !== '');
        const csvToParse = [HAPPY_HOUR_HEADER, ...dataLines].join('\n');

        Papa.parse(csvToParse, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                happyHourData = results.data.filter(row => row.Name);
            }
        });
    } catch (error) {
        console.error(`Error loading Happy Hour CSV:`, error);
        return;
    }

    // 3. Attempt to Load or Generate Coordinates Data (The NEW HYBRID STEP)
    const coordinatesData = await loadOrGenerateCoordinates(happyHourData);
    
    if (!coordinatesData) {
        console.error("Fatal: Could not load or generate coordinate data.");
        return;
    }

    // 4. Create Master List of Restaurant Names (based on combined data)
    const allUniqueNames = new Set();
    happyHourData.forEach(row => allUniqueNames.add(row.Name));
    coordinatesData.forEach((_, name) => allUniqueNames.add(name));
    const masterRestaurantNames = Array.from(allUniqueNames);


    // 5. Process and Merge All Data
    await processAndMergeData(masterRestaurantNames, happyHourData, coordinatesData);
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeMapAndData);