# 🍹 Happy Hour Map Project

This project creates an interactive map for exploring happy hour deals, complete with a sortable, filterable sidebar and custom map markers, using Leaflet for mapping, PapaParse for CSV data handling, and custom HTML/CSS for a brand-aligned user interface.

## 📁 Project Structure

To set up this project, ensure you have the following file structure:

**⚠️ Crucial:** You must create the **`data`** folder and place your main restaurant data CSV file inside it, named **`main.csv`**.

---

## 🛠️ Setup and Installation

Since this project is entirely client-side (HTML, CSS, JavaScript) and relies on loading a local CSV file, you **must** run it using a local web server to bypass browser security restrictions (CORS/file protocol issues).

### Option 1: Using VS Code Live Server (Recommended)

1.  **Install VS Code** and the **"Live Server" extension** by Ritwick Dey.
2.  Open the project's root folder (`happy-hour-map/`) in VS Code.
3.  Right-click on the **`index.html`** file in the file explorer.
4.  Select **"Open with Live Server"**.

The map will launch in your browser at an address like `http://127.0.0.1:5500/index.html`.

### Option 2: Python Simple HTTP Server

1.  Open your terminal or command prompt.
2.  Navigate to the project's root folder (`cd /path/to/happy-hour-map`).
3.  Run the following command:
    ```bash
    # For Python 3
    python -m http.server 8000
    ```
4.  Open your web browser and navigate to: **`http://localhost:8000`**

---

## ⚙️ Data Preparation (`data/main.csv`)

The `script.js` file is configured to read data from a single CSV file named `main.csv`. Your CSV file **must** include the following columns with these exact headers for the script to function correctly:

| Header Name | Required? | Purpose |
| :--- | :--- | :--- |
| **Name** | **YES** | The name of the restaurant/place. |
| **coordinates** | **YES** | The latitude and longitude, separated by a comma (e.g., `34.0522, -118.2437`). |
| **neighborhood** | YES | The location/neighborhood name for filtering. |
| **address** | YES | The full address. |
| **restaurant google map url** | NO | The direct link to the place on Google Maps. |
| **details\_monday** to **details\_sunday** | NO | Happy hour details for each day. |
| **details\_games** | NO | Optional: details on games available. |
| **details\_haunted** | NO | Optional: whether the place is haunted. |

---

## 📝 Customization and Styling Notes

The following key styles have been recently updated in `style.css` based on your requests:

* **Sidebar Width:** Set in the `#listings` selector to **`450px`** for more horizontal space.
* **Tile Size (Vertical):** Set in the `.listing-item` selector using aggressive padding (`padding: 50px 30px;`) to make the tiles significantly larger.
* **Restaurant Name Size:** Set in the `.restaurant-name` selector to **`1.625em`** (approx. 30% larger).
* **Map Marker Style:** The circular markers are defined by the `.eater-marker` class.