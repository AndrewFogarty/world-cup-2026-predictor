/* =================================================================
   Live match-day weather (Open-Meteo — free, no API key).
   Resolves each host city to coordinates, fetches the daily forecast
   in °F, and exposes a tiny API the schedule strip uses to show a
   weather emoji + high temperature for each upcoming match.
   ================================================================= */
(function () {
  "use strict";

  /* Fixed coordinates for the 16 WC 2026 host cities. Keyed by the
     "City, COUNTRY" string that appears in each venue (the part in
     parentheses), so lookups are exact and never ambiguous. */
  const CITY_COORDS = {
    "Atlanta, USA": [33.755, -84.401],
    "Boston, USA": [42.091, -71.264], // Gillette Stadium, Foxborough
    "Dallas, USA": [32.748, -97.093], // AT&T Stadium, Arlington
    "Houston, USA": [29.685, -95.411],
    "Kansas City, USA": [39.049, -94.484],
    "Los Angeles, USA": [33.953, -118.339], // SoFi Stadium, Inglewood
    "Miami, USA": [25.958, -80.239], // Hard Rock Stadium
    "New York/New Jersey, USA": [40.814, -74.074], // MetLife Stadium
    "Philadelphia, USA": [39.901, -75.168],
    "San Francisco Bay Area, USA": [37.403, -121.97], // Levi's Stadium, Santa Clara
    "Seattle, USA": [47.595, -122.332],
    "Guadalajara, MEX": [20.681, -103.463],
    "Mexico City, MEX": [19.303, -99.15], // Estadio Azteca
    "Monterrey, MEX": [25.669, -100.244],
    "Toronto, CAN": [43.633, -79.418],
    "Vancouver, CAN": [49.277, -123.112],
  };

  /* WMO weather code -> { emoji, label } */
  function describe(code) {
    if (code === 0) return { emoji: "☀️", label: "Clear" };
    if (code === 1) return { emoji: "🌤️", label: "Mainly clear" };
    if (code === 2) return { emoji: "⛅", label: "Partly cloudy" };
    if (code === 3) return { emoji: "☁️", label: "Overcast" };
    if (code === 45 || code === 48) return { emoji: "🌫️", label: "Fog" };
    if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Drizzle" };
    if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "Rain" };
    if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "Snow" };
    if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "Rain showers" };
    if (code === 85 || code === 86) return { emoji: "🌨️", label: "Snow showers" };
    if (code >= 95) return { emoji: "⛈️", label: "Thunderstorm" };
    return { emoji: "🌡️", label: "" };
  }

  /* "Estadio Azteca (Mexico City, MEX)" -> "Mexico City, MEX" */
  function cityFromVenue(venue) {
    const m = /\(([^)]+)\)\s*$/.exec(venue || "");
    return m ? m[1].trim() : null;
  }

  /* In-flight / completed fetches per city. Each resolves to a map of
     { "YYYY-MM-DD": { code, tmax } } so dates index in O(1). */
  const cache = new Map();

  function fetchCity(city, startDate, endDate) {
    if (cache.has(city)) return cache.get(city);
    const coords = CITY_COORDS[city];
    if (!coords) {
      const empty = Promise.resolve(null);
      cache.set(city, empty);
      return empty;
    }
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${coords[0]}&longitude=${coords[1]}` +
      "&daily=weather_code,temperature_2m_max" +
      "&temperature_unit=fahrenheit&timezone=auto" +
      `&start_date=${startDate}&end_date=${endDate}`;
    const p = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = j && j.daily;
        if (!d || !d.time) return null;
        const byDate = {};
        d.time.forEach((day, i) => {
          byDate[day] = { code: d.weather_code[i], tmax: d.temperature_2m_max[i] };
        });
        return byDate;
      })
      .catch(() => null);
    cache.set(city, p);
    return p;
  }

  /* Open-Meteo's free daily forecast reaches ~16 days ahead. */
  function withinForecastWindow(date) {
    const ms = new Date(date + "T00:00:00").getTime() - Date.now();
    return ms <= 16 * 864e5 && ms >= -864e5; // up to 16 days out, or today
  }

  /* Fill every element matching `selector` that carries data-city +
     data-date with an emoji and °F high. No-ops outside the window. */
  function fill(selector) {
    const els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return;

    // Group requested dates per city so each city is fetched once over
    // the full span of dates it needs.
    const spans = {}; // city -> [minDate, maxDate]
    els.forEach((el) => {
      const city = el.dataset.city;
      const date = el.dataset.date;
      if (!city || !date || !CITY_COORDS[city] || !withinForecastWindow(date)) return;
      const s = spans[city] || [date, date];
      if (date < s[0]) s[0] = date;
      if (date > s[1]) s[1] = date;
      spans[city] = s;
    });

    Object.keys(spans).forEach((city) => {
      const [start, end] = spans[city];
      fetchCity(city, start, end).then((byDate) => {
        if (!byDate) return;
        els
          .filter((el) => el.dataset.city === city)
          .forEach((el) => {
            const w = byDate[el.dataset.date];
            if (!w || w.tmax == null) return;
            const info = describe(w.code);
            el.innerHTML =
              `<span class="wx-emoji">${info.emoji}</span>` +
              `<span class="wx-temp">${Math.round(w.tmax)}°F</span>`;
            el.title = `${info.label}${info.label ? " · " : ""}high ${Math.round(w.tmax)}°F (Open-Meteo)`;
          });
      });
    });
  }

  window.WCWeather = { cityFromVenue, describe, fill };
})();
