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

const MAIN_CSV_PATH = 'main.csv';

const LA_CENTER = [34.0522, -118.2437]; 
const STARTING_ZOOM = 12; 
const HAPPY_HOUR_HEADER = "Name,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!,address,restaurant google map url,coordinates"; 


// --- 2. NEW DATA STRUCTURES ---

/**
 * Class to hold detailed happy hour data, mapping directly to main.csv columns.
 */
class HappyHourData {
    constructor(dataRow = {}) {
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
        this.happyHourData = new HappyHourData(); 
        this.placeId = null;
        this.mapUri = '';
        this.lat = null;
        this.lng = null;
        this.formattedAddress = '';
        this.neighborhood = ''; // Added property
        this.rawApiResponse = {};
        this.marker = null;
        this.listingItem = null;
        this.fullDetails = null;
    }
}


// --- 3. UI/MAP UTILITY FUNCTIONS ---

const EaterIcon = (index) => L.divIcon({
    className: 'eater-marker',
    html: '', 
    iconSize: [15, 15],
    iconAnchor: [7, 7] 
});

/**
 * Creates the HTML content for a Leaflet marker popup, now mirroring the sidebar design.
 */
function createPopupContent(place) {
    
    // --- Determine Current Day and Corresponding Key ---
    const today = new Date();
    const dayIndex = today.getDay(); 
    const dayKeys = [
        'details_sunday', 'details_monday', 'details_tuesday', 
        'details_wednesday', 'details_thursday', 'details_friday', 'details_saturday'
    ];
    
    const currentDayKey = dayKeys[dayIndex];
    const currentDayDetail = place.happyHourData[currentDayKey] || 'N/A';

    const dayTitle = currentDayKey
        .replace('details_', '')
        .replace(/^./, str => str.toUpperCase());
    // ---------------------------------------------------
    
    let content = `
        <div class="popup-content">
            <h4 class="popup-title">${place.name}</h4>
            <hr class="popup-divider">
    `;
    
    // 🍹 Today's Happy Hour (Mirrors sidebar tile-content)
    content += `
        <div class="popup-happy-hour-detail">
            <p style="margin: 0; line-height: 1.4;">
                <span class="popup-value">${currentDayDetail}</span>
            </p>
        </div>
    `;

    // Add map link if available
    if (place.mapUri) {
        const cleanUri = place.mapUri.replace('http://googleusercontent.com/maps.google.com/', '');
        content += `<a href="${cleanUri}" target="_blank">View on Google Maps</a>`;
    }
    
    content += `</div>`;
    return content;
}

/**
 * Creates the sidebar listing item for a restaurant and attaches map interaction handlers.
 */
function createListingItem(place, index) {
    
    if (!LIST_CONTAINER) return;

    // --- 1. Determine Current Day and Corresponding Key ---
    const today = new Date();
    const dayIndex = today.getDay(); 
    const dayKeys = [
        'details_sunday', 'details_monday', 'details_tuesday', 
        'details_wednesday', 'details_thursday', 'details_friday', 'details_saturday'
    ];
    
    const currentDayKey = dayKeys[dayIndex];
    const currentDayDetail = place.happyHourData[currentDayKey] || 'N/A';

    const dayTitle = currentDayKey
        .replace('details_', '')
        .replace(/^./, str => str.toUpperCase());
    // ---------------------------------------------------

    const item = document.createElement('div');
    item.className = 'listing-item';
    item.setAttribute('data-index', index);
    
    // START: FLATICON UICONS INTEGRATION
    item.innerHTML = `
        <div class="tile-header">
            <h5 class="restaurant-name">${place.name}</h5>
            <p class="listing-neighborhood">
                <span class="neighborhood-tag">
                    <span class="location-icon fi fi-rr-marker"></span> ${place.neighborhood || 'LA Area'} 
                </span> 
            </p>
        </div>
        
        <div class="tile-content">
            <p class="happy-hour-details">
                <span class="icon-flair fi fi-rr-cocktail"></span> 
                <span class="deal-day">Today's Deal:</span> 
                <strong class="deal-text">${currentDayDetail}</strong>
            </p>
        </div>
    `;
    // END: FLATICON UICONS INTEGRATION

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


/**
 * Extracts unique, non-empty, and sorted neighborhood names from all Place objects.
 * @param {Map<string, Place>} placeMap Map of all place objects.
 * @returns {Array<string>} A sorted array of unique neighborhood names.
 */
function getUniqueNeighborhoods(placeMap) {
    const neighborhoods = new Set();
    placeDataMap.forEach(place => {
        if (place.neighborhood && place.neighborhood.trim() !== '') {
            neighborhoods.add(place.neighborhood.trim());
        }
    });
    return Array.from(neighborhoods).sort();
}

/**
 * Calculates the geographic center (centroid) of a list of Leaflet markers.
 * @param {Array<L.Marker>} markers Array of Leaflet marker objects.
 * @returns {{lat: number, lng: number} | null} The average center point or null if no markers.
 */
function calculateCentroid(markers) {
    if (markers.length === 0) return null;

    let totalLat = 0;
    let totalLng = 0;
    
    markers.forEach(marker => {
        const latlng = marker.getLatLng();
        totalLat += latlng.lat;
        totalLng += latlng.lng;
    });

    return {
        lat: totalLat / markers.length,
        lng: totalLng / markers.length
    };
}


/**
 * Filters the map markers and sidebar listings based on the selected neighborhood.
 * NOW centers the map on the centroid of the visible markers.
 * @param {string} selectedNeighborhood The neighborhood to filter by (or "all").
 */
function filterPlaces(selectedNeighborhood) {
    let activeMarkers = [];
    
    placeDataMap.forEach(place => {
        const isMatch = (selectedNeighborhood === 'all' || place.neighborhood === selectedNeighborhood);

        if (place.marker) {
            if (isMatch) {
                // Show marker by adding it to the temporary array
                activeMarkers.push(place.marker);
            }
        }
        
        // Toggle sidebar visibility
        if (place.listingItem) {
            place.listingItem.style.display = isMatch ? '' : 'none';
        }
    });

    // Update markers layer on the map
    markersLayer.clearLayers();
    if (activeMarkers.length > 0) {
        markersLayer.addLayer(L.featureGroup(activeMarkers));

        // 1. Calculate the centroid of the active markers 
        const centroid = calculateCentroid(activeMarkers);
        
        if (centroid) {
            // Set zoom level slightly closer for a specific neighborhood
            const zoomLevel = selectedNeighborhood === 'all' ? STARTING_ZOOM : 13; 
            
            // 2. Center the map on the centroid
            map.setView([centroid.lat, centroid.lng], zoomLevel, { animate: true }); 
        }

    } else {
        // If no markers are active, reset to LA center
        map.setView(LA_CENTER, STARTING_ZOOM, { animate: true });
    }
}

/**
 * Creates and sets up the neighborhood filter dropdown.
 * @param {Array<string>} uniqueNeighborhoods Sorted list of neighborhoods.
 */
function setupNeighborhoodFilter(uniqueNeighborhoods) {
    const container = document.getElementById('neighborhood-filter-container');
    if (!container) {
        console.error("Missing DOM element: #neighborhood-filter-container. Cannot create filter dropdown.");
        return;
    }

    const select = document.createElement('select');
    select.id = 'neighborhood-filter';
    select.className = 'custom-filter-dropdown';
    
    // Add default "All" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Neighborhoods';
    select.appendChild(allOption);

    // Add neighborhood options
    uniqueNeighborhoods.forEach(neighborhood => {
        const option = document.createElement('option');
        option.value = neighborhood;
        option.textContent = neighborhood;
        select.appendChild(option);
    });

    // Add event listener for filtering
    select.addEventListener('change', (event) => {
        filterPlaces(event.target.value);
    });

    container.appendChild(select);
}

// --- 4. DATA LOADING FUNCTION ---

/**
 * Loads and parses the main.csv file.
 * @returns {Promise<Array<Object> | null>} Array of parsed CSV rows (objects) or null on failure.
 */
async function loadMainCsvData() {
    const pathsToTry = [
        { path: MAIN_CSV_PATH, header: true, name: "Main Data" }
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

        // A. Merge All Data: Use the constructor to map raw CSV data to the typed class
        place.happyHourData = new HappyHourData(dataRow); 
        
        // B. Load and PARSE Coordinates from the single 'coordinates' column
        let lat = null;
        let lng = null;

        const coordsString = dataRow.coordinates;
        if (coordsString) {
            const coordsArray = coordsString.split(',');
            if (coordsArray.length === 2) {
                lat = parseFloat(coordsArray[0].trim());
                lng = parseFloat(coordsArray[1].trim());
            }
        }
        
        // Set neighborhood and other core properties
        place.neighborhood = dataRow.neighborhood || ''; // Assuming a 'neighborhood' column exists
        
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

    // 2. Load All Data
    const allRestaurantDetails = await loadMainCsvData();
    
    if (!allRestaurantDetails || allRestaurantDetails.length === 0) {
        console.error("Fatal: Could not load data from CSV files.");
        return;
    }

    // 3. Process and Merge All Data (populates placeDataMap)
    await processAndMergeData(allRestaurantDetails);
    
    // 4. Setup Neighborhood Filter
    const uniqueNeighborhoods = getUniqueNeighborhoods(placeDataMap);
    setupNeighborhoodFilter(uniqueNeighborhoods);
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeMapAndData);