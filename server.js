const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname)));

// Всегда отдаём index.html, если путь не найден
app.get("*", (req, res) => {
    const file = path.join(__dirname, req.path);

    if (file.endsWith(".html") || file.endsWith(".css") || file.endsWith(".js") || file.endsWith(".png") || file.endsWith(".jpg")) {
        res.sendFile(file);
    } else {
        res.sendFile(path.join(__dirname, "index.html"));
    }
});

app.listen(PORT, () => console.log("Frontend running on port", PORT));
