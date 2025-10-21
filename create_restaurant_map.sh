#!/bin/bash
# Create restaurant map project structure

PROJECT_DIR="restaurant-map"

echo "📁 Creating project: $PROJECT_DIR"

mkdir -p $PROJECT_DIR/data

# Create files
touch $PROJECT_DIR/index.html
touch $PROJECT_DIR/script.js
touch $PROJECT_DIR/style.css
touch $PROJECT_DIR/data/restaurants.csv

# Add starter HTML
cat <<'EOF' > $PROJECT_DIR/index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neighborhood Restaurant Map</title>

  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Neighborhood Restaurants</h1>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
  <script src="script.js"></script>
</body>
</html>
EOF

# Add starter CSS
cat <<'EOF' > $PROJECT_DIR/style.css
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}

h1 {
  text-align: center;
  margin: 10px 0;
}

#map {
  width: 100%;
  height: 90vh;
  border-top: 2px solid #444;
}
EOF

# Add starter JS
cat <<'EOF' > $PROJECT_DIR/script.js
const map = L.map('map').setView([34.05, -118.25], 13);

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
  attribution:
    '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
  maxZoom: 18,
  id: 'mapbox/streets-v11',
  tileSize: 512,
  zoomOffset: -1,
  accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN_HERE'
}).addTo(map);

function extractCoordsFromGoogleLink(url) {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return [parseFloat(match[1]), parseFloat(match[2])];
  return null;
}

Papa.parse('data/restaurants.csv', {
  download: true,
  header: true,
  complete: function(results) {
    results.data.forEach(row => {
      const restaurantName = row[Object.keys(row)[0]];
      const googleLink = restaurantName.match(/https?:\/\/[^\s)]+/);
      const coords = googleLink ? extractCoordsFromGoogleLink(googleLink[0]) : null;

      if (coords) {
        let popupHtml = `<b>${restaurantName}</b><br>`;
        popupHtml += Object.entries(row)
          .slice(1)
          .map(([day, info]) => `<strong>${day}:</strong> ${info}`)
          .join('<br>');

        L.marker(coords).addTo(map).bindPopup(popupHtml);
      }
    });
  }
});
EOF

echo "✅ Project created at: $(pwd)/$PROJECT_DIR"
