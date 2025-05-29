// DOM Elements
const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const modeSelect = document.getElementById("modeSelect");
const myLocationBtn = document.getElementById("myLocationBtn");

// Create auto-suggest dropdown
const suggestBox = document.createElement("ul");
suggestBox.id = "suggestBox";
suggestBox.className = "suggest-box";
cityInput.parentNode.insertBefore(suggestBox, cityInput.nextSibling);

// --- Event Listeners --- //

// Auto-suggest cities on input
cityInput.addEventListener("input", async () => {
  const query = cityInput.value.trim();
  suggestBox.innerHTML = "";
  if (query.length < 2) return;

  try {
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=ed95aef3b8434dcd80f1a19a9fad96d8&limit=5`);
    const data = await res.json();

    data.results.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item.formatted;
      li.addEventListener("click", () => {
        cityInput.value = item.formatted;
        suggestBox.innerHTML = "";
      });
      suggestBox.appendChild(li);
    });
  } catch (e) {
    console.error("Autocomplete error:", e);
  }
});

// Hide suggestions when clicking elsewhere
document.addEventListener("click", (e) => {
  if (!suggestBox.contains(e.target) suggestBox.innerHTML = "";
});

// Form submission
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) {
    fetchWeatherByCity(city);
    saveToHistory(city);
    cityInput.value = "";
  }
});

// Clear history
clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem("weatherHistory");
  historyList.innerHTML = "";
});

// Get precise location
myLocationBtn.addEventListener("click", getPreciseLocation);

// --- Core Functions --- //

// Improved location detection
async function getPreciseLocation() {
  if (!navigator.geolocation) {
    showError("Geolocation not supported");
    return;
  }

  weatherResult.innerHTML = "<div class='loading'>Detecting your precise location...</div>";

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000
      });
    });

    const { latitude: lat, longitude: lon } = position.coords;
    const locationName = await reverseGeocode(lat, lon);
    
    fetchWeatherByCoords(lat, lon, locationName);
    saveToHistory(locationName);

  } catch (error) {
    handleLocationError(error);
  }
}

// Get readable address from coordinates
async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
    const data = await response.json();
    
    const address = data.address || {};
    const parts = [
      address.road,
      address.neighbourhood,
      address.suburb,
      address.village,
      address.town,
      address.city,
      address.county,
      address.state
    ].filter(Boolean);

    return parts.length > 0 
      ? `${parts.join(", ")} (${lat.toFixed(4)}, ${lon.toFixed(4)})` 
      : `Your Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  } catch (e) {
    console.error("Geocoding error:", e);
    return `Your Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  }
}

// Fetch weather by city name
async function fetchWeatherByCity(city) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json`);
    const data = await response.json();

    if (data.length === 0) {
      showError("Location not found");
      return;
    }

    const { lat, lon, display_name } = data[0];
    fetchWeatherByCoords(lat, lon, display_name || city);

  } catch (error) {
    showError("Failed to fetch location");
    console.error(error);
  }
}

// Main weather data fetcher
async function fetchWeatherByCoords(lat, lon, locationName) {
  weatherResult.innerHTML = "<div class='loading'>Loading weather data...</div>";
  const mode = modeSelect.value;

  try {
    let url, dateRange;
    
    if (mode === "live") {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min`;
    } else {
      const dates = getDateRange(mode);
      url = `https://${mode === "past" ? "archive-api" : "api"}.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${dates.start}&end_date=${dates.end}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (mode === "live") {
      displayCurrentWeather(data, locationName, lat, lon);
    } else {
      displayForecast(data, locationName, lat, lon, mode);
    }

  } catch (error) {
    showError("Failed to fetch weather data");
    console.error(error);
  }
}

// --- Helper Functions --- //

function getDateRange(mode) {
  const today = new Date();
  const start = new Date(today);
  
  if (mode === "past") {
    start.setDate(today.getDate() - 7);
    return {
      start: start.toISOString().split("T")[0],
      end: new Date(today.setDate(today.getDate() - 1)).toISOString().split("T")[0]
    };
  } else {
    start.setDate(today.getDate() + 1);
    return {
      start: start.toISOString().split("T")[0],
      end: new Date(start.setDate(start.getDate() + 6)).toISOString().split("T")[0]
    };
  }
}

function displayCurrentWeather(data, locationName, lat, lon) {
  const current = data.current_weather;
  const daily = data.daily;

  weatherResult.innerHTML = `
    <div class="weather-card current">
      <h3>📍 ${locationName}</h3>
      <div class="weather-grid">
        <div><span>🌡 Temperature:</span> ${current.temperature}°C</div>
        <div><span>💨 Wind:</span> ${current.windspeed} km/h</div>
        <div><span>⬆️ Max:</span> ${daily.temperature_2m_max[0]}°C</div>
        <div><span>⬇️ Min:</span> ${daily.temperature_2m_min[0]}°C</div>
        <div><span>📍 Coordinates:</span> ${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
      </div>
    </div>`;
}

function displayForecast(data, locationName, lat, lon, mode) {
  let html = `
    <div class="weather-card forecast">
      <h3>📍 ${locationName} (${mode === "past" ? "Past Week" : "Next Week"})</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Max (°C)</th>
              <th>Min (°C)</th>
              <th>Rain (mm)</th>
              <th>Wind (km/h)</th>
            </tr>
          </thead>
          <tbody>`;

  data.daily.time.forEach((date, i) => {
    html += `
            <tr>
              <td>${date}</td>
              <td>${data.daily.temperature_2m_max[i]}</td>
              <td>${data.daily.temperature_2m_min[i]}</td>
              <td>${data.daily.precipitation_sum[i]}</td>
              <td>${data.daily.windspeed_10m_max[i]}</td>
            </tr>`;
  });

  html += `
          </tbody>
        </table>
      </div>
      <div class="coordinates">Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
    </div>`;

  weatherResult.innerHTML = html;
}

function saveToHistory(location) {
  const history = JSON.parse(localStorage.getItem("weatherHistory") || []);
  if (!history.includes(location)) {
    history.push(location);
    localStorage.setItem("weatherHistory", JSON.stringify(history));
    displayHistory();
  }
}

function displayHistory() {
  const history = JSON.parse(localStorage.getItem("weatherHistory") || []);
  historyList.innerHTML = history.reverse().map(item => `
    <li>
      ${item.split(" (")[0]}
      <button onclick="removeFromHistory('${item}')">❌</button>
    </li>
  `).join("");
}

function removeFromHistory(item) {
  const history = JSON.parse(localStorage.getItem("weatherHistory") || []);
  const updated = history.filter(i => i !== item);
  localStorage.setItem("weatherHistory", JSON.stringify(updated));
  displayHistory();
}

function showError(message) {
  weatherResult.innerHTML = `<div class="error">❌ ${message}</div>`;
}

function handleLocationError(error) {
  let message = "Location detection failed";
  if (error.code === error.PERMISSION_DENIED) message = "Please enable location permissions";
  if (error.code === error.TIMEOUT) message = "Location request timed out";
  showError(message);
}

// Initialize
window.onload = displayHistory;
