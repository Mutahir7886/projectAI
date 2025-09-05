const express = require("express");

const router = require("./routes/dataRoutes"); // if you’re using routes.js
// OR: const { askStock } = require("./controllers/dataController");


const app = express();
app.use(express.json());

// Using routes.js
app.use("/api", router);

// OR without routes.js:
// app.post("/api/ask", askStock);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
