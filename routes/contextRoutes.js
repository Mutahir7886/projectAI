const express = require("express");
const toolRouter = express.Router();
const { askContextBasedAgent } = require("../controllers/contextBasedController");

toolRouter.post("/ask", askContextBasedAgent);

module.exports = toolRouter;
