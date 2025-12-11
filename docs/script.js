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

// --- GLOBAL STATE VARIABLE ---
/**
 * @type {Place | null} Tracks the currently selected restaurant for single-pin view toggle.
 * It is now primarily used to track the last clicked place for highlight purposes.
 */
let activePlace = null; 
// ---------------------------------

// --- Configuration Variables ---

const MAIN_CSV_PATH = 'main.csv';

const LA_CENTER = [34.0522, -118.2437]; 
const STARTING_ZOOM = 12; 
const TARGET_ZOOM = 16; 
const HAPPY_HOUR_HEADER = "Name,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!,address,restaurant google map url,coordinates"; 


// --- 2. NEW DATA STRUCTURES ---

class HappyHourData {
    constructor(dataRow = {}) {
        this.details_monday = dataRow.details_monday || '';
        this.details_tuesday = dataRow.details_tuesday || '';
        this.details_wednesday = dataRow.details_wednesday || '';
        this.details_thursday = dataRow.details_thursday || '';
        this.details_friday = dataRow.details_friday || '';
        this.details_saturday = dataRow.details_saturday || '';
        this.details_sunday = dataRow.details_sunday || '';
        
        this.details_games = dataRow.details_games || '';
        this.details_haunted = dataRow.details_haunted || '';
    }
}


class Place {
    constructor(name) {
        this.name = name;
        this.happyHourData = new HappyHourData(); 
        this.placeId = null;
        this.mapUri = '';
        this.lat = null;
        this.lng = null;
        this.formattedAddress = '';
        this.neighborhood = '';
        this.rawApiResponse = {};
        this.marker = null;
        this.listingItem = null;
        this.fullDetails = null;
    }
}


// --- 3. UI/MAP UTILITY FUNCTIONS ---

/**
 * Creates a custom Leaflet DivIcon for the map marker.
 */
const HappyHouseMapIcon = (index) => L.divIcon({
    className: 'happy-house-map-marker',
    html: '', 
    iconSize: [12, 12], 
    iconAnchor: [6, 6] 
});

/**
 * **NEW RESET LOGIC:** Resets the map and sidebar back to the 'All Neighborhoods' default state.
 */
function resetToDefaultView() {
    // 1. Clear highlighting on all sidebar items
    document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));
    
    // 2. Clear the global state
    activePlace = null;

    // 3. Reset the filter dropdown to 'all'
    const filterDropdown = document.getElementById('neighborhood-filter');
    if (filterDropdown && filterDropdown.value !== 'all') {
        filterDropdown.value = 'all';
    }

    // 4. Re-run filterPlaces to display all markers and reset map view
    filterPlaces('all'); 
}


/**
 * Creates the HTML content for a Leaflet marker popup (unused).
 */
function createPopupContent(place) {
    // Function left empty as popups are removed.
}

/**
 * Creates the sidebar listing item and attaches the primary map interaction handler.
 */
function createListingItem(place, index) {
    
    if (!LIST_CONTAINER) return;

    // --- Determine Current Day and Corresponding Key ---
    const today = new Date();
    const dayIndex = today.getDay(); 
    const dayKeys = [
        'details_sunday', 'details_monday', 'details_tuesday', 
        'details_wednesday', 'details_thursday', 'details_friday', 'details_saturday'
    ];
    
    const currentDayKey = dayKeys[dayIndex];
    const currentDayDetail = place.happyHourData[currentDayKey] || 'N/A';
    // ---------------------------------------------------

    const item = document.createElement('div');
    item.className = 'listing-item';
    item.setAttribute('data-index', index);
    
    item.innerHTML = `
        <div class="tile-header">
            <h5 class="restaurant-name">${place.name}</h5>
            <p class="listing-neighborhood">
                <span class="neighborhood-tag">
                    <span class="happy-house-map-marker listing-icon"></span> ${place.neighborhood || 'LA Area'} 
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

    // --- UPDATED CLICK HANDLER LOGIC FOR APPLYING NEIGHBORHOOD FILTER ---
    item.addEventListener('click', () => {
        
        const filterDropdown = document.getElementById('neighborhood-filter');
        const currentFilter = filterDropdown ? filterDropdown.value : 'all';
        const clickedNeighborhood = place.neighborhood || 'all';

        // Check if the same neighborhood is being clicked OR if the same item is clicked twice
        if (activePlace === place || currentFilter === clickedNeighborhood) {
            // UNSET: Return to default (all) view
            resetToDefaultView();
            return; 
        }

        // SET / NAVIGATE: Apply the filter for the clicked item's neighborhood
        
        // 1. Set the active place just for immediate highlighting/tracking
        activePlace = place;
        
        // 2. Synchronize the filter dropdown to the selected neighborhood.
        if (filterDropdown) {
            filterDropdown.value = clickedNeighborhood;
        }

        // 3. Apply the filter (this clears old highlights and draws new pins)
        filterPlaces(clickedNeighborhood); 
        
        // 4. Highlight the active listing (find it after filterPlaces runs)
        document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));
        // Find the specific item being clicked, which is now visible, and highlight it.
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // NOTE: Map centering is now handled inside filterPlaces.
    });
    // --- END UPDATED CLICK HANDLER LOGIC ---

    place.listingItem = item;
    LIST_CONTAINER.appendChild(item);
}


/**
 * Extracts unique, non-empty, and sorted neighborhood names from all Place objects.
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
 */
function filterPlaces(selectedNeighborhood) {
    // activePlace is NOT reset here, as we want to preserve highlight state 
    // when filtering is initiated by the dropdown, but we ensure the old 
    // highlights are removed below.

    let activeMarkers = [];
    
    placeDataMap.forEach(place => {
        const isMatch = (selectedNeighborhood === 'all' || place.neighborhood === selectedNeighborhood);

        if (place.marker) {
            if (isMatch) {
                activeMarkers.push(place.marker);
            }
        }
        
        // Toggle sidebar visibility
        if (place.listingItem) {
            // Remove active class for all items when filtering
            place.listingItem.classList.remove('active'); 
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
        const selectedValue = event.target.value;
        
        if (selectedValue === 'all') {
            // Clicking 'All' in the dropdown should return to the default view
            resetToDefaultView(); 
        } else {
            // Otherwise, filter normally
            filterPlaces(selectedValue);
        }
    });

    container.appendChild(select);
}

// --- 4. DATA LOADING FUNCTION ---

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

async function processAndMergeData(allRestaurantDetails) {
    
    const markerPromises = allRestaurantDetails.map(async (dataRow, index) => {
        const name = dataRow.Name || dataRow.restaurant_key;
        if (!name) return null;
        
        const place = new Place(name); 
        placeDataMap.set(name, place);

        // A. Merge All Data
        place.happyHourData = new HappyHourData(dataRow); 
        
        // B. Load and PARSE Coordinates
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
        place.neighborhood = dataRow.neighborhood || ''; 
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
             console.warn(`[MISSING COORDS] No valid coordinates for ${name}. Using LA Center.`);
        }
        
        // E. Create Marker and Listing
        const marker = L.marker([finalLat, finalLng], {
            icon: HappyHouseMapIcon(index), 
            title: name
        });

        place.marker = marker;
        createListingItem(place, index);

        // --- MARKER CLICK HANDLER ---
        // Marker click programmatically triggers the sidebar click event
        marker.on('click', () => {
            const correspondingItem = document.querySelector(`.listing-item[data-index="${index}"]`);
            if (correspondingItem) {
                correspondingItem.click(); 
            }
        });
        
        allMarkers.push(marker);
        return marker;
    });

    // Wait for all markers to be created
    await Promise.all(markerPromises.filter(p => p !== null));
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

    // 3. Process and Merge All Data (populates placeDataMap and allMarkers)
    await processAndMergeData(allRestaurantDetails);
    
    // 4. Setup Neighborhood Filter
    const uniqueNeighborhoods = getUniqueNeighborhoods(placeDataMap);
    setupNeighborhoodFilter(uniqueNeighborhoods);

    // 5. Initial Map State: Ensure all markers are displayed and the map is centered based on the current filter ('all').
    filterPlaces('all'); 
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeMapAndData); 