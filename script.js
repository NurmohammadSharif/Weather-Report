// script.js

const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const liveLocationBtn = document.getElementById("liveLocationBtn");
const modeSelect = document.getElementById("modeSelect");

// --- Event Listeners ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim().toUpperCase();
  if (city) {
    fetchWeather(city);
    saveToHistory(city);
    displayHistory();
    cityInput.value = "";
  }
});

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem("weatherHistory");
  displayHistory();
  weatherResult.innerHTML = "";
});

liveLocationBtn.addEventListener("click", () => {
  weatherResult.innerHTML = "⏳ Detecting your location…";
  if (!navigator.geolocation) {
    weatherResult.innerHTML = `<p style="color:red;">❌ Geolocation not supported.</p>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });
});

// --- Geolocation Callbacks ---
async function onGeoSuccess(pos) {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  // Show debug coords
  weatherResult.innerHTML = `<p>📍 Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>`;

  // Reverse-geocode to get a name
  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2`
    );
    const geoData = await geoRes.json();
    const addr = geoData.address || {};
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.hamlet ||
      addr.suburb ||
      addr.county ||
      addr.state ||
      "Your Location";

    fetchWeather(city, lat, lon);
  } catch (err) {
    console.error("Reverse geocoding error", err);
    weatherResult.innerHTML +=
      `<p style="color:orange;">⚠️ Couldn’t resolve place name; showing by coords.</p>`;
    fetchWeather("Your Location", lat, lon);
  }
}

function onGeoError(err) {
  console.warn(`Geolocation error (${err.code}): ${err.message}`);
  let msg;
  switch(err.code) {
    case err.PERMISSION_DENIED:
      msg = "Permission denied. Please allow location access.";
      break;
    case err.POSITION_UNAVAILABLE:
      msg = "Position unavailable.";
      break;
    case err.TIMEOUT:
      msg = "Geolocation timed out.";
      break;
    default:
      msg = "Unknown geolocation error.";
  }
  weatherResult.innerHTML = `<p style="color:red;">❌ ${msg}</p>`;
}

// --- History Management ---
function saveToHistory(city) {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  if (!history.includes(city)) {
    history.push(city);
    localStorage.setItem("weatherHistory", JSON.stringify(history));
  }
}

function displayHistory() {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  historyList.innerHTML = "";
  history.slice().reverse().forEach((city) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = city;
    span.style.cursor = "pointer";
    span.onclick = () => fetchWeather(city);

    const del = document.createElement("button");
    del.textContent = "❌";
    del.onclick = (e) => {
      e.stopPropagation();
      const updated = history.filter((c) => c !== city);
      localStorage.setItem("weatherHistory", JSON.stringify(updated));
      displayHistory();
    };

    li.appendChild(span);
    li.appendChild(del);
    historyList.appendChild(li);
  });
}

// --- Weather Fetching ---
async function fetchWeather(city, lat = null, lon = null) {
  weatherResult.innerHTML = "⏳ Loading weather…";
  const mode = modeSelect.value;

  try {
    // Geocode if needed
    if (lat == null || lon == null) {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=bd`
      );
      const geoData = await geoRes.json();
      if (!geoData.length) {
        weatherResult.innerHTML = `<p style="color:red;">❌ Location not found.</p>`;
        return;
      }
      lat = geoData[0].lat;
      lon = geoData[0].lon;
    }

    // Live weather
    if (mode === "live") {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current_weather=true` +
          `&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min` +
          `&timezone=auto`
      );
      const data = await res.json();
      const cur = data.current_weather;
      const d = data.daily;
      const humidity = (
        (d.relative_humidity_2m_max[0] + d.relative_humidity_2m_min[0]) /
        2
      ).toFixed(1);

      weatherResult.innerHTML = `
        <h3>📍 ${city}</h3>
        <p>🌡 Current: ${cur.temperature} °C</p>
        <p>🌡 Max Today: ${d.temperature_2m_max[0]} °C</p>
        <p>🌡 Min Today: ${d.temperature_2m_min[0]} °C</p>
        <p>🌡 Feels Like Max: ${d.apparent_temperature_max[0]} °C</p>
        <p>🌡 Feels Like Min: ${d.apparent_temperature_min[0]} °C</p>
        <p>💧 Humidity: ${humidity} %</p>
        <p>💨 Wind: ${cur.windspeed} km/h</p>
        <p>📍 [${lat.toFixed(4)}, ${lon.toFixed(4)}]</p>
      `;
    } else {
      // Past/Future 7 days
      const today = new Date();
      let startDate, endDate;
      if (mode === "past") {
        startDate = new Date(today.setDate(today.getDate() - 7))
          .toISOString()
          .split("T")[0];
        endDate = new Date().toISOString().split("T")[0];
      } else {
        startDate = new Date().toISOString().split("T")[0];
        endDate = new Date(today.setDate(today.getDate() + 7))
          .toISOString()
          .split("T")[0];
      }

      const apiUrl =
        mode === "past"
          ? "https://archive-api.open-meteo.com/v1/archive"
          : "https://api.open-meteo.com/v1/forecast";

      const res = await fetch(
        `${apiUrl}?latitude=${lat}&longitude=${lon}` +
          `&start_date=${startDate}&end_date=${endDate}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min` +
          `&hourly=windspeed_10m` +
          `&timezone=auto`
      );
      const data = await res.json();
      const d = data.daily;
      const h = data.hourly;

      function getMinWind(date) {
        const speeds = h.time
          .map((t, i) => (t.startsWith(date) ? h.windspeed_10m[i] : null))
          .filter((v) => v != null);
        return speeds.length ? Math.min(...speeds).toFixed(1) : "-";
      }

      let html = `<h3>📍 ${city} — ${
        mode === "past" ? "Past 7 Days" : "Next 7 Days"
      }</h3><table><tr>
        <th>Date</th><th>Max °C</th><th>Min °C</th><th>Feels Max</th><th>Feels Min</th><th>Hum %</th><th>Rain mm</th><th>Wind Max</th><th>Wind Min</th>
      </tr>`;
      for (let i = 0; i < d.time.length; i++) {
        const hum = ((d.relative_humidity_2m_max[i] + d.relative_humidity_2m_min[i]) / 2).toFixed(1);
        html += `<tr>
          <td>${d.time[i]}</td>
          <td>${d.temperature_2m_max[i]}</td>
          <td>${d.temperature_2m_min[i]}</td>
          <td>${d.apparent_temperature_max[i]}</td>
          <td>${d.apparent_temperature_min[i]}</td>
          <td>${hum}</td>
          <td>${d.precipitation_sum[i]}</td>
          <td>${d.windspeed_10m_max[i]}</td>
          <td>${getMinWind(d.time[i])}</td>
        </tr>`;
      }
      html += "</table>";
      weatherResult.innerHTML = html;
    }
  } catch (error) {
    console.error(error);
    weatherResult.innerHTML = `<p style="color:red;">❌ Error fetching weather.</p>`;
  }
}

// Initialize history on load
displayHistory();
