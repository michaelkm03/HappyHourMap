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
 */
let activePlace = null; 
// ---------------------------------

// --- Configuration Variables ---

const MAIN_CSV_PATH = 'main.csv';

const LA_CENTER = [34.0522, -118.2437]; 
const STARTING_ZOOM = 12; 
const TARGET_ZOOM = 16; 
const HAPPY_HOUR_HEADER = "Name,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!,address,restaurant google map url,coordinates"; 

// --- SIZE DEFINITIONS ---
// Standard Marker Size (Matches default .happy-house-map-marker CSS 20px)
const STANDARD_ICON_SIZE = [12, 12]; 
const STANDARD_ICON_ANCHOR = [10, 10]; 

// Highlighted Marker Size (Used to tell Leaflet how big the icon is for centering)
const HIGHLIGHTED_ICON_SIZE = [36, 36]; 
const HIGHLIGHTED_ICON_ANCHOR = [18, 18]; 
// -----------------------------


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
 * Creates a custom Leaflet DivIcon for the map marker using the STANDARD size.
 */
const HappyHouseMapIcon = (index) => L.divIcon({
    className: 'happy-house-map-marker',
    // Initial pins are empty; we dynamically insert the star on highlight.
    html: '', 
    iconSize: STANDARD_ICON_SIZE, 
    iconAnchor: STANDARD_ICON_ANCHOR
});

/**
 * Clears the 'highlighted-marker' class, star content, and resets the icon size/anchor.
 */
function clearMarkerHighlight() {
    if (activePlace && activePlace.marker && activePlace.marker._icon) {
        const iconElement = activePlace.marker._icon;
        
        // 1. Reset Leaflet's internal icon size and anchor properties
        activePlace.marker.options.icon.options.iconSize = STANDARD_ICON_SIZE;
        activePlace.marker.options.icon.options.iconAnchor = STANDARD_ICON_ANCHOR;

        // 2. Remove highlight CSS class and star content
        iconElement.classList.remove('highlighted-marker');
        iconElement.innerHTML = '';
        
        // 3. Force Leaflet to update the marker's DOM element size/position
        activePlace.marker.setIcon(activePlace.marker.options.icon);
    }
}

/**
 * Resets the map and sidebar back to the 'All Neighborhoods' default state.
 */
function resetToDefaultView() {
    // 1. Clear highlight on the currently active marker
    clearMarkerHighlight();
    
    // 2. Clear highlighting on all sidebar items
    document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));
    
    // 3. Clear the global state
    activePlace = null;

    // 4. Reset the filter dropdown to 'all'
    const filterDropdown = document.getElementById('neighborhood-filter');
    if (filterDropdown && filterDropdown.value !== 'all') {
        filterDropdown.value = 'all';
    }

    // 5. Re-run filterPlaces to display all markers and reset map view
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

    // --- UPDATED: Conditionally render the map link with aligned styling ---
    const googleMapLinkHtml = place.mapUri ? `
        <p class="google-map-link-container">
            <a href="${place.mapUri}" target="_blank" rel="noopener noreferrer" class="styled-map-link">
                <span class="icon-flair fi fi-rr-link"></span> 
                <strong>Google Maps Link</strong>
            </a>
        </p>
    ` : '';
    // ---------------------------------------------


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
                <strong>${currentDayDetail}</strong>
            </p>
            ${googleMapLinkHtml}
        </div>
    `;

    // --- UPDATED CLICK HANDLER LOGIC FOR APPLYING HIGHLIGHTING AND CENTERING ---
    item.addEventListener('click', (event) => {
        
        // Prevent map centering if the link itself is clicked
        if (event.target.closest('.styled-map-link')) {
            return; 
        }

        const filterDropdown = document.getElementById('neighborhood-filter');
        const currentFilter = filterDropdown ? filterDropdown.value : 'all';
        const clickedNeighborhood = place.neighborhood || 'all';

        // 1. Handle clicking the currently active place
        if (activePlace === place) {
            return; 
        }

        // 2. CLEAR PREVIOUS STATE
        clearMarkerHighlight();
        document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));


        // 3. SET NEW ACTIVE STATE
        activePlace = place;

        // 4. APPLY HIGHLIGHTS and UPDATE SIZE
        if (place.marker && place.marker._icon) {
            const iconElement = place.marker._icon;

            // Update Leaflet's internal icon size and anchor properties for the highlighted pin
            place.marker.options.icon.options.iconSize = HIGHLIGHTED_ICON_SIZE;
            place.marker.options.icon.options.iconAnchor = HIGHLIGHTED_ICON_ANCHOR;

            // Force Leaflet to update the marker's DOM element size/position
            place.marker.setIcon(place.marker.options.icon);
            
            // Add highlight CSS class and STAR ICON CONTENT (CSS handles visual transformation)
            iconElement.classList.add('highlighted-marker');
        }

        // Highlight the new active sidebar item
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });


        // 5. HANDLE FILTER/MAP CHANGE OR RE-CENTER (New Logic)
        if (currentFilter !== clickedNeighborhood) {
            // Case A: Filter changed. We need to filter and recenter based on the new filter set.
            if (filterDropdown) {
                filterDropdown.value = clickedNeighborhood;
            }
            filterPlaces(clickedNeighborhood); 
        } else {
            // Case B: Filter did NOT change. We are only selecting a new item within the current filtered set.
            // We must re-center the map on the centroid of the *current visible markers*.
            
            // Get all currently visible markers (markers that match the current filter)
            const currentMarkers = Array.from(placeDataMap.values())
                .filter(p => p.neighborhood === currentFilter || currentFilter === 'all')
                .map(p => p.marker)
                .filter(m => m !== null);
            
            if (currentMarkers.length > 0) {
                const centroid = calculateCentroid(currentMarkers);
                const zoomLevel = currentFilter === 'all' ? STARTING_ZOOM : 13;
                
                if (centroid) {
                    map.setView([centroid.lat, centroid.lng], zoomLevel, { animate: true });
                }
            }
        }
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
 * This function handles the *initial* map centering after a filter change.
 */
function filterPlaces(selectedNeighborhood) {
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
            // Remove active class for all items when filtering (except the active one)
            if (place !== activePlace) {
                place.listingItem.classList.remove('active'); 
            }
            place.listingItem.style.display = isMatch ? '' : 'none';
        }
    });

    // Update markers layer on the map
    markersLayer.clearLayers();
    if (activeMarkers.length > 0) {
        // Add only the filtered markers back to the map layer
        markersLayer.addLayer(L.featureGroup(activeMarkers));

        // Re-apply highlight if the active place is still visible after filtering
        if (activePlace && activePlace.marker && activePlace.marker._icon && activeMarkers.includes(activePlace.marker)) {
            
            const iconElement = activePlace.marker._icon;

            // Re-apply the HIGHLIGHTED size/anchor
            activePlace.marker.options.icon.options.iconSize = HIGHLIGHTED_ICON_SIZE;
            activePlace.marker.options.icon.options.iconAnchor = HIGHLIGHTED_ICON_ANCHOR;
            activePlace.marker.setIcon(activePlace.marker.options.icon);
            
            // Re-apply the CSS class and star content
            iconElement.classList.add('highlighted-marker');
        }

        // 1. Calculate the centroid of the active markers (Used for filter change)
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
        
        // CLEAR HIGHLIGHT, STAR CONTENT, AND ACTIVE STATE when filter dropdown changes
        clearMarkerHighlight();
        activePlace = null; 
        document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));

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

    // Add map click handler for resetting the highlight
    map.on('click', (e) => {
        // Only reset if the click target is the map pane itself (not a marker or popup)
        if (e.originalEvent.target.classList.contains('leaflet-pane') || e.originalEvent.target.id === 'map' || e.originalEvent.target.classList.contains('leaflet-marker-pane')) {
            resetToDefaultView();
        }
    });


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