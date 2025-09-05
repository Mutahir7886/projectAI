const express = require("express");
const router = express.Router();    
const { askStock } = require("../controllers/dataController");

router.post("/ask", askStock);

module.exports = router;
