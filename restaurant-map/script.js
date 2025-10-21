// script.js

// --- 1. CORE MAP AND DATA INITIALIZATION ---

// Map and Data Containers
let map;
let allMarkers = [];
let markersLayer = L.layerGroup();
const LIST_CONTAINER = document.getElementById('restaurant-list');
// Base URL for your geocoding proxy service (currently simulated/commented out)
const API_BASE_URL = 'http://localhost:3000/api/resolve-google-link'; 

// --- Configuration Variables ---

// Path to your local CSV data file
const CSV_FILE_PATH = 'data/restaurants.csv'; 

// Placeholder coordinates for demonstration (Los Angeles area center)
const LA_CENTER = [34.0522, -118.2437]; 
// UPDATED: Set a closer starting zoom level (12 is city, 14 is neighborhood/area)
const STARTING_ZOOM = 14; 
// Define the correct header row for PapaParse to use (must match the column names)
const CORRECT_HEADER = "Name,URL,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!";

// ** NEW: API Key Placeholder and Cache for Full Place Details **
const API_KEY = "AIzaSyDRk6GSn3W_AgpoEN-blxb2PGctvE9UvPY";
const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1/places"; 
let placeDetailsCache = {}; // Storage for the full place details response

// Custom Marker Icon Definition (Eater Style)
const EaterIcon = (index) => L.divIcon({
    className: 'eater-marker',
    html: `<span class="marker-number">${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15] // Centers the icon point
});


// --- NEW METHOD FOR FETCHING GOOGLE MAPS DATA (no change, used for geocoding if implemented) ---
/**
 * Asynchronously fetches a restaurant's latitude and longitude 
 * and official Google Maps URL by sending the name to a backend proxy.
 */
async function fetchRestaurantDetails(restaurantName) {
    const searchQuery = `${restaurantName}, Los Angeles`;

    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: searchQuery }),
        });

        if (!response.ok) {
            console.error(`Backend error for ${restaurantName}: ${response.statusText}`);
            return null;
        }

        const result = await response.json();
        
        if (result.success && result.data && result.data.lat && result.data.lng) {
            return {
                lat: result.data.lat,
                lng: result.data.lng,
                url: result.data.url || '' 
            };
        } else {
            return null;
        }

    } catch (error) {
        console.error(`Error fetching details for ${restaurantName}:`, error);
        return null;
    }
}
// --------------------------------------------------


// --- 2. GOOGLE PLACES API METHODS (TWO-STEP PROCESS) ---

/**
 * Helper to call the Text Search (New) API to get the Place ID.
 * @param {string} placeName The name of the place to search for.
 * @returns {Promise<string|null>} The Place ID or null on failure.
 */
async function fetchPlaceID(placeName) {
    console.log(`[Step 1: Text Search] Starting search for: ${placeName}`);
    
    const endpoint = `${GOOGLE_PLACES_BASE_URL}:searchText`;
    
    const requestBodyContent = {
        textQuery: `${placeName}, Los Angeles`,
        maxResultCount: 1, 
    };

    const requestBodyJson = JSON.stringify(requestBodyContent);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'places.id' 
            },
            body: requestBodyJson, 
        });
        
        console.log(`[Step 1: Text Search] HTTP Status: ${response.status}`);

        if (!response.ok) {
            console.error(`[Step 1: Text Search] Error fetching Place ID: ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (data.places && data.places.length > 0) {
            const placeId = data.places[0].id;
            console.log(`[Step 1: Text Search] Success! Found Place ID: ${placeId}`);
            return placeId;
        } else {
            console.warn(`[Step 1: Text Search] No results found for ${placeName}.`);
            return null;
        }

    } catch (error) {
        console.error(`[Step 1: Text Search] Network error:`, error);
        return null;
    }
}

/**
 * Helper to call the Place Details (New) API with a Place ID.
 * @param {string} placeId The unique identifier of the place.
 * @returns {Promise<object|null>} The full place data object or null on failure.
 */
async function fetchFullPlaceData(placeId) {
    console.log(`[Step 2: Place Details] Requesting full data for ID: ${placeId}`);

    const endpoint = `${GOOGLE_PLACES_BASE_URL}/${placeId}`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                // Request the fields needed for the sidebar rendering and logging
                'X-Goog-FieldMask': 'displayName,formattedAddress,rating,userRatingCount,currentOpeningHours' 
            },
        });
        
        console.log(`[Step 2: Place Details] HTTP Status: ${response.status}`);

        if (!response.ok) {
            console.error(`[Step 2: Place Details] Error fetching details: ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        console.log(`[Step 2: Place Details] Success! Full data received.`);
        return data;

    } catch (error) {
        console.error(`[Step 2: Place Details] Network error:`, error);
        return null;
    }
}

/**
 * Main method to get ALL available data for a place name using the Places API (New).
 * @param {string} placeName The name of the place.
 * @returns {Promise<object|null>} The full place details object or null.
 */
async function fetchPlaceDetailsByName(placeName) {
    console.log(`\n--- Starting Full Place Details Request for: ${placeName} ---`);
    
    // Check cache first
    if (placeDetailsCache[placeName]) {
        console.log(`--- Cache HIT! Returning cached data for ${placeName}. ---`);
        return placeDetailsCache[placeName];
    }

    // 1. Get the Place ID
    const placeId = await fetchPlaceID(placeName);
    
    if (!placeId) {
        console.error(`--- Full Place Details FAILED: Could not get Place ID for ${placeName}. ---`);
        return null;
    }
    
    // 2. Use the Place ID to get all details
    const fullDetailsResponse = await fetchFullPlaceData(placeId);
    
    if (!fullDetailsResponse) {
        console.error(`--- Full Place Details FAILED: Could not fetch details for ID ${placeId}. ---`);
        return null;
    }

    // --- MAPPED RESPONSE LOGGING ---
    console.log(`\n=================================================`);
    console.log(`🚀 RESPONSE OBJECT MAPPING for: ${placeName}`);
    console.log(`=================================================`);
    
    console.log(`[Name] Display Name:`, fullDetailsResponse.displayName?.text);
    console.log(`[Address] Formatted Address:`, fullDetailsResponse.formattedAddress);
    console.log(`[Rating] Average Rating:`, fullDetailsResponse.rating || 'N/A');
    console.log(`[Hours] Current Opening Hours Object:`, fullDetailsResponse.currentOpeningHours);
    
    console.log(`\n=================================================\n`);
    // --- END MAPPED RESPONSE LOGGING ---

    // 3. Store the full response and return it
    placeDetailsCache[placeName] = fullDetailsResponse;
    console.log(`--- Full Place Details SUCCESS! Data stored in cache and returned. ---`);
    
    return fullDetailsResponse;
}

// --------------------------------------------------
// --- END GOOGLE PLACES API METHODS ---


// --- UTILITY FUNCTIONS: RENDERING ---

/**
 * Takes the Google Places currentOpeningHours object and formats it into a clean HTML table.
 * @param {object|null} hoursObject The currentOpeningHours object from the Places API response.
 * @returns {string} HTML string of the formatted hours table.
 */
function renderOpeningHoursHtml(hoursObject) {
    // Check for null or missing data, returning a descriptive error message
    if (!hoursObject || !hoursObject.weekdayDescriptions || hoursObject.weekdayDescriptions.length === 0) {
        return '<div class="hours-box"><p class="details-subtitle">Operating Hours</p><p class="place-details-error">⚠️ Hours data not available.</p></div>';
    }

    // Handle 24-hour business status
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

        // Using a table structure (tr/td)
        html += `<tr class="hours-entry ${highlightClass}">
            <td class="hours-day">${day}</td>
            <td class="hours-time">${time}</td>
        </tr>`;
    });

    html += '</table></div>';
    return html;
}

/**
 * Renders the fetched Place Details (Rating and Hours) into the sidebar list item.
 * This is called AFTER data is fetched to UPDATE the placeholder.
 * @param {HTMLElement} listItem The list item to modify.
 * @param {object|null} details The full place details response object, or null for placeholders.
 */
function renderPlaceDetails(listItem, details = null) {
    // If no details, render the initial placeholder (no hours, no rating)
    if (!details) {
        return `
            <div class="place-api-details-injected loading-state">
                <div class="rating-box">
                    <span class="rating-value">—</span>
                    <div class="rating-text-group">
                        <span class="rating-stars">★★★★★</span>
                        <span class="review-count">(Loading details...)</span>
                    </div>
                </div>
                <div class="hours-box placeholder">
                    <p class="details-subtitle">Operating Hours</p>
                    <p class="place-details-error">Click to load hours.</p>
                </div>
            </div>
        `;
    }

    // If details are provided, render the live data (called upon successful fetch)

    // Round rating to one decimal place
    const hoursHtml = renderOpeningHoursHtml(details.currentOpeningHours);
    const rating = details.rating ? details.rating.toFixed(1) : '—'; 
    const reviewCount = details.userRatingCount || 0;

    // Create the updated details section HTML
    const newDetailsHtml = `
        <div class="place-api-details-injected has-data">
            <div class="rating-box">
                <span class="rating-value">${rating}</span>
                <div class="rating-text-group">
                    <span class="rating-stars">${'⭐'.repeat(Math.round(rating))}</span>
                    <span class="review-count">(${reviewCount} reviews)</span>
                </div>
            </div>
            ${hoursHtml}
        </div>
    `;
    
    // Find the existing placeholder and replace its HTML
    const existingDetails = listItem.querySelector('.place-api-details-injected');
    if (existingDetails) {
        existingDetails.outerHTML = newDetailsHtml;
    }
    
    // Add a class to the list item for enhanced styling
    listItem.classList.add('has-full-details');
}


/**
 * Creates the HTML content for the Leaflet popup using restaurant data.
 */
function createPopupContent(data) {
    // ... (unchanged) ...
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay();
    const todayKey = days[todayIndex];
    const specialToday = data[todayKey] || 'N/A';
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

/**
 * Creates the HTML list item for the sidebar.
 * **MODIFIED to include the initial placeholder details section**
 */
function createListingItem(data, index, marker) {
    const li = document.createElement('li');
    li.className = 'listing-item';
    li.setAttribute('data-index', index);
    
    const markerNumber = index + 1; 

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay(); 
    const todayKey = days[todayIndex]; 

    // Inject the placeholder rendering here, which includes the 'Fetch Details' button
    const initialDetailsHtml = renderPlaceDetails(li, null);

    li.innerHTML = `
        <div class="listing-header">
            <span class="marker-number">${markerNumber}</span>
            <h3 class="listing-title">${data.Name}</h3>
        </div>
        <p class="listing-special"><strong>Today's Special (${todayKey}):</strong> ${data[todayKey] || 'N/A'}</p>
        
        ${initialDetailsHtml}

        <button class="share-button" data-restaurant-name="${data.Name}" data-short-url="${data.URL || ''}">
            Share Location
        </button>
    `;

    // Event listener to center map and open popup when list item is clicked
    li.addEventListener('click', (event) => {
        // Only trigger map/popup on non-share button clicks
        if (event.target.closest('.share-button')) return; 

        document.querySelectorAll('.listing-item').forEach(item => item.classList.remove('active'));
        li.classList.add('active');
        
        map.setView(marker.getLatLng(), map.getZoom());
        marker.openPopup();
    });

    return li;
}


// --- 3. SHARING AND FETCH DETAILS LOGIC ---
/**
 * Attaches event listeners to dynamically created 'share-button' elements 
 * and the 'place-api-details-injected' element for fetching data.
 */
function initializeSharingListeners() {
    LIST_CONTAINER.addEventListener('click', function(event) {
        const shareButton = event.target.closest('.share-button');
        // Now we bind the fetch action to the entire injected details section
        const detailsContainer = event.target.closest('.place-api-details-injected');
        
        // Find the corresponding list item (li) for rendering later
        const listItem = event.target.closest('.listing-item');
        const restaurantName = listItem.querySelector('.listing-title').textContent.trim();
        
        if (shareButton) {
             event.preventDefault();
             handleShareButtonClick(shareButton);
        } else if (detailsContainer && listItem && !detailsContainer.classList.contains('has-data')) {
             event.preventDefault();
             // Pass the list item to the handler
             handleFetchDetailsClick(listItem, restaurantName, detailsContainer);
        }
    });
}

/** Handles the original share button logic */
function handleShareButtonClick(button) {
    // ... (unchanged) ...
    const restaurantName = button.getAttribute('data-restaurant-name');
    const shortUrl = button.getAttribute('data-short-url');
    
    console.log('--- Share Button Clicked ---');
    
    let resultCount = 1; 
    if (restaurantName.toLowerCase().includes('akuma')) {
        resultCount = 2; // Simulating a multi-result case to test logic
    }
    
    if (resultCount > 1) {
        console.log(`ACTION (Skipping): Skipping share URL generation. We only proceed with a single result.`);
        return null; 
    }
    
    const finalUrl = shortUrl || 'https://maps.app.goo.gl/JBrzJtMsUfsgY9jo6,Badmaash'; 
    
    alert(`Simulated Google Maps URL for ${restaurantName}:\n${finalUrl}`);

    return finalUrl;
}

/** * Handles the new logic: fetching data when the placeholder hours area is clicked.
 */
async function handleFetchDetailsClick(listItem, restaurantName, detailsContainer) {
    // Prevent double clicks by checking the state class
    if (detailsContainer.classList.contains('fetching')) return;

    // Set fetching state
    detailsContainer.classList.add('fetching');
    detailsContainer.querySelector('.review-count').textContent = '(Fetching...)';
    
    // Use the new main method
    const details = await fetchPlaceDetailsByName(restaurantName);
    
    // Clear fetching state
    detailsContainer.classList.remove('fetching');
    
    if (details) {
        // Render the hours and other Place details to the sidebar
        renderPlaceDetails(listItem, details);
        console.log(`Successfully rendered details for ${restaurantName}.`);
    } else {
        // Update the placeholder to show failure
        detailsContainer.querySelector('.review-count').textContent = '(Fetch failed)';
        detailsContainer.querySelector('.hours-box').innerHTML = '<p class="details-subtitle">Operating Hours</p><p class="place-details-error">❌ Failed to load hours.</p>';
        alert(`Failed to fetch full details for ${restaurantName}. Check the console for logs.`);
    }
}


// --- 4. MAIN EXECUTION FUNCTION ---
// Function is ASYNC to allow fetching the file contents
async function initializeMapAndData() { 
    // 1. Initialize Map and Tile Layer
    map = L.map('map', {
        minZoom: 10 
    }).setView(LA_CENTER, STARTING_ZOOM); // Apply LA Center and new Zoom

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    markersLayer.addTo(map);

    // 2. Load and Parse Data from Local File
    let csvText = '';
    try {
        const response = await fetch(CSV_FILE_PATH);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}. Ensure the file exists at: ${CSV_FILE_PATH} (relative to your HTML file).`);
        }
        
        csvText = await response.text();

        // Data Prep: Fix the malformed CSV header
        const lines = csvText.split('\n');
        
        // Skip the first three lines (index 0, 1, 2) which are titles/malformed header.
        const dataLines = lines.slice(3); 

        // Combine the correct header with the remaining data lines for clean parsing
        const csvToParse = [CORRECT_HEADER, ...dataLines].join('\n');
        
        // Parse the constructed CSV
        Papa.parse(csvToParse, { 
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.error('PapaParse Errors:', results.errors);
                }
                // Process data to create markers and list
                processRestaurantData(results.data);
                initializeSharingListeners(); 
            }
        });

    } catch (error) {
        console.error(`Error loading or parsing CSV:`, error);
        alert(`Could not load data from ${CSV_FILE_PATH}. Check your file path and that your local server is running.`);
    }
}

/**
 * Processes the parsed CSV data to create map markers and list items.
 */
function processRestaurantData(data) {
    // Filter: Only process rows that have both a Name and a URL (removes area header rows)
    const validRestaurants = data.filter(row => row.Name && row.URL);
    
    // ** New DEMO Call to fetchPlaceDetailsByName (Optional: remove this if you want) **
    if (validRestaurants.length > 0) {
        const testPlaceName = validRestaurants[0].Name;
        
        (async () => {
            console.log(`\n*** DEMO CALL: Testing fetchPlaceDetailsByName for "${testPlaceName}" ***`);
            const apiResponse = await fetchPlaceDetailsByName(testPlaceName);
            
            if (apiResponse) {
                console.log(`\n🎉 DEMO RESULT: API Response successfully retrieved for ${testPlaceName}!`);
            }
        })();
    }
    // ** End DEMO Call **
    
    // Sequential offset variables for distributing placeholder markers
    let latOffset = 0.005;
    let lngOffset = 0.005;

    // Use Promise.all to handle asynchronous API calls for coordinates
    const markerPromises = validRestaurants.map(async (restaurant, index) => {
        let lat, lng;
        let geoData = null; 

        // --- Use direct geocoding ONLY for the first entry (index 0) for testing ---
        if (index === 0) {
            console.log(`\n--- ATTEMPTING DIRECT GOOGLE API CALL FOR: ${restaurant.Name} ---`);
            geoData = await geocodeWithGoogleApiDirect(restaurant.Name);
            console.log(`--- DIRECT API CALL COMPLETE ---`);
        } else {
            geoData = null; 
        }

        if (geoData) {
            lat = geoData.lat;
            lng = geoData.lng;
            restaurant.URL = geoData.url || restaurant.URL; 
        } else {
            // Fallback: Use placeholder Lat/Lng calculation to distribute markers around LA_CENTER
            lat = LA_CENTER[0] + (latOffset * (index % 10)) * (index % 2 === 0 ? 1 : -1);
            lng = LA_CENTER[1] + (lngOffset * (index % 10)) * (index % 3 === 0 ? 1 : -1);
        }
        
        // Create Marker Icon and Marker
        const marker = L.marker([lat, lng], {
            icon: EaterIcon(index),
            title: restaurant.Name
        }).bindPopup(createPopupContent(restaurant));
        
        // Create Listing Item
        const listing = createListingItem(restaurant, index, marker);

        // Link marker click to highlight list item
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

    // Add all markers to the map once all promises are resolved
    Promise.all(markerPromises).then(() => {
        if (allMarkers.length > 0) {
            markersLayer.addLayer(L.featureGroup(allMarkers));
        }
    });
}

// --- NEW METHOD FOR DIRECT GOOGLE MAPS API ACCESS (Illustrative ONLY) ---
/**
 * Illustrative function to show a direct call to the Google Geocoding API.
 */
async function geocodeWithGoogleApiDirect(restaurantName) {
    const API_KEY_GEO = "AIzaSyCVr84tmw2QftHJhvGrMQpewi76bfE9evI"; // Replace with your actual API key
    
    const address = encodeURIComponent(`${restaurantName}, Los Angeles`);
    const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${API_KEY_GEO}`;

    try {
        const response = await fetch(endpoint);
        
        if (!response.ok) {
            console.error(`[Geocoding Direct] HTTP Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        
        if (data.status === "OK" && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            
            return {
                lat: location.lat,
                lng: location.lng,
                url: `https://maps.google.com/?q=$${location.lat},${location.lng}` 
            };
        } else {
            return null;
        }

    } catch (error) {
        console.error("[Geocoding Direct] Error:", error);
        return null;
    }
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeMapAndData);