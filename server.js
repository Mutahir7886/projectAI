const express = require("express");
const toolRoutes = require("./routes/toolRoutes");
require("dotenv").config();

const app = express();

app.use(express.json());
// app.use("/api", router); // data based 
app.use("/api", toolRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
