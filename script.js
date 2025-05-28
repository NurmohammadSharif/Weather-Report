const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const modeSelect = document.getElementById("modeSelect");
const myLocationBtn = document.getElementById("myLocationBtn");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim().toUpperCase();
  if (city) {
    fetchWeatherByCity(city);
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

myLocationBtn.addEventListener("click", () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const geoData = await geoRes.json();
        const placeName = geoData.address.city || geoData.address.town || geoData.address.village || "Your Location";
        fetchWeatherByCoords(lat, lon, placeName.toUpperCase());
      } catch {
        fetchWeatherByCoords(lat, lon, "YOUR LOCATION");
      }
    }, () => {
      weatherResult.innerHTML = `<p style="color:red;">❌ Failed to get your location.</p>`;
    });
  } else {
    weatherResult.innerHTML = `<p style="color:red;">❌ Geolocation not supported in this browser.</p>`;
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
  historyList.innerHTML = "";

  history.slice().reverse().forEach((city) => {
    const li = document.createElement("li");
    li.textContent = city;
    li.onclick = () => {
      cityInput.value = city;
      fetchWeatherByCity(city);
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "❌";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      const updated = history.filter((item) => item !== city);
      localStorage.setItem("weatherHistory", JSON.stringify(updated));
      displayHistory();
    };

    li.appendChild(delBtn);
    historyList.appendChild(li);
  });
}

async function fetchWeatherByCity(city) {
  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json`);
    const geoData = await geoRes.json();

    if (!geoData.length) {
      weatherResult.innerHTML = `<p style="color:red;">❌ City not found.</p>`;
      return;
    }

    const lat = geoData[0].lat;
    const lon = geoData[0].lon;
    fetchWeatherByCoords(lat, lon, city);
  } catch (err) {
    weatherResult.innerHTML = `<p style="color:red;">❌ Error fetching city location.</p>`;
  }
}

async function fetchWeatherByCoords(lat, lon, city) {
  weatherResult.innerHTML = "Loading...";
  const mode = modeSelect.value;

  try {
    if (mode === "live") {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min` +
        `&timezone=auto`
      );
      const weatherData = await weatherRes.json();
      const current = weatherData.current_weather;
      const daily = weatherData.daily;

      if (!current) {
        weatherResult.innerHTML = `<p style="color:red;">❌ Current weather data unavailable.</p>`;
        return;
      }

      let humidity = "-";
      if (daily.relative_humidity_2m_max && daily.relative_humidity_2m_min) {
        humidity = (
          (daily.relative_humidity_2m_max[0] + daily.relative_humidity_2m_min[0]) / 2
        ).toFixed(1);
      }

      weatherResult.innerHTML = `
        <h3>📍 ${city}</h3>
        <p>🌡 Current Temperature: ${current.temperature} °C</p>
        <p>🌡 Max Temp (Today): ${daily.temperature_2m_max[0]} °C</p>
        <p>🌡 Min Temp (Today): ${daily.temperature_2m_min[0]} °C</p>
        <p>🌡 Feels Like Max: ${daily.apparent_temperature_max[0]} °C</p>
        <p>🌡 Feels Like Min: ${daily.apparent_temperature_min[0]} °C</p>
        <p>💨 Wind Speed: ${current.windspeed} km/h</p>
        <p>💧 Humidity: ${humidity} %</p>
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
        `${apiUrl}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min` +
        `&hourly=windspeed_10m&timezone=auto`
      );

      const data = await res.json();

      if (!data.daily || !data.hourly) {
        weatherResult.innerHTML = `<p style="color:red;">❌ Weather data unavailable.</p>`;
        return;
      }

      const hourlyTimes = data.hourly.time;
      const hourlyWinds = data.hourly.windspeed_10m;

      const getMinWind = (dateStr) => {
        const speeds = [];
        for (let i = 0; i < hourlyTimes.length; i++) {
          if (hourlyTimes[i].startsWith(dateStr)) {
            speeds.push(hourlyWinds[i]);
          }
        }
        return speeds.length ? Math.min(...speeds).toFixed(1) : "-";
      };

      let html = `<h3>📍 ${city} (${mode === "past" ? "Past" : "Next"} 7 Days)</h3><table><tr>
          <th>Date</th><th>Max Temp</th><th>Min Temp</th><th>Feels Max</th><th>Feels Min</th>
          <th>Precip (mm)</th><th>Max Wind</th><th>Min Wind</th><th>Humidity Max</th><th>Humidity Min</th>
        </tr>`;

      for (let i = 0; i < data.daily.time.length; i++) {
        const d = data.daily;
        html += `<tr>
          <td>${d.time[i]}</td>
          <td>${d.temperature_2m_max[i]}</td>
          <td>${d.temperature_2m_min[i]}</td>
          <td>${d.apparent_temperature_max[i]}</td>
          <td>${d.apparent_temperature_min[i]}</td>
          <td>${d.precipitation_sum[i]}</td>
          <td>${d.windspeed_10m_max[i]}</td>
          <td>${getMinWind(d.time[i])}</td>
          <td>${d.relative_humidity_2m_max[i]}</td>
          <td>${d.relative_humidity_2m_min[i]}</td>
        </tr>`;
      }

      html += "</table>";
      weatherResult.innerHTML = html;
    }
  } catch (err) {
    console.error(err);
    weatherResult.innerHTML = `<p style="color:red;">❌ Unable to fetch weather. Try again later.</p>`;
  }
}

window.onload = displayHistory;
