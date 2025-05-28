// script.js

const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const liveLocationBtn = document.getElementById("liveLocationBtn");
const modeSelect = document.getElementById("modeSelect");

// Search by city/upazila
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

// Clear all history
clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem("weatherHistory");
  displayHistory();
  weatherResult.innerHTML = "";
});

// Use browser geolocation
liveLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  weatherResult.innerHTML = "Detecting your location…";
  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    try {
      // Reverse geocode to get a place name
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
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
        addr.state_district ||
        addr.state ||
        "Unknown Location";

      if (city === "Unknown Location") {
        alert("Could not detect a named place—showing weather by coords.");
      }

      fetchWeather(city, lat, lon);
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
      weatherResult.innerHTML = `<p style="color:red;">❌ Failed to determine your place name.</p>`;
      // still try fetch by coords:
      fetchWeather("Your Location", lat, lon);
    }
  }, () => {
    weatherResult.innerHTML = `<p style="color:red;">❌ Location access denied.</p>`;
  });
});

// Save to localStorage history
function saveToHistory(city) {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  if (!history.includes(city)) {
    history.push(city);
    localStorage.setItem("weatherHistory", JSON.stringify(history));
  }
}

// Render history list
function displayHistory() {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  historyList.innerHTML = "";
  history.slice().reverse().forEach((city) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = city;
    span.onclick = () => {
      fetchWeather(city);
    };
    const del = document.createElement("button");
    del.textContent = "❌";
    del.onclick = () => {
      const updated = history.filter((c) => c !== city);
      localStorage.setItem("weatherHistory", JSON.stringify(updated));
      displayHistory();
    };
    li.appendChild(span);
    li.appendChild(del);
    historyList.appendChild(li);
  });
}

// Main fetch function
async function fetchWeather(city, lat = null, lon = null) {
  weatherResult.innerHTML = "Loading…";
  const mode = modeSelect.value;

  try {
    // If coords not passed, geocode by name
    if (lat == null || lon == null) {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          city
        )}&countrycodes=bd,us,gb&format=json&limit=1`
      );
      const geoData = await geoRes.json();
      if (!geoData.length) {
        weatherResult.innerHTML = `<p style="color:red;">❌ Location not found.</p>`;
        return;
      }
      lat = geoData[0].lat;
      lon = geoData[0].lon;
    }

    if (mode === "live") {
      // Live weather + daily summary
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current_weather=true&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min&timezone=auto`
      );
      const data = await res.json();
      const current = data.current_weather;
      const daily = data.daily;
      const humidity = (
        (daily.relative_humidity_2m_max[0] + daily.relative_humidity_2m_min[0]) /
        2
      ).toFixed(1);

      weatherResult.innerHTML = `
        <h3>📍 ${city}</h3>
        <p>🌡 Current: ${current.temperature} °C</p>
        <p>🌡 Max Today: ${daily.temperature_2m_max[0]} °C</p>
        <p>🌡 Min Today: ${daily.temperature_2m_min[0]} °C</p>
        <p>🌡 Feels Like Max: ${daily.apparent_temperature_max[0]} °C</p>
        <p>🌡 Feels Like Min: ${daily.apparent_temperature_min[0]} °C</p>
        <p>💧 Humidity: ${humidity} %</p>
        <p>💨 Wind Speed: ${current.windspeed} km/h</p>
        <p>📍 Lat: ${parseFloat(lat).toFixed(4)}, Lon: ${parseFloat(lon).toFixed(4)}</p>
      `;
    } else {
      // Past or future 7-day forecast
      const today = new Date();
      let startDate, endDate;
      if (mode === "past") {
        const past = new Date(today);
        past.setDate(today.getDate() - 7);
        startDate = past.toISOString().split("T")[0];
        endDate = today.toISOString().split("T")[0];
      } else {
        startDate = today.toISOString().split("T")[0];
        const fut = new Date(today);
        fut.setDate(today.getDate() + 7);
        endDate = fut.toISOString().split("T")[0];
      }

      const apiUrl =
        mode === "past"
          ? "https://archive-api.open-meteo.com/v1/archive"
          : "https://api.open-meteo.com/v1/forecast";

      const res = await fetch(
        `${apiUrl}?latitude=${lat}&longitude=${lon}` +
          `&start_date=${startDate}&end_date=${endDate}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min` +
          `&hourly=windspeed_10m&timezone=auto`
      );
      const data = await res.json();
      const daily = data.daily;
      const hourly = data.hourly;

      // Helper to get min wind
      function getMinWind(dateStr) {
        const speeds = hourly.time
          .map((t, i) => (t.startsWith(dateStr) ? hourly.windspeed_10m[i] : null))
          .filter((v) => v != null);
        return speeds.length ? Math.min(...speeds).toFixed(1) : "-";
      }

      let html = `<h3>📍 ${city} — ${mode === "past" ? "Past" : "Next"} 7 Days</h3><table>`;
      html += `<tr>
        <th>Date</th><th>Max °C</th><th>Min °C</th><th>Feels Max</th><th>Feels Min</th><th>Hum %</th><th>Rain mm</th><th>Wind Max</th><th>Wind Min</th>
      </tr>`;

      for (let i = 0; i < daily.time.length; i++) {
        const hum = (
          (daily.relative_humidity_2m_max[i] + daily.relative_humidity_2m_min[i]) /
          2
        ).toFixed(1);
        html += `<tr>
          <td>${daily.time[i]}</td>
          <td>${daily.temperature_2m_max[i]}</td>
          <td>${daily.temperature_2m_min[i]}</td>
          <td>${daily.apparent_temperature_max[i]}</td>
          <td>${daily.apparent_temperature_min[i]}</td>
          <td>${hum}</td>
          <td>${daily.precipitation_sum[i]}</td>
          <td>${daily.windspeed_10m_max[i]}</td>
          <td>${getMinWind(daily.time[i])}</td>
        </tr>`;
      }
      html += "</table>";
      weatherResult.innerHTML = html;
    }
  } catch (err) {
    console.error(err);
    weatherResult.innerHTML = `<p style="color:red;">❌ Unable to fetch weather data.</p>`;
  }
}

// Load history on startup
displayHistory();
