const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const liveLocationBtn = document.getElementById("liveLocationBtn");
const modeSelect = document.getElementById("modeSelect");

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
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const geoData = await geoRes.json();
        const city = geoData.address.city || geoData.address.town || geoData.address.village || "Unknown Location";
        fetchWeather(city, lat, lon);
      } catch (error) {
        console.error("Failed to get location name:", error);
        weatherResult.innerHTML = `<p style="color:red;">❌ Failed to get your location.</p>`;
      }
    });
  } else {
    alert("Geolocation is not supported by your browser.");
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
    const span = document.createElement("span");
    span.textContent = city;
    span.onclick = () => {
      cityInput.value = city;
      fetchWeather(city);
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "❌";
    delBtn.onclick = () => {
      const updated = history.filter((item) => item !== city);
      localStorage.setItem("weatherHistory", JSON.stringify(updated));
      displayHistory();
    };
    li.appendChild(span);
    li.appendChild(delBtn);
    historyList.appendChild(li);
  });
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
      const humidity = ((daily.relative_humidity_2m_max[0] + daily.relative_humidity_2m_min[0]) / 2).toFixed(1);

      weatherResult.innerHTML = `
        <h3>📍 ${city}</h3>
        <p>🌡 Current Temp: ${current.temperature} °C</p>
        <p>🌡 Max Temp: ${daily.temperature_2m_max[0]} °C</p>
        <p>🌡 Min Temp: ${daily.temperature_2m_min[0]} °C</p>
        <p>🌡 Feels Like Max: ${daily.apparent_temperature_max[0]} °C</p>
        <p>🌡 Feels Like Min: ${daily.apparent_temperature_min[0]} °C</p>
        <p>💧 Humidity: ${humidity} %</p>
        <p>💨 Wind Speed: ${current.windspeed} km/h</p>
        <p>🌍 Latitude: ${lat}, Longitude: ${lon}</p>
      `;
    } else {
      const today = new Date();
      let startDate, endDate;

      if (mode === "past") {
        const pastStart = new Date(today);
        pastStart.setDate(today.getDate() - 7);
        startDate = pastStart.toISOString().split("T")[0];
        endDate = today.toISOString().split("T")[0];
      } else {
        startDate = today.toISOString().split("T")[0];
        const futureEnd = new Date(today);
        futureEnd.setDate(today.getDate() + 7);
        endDate = futureEnd.toISOString().split("T")[0];
      }

      const apiUrl = mode === "past"
        ? "https://archive-api.open-meteo.com/v1/archive"
        : "https://api.open-meteo.com/v1/forecast";

      const res = await fetch(
        `${apiUrl}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min&hourly=windspeed_10m&timezone=auto`
      );
      const data = await res.json();

      const dailyTimes = data.daily.time;
      const hourlyTimes = data.hourly.time;
      const hourlyWindspeed = data.hourly.windspeed_10m;

      function getDailyMinWindSpeed(dateStr) {
        const speeds = [];
        for (let i = 0; i < hourlyTimes.length; i++) {
          if (hourlyTimes[i].startsWith(dateStr)) {
            speeds.push(hourlyWindspeed[i]);
          }
        }
        return speeds.length ? Math.min(...speeds).toFixed(1) : "-";
      }

      let html = `<h3>📍 ${city} (${mode === "past" ? "Past" : "Next"} 7 Days)</h3><table>`;
      html += `<tr><th>Date</th><th>Max Temp (°C)</th><th>Min Temp (°C)</th><th>Feels Like Max</th><th>Feels Like Min</th><th>Humidity Avg (%)</th><th>Precipitation (mm)</th><th>Max Wind (km/h)</th><th>Min Wind (km/h)</th></tr>`;

      for (let i = 0; i < dailyTimes.length; i++) {
        const date = dailyTimes[i];
        const minWind = getDailyMinWindSpeed(date);
        const humidity = ((data.daily.relative_humidity_2m_max[i] + data.daily.relative_humidity_2m_min[i]) / 2).toFixed(1);
        html += `<tr>
          <td>${date}</td>
          <td>${data.daily.temperature_2m_max[i]}</td>
          <td>${data.daily.temperature_2m_min[i]}</td>
          <td>${data.daily.apparent_temperature_max[i]}</td>
          <td>${data.daily.apparent_temperature_min[i]}</td>
          <td>${humidity}</td>
          <td>${data.daily.precipitation_sum[i]}</td>
          <td>${data.daily.windspeed_10m_max[i]}</td>
          <td>${minWind}</td>
        </tr>`;
      }

      html += "</table>";
      weatherResult.innerHTML = html;
    }

  } catch (error) {
    console.error(error);
    weatherResult.innerHTML = `<p style="color:red;">❌ Unable to fetch weather. Try again later.</p>`;
  }
}

// Initialize history on load
displayHistory();
