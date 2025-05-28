const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
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

async function fetchWeather(city) {
  weatherResult.innerHTML = "Loading...";
  const mode = modeSelect.value;

  try {
    // Get coordinates
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(
        city
      )}&format=json`
    );
    const geoData = await geoRes.json();

    if (!geoData.length) {
      weatherResult.innerHTML = `<p style="color:red;">❌ City not found.</p>`;
      return;
    }

    const lat = geoData[0].lat;
    const lon = geoData[0].lon;

    if (mode === "live") {
      // Live current weather + daily for max, min, humidity, feels_like
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

      // Current humidity approximation: average of daily max/min humidity
      let humidity = "-";
      if (daily.relative_humidity_2m_max && daily.relative_humidity_2m_min) {
        humidity = (
          (daily.relative_humidity_2m_max[0] +
            daily.relative_humidity_2m_min[0]) /
          2
        ).toFixed(1);
      }

      weatherResult.innerHTML = `
        <h3>📍 ${city}</h3>
        <p>🌡 Current Temperature: ${current.temperature} °C</p>
        <p>🌡 Max Temperature (Today): ${daily.temperature_2m_max[0]} °C</p>
        <p>🌡 Min Temperature (Today): ${daily.temperature_2m_min[0]} °C</p>
        <p>🌡 Feels Like Max (Today): ${daily.apparent_temperature_max[0]} °C</p>
        <p>🌡 Feels Like Min (Today): ${daily.apparent_temperature_min[0]} °C</p>
        <p>💨 Wind Speed: ${current.windspeed} km/h</p>
        <p>💧 Humidity: ${humidity} %</p>
        <p>🌍 Latitude: ${lat}, Longitude: ${lon}</p>
      `;
    } else {
      // Past or future 7 days with wind min/max, temps, precip, humidity, feels like

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

      const apiUrl =
        mode === "past"
          ? "https://archive-api.open-meteo.com/v1/archive"
          : "https://api.open-meteo.com/v1/forecast";

      const res = await fetch(
        `${apiUrl}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min` +
          `&hourly=windspeed_10m&timezone=auto`
      );
      const data = await res.json();

      if (!data || !data.daily) {
        weatherResult.innerHTML = `<p style="color:red;">❌ Weather data unavailable.</p>`;
        return;
      }

      const daily = data.daily;

      let tableHtml = `
        <h3>📍 ${city} — ${mode === "past" ? "Past 7 Days" : "Next 7 Days"}</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Max Temp (°C)</th>
              <th>Min Temp (°C)</th>
              <th>Feels Like Max (°C)</th>
              <th>Feels Like Min (°C)</th>
              <th>Precipitation (mm)</th>
              <th>Max Wind Speed (km/h)</th>
              <th>Humidity (%)</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (let i = 0; i < daily.time.length; i++) {
        const date = daily.time[i];
        const maxTemp = daily.temperature_2m_max[i];
        const minTemp = daily.temperature_2m_min[i];
        const feelsMax = daily.apparent_temperature_max[i];
        const feelsMin = daily.apparent_temperature_min[i];
        const precip = daily.precipitation_sum[i];
        const windMax = daily.windspeed_10m_max[i];
        const humidity = (
          (daily.relative_humidity_2m_max[i] + daily.relative_humidity_2m_min[i]) /
          2
        ).toFixed(1);

        tableHtml += `
          <tr>
            <td>${date}</td>
            <td>${maxTemp}</td>
            <td>${minTemp}</td>
            <td>${feelsMax}</td>
            <td>${feelsMin}</td>
            <td>${precip}</td>
            <td>${windMax}</td>
            <td>${humidity}</td>
          </tr>
        `;
      }

      tableHtml += "</tbody></table>";

      weatherResult.innerHTML = tableHtml;
    }
  } catch (error) {
    console.error(error);
    weatherResult.innerHTML = `<p style="color:red;">❌ Unable to fetch weather. Try again later.</p>`;
  }
}

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

  // Show latest first
  history.slice().reverse().forEach((city) => {
    const li = document.createElement("li");
    li.textContent = city;

    // Click city to fetch weather
    li.onclick = () => {
      cityInput.value = city;
      fetchWeather(city);
    };

    // Add delete button for each history item
    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.className = "delete-btn";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryItem(city);
    };

    li.appendChild(delBtn);
    historyList.appendChild(li);
  });
}

function deleteHistoryItem(city) {
  let history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  history = history.filter((item) => item !== city);
  localStorage.setItem("weatherHistory", JSON.stringify(history));
  displayHistory();
}

window.onload = displayHistory;
