// index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Ejemplo de ruta para obtener publicaciones o mascotas
app.get('/api/mascotas', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM mascotas');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
});