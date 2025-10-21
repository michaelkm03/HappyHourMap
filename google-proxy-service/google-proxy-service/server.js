// server.js
const express = require("express");
const axios = require("axios");
const app = express();
const port = 3000;
const CLIENT_ORIGIN = 'http://127.0.0.1:5500'; // ⬅️ IMPORTANT: Match your frontend URL

// Middleware for CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CLIENT_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

/**
 * Determines the address by checking for the specific restaurant name.
 * Coordinates are entirely removed from this server-side function for known addresses.
 */
async function getAddressAndCoords(longUrl, placeName) {
    console.log(`[SERVER-GEO] Step 1: Checking restaurant name for known addresses.`);
    
    const isAkuma = placeName.toLowerCase().includes('akuma');

    if (isAkuma) {
        console.log(`[SERVER-GEO] Step 2: Restaurant name is Akuma.`);
        console.log(`[SERVER-GEO] Step 3: Assigning user-specified address.`);
        
        // Only return the address string. The client will handle coordinate lookup.
        return { 
            address: "8267 Santa Monica Blvd, West Hollywood, CA 90046"
        };
    }
    
    console.log(`[SERVER-GEO] Step 2: Restaurant name is not a known match.`);
    console.log(`[SERVER-GEO] Step 3: Cannot find address. Returning null address.`);
    
    // For all other restaurants, we return null.
    return { address: null };
}


// The core endpoint to resolve the link and get the address
app.get('/api/resolve-google-link', async (req, res) => {
    const shortUrl = req.query.url;
    const restaurantName = req.query.name; // Passed from the client
    console.log(`\n[SERVER] Received request for URL: ${shortUrl}, Name: ${restaurantName}`);

    if (!shortUrl || !restaurantName) {
        return res.status(400).json({ error: 'Missing "url" or "name" query parameter.' });
    }

    try {
        // Step 1: Follow redirects and get the final URL
        const headResponse = await axios.head(shortUrl, {
            validateStatus: status => status < 500 
        });

        const longUrl = headResponse.request.res.responseUrl || shortUrl;
        console.log(`[SERVER] Final resolved URL: ${longUrl}`);
        
        // Step 2: Use the restaurant name to look up the address
        const geocodeResult = await getAddressAndCoords(longUrl, restaurantName);

        // Success is now based on finding the address, not coordinates.
        if (geocodeResult.address) {
            console.log(`[SERVER] Success! Found Address: ${geocodeResult.address}. Coordinates must be resolved on client.`);

            return res.json({ 
                // CRITICAL CHANGE: Removed coordinates from server response.
                address: geocodeResult.address,
                url: longUrl 
            });
        } else {
            // Log the specified error message and return 404
            console.log(`[SERVER] ERROR: cannot find address`);
            return res.status(404).json({ 
                error: `Address not found for ${restaurantName}.`,
                resolvedUrl: longUrl 
            });
        }

    } catch (error) {
        console.error(`[SERVER] FATAL ERROR during URL resolution: ${error.message}`);
        return res.status(500).json({ 
            error: 'Internal server error during URL resolution.', 
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`Google Maps Proxy Service listening at http://localhost:${port}`);
    console.log(`CORS enabled for client origin: ${CLIENT_ORIGIN}`);
    console.log(`======================================================\n`);
});