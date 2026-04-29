const API_URL = "https://wasteproject.onrender.com";
const STATS_URL = `${API_URL}/stats`;
const ANALYTICS_URL = `${API_URL}/analytics`;

let bins = [];
let chart = null;
let stats = null;
let map = null;

const container = document.getElementById("bins-container");
const statsContainer = document.getElementById("stats-container");

const showAllBtn = document.getElementById("show-all");
const urgentBtn = document.getElementById("show-urgent");
const sortBtn = document.getElementById("sort");

function getStatus(level) {
  if (level < 50) return { text: "Normal", class: "low", color: "#22c55e" };
  if (level < 80) return { text: "Warning", class: "medium", color: "#f59e0b" };
  return { text: "Critical", class: "high", color: "#ef4444" };
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchBins() {
  const res = await fetch(`${API_URL}/bins`);
  bins = await res.json();
  renderBins(bins);
  if (map) renderMap();
}

async function fetchStats() {
  try {
    const res = await fetch(STATS_URL);
    stats = await res.json();
    renderStats(stats);
  } catch (e) {
    console.error("Stats error:", e);
  }
}

function renderStats(data) {
  if (!statsContainer) return;
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${data.totalBins}</div>
      <div class="stat-label">Total Bins</div>
    </div>
    <div class="stat-card critical">
      <div class="stat-value">${data.critical}</div>
      <div class="stat-label">Critical</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-value">${data.warning}</div>
      <div class="stat-label">Warning</div>
    </div>
    <div class="stat-card normal">
      <div class="stat-value">${data.normal}</div>
      <div class="stat-label">Normal</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.averageFillLevel}%</div>
      <div class="stat-label">Avg Fill Level</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.utilizationPercent}%</div>
      <div class="stat-label">Utilization</div>
    </div>
  `;
}

function renderChart(data) {
  const ctx = document.getElementById("wasteChart");
  if (!ctx) return;

  const labels = data.map((bin) => bin.name.split(" ").slice(0, 2).join(" "));
  const levels = data.map((bin) => bin.level);
  const colors = data.map((bin) => getStatus(bin.level).color);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Fill Level (%)",
          data: levels,
          backgroundColor: colors,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

function renderPieChart(data) {
  const ctx = document.getElementById("statusChart");
  if (!ctx) return;
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Normal", "Warning", "Critical"],
      datasets: [
        {
          data: [data.normal, data.warning, data.critical],
          backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 20, usePointStyle: true },
        },
      },
    },
  });
}

function initMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  // Initialize map centered on NYC
  map = L.map("map").setView([40.758, -73.9855], 13);

  // Add OpenStreetMap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

function renderMap() {
  if (!map) return;

  // Clear existing markers
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Add markers for each bin
  bins.forEach((bin) => {
    if (bin.lat && bin.lng) {
      const status = getStatus(bin.level);
      const fillAmount = Math.round((bin.level / 100) * bin.capacity);

      const popupContent = `
        <div class="bin-popup">
          <h4>${bin.name}</h4>
          <p style="color: #64748b; font-size: 0.85rem;">📍 ${bin.location}</p>
          <div class="popup-level">
            <span>${bin.level}%</span>
            <div class="level-bar">
              <div class="level-fill" style="width: ${bin.level}%; background: ${status.color};"></div>
            </div>
          </div>
          <div class="popup-info">
            <div>Capacity: ${fillAmount}/${bin.capacity}L</div>
            <div>Last collected: ${formatDate(bin.lastCollected)}</div>
          </div>
          <span class="popup-status ${status.class}">${status.text}</span>
        </div>
      `;

      const marker = L.marker([bin.lat, bin.lng])
        .bindPopup(popupContent)
        .addTo(map);

      // Custom marker icon based on status
      const iconHtml = `
        <div style="
          background: ${status.color};
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">${bin.level}</div>
      `;

      marker.setIcon(
        L.divIcon({
          html: iconHtml,
          className: "custom-marker",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      );
    }
  });

  // Fit bounds to show all markers
  if (bins.length > 0) {
    const validBins = bins.filter((b) => b.lat && b.lng);
    if (validBins.length > 0) {
      const group = L.featureGroup(
        validBins.map((b) => L.marker([b.lat, b.lng])),
      );
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }
}

function renderBins(data) {
  container.innerHTML = "";

  data.forEach((bin) => {
    const status = getStatus(bin.level);
    const fillAmount = Math.round((bin.level / 100) * bin.capacity);

    const card = document.createElement("div");
    card.classList.add("card");
    card.style.borderLeft = `4px solid ${status.color}`;

    card.innerHTML = `
      <div class="card-header">
        <h3>${bin.name}</h3>
        <span class="badge ${status.class}" style="background:${status.color}20;color:${status.color}">${status.text}</span>
      </div>
      <p class="location">📍 ${bin.location}</p>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress ${status.class}" style="width:${bin.level}%;background:${status.color}"></div>
        </div>
        <div class="progress-labels">
          <span>${bin.level}% full</span>
          <span>${fillAmount}/${bin.capacity}L</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="last-collected">🕐 Last collected: ${formatDate(bin.lastCollected)}</span>
      </div>
      <div class="card-actions">
        <input type="number" min="0" max="100" value="${bin.level}" data-id="${bin.id}" placeholder="Update %" />
        <button class="update-btn" data-id="${bin.id}">Update</button>
      </div>
    `;

    container.appendChild(card);
  });

  attachInputEvents();
  renderChart(data);
}

function attachInputEvents() {
  const buttons = document.querySelectorAll(".update-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = +e.target.dataset.id;
      const input = e.target.previousElementSibling;
      const newLevel = +input.value;

      if (newLevel < 0 || newLevel > 100) {
        alert("Please enter a value between 0 and 100");
        return;
      }

      await fetch(`${API_URL}/bins/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: newLevel }),
      });

      fetchBins();
      fetchStats();
    });
  });
}

showAllBtn.addEventListener("click", () => renderBins(bins));
urgentBtn.addEventListener("click", () =>
  renderBins(bins.filter((b) => b.level >= 80)),
);
sortBtn.addEventListener("click", () =>
  renderBins([...bins].sort((a, b) => b.level - a.level)),
);

async function init() {
  initMap();
  await fetchBins();
  await fetchStats();
  try {
    const analyticsRes = await fetch(ANALYTICS_URL);
    const analytics = await analyticsRes.json();
    renderPieChart(analytics.byStatus);
  } catch (e) {
    console.error("Analytics error:", e);
  }
}

init();
