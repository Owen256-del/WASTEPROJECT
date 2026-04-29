const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data.json");

app.use(
  cors({
    origin: "https://smartecowaste.netlify.app",
  }),
);
app.use(express.json());
// app.use(express.static(path.join(__dirname, "../public")));

/**
 * Helper: Read data
 */
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

/**
 * Helper: Write data
 */
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * GET all bins
 */
app.get("/bins", (req, res) => {
  const bins = readData();
  res.json(bins);
});

/**
 * GET single bin
 */
app.get("/bins/:id", (req, res) => {
  const bins = readData();
  const bin = bins.find((b) => b.id === parseInt(req.params.id));

  if (!bin) {
    return res.status(404).json({ message: "Bin not found" });
  }

  res.json(bin);
});

/**
 * UPDATE bin level
 */
app.put("/bins/:id", (req, res) => {
  const bins = readData();
  const id = parseInt(req.params.id);

  const updatedBins = bins.map((bin) =>
    bin.id === id ? { ...bin, level: req.body.level } : bin,
  );

  writeData(updatedBins);

  res.json({
    message: "Bin updated successfully",
    updated: updatedBins.find((b) => b.id === id),
  });
});

/**
 * ADD new bin (optional but good for presentation)
 */
app.post("/bins", (req, res) => {
  const bins = readData();

  const newBin = {
    id: bins.length ? bins[bins.length - 1].id + 1 : 1,
    name: req.body.name,
    location: req.body.location || "Unknown",
    level: req.body.level || 0,
    capacity: req.body.capacity || 500,
    lastCollected: new Date().toISOString(),
    status:
      req.body.level > 80
        ? "critical"
        : req.body.level > 50
          ? "warning"
          : "normal",
  };

  bins.push(newBin);
  writeData(bins);

  res.status(201).json(newBin);
});

/**
 * DELETE bin (optional)
 */
app.delete("/bins/:id", (req, res) => {
  const bins = readData();
  const id = parseInt(req.params.id);

  const filtered = bins.filter((bin) => bin.id !== id);

  writeData(filtered);

  res.json({ message: "Bin deleted successfully" });
});

/**
 * GET statistics summary
 */
app.get("/stats", (req, res) => {
  const bins = readData();

  const total = bins.length;
  const critical = bins.filter((b) => b.status === "critical").length;
  const warning = bins.filter((b) => b.status === "warning").length;
  const normal = bins.filter((b) => b.status === "normal").length;
  const avgLevel = Math.round(
    bins.reduce((sum, b) => sum + b.level, 0) / total,
  );
  const totalCapacity = bins.reduce((sum, b) => sum + b.capacity, 0);
  const usedCapacity = bins.reduce(
    (sum, b) => sum + (b.level / 100) * b.capacity,
    0,
  );

  res.json({
    totalBins: total,
    critical,
    warning,
    normal,
    averageFillLevel: avgLevel,
    totalCapacity,
    usedCapacity: Math.round(usedCapacity),
    utilizationPercent: Math.round((usedCapacity / totalCapacity) * 100),
  });
});

/**
 * GET bins by status
 */
app.get("/bins/status/:status", (req, res) => {
  const bins = readData();
  const status = req.params.status.toLowerCase();

  const filtered = bins.filter((b) => b.status === status);
  res.json(filtered);
});

/**
 * GET analytics data
 */
app.get("/analytics", (req, res) => {
  const bins = readData();

  // Group by status
  const byStatus = {
    critical: bins.filter((b) => b.status === "critical"),
    warning: bins.filter((b) => b.status === "warning"),
    normal: bins.filter((b) => b.status === "normal"),
  };

  // Top 5 fullest bins
  const topFull = [...bins].sort((a, b) => b.level - a.level).slice(0, 5);

  // Recently collected (last 24 hours)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const recent = bins.filter((b) => new Date(b.lastCollected) > yesterday);

  res.json({
    byStatus: {
      critical: byStatus.critical.length,
      warning: byStatus.warning.length,
      normal: byStatus.normal.length,
    },
    topFullestBins: topFull,
    recentlyCollected: recent.length,
    collectionRate: Math.round((recent.length / bins.length) * 100),
  });
});

/**
 * START SERVER
 */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
