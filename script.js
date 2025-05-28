const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const modeSelect = document.getElementById("modeSelect");
const myLocationBtn = document.getElementById("myLocationBtn");
const suggestions = document.getElementById("suggestions");

const OPENWEATHER_API_KEY = 'ed95aef3b8434dcd80f1a19a9fad96d8';

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim().toUpperCase();
  if (city) {
    fetchWeather(city);
    saveToHistory(city);
    displayHistory();
    cityInput.value = "";
    suggestions.innerHTML = "";
  }
});

cityInput.addEventListener("input", async () => {
  const query = cityInput.value.trim();
  if (query.length < 2) return;

  try {
    const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${OPENWEATHER_API_KEY}`);
    const data = await res.json();
    suggestions.innerHTML = "";

    data.forEach(place => {
      const option = document.createElement("option");
      option.value = `${place.name}${place.state ? ', ' + place.state : ''}, ${place.country}`;
      suggestions.appendChild(option);
    });
  } catch (err) {
    console.error("Auto-suggest failed:", err);
  }
});

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem("weatherHistory");
  displayHistory();
  weatherResult.innerHTML = "";
});

myLocationBtn.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const locationData = await geo.json();
        const city = locationData.address.city || locationData.address.town || locationData.address.village || locationData.name || "Your Location";
        fetchWeather(city, lat, lon);
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      }
    });
  } else {
    alert("Geolocation not supported by this browser.");
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
  let history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  historyList.innerHTML = "";
  history.slice().reverse().forEach((city) => {
    const li = document.createElement("li");
    li.textContent = city;
    li.onclick = () => {
      cityInput.value = city;
      fetchWeather(city);
    };
    historyList.appendChild(li);
  });
}

window.onload = displayHistory;

async function fetchWeather(city, latOverride = null, lonOverride = null) {
  weatherResult.innerHTML = "Loading...";
  const mode = modeSelect.value;

  try {
    let lat = latOverride;
    let lon = lonOverride;

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
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min&timezone=auto`);
      const data = await res.json();
      const current = data.current_weather;
      const daily = data.daily;

      let humidity = "-";
      if (daily.relative_humidity_2m_max && daily.relative_humidity_2m_min) {
        humidity = ((daily.relative_humidity_2m_max[0] + daily.relative_humidity_2m_min[0]) / 2).toFixed(1);
      }

      weatherResult.innerHTML = `
        <h3>📍 ${city.toUpperCase()}</h3>
        <p>🌡 Current Temp: ${current.temperature} °C</p>
        <p>🌡 Max Temp (Today): ${daily.temperature_2m_max[0]} °C</p>
        <p>🌡 Min Temp (Today): ${daily.temperature_2m_min[0]} °C</p>
        <p>🌡 Feels Like Max: ${daily.apparent_temperature_max[0]} °C</p>
        <p>🌡 Feels Like Min: ${daily.apparent_temperature_min[0]} °C</p>
        <p>💧 Humidity: ${humidity}%</p>
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

      const apiUrl = mode === "past" ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
      const res = await fetch(`${apiUrl}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min` +
        `&hourly=windspeed_10m&timezone=auto`);
      const data = await res.json();

      if (!data.daily || !data.hourly) {
        weatherResult.innerHTML = `<p style="color:red;">❌ Weather data unavailable.</p>`;
        return;
      }

      const dailyTimes = data.daily.time;
      const hourlyTimes = data.hourly.time;
      const hourlyWindspeed = data.hourly.windspeed_10m;

      function getDailyMinWindSpeed(dateStr) {
        const windSpeeds = [];
        for (let i = 0; i < hourlyTimes.length; i++) {
          if (hourlyTimes[i].startsWith(dateStr)) {
            windSpeeds.push(hourlyWindspeed[i]);
          }
        }
        return windSpeeds.length ? Math.min(...windSpeeds).toFixed(1) : "-";
      }

      let html = `<h3>📍 ${city.toUpperCase()} (${mode === "past" ? "Past" : "Next"} 7 Days)</h3><table>`;
      html += `<tr><th>Date</th><th>Max Temp (°C)</th><th>Min Temp (°C)</th><th>Feels Max</th><th>Feels Min</th><th>Humidity Max</th><th>Humidity Min</th><th>Precip (mm)</th><th>Wind Max</th><th>Wind Min</th></tr>`;

      for (let i = 0; i < dailyTimes.length; i++) {
        html += `<tr>
          <td>${dailyTimes[i]}</td>
          <td>${data.daily.temperature_2m_max[i]}</td>
          <td>${data.daily.temperature_2m_min[i]}</td>
          <td>${data.daily.apparent_temperature_max[i]}</td>
          <td>${data.daily.apparent_temperature_min[i]}</td>
          <td>${data.daily.relative_humidity_2m_max[i]}</td>
          <td>${data.daily.relative_humidity_2m_min[i]}</td>
          <td>${data.daily.precipitation_sum[i]}</td>
          <td>${data.daily.windspeed_10m_max[i]}</td>
          <td>${getDailyMinWindSpeed(dailyTimes[i])}</td>
        </tr>`;
      }

      html += `</table>`;
      weatherResult.innerHTML = html;
    }
  } catch (error) {
    console.error(error);
    weatherResult.innerHTML = `<p style="color:red;">❌ Unable to fetch weather. Try again later.</p>`;
  }
}
