// script.js

// --- 1. CORE MAP AND DATA INITIALIZATION ---

let map;
let allMarkers = [];
let markersLayer = L.layerGroup();
const LIST_CONTAINER = document.getElementById('restaurant-list');
let restaurantDataList = []; 

// ** SIMULATED CACHE: Stores restaurantName -> Google Maps URL **
let urlCache = {}; 

// --- Configuration Variables ---

const CSV_FILE_PATH = 'data/restaurant.csv'; 
const LA_CENTER = [34.0522, -118.2437]; 
const STARTING_ZOOM = 14; 
const CORRECT_HEADER = "Name,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!";

// ** API Key Placeholder and Cache **
const API_KEY = "AIzaSyDRk6GSn3W_AgpoEN-blxb2PGctvE9UvPY";
const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1/places"; 
let placeDetailsCache = {}; 

/**
 * Placeholder to simulate loading data from 'data/google_map_url.csv'.
 * Simulates reading a simple CSV (Name,URL) into the urlCache object.
 */
function loadUrlCacheFromDisk() {
    // In a real environment, this would read and parse the CSV file.
    // console.log("Simulating loading URL cache from 'data/google_map_url.csv'...");
    
    // For this simulation, the cache starts empty on every load.
    // Replace this with actual file I/O for persistent caching:
    // const csvText = readFile('data/google_map_url.csv');
    // const results = Papa.parse(csvText, { header: true });
    // const cache = results.data.reduce((acc, row) => {
    //     acc[row.Name] = row.URL;
    //     return acc;
    // }, {});
    // return cache;
    return {};
}

/**
 * Placeholder to simulate saving data to 'data/google_map_url.csv'.
 * Simulates writing the urlCache object to a CSV file.
 */
function saveUrlCacheToDisk() {
    // ** NOTE: This simulates the required file persistence **
    console.log("Saving URL cache to simulated disk file 'data/google_map_url.csv'...");
    
    // In a real environment, this would perform the file write:
    // const cacheArray = Object.keys(urlCache).map(name => ({ Name: name, URL: urlCache[name] }));
    // const csv = Papa.unparse(cacheArray);
    // writeFile('data/google_map_url.csv', csv);
    
    // Logging the final map for verification:
    // console.log("Final Cached Name : URL Map:", urlCache);
}


/**
 * Creates a custom Leaflet marker icon with a numbered badge.
 */
const EaterIcon = (index) => L.divIcon({
    className: 'eater-marker',
    html: `<span class="marker-number">${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15] 
});


// --- UTILITY DATA CLASS (UNCHANGED) ---

class PlaceDetails {
    constructor(apiResponse) {
        this.id = apiResponse.id || null;
        this.displayName = apiResponse.displayName?.text || 'N/A';
        this.formattedAddress = apiResponse.formattedAddress || 'N/A';
        this.rating = apiResponse.rating || null;
        this.userRatingCount = apiResponse.userRatingCount || 0;
        this.currentOpeningHours = apiResponse.currentOpeningHours || null;
    }
}


// --- API METHODS ---

/**
 * Calls the Text Search (New) API to get the Place ID, Location, and Maps URL.
 */
async function fetchPlaceIDAndLocation(placeName) {
    const endpoint = `${GOOGLE_PLACES_BASE_URL}:searchText`;

    const requestBodyContent = {
        textQuery: `${placeName}, Los Angeles`,
        maxResultCount: 1,
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'places.id,places.location,places.googleMapsUri'
            },
            body: JSON.stringify(requestBodyContent),
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (data.places && data.places.length > 0) {
            const place = data.places[0];
            const location = place.location;
            const mapUri = place.googleMapsUri;

            if (!place.id || !location) return null;

            // ** ONLY LOGGING THE SUCCESSFUL GEOCDE RESULT HERE (on API call) **
            if (mapUri) {
                 console.log(`[GEOCODE SUCCESS] ${placeName} : ${mapUri}`);
            }
            // ****************************************************

            return {
                placeId: place.id,
                lat: location.latitude,
                lng: location.longitude,
                mapUri: mapUri || ''
            };
        } else {
            return null;
        }

    } catch (error) {
        return null;
    }
}

/**
 * Helper to get only the Place ID.
 */
async function fetchPlaceID(placeName) {
    const data = await fetchPlaceIDAndLocation(placeName);
    return data ? data.placeId : null;
}

/**
 * Calls the Place Details (New) API with a Place ID to get full business data.
 */
async function fetchFullPlaceData(placeId) {
    const endpoint = `${GOOGLE_PLACES_BASE_URL}/${placeId}`;

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,currentOpeningHours'
            },
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data;

    } catch (error) {
        return null;
    }
}

/**
 * Main method to get ALL available data for a place name using the Places API (New).
 */
async function fetchPlaceDetailsByName(placeName) {
    if (placeDetailsCache[placeName]) return placeDetailsCache[placeName];

    // 1. Get the Place ID
    const placeId = await fetchPlaceID(placeName);
    if (!placeId) return null;

    // 2. Use the Place ID to get all details
    const rawDetailsResponse = await fetchFullPlaceData(placeId);
    if (!rawDetailsResponse) return null;

    // 3. Create structured data class instance
    const structuredDetails = new PlaceDetails(rawDetailsResponse);
    
    // 4. Store the structured response and return it
    placeDetailsCache[placeName] = structuredDetails;

    return structuredDetails;
}


// --- UTILITY FUNCTIONS: RENDERING & LOOKUP (UNCHANGED) ---

function findRestaurantByApiData(apiData) {
    if (!apiData || !apiData.displayName) return null;

    const apiName = apiData.displayName.trim().toLowerCase();
    
    const match = restaurantDataList.find(localRow => {
        if (!localRow.Name) return false;
        const localName = localRow.Name.trim().toLowerCase();
        return apiName.includes(localName) || localName.includes(apiName);
    });
    
    return match;
}

function renderOpeningHoursHtml(hoursObject) {
    if (!hoursObject || !hoursObject.weekdayDescriptions || hoursObject.weekdayDescriptions.length === 0) {
        return '<div class="hours-box"><p class="details-subtitle">Operating Hours</p><p class="place-details-error">⚠️ Hours data not available.</p></div>';
    }
    if (hoursObject.textSummary === "Open 24 hours") {
        return '<div class="hours-box"><p class="details-subtitle">Operating Hours</p><p class="open-24">🟢 Open 24 Hours</p></div>';
    }
    let html = '<div class="hours-box"><p class="details-subtitle">Operating Hours</p><table class="hours-table">';
    hoursObject.weekdayDescriptions.forEach(desc => {
        const parts = desc.split(':');
        const day = parts[0].trim();
        const time = parts.slice(1).join(':').trim();
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const highlightClass = day === today ? 'current-day-active' : '';
        html += `<tr class="hours-entry ${highlightClass}"><td class="hours-day">${day}</td><td class="hours-time">${time}</td></tr>`;
    });
    html += '</table></div>';
    return html;
}

function renderPlaceDetails(listItem, details = null) {
    if (!details) {
        return `
            <div class="place-api-details-injected loading-state">
                <div class="rating-box"><span class="rating-value">—</span><div class="rating-text-group"><span class="rating-stars">★★★★★</span><span class="review-count">(Loading details...)</span></div></div>
                <div class="hours-box placeholder"><p class="details-subtitle">Operating Hours</p><p class="place-details-error">Click to load hours.</p></div>
            </div>
        `;
    }
    const hoursHtml = renderOpeningHoursHtml(details.currentOpeningHours);
    const rating = details.rating ? details.rating.toFixed(1) : '—';
    const reviewCount = details.userRatingCount || 0;
    const newDetailsHtml = `
        <div class="place-api-details-injected has-data">
            <div class="rating-box"><span class="rating-value">${rating}</span><div class="rating-text-group"><span class="rating-stars">${'⭐'.repeat(Math.round(details.rating))}</span><span class="review-count">(${reviewCount} reviews)</span></div></div>
            ${hoursHtml}
        </div>
    `;
    const existingDetails = listItem.querySelector('.place-api-details-injected');
    if (existingDetails) {
        existingDetails.outerHTML = newDetailsHtml;
    }
    listItem.classList.add('has-full-details');
}

function createPopupContent(data) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay();
    const todayKey = days[todayIndex];
    const specialToday = data[todayKey] || 'N/A';
    // Uses URL from cache/API or placeholder
    const finalUrl = data.URL || '<span class="null-info">N/A</span>'; 

    return `
        <div class="custom-popup-content">
            <h3 class="popup-title">${data.Name}</h3>
            <p class="popup-address">Happy Hour Today (${todayKey}): <strong>${specialToday}</strong></p>
            <hr class="popup-divider">
            <table class="popup-table">
                <tr><td class="popup-key">URL:</td><td class="popup-value">${finalUrl}</td></tr>
                <tr><td class="popup-key">Games:</td><td class="popup-value">${data['GAMES?!'] || '<span class="null-info">None</span>'}</td></tr>
                <tr><td class="popup-key">Haunted:</td><td class="popup-value">${data['HAUNTED?!'] || '<span class="null-info">No</span>'}</td></tr>
            </table>
        </div>
    `;
}

function createListingItem(data, index, marker) {
    const li = document.createElement('li');
    li.className = 'listing-item';
    li.setAttribute('data-index', index);
    const markerNumber = index + 1;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay();
    const todayKey = days[todayIndex];
    const initialDetailsHtml = renderPlaceDetails(li, null);
    li.innerHTML = `
        <div class="listing-header"><span class="marker-number">${markerNumber}</span><h3 class="listing-title">${data.Name}</h3></div>
        <p class="listing-special"><strong>Today's Special (${todayKey}):</strong> ${data[todayKey] || 'N/A'}</p>
        ${initialDetailsHtml}
        <button class="share-button" data-restaurant-name="${data.Name}" data-short-url="${data.URL || ''}">Share Location</button>
    `;
    li.addEventListener('click', (event) => {
        if (event.target.closest('.share-button')) return;
        document.querySelectorAll('.listing-item').forEach(item => item.classList.remove('active'));
        li.classList.add('active');
        map.setView(marker.getLatLng(), map.getZoom());
        marker.openPopup();
    });
    return li;
}


// --- 3. SHARING AND FETCH DETAILS LOGIC (UNCHANGED) ---

function initializeSharingListeners() {
    LIST_CONTAINER.addEventListener('click', function(event) {
        const shareButton = event.target.closest('.share-button');
        const detailsContainer = event.target.closest('.place-api-details-injected');
        const listItem = event.target.closest('.listing-item');
        const restaurantName = listItem.querySelector('.listing-title').textContent.trim();

        if (shareButton) {
             event.preventDefault();
             handleShareButtonClick(shareButton);
        } else if (detailsContainer && listItem && !detailsContainer.classList.contains('has-data')) {
             event.preventDefault();
             handleFetchDetailsClick(listItem, restaurantName, detailsContainer);
        }
    });
}

function handleShareButtonClick(button) {
    const restaurantName = button.getAttribute('data-restaurant-name');
    const shortUrl = button.getAttribute('data-short-url');
    let resultCount = 1;
    if (restaurantName.toLowerCase().includes('akuma')) {
        resultCount = 2;
    }
    if (resultCount > 1) {
        return null;
    }
    const finalUrl = shortUrl || 'https://maps.app.goo.gl/JBrzJtMsUfsgY9jo6,Badmaash';
    alert(`Simulated Google Maps URL for ${restaurantName}:\n${finalUrl}`);
    return finalUrl;
}

async function handleFetchDetailsClick(listItem, restaurantName, detailsContainer) {
    if (detailsContainer.classList.contains('fetching')) return;

    detailsContainer.classList.add('fetching');
    detailsContainer.querySelector('.review-count').textContent = '(Fetching...)';

    const details = await fetchPlaceDetailsByName(restaurantName); 

    detailsContainer.classList.remove('fetching');

    if (details) {
        const localMatch = findRestaurantByApiData(details);
        renderPlaceDetails(listItem, details);
    } else {
        detailsContainer.querySelector('.review-count').textContent = '(Fetch failed)';
        detailsContainer.querySelector('.hours-box').innerHTML = '<p class="details-subtitle">Operating Hours</p><p class="place-details-error">❌ Failed to load hours.</p>';
        alert(`Failed to fetch full details for ${restaurantName}.`);
    }
}


// --- 4. MAIN EXECUTION FUNCTION ---

async function initializeMapAndData() {
    // 1. Initialize Map and Tile Layer
    map = L.map('map', { minZoom: 10 }).setView(LA_CENTER, STARTING_ZOOM); 
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    markersLayer.addTo(map);

    // 2. Load Cache (Simulated)
    urlCache = loadUrlCacheFromDisk();

    // 3. Load and Parse Data from Local File
    let csvText = '';
    try {
        const response = await fetch(CSV_FILE_PATH);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}.`);
        }
        csvText = await response.text();

        const lines = csvText.split('\n');
        const dataLines = lines.slice(3).filter(line => line.trim() !== '');

        const csvToParse = [CORRECT_HEADER, ...dataLines].join('\n');

        Papa.parse(csvToParse, {
            header: true,
            skipEmptyLines: true, 
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.error('PapaParse Errors:', results.errors);
                }
                processRestaurantData(results.data);
                initializeSharingListeners();
            }
        });

    } catch (error) {
        console.error(`Error loading or parsing CSV:`, error);
        alert(`Could not load data from ${CSV_FILE_PATH}.`);
    }
}

/**
 * Processes the parsed CSV data, checks/updates URLs from cache/API, and creates markers.
 */
function processRestaurantData(data) {
    const validRestaurants = data.filter(row => row.Name && row.Monday);
    restaurantDataList = validRestaurants;

    let latOffset = 0.005;
    let lngOffset = 0.005;

    const markerPromises = validRestaurants.map(async (restaurant, index) => {
        let lat, lng;
        let geoData = null;
        
        restaurant.URL = restaurant.URL || ''; 

        // 1. CHECK CACHE: Skip API call if URL is known
        if (urlCache[restaurant.Name]) {
            restaurant.URL = urlCache[restaurant.Name];
            
        } else {
            // 2. CACHE MISS: Call API to get URL, coordinates, and log
            // This happens only once for a missing URL.
            geoData = await geocodeWithGoogleApiDirect(restaurant.Name);
            
            if (geoData) {
                // Update cache and restaurant data
                urlCache[restaurant.Name] = geoData.url;
                restaurant.URL = geoData.url;
            }
        }
        
        // 3. DETERMINE COORDINATES (only use real coordinates if geodata was just fetched)
        if (geoData) {
            lat = geoData.lat;
            lng = geoData.lng;
        } else {
            // Use placeholder Lat/Lng calculation for all cache hits and API misses
            lat = LA_CENTER[0] + (latOffset * (index % 10)) * (index % 2 === 0 ? 1 : -1);
            lng = LA_CENTER[1] + (lngOffset * (index % 10)) * (index % 3 === 0 ? 1 : -1);
        }

        // Create Marker Icon and Marker
        const marker = L.marker([lat, lng], {
            icon: EaterIcon(index),
            title: restaurant.Name
        }).bindPopup(createPopupContent(restaurant));

        const listing = createListingItem(restaurant, index, marker);

        marker.on('click', () => {
            document.querySelectorAll('.listing-item').forEach(item => item.classList.remove('active'));
            const correspondingItem = document.querySelector(`.listing-item[data-index="${index}"]`);
            if (correspondingItem) {
                correspondingItem.classList.add('active');
                correspondingItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        allMarkers.push(marker);
        LIST_CONTAINER.appendChild(listing);

        return marker;
    });

    Promise.all(markerPromises).then(() => {
        if (allMarkers.length > 0) {
            markersLayer.addLayer(L.featureGroup(allMarkers));
        }
    });
    
    // 4. SAVE CACHE TO DISK (Simulated)
    saveUrlCacheToDisk();
}

/**
 * Uses the Places API to get the canonical Google Maps URL and coordinates.
 */
async function geocodeWithGoogleApiDirect(restaurantName) {
    const geoData = await fetchPlaceIDAndLocation(restaurantName); 

    if (geoData && geoData.lat && geoData.lng) {
        return {
            lat: geoData.lat,
            lng: geoData.lng,
            url: geoData.mapUri
        };
    } else {
        return null;
    }
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeMapAndData);