import express from 'express';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import dotenv from 'dotenv';


dotenv.config();
const app = express();
const port = 3000;

const pool = new Pool({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.AFYA_TECH,
  password: process.env.PASSWORD,
  port: process.env.PORT_DB,
});


// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Get all patients
app.get('/patients', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM patients');
    res.render('patients', { patients: rows });
  } catch (err) {
    console.error(err);
    res.send("Error fetching patients");
  }
});

// Add a new patient
app.post('/patients', async (req, res) => {
  const { name, age, gender, diagnosis, treatment } = req.body;
  try {
    await pool.query(
      'INSERT INTO patients(name, age, gender, diagnosis, treatment) VALUES($1, $2, $3, $4, $5)',
      [name, age, gender, diagnosis, treatment]
    );
    res.redirect('/patients');
  } catch (err) {
    console.error(err);
    res.send("Error adding patient");
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
