const express = require("express");
const toolRouter = express.Router();
const { askToolBasedAgent } = require("../controllers/toolBasedController");

toolRouter.post("/ask", askToolBasedAgent);

module.exports = toolRouter;
