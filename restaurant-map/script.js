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
