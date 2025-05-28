const cityInput = document.getElementById("cityInput");
const suggestionBox = document.getElementById("suggestions");
const weatherForm = document.getElementById("weatherForm");
const weatherResult = document.getElementById("weatherResult");
const myLocationBtn = document.getElementById("myLocationBtn");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const modeSelect = document.getElementById("modeSelect");

// --- 1. Load history on page load ---
document.addEventListener("DOMContentLoaded", () => {
  loadHistory();
});

// --- 2. Handle input suggestions ---
cityInput.addEventListener("input", async () => {
  const query = cityInput.value.trim();
  if (query.length < 2) {
    suggestionBox.innerHTML = "";
    return;
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
  const data = await response.json();

  suggestionBox.innerHTML = "";

  data.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.display_name;
    li.addEventListener("click", () => {
      cityInput.value = item.display_name;
      suggestionBox.innerHTML = "";
    });
    suggestionBox.appendChild(li);
  });
});

// --- 3. Hide suggestions if click outside ---
document.addEventListener("click", (e) => {
  if (!suggestionBox.contains(e.target) && e.target !== cityInput) {
    suggestionBox.innerHTML = "";
  }
});

// --- 4. Form submission (weather search) ---
weatherForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  const mode = modeSelect.value;

  if (city) {
    getWeather(city, mode);
    addToHistory(city);
  }
});

// --- 5. Fetch weather (dummy implementation placeholder) ---
function getWeather(city, mode) {
  weatherResult.innerHTML = `<p>Fetching ${mode} weather for <strong>${city}</strong>...</p>`;
  // 🔁 Replace with real API logic for live/past/future weather
}

// --- 6. My location button ---
myLocationBtn.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await res.json();

      const locationName = data.display_name || `Lat: ${lat}, Lon: ${lon}`;
      cityInput.value = locationName;
      getWeather(locationName, modeSelect.value);
      addToHistory(locationName);
    }, () => {
      alert("Location access denied.");
    });
  } else {
    alert("Geolocation is not supported by your browser.");
  }
});

// --- 7. Search history handling ---
function addToHistory(city) {
  let history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  if (!history.includes(city)) {
    history.unshift(city);
    if (history.length > 10) history.pop();
    localStorage.setItem("weatherHistory", JSON.stringify(history));
  }
  loadHistory();
}

function loadHistory() {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  historyList.innerHTML = "";
  history.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    li.addEventListener("click", () => {
      cityInput.value = item;
      getWeather(item, modeSelect.value);
    });
    historyList.appendChild(li);
  });
}

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem("weatherHistory");
  loadHistory();
});
