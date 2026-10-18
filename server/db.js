// db.js
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',      // Usuario por defecto en XAMPP
  password: '12345678',      // Contraseña por defecto en XAMPP (vacía)
  database: 'huellap_web',
  port: 3306
});

module.exports = pool.promise();