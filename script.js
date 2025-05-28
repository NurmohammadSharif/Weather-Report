
const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const modeSelect = document.getElementById("modeSelect");
const liveLocationBtn = document.getElementById("liveLocationBtn");
const suggestionsBox = document.getElementById("suggestions");

const GEOAPIFY_KEY = "ed95aef3b8434dcd80f1a19a9fad96d8";

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim().toUpperCase();
  if (city) {
    fetchWeather(city);
    saveToHistory(city);
    displayHistory();
    cityInput.value = "";
    suggestionsBox.innerHTML = "";
  }
});

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem("weatherHistory");
  displayHistory();
  weatherResult.innerHTML = "";
});

cityInput.addEventListener("input", async () => {
  const query = cityInput.value.trim();
  if (query.length < 2) {
    suggestionsBox.innerHTML = "";
    return;
  }
  const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${query}&limit=5&apiKey=${GEOAPIFY_KEY}`);
  const data = await response.json();

  suggestionsBox.innerHTML = "";
  if (data.features) {
    data.features.forEach((feature) => {
      const place = feature.properties.city || feature.properties.name;
      if (place) {
        const item = document.createElement("div");
        item.textContent = place.toUpperCase();
        item.classList.add("suggestion-item");
        item.onclick = () => {
          cityInput.value = place.toUpperCase();
          suggestionsBox.innerHTML = "";
        };
        suggestionsBox.appendChild(item);
      }
    });
  }
});

liveLocationBtn.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      const reverseGeo = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_KEY}`);
      const geoData = await reverseGeo.json();
      const city = geoData.features[0].properties.city || geoData.features[0].properties.name || "Unknown";

      fetchWeather(city.toUpperCase(), lat, lon);
    }, () => {
      weatherResult.innerHTML = `<p style="color:red;">❌ Failed to get your location.</p>`;
    });
  } else {
    weatherResult.innerHTML = `<p style="color:red;">❌ Geolocation is not supported.</p>`;
  }
});

function saveToHistory(city) {
  let history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  if (!history.includes(city)) {
    history.push(city);
    localStorage.setItem("weatherHistory", JSON.stringify(history));
  }
}

function displayHistory() {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  historyList.innerHTML = history.map(city => `
    <div>
      ${city}
      <button onclick="fetchWeather('${city}')">🔄</button>
      <button onclick="deleteHistoryItem('${city}')">❌</button>
    </div>
  `).join("");
}

function deleteHistoryItem(city) {
  let history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  history = history.filter(item => item !== city);
  localStorage.setItem("weatherHistory", JSON.stringify(history));
  displayHistory();
}

async function fetchWeather(city, lat = null, lon = null) {
  weatherResult.innerHTML = "Loading...";
  const mode = modeSelect.value;

  try {
    if (!lat || !lon) {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json`);
      const geoData = await geoRes.json();
      if (!geoData.length) {
        weatherResult.innerHTML = `<p style="color:red;">❌ City not found.</p>`;
        return;
      }
      lat = geoData[0].lat;
      lon = geoData[0].lon;
    }

    if (mode === "live") {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min&timezone=auto`);
      const data = await res.json();
      const current = data.current_weather;
      const daily = data.daily;

      let humidity = "-";
      if (daily.relative_humidity_2m_max && daily.relative_humidity_2m_min) {
        humidity = ((daily.relative_humidity_2m_max[0] + daily.relative_humidity_2m_min[0]) / 2).toFixed(1);
      }

      weatherResult.innerHTML = `
        <h3>📍 ${city}</h3>
        <p>🌡 Current Temp: ${current.temperature} °C</p>
        <p>🌡 Max Temp: ${daily.temperature_2m_max[0]} °C</p>
        <p>🌡 Min Temp: ${daily.temperature_2m_min[0]} °C</p>
        <p>🌡 Feels Like Max: ${daily.apparent_temperature_max[0]} °C</p>
        <p>🌡 Feels Like Min: ${daily.apparent_temperature_min[0]} °C</p>
        <p>💧 Humidity: ${humidity} %</p>
        <p>💨 Wind Speed: ${current.windspeed} km/h</p>
        <p>🌍 Lat: ${lat}, Lon: ${lon}</p>
      `;
    } else {
      const today = new Date();
      let startDate, endDate;

      if (mode === "past") {
        const past = new Date(today);
        past.setDate(today.getDate() - 7);
        startDate = past.toISOString().split("T")[0];
        endDate = today.toISOString().split("T")[0];
      } else {
        startDate = today.toISOString().split("T")[0];
        const future = new Date(today);
        future.setDate(today.getDate() + 7);
        endDate = future.toISOString().split("T")[0];
      }

      const api = mode === "past" ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
      const res = await fetch(`${api}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min&hourly=windspeed_10m&timezone=auto`);
      const data = await res.json();

      const daily = data.daily;
      const hourlyTimes = data.hourly.time;
      const hourlyWind = data.hourly.windspeed_10m;

      function getMinWind(date) {
        const winds = hourlyTimes.reduce((arr, time, i) => {
          if (time.startsWith(date)) arr.push(hourlyWind[i]);
          return arr;
        }, []);
        return winds.length ? Math.min(...winds).toFixed(1) : "-";
      }

      let html = `<h3>📍 ${city} (${mode === 'past' ? 'Past' : 'Next'} 7 Days)</h3><table>`;
      html += `<tr><th>Date</th><th>Max Temp</th><th>Min Temp</th><th>Precip.</th><th>Max Wind</th><th>Min Wind</th><th>Feels Max</th><th>Feels Min</th><th>Humidity</th></tr>`;
      for (let i = 0; i < daily.time.length; i++) {
        html += `<tr>
          <td>${daily.time[i]}</td>
          <td>${daily.temperature_2m_max[i]}</td>
          <td>${daily.temperature_2m_min[i]}</td>
          <td>${daily.precipitation_sum[i]}</td>
          <td>${daily.windspeed_10m_max[i]}</td>
          <td>${getMinWind(daily.time[i])}</td>
          <td>${daily.apparent_temperature_max[i]}</td>
          <td>${daily.apparent_temperature_min[i]}</td>
          <td>${((daily.relative_humidity_2m_max[i] + daily.relative_humidity_2m_min[i]) / 2).toFixed(1)}</td>
        </tr>`;
      }
      html += "</table>";
      weatherResult.innerHTML = html;
    }
  } catch (err) {
    weatherResult.innerHTML = `<p style="color:red;">❌ Error fetching weather. Please try again later.</p>`;
  }
}

