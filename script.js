const form = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const weatherResult = document.getElementById("weatherResult");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const modeSelect = document.getElementById("modeSelect");
const myLocationBtn = document.getElementById("myLocationBtn");

// OpenCage API Key (replace with your own)
const OPENCAGE_API_KEY = 'YOUR_OPENCAGE_API_KEY';

// Auto-suggest using OpenCage API
const suggestBox = document.createElement("ul");
suggestBox.id = "suggestBox";
suggestBox.style.position = "absolute";
suggestBox.style.zIndex = "1000";
suggestBox.style.background = "#fff";
suggestBox.style.border = "1px solid #ccc";
suggestBox.style.listStyle = "none";
suggestBox.style.padding = "0";
suggestBox.style.marginTop = "2px";
suggestBox.style.width = cityInput.offsetWidth + "px";
cityInput.parentNode.insertBefore(suggestBox, cityInput.nextSibling);

cityInput.addEventListener("input", async () => {
  const query = cityInput.value.trim();
  suggestBox.innerHTML = "";
  if (query.length < 2) return;

  try {
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=5&language=en`);
    const data = await res.json();

    data.results.forEach(item => {
      const name = item.formatted;
      const li = document.createElement("li");
      li.textContent = name;
      li.style.padding = "6px";
      li.style.cursor = "pointer";
      li.addEventListener("click", () => {
        cityInput.value = name;
        suggestBox.innerHTML = "";
      });
      suggestBox.appendChild(li);
    });
  } catch (e) {
    console.error("Autocomplete error:", e);
  }
});

document.addEventListener("click", (e) => {
  if (!suggestBox.contains(e.target) && e.target !== cityInput) {
    suggestBox.innerHTML = "";
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim().toUpperCase();
  if (city) {
    fetchWeatherByCity(city);
    saveToHistory(city);
    displayHistory();
    cityInput.value = "";
    suggestBox.innerHTML = "";
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
        const geoRes = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_API_KEY}`);
        const geoData = await geoRes.json();

        if (geoData.results.length > 0) {
          const fullName = geoData.results[0].formatted;
          fetchWeatherByCoords(lat, lon, fullName.toUpperCase());
        } else {
          fetchWeatherByCoords(lat, lon, "YOUR LOCATION");
        }
      } catch (err) {
        console.error(err);
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
    weatherResult.innerHTML = `<p style="color:red;">❌ Failed to fetch weather for city.</p>`;
    console.error(err);
  }
}

async function fetchWeatherByCoords(lat, lon, placeName) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await res.json();
    const weather = data.current_weather;

    weatherResult.innerHTML = `
      <h3>Weather for ${placeName}</h3>
      <p>🌡 Temperature: ${weather.temperature}°C</p>
      <p>💨 Wind: ${weather.windspeed} km/h</p>
      <p>🧭 Direction: ${weather.winddirection}°</p>
      <p>⏱ Time: ${weather.time}</p>
    `;
  } catch (err) {
    weatherResult.innerHTML = `<p style="color:red;">❌ Failed to fetch weather data.</p>`;
    console.error(err);
  }
}

// On page load
displayHistory();
