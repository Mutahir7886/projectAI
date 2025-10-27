const express = require("express");
const contextRoutes = require("./routes/contextRoutes");
const toolRoutes = require("./routes/toolRoutes");

require("dotenv").config();

const app = express();

app.use(express.json());
// app.use("/api", router); // data based 
// app.use("/api", toolRoutes); // tool based
app.use("/api", contextRoutes); // context based

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
