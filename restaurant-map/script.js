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

// --- Configuration Variables ---
// ❌ API key and Geocoding URL removed. Relying entirely on local CSV data.

const RESTAURANTS_CSV_PATH = 'data/restaurants.csv'; 
const MAIN_CSV_PATH = 'data/main.csv'; 

const LA_CENTER = [34.0522, -118.2437]; 
const STARTING_ZOOM = 14; 
// Header is kept for reference only
const HAPPY_HOUR_HEADER = "Name,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!,address,restaurant google map url,coordinates"; 


// --- 2. NEW DATA STRUCTURES ---

/**
 * Class to hold detailed happy hour data, mapping directly to main.csv columns.
 */
class HappyHourData {
    constructor(dataRow = {}) {
        // Map CSV column names to properties, using an empty string as a safe fallback
        this.details_monday = dataRow.details_monday || '';
        this.details_tuesday = dataRow.details_tuesday || '';
        this.details_wednesday = dataRow.details_wednesday || '';
        this.details_thursday = dataRow.details_thursday || '';
        this.details_friday = dataRow.details_friday || '';
        this.details_saturday = dataRow.details_saturday || '';
        this.details_sunday = dataRow.details_sunday || '';
        
        // Games and Haunted fields
        this.details_games = dataRow.details_games || '';
        this.details_haunted = dataRow.details_haunted || '';
    }
}


/**
 * Comprehensive class to hold all merged data for a single restaurant.
 */
class Place {
    constructor(name) {
        this.name = name;
        // 🆕 Now initializes a separate class instance
        this.happyHourData = new HappyHourData(); 
        this.placeId = null;
        this.mapUri = '';
        this.lat = null;
        this.lng = null;
        this.formattedAddress = '';
        this.rawApiResponse = {};
        this.marker = null;
        this.listingItem = null;
        this.fullDetails = null;
    }
}


// --- 3. UI/MAP UTILITY FUNCTIONS ---

const EaterIcon = (index) => L.divIcon({
    // UPDATED: Removed the number for a simple map dot
    className: 'eater-marker',
    html: '', 
    iconSize: [15, 15],
    iconAnchor: [7, 7]  
});

/**
 * Creates the HTML content for a Leaflet marker popup.
 * @param {Place} place The Place object containing restaurant data.
 * @returns {string} HTML string for the popup.
 */
function createPopupContent(place) {
    let content = `
        <div class="popup-content">
            <h4 style="margin-top:0;">${place.name}</h4>
            <p>${place.formattedAddress || 'Address not available'}</p>
    `;

    // Add map link if available
    if (place.mapUri) {
        // Clean up legacy URL prefixes if present
        const cleanUri = place.mapUri.replace('http://googleusercontent.com/maps.google.com/', '');
        content += `<p><a href="${cleanUri}" target="_blank">View on Google Maps</a></p>`;
    }

    // Display a sample of happy hour data using the new structure
    const mondayData = place.happyHourData.details_monday || 'N/A';
    content += `<p><strong>Monday Happy Hour:</strong> ${mondayData}</p>`;
    
    content += `</div>`;
    return content;
}


// --- 3. UI/MAP UTILITY FUNCTIONS (UPDATED createListingItem) ---

/**
 * Creates the sidebar listing item for a restaurant and attaches map interaction handlers.
 */
function createListingItem(place, index) {
    // Console logs for debugging the new structure (kept for your reference)
    console.log(`Creating listing item for: ${place.name}`);
    console.log("Happy Hour Data Object:", place.happyHourData);
    
    if (!LIST_CONTAINER) return;

    const item = document.createElement('div');
    item.className = 'listing-item';
    item.setAttribute('data-index', index);

    // --- Dynamic Content Generation ---
    let detailsHtml = '';
    
    // Loop through every key in the HappyHourData object
    for (const key in place.happyHourData) {
        if (place.happyHourData.hasOwnProperty(key)) {
            const detailValue = place.happyHourData[key] || 'N/A';
            
            // Convert key (e.g., 'details_monday') to readable title (e.g., 'Details Monday')
            // This capitalizes the first letter and replaces underscores with spaces
            let title = key.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());

            // Optionally, skip keys if the value is empty or not useful
            if (!detailValue || detailValue === '') continue;

            detailsHtml += `<p class="happy-hour-detail">${title}: <strong>${detailValue}</strong></p>`;
        }
    }
    // ---------------------------------
    
    item.innerHTML = `
        <div class="listing-details">
            <h5 class="restaurant-name">${place.name}</h5>
            <p class="listing-address">${place.formattedAddress || 'No address data'}</p>
            ${detailsHtml}
        </div>
    `;
    
    // Add click handler to zoom to the marker
    item.addEventListener('click', () => {
        // Center the map on the marker location
        if (place.lat && place.lng) {
            map.setView([place.lat, place.lng], map.getZoom() > 16 ? map.getZoom() : 16, { animate: true });
        }
        
        // Open the marker popup
        if (place.marker) {
            place.marker.openPopup();
        }

        // Highlight the active listing
        document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));
        item.classList.add('active');
    });

    place.listingItem = item;
    LIST_CONTAINER.appendChild(item);
}


// --- 4. DATA LOADING FUNCTION ---

/**
 * Loads and parses the main.csv file, with a fallback to restaurants.csv.
 * @returns {Promise<Array<Object> | null>} Array of parsed CSV rows (objects) or null on failure.
 */
async function loadMainCsvData() {
    const pathsToTry = [
        { path: MAIN_CSV_PATH, header: true, name: "Main Data" },
        { path: RESTAURANTS_CSV_PATH, header: true, name: "Legacy Data" },
    ];

    for (const { path, header, name } of pathsToTry) {
        console.log(`Attempting to load data from: ${path} (${name})`);
        
        try {
            const response = await fetch(path);
            if (!response.ok) {
                console.warn(`Fetch failed for ${path}: HTTP status ${response.status}. Trying next path.`);
                continue; 
            }
            const csvText = await response.text();
            
            const data = await new Promise((resolve) => {
                Papa.parse(csvText, {
                    header: header,
                    skipEmptyLines: true,
                    complete: function(results) {
                        const parsedData = results.data.filter(row => row.Name || row.restaurant_key); 
                        if (parsedData.length > 0) {
                            console.log(`✅ Loaded ${parsedData.length} records successfully from ${path}.`);
                            resolve(parsedData);
                        } else {
                            console.warn(`File ${path} loaded but contained no valid data (0 rows with a 'Name' or 'restaurant_key').`);
                            resolve(null);
                        }
                    },
                    error: function(error) {
                        console.error(`PapaParse error for ${path}:`, error);
                        resolve(null);
                    }
                });
            });

            if (data) {
                return data;
            }

        } catch (error) {
            console.warn(`Error during fetch or parse of ${path}. Trying next path.`, error);
        }
    }

    console.error("❌ Fatal: All attempts to load data from CSV paths failed.");
    return null; 
}


// --- 5. DATA MERGING AND MAP PROCESSING ---

/**
 * Processes the list of names, merges data from the single CSV, and creates markers/listings.
 * @param {Array<Object>} allRestaurantDetails The array of parsed rows from the CSV.
 */
async function processAndMergeData(allRestaurantDetails) {
    
    const markerPromises = allRestaurantDetails.map(async (dataRow, index) => {
        const name = dataRow.Name || dataRow.restaurant_key;
        if (!name) return null;
        
        const place = new Place(name); 
        placeDataMap.set(name, place);

        // A. Merge All Data (UPDATED to use the new class)
        // Pass the raw dataRow to the HappyHourData constructor for explicit mapping
        place.happyHourData = new HappyHourData(dataRow); 
        
        // B. Load and PARSE Coordinates from the single 'coordinates' column (FIXED)
        let lat = null;
        let lng = null;

        const coordsString = dataRow.coordinates;
        if (coordsString) {
            const coordsArray = coordsString.split(',');
            if (coordsArray.length === 2) {
                // Parse the first element (index 0) as latitude, second (index 1) as longitude
                lat = parseFloat(coordsArray[0].trim());
                lng = parseFloat(coordsArray[1].trim());
            }
        }
        
        // C. Apply parsed coordinates to the Place object
        place.lat = lat;
        place.lng = lng;
        place.formattedAddress = dataRow.address || '';
        place.mapUri = dataRow['restaurant google map url'] || '';


        // D. Determine Final Coordinates for Marker
        let finalLat = place.lat;
        let finalLng = place.lng;

        if (!finalLat || !finalLng) {
             finalLat = LA_CENTER[0];
             finalLng = LA_CENTER[1];
             console.warn(`[MISSING COORDS] No valid coordinates for ${name}. Using LA Center. Ensure 'coordinates' column has valid 'lat,lng' data.`);
        }
        
        // E. Create Marker and Listing
        const marker = L.marker([finalLat, finalLng], {
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


// --- 6. MAIN EXECUTION FUNCTION ---

async function initializeMapAndData() {
    // 1. Initialize Map
    map = L.map('map', { minZoom: 10 }).setView(LA_CENTER, STARTING_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    markersLayer.addTo(map);

    // 2. Load All Data from main.csv (or fallback)
    const allRestaurantDetails = await loadMainCsvData();
    
    if (!allRestaurantDetails || allRestaurantDetails.length === 0) {
        console.error("Fatal: Could not load data from CSV files.");
        return;
    }

    // 3. Process and Merge All Data
    await processAndMergeData(allRestaurantDetails);
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeMapAndData);