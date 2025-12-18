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
const STANDARD_ICON_SIZE = [12, 12]; 
const STANDARD_ICON_ANCHOR = [10, 10]; 

const HIGHLIGHTED_ICON_SIZE = [36, 36]; 
const HIGHLIGHTED_ICON_ANCHOR = [18, 18]; 

// --- 2. DATA STRUCTURES ---

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
 * Mobile Detection: Checks if the user is on a mobile browser.
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Renders a basic 404/Not Supported page for mobile users.
 */
function showMobileBlocker() {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; background: #0f172a; color: #f8fafc; font-family: -apple-system, system-ui, sans-serif; padding: 20px;">
            <div style="width: 60px; height: 2px; background: #38bdf8; margin-bottom: 20px;"></div>
            <h1 style="font-size: 22px; letter-spacing: -0.5px; font-weight: 600;">DESKTOP ONLY</h1>
            <p style="font-size: 14px; color: #94a3b8; margin-top: 8px; font-weight: 300; max-width: 220px; line-height: 1.5;">
                Map navigation is not yet supported on mobile devices. 
            </p>
            <div style="margin-top: 40px; font-size: 11px; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px;">
                See you on a larger screen
            </div>
        </div>
    `;
    document.body.style.overflow = "hidden";
}

const HappyHouseMapIcon = (index) => L.divIcon({
    className: 'happy-house-map-marker',
    html: '', 
    iconSize: STANDARD_ICON_SIZE, 
    iconAnchor: STANDARD_ICON_ANCHOR
});

function clearMarkerHighlight() {
    if (activePlace && activePlace.marker && activePlace.marker._icon) {
        const iconElement = activePlace.marker._icon;
        activePlace.marker.options.icon.options.iconSize = STANDARD_ICON_SIZE;
        activePlace.marker.options.icon.options.iconAnchor = STANDARD_ICON_ANCHOR;
        iconElement.classList.remove('highlighted-marker');
        iconElement.innerHTML = '';
        activePlace.marker.setIcon(activePlace.marker.options.icon);
    }
}

function resetToDefaultView() {
    clearMarkerHighlight();
    document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));
    activePlace = null;
    const filterDropdown = document.getElementById('neighborhood-filter');
    if (filterDropdown && filterDropdown.value !== 'all') {
        filterDropdown.value = 'all';
    }
    filterPlaces('all'); 
}

function createListingItem(place, index) {
    if (!LIST_CONTAINER) return;

    const today = new Date();
    const dayIndex = today.getDay(); 
    const dayKeys = [
        'details_sunday', 'details_monday', 'details_tuesday', 
        'details_wednesday', 'details_thursday', 'details_friday', 'details_saturday'
    ];
    
    const currentDayKey = dayKeys[dayIndex];
    const currentDayDetail = place.happyHourData[currentDayKey] || 'N/A';

    const googleMapLinkHtml = place.mapUri ? `
        <p class="google-map-link-container">
            <a href="${place.mapUri}" target="_blank" rel="noopener noreferrer" class="styled-map-link">
                <span class="icon-flair fi fi-rr-link"></span> 
                <strong>Google Maps Link</strong>
            </a>
        </p>
    ` : '';

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

    item.addEventListener('click', (event) => {
        if (event.target.closest('.styled-map-link')) return; 

        const filterDropdown = document.getElementById('neighborhood-filter');
        const currentFilter = filterDropdown ? filterDropdown.value : 'all';
        const clickedNeighborhood = place.neighborhood || 'all';

        if (activePlace === place) return; 

        clearMarkerHighlight();
        document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));

        activePlace = place;

        if (place.marker && place.marker._icon) {
            const iconElement = place.marker._icon;
            place.marker.options.icon.options.iconSize = HIGHLIGHTED_ICON_SIZE;
            place.marker.options.icon.options.iconAnchor = HIGHLIGHTED_ICON_ANCHOR;
            place.marker.setIcon(place.marker.options.icon);
            iconElement.classList.add('highlighted-marker');
        }

        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (currentFilter !== clickedNeighborhood) {
            if (filterDropdown) filterDropdown.value = clickedNeighborhood;
            filterPlaces(clickedNeighborhood); 
        } else {
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

    place.listingItem = item;
    LIST_CONTAINER.appendChild(item);
}

function getUniqueNeighborhoods() {
    const neighborhoods = new Set();
    placeDataMap.forEach(place => {
        if (place.neighborhood && place.neighborhood.trim() !== '') {
            neighborhoods.add(place.neighborhood.trim());
        }
    });
    return Array.from(neighborhoods).sort();
}

function calculateCentroid(markers) {
    if (markers.length === 0) return null;
    let totalLat = 0;
    let totalLng = 0;
    markers.forEach(marker => {
        const latlng = marker.getLatLng();
        totalLat += latlng.lat;
        totalLng += latlng.lng;
    });
    return { lat: totalLat / markers.length, lng: totalLng / markers.length };
}

function filterPlaces(selectedNeighborhood) {
    let activeMarkers = [];
    placeDataMap.forEach(place => {
        const isMatch = (selectedNeighborhood === 'all' || place.neighborhood === selectedNeighborhood);
        if (place.marker) {
            if (isMatch) activeMarkers.push(place.marker);
        }
        if (place.listingItem) {
            if (place !== activePlace) place.listingItem.classList.remove('active'); 
            place.listingItem.style.display = isMatch ? '' : 'none';
        }
    });

    markersLayer.clearLayers();
    if (activeMarkers.length > 0) {
        markersLayer.addLayer(L.featureGroup(activeMarkers));
        if (activePlace && activePlace.marker && activePlace.marker._icon && activeMarkers.includes(activePlace.marker)) {
            const iconElement = activePlace.marker._icon;
            activePlace.marker.options.icon.options.iconSize = HIGHLIGHTED_ICON_SIZE;
            activePlace.marker.options.icon.options.iconAnchor = HIGHLIGHTED_ICON_ANCHOR;
            activePlace.marker.setIcon(activePlace.marker.options.icon);
            iconElement.classList.add('highlighted-marker');
        }
        const centroid = calculateCentroid(activeMarkers);
        if (centroid) {
            const zoomLevel = selectedNeighborhood === 'all' ? STARTING_ZOOM : 13; 
            map.setView([centroid.lat, centroid.lng], zoomLevel, { animate: true }); 
        }
    } else {
        map.setView(LA_CENTER, STARTING_ZOOM, { animate: true });
    }
}

function setupNeighborhoodFilter(uniqueNeighborhoods) {
    const container = document.getElementById('neighborhood-filter-container');
    if (!container) return;

    const select = document.createElement('select');
    select.id = 'neighborhood-filter';
    select.className = 'custom-filter-dropdown';
    
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Neighborhoods';
    select.appendChild(allOption);

    uniqueNeighborhoods.forEach(neighborhood => {
        const option = document.createElement('option');
        option.value = neighborhood;
        option.textContent = neighborhood;
        select.appendChild(option);
    });

    select.addEventListener('change', (event) => {
        const selectedValue = event.target.value;
        clearMarkerHighlight();
        activePlace = null; 
        document.querySelectorAll('.listing-item').forEach(li => li.classList.remove('active'));
        if (selectedValue === 'all') {
            resetToDefaultView(); 
        } else {
            filterPlaces(selectedValue);
        }
    });
    container.appendChild(select);
}

// --- 4. DATA LOADING FUNCTION ---

async function loadMainCsvData() {
    const pathsToTry = [{ path: MAIN_CSV_PATH, header: true, name: "Main Data" }];
    for (const { path, header, name } of pathsToTry) {
        try {
            const response = await fetch(path);
            if (!response.ok) continue; 
            const csvText = await response.text();
            const data = await new Promise((resolve) => {
                Papa.parse(csvText, {
                    header: header,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const parsedData = results.data.filter(row => row.Name || row.restaurant_key); 
                        resolve(parsedData.length > 0 ? parsedData : null);
                    },
                    error: () => resolve(null)
                });
            });
            if (data) return data;
        } catch (error) {
            console.warn(`Error loading ${path}`, error);
        }
    }
    return null; 
}

// --- 5. DATA MERGING AND MAP PROCESSING ---

async function processAndMergeData(allRestaurantDetails) {
    const markerPromises = allRestaurantDetails.map(async (dataRow, index) => {
        const name = dataRow.Name || dataRow.restaurant_key;
        if (!name) return null;
        
        const place = new Place(name); 
        placeDataMap.set(name, place);
        place.happyHourData = new HappyHourData(dataRow); 
        
        let lat = null, lng = null;
        const coordsString = dataRow.coordinates;
        if (coordsString) {
            const coordsArray = coordsString.split(',');
            if (coordsArray.length === 2) {
                lat = parseFloat(coordsArray[0].trim());
                lng = parseFloat(coordsArray[1].trim());
            }
        }
        
        place.neighborhood = dataRow.neighborhood || ''; 
        place.lat = lat;
        place.lng = lng;
        place.formattedAddress = dataRow.address || '';
        place.mapUri = dataRow['restaurant google map url'] || '';

        let finalLat = place.lat || LA_CENTER[0];
        let finalLng = place.lng || LA_CENTER[1];
        
        const marker = L.marker([finalLat, finalLng], {
            icon: HappyHouseMapIcon(index), 
            title: name
        });

        place.marker = marker;
        createListingItem(place, index);

        marker.on('click', () => {
            const correspondingItem = document.querySelector(`.listing-item[data-index="${index}"]`);
            if (correspondingItem) correspondingItem.click(); 
        });
        
        allMarkers.push(marker);
        return marker;
    });

    await Promise.all(markerPromises.filter(p => p !== null));
}

// --- 6. MAIN EXECUTION FUNCTION ---

async function initializeMapAndData() {
    // A. MOBILE CHECK
    if (isMobileDevice()) {
        showMobileBlocker();
        return; // Halt execution for mobile
    }

    // B. DESKTOP INITIALIZATION
    map = L.map('map', { minZoom: 10 }).setView(LA_CENTER, STARTING_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map); 
    markersLayer.addTo(map);

    map.on('click', (e) => {
        if (e.originalEvent.target.classList.contains('leaflet-pane') || e.originalEvent.target.id === 'map' || e.originalEvent.target.classList.contains('leaflet-marker-pane')) {
            resetToDefaultView();
        }
    });

    const allRestaurantDetails = await loadMainCsvData();
    if (!allRestaurantDetails || allRestaurantDetails.length === 0) return;

    await processAndMergeData(allRestaurantDetails);
    
    const uniqueNeighborhoods = getUniqueNeighborhoods();
    setupNeighborhoodFilter(uniqueNeighborhoods);

    filterPlaces('all'); 
}

document.addEventListener('DOMContentLoaded', initializeMapAndData);