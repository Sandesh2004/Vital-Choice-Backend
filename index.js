const express = require('express');
const cors = require('cors');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// IMPORTANT middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "5mb" }));

// ROOT ROUTE (CRITICAL)
app.get("/", (req, res) => {
  res.status(200).send("VitalChoice is live");
});

app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/music', express.static('music'));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
