import express from 'express';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

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

// Initialize OpenAI client
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Routes
app.get('/form', (req, res) => {
  res.render('index');
});

app.get('/', (req, res) => {
  res.render('home');
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
  const { name, age, gender, diagnosis, treatment, symptoms, allergies, medications, follow_up_date, impact_notes } = req.body;
  try {
    await pool.query(
      `INSERT INTO patients(
        name, age, gender, diagnosis, treatment,
        symptoms, allergies, medications, follow_up_date, impact_notes
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        name, age, gender, diagnosis, treatment,
        symptoms ? symptoms.split(',').map(s => s.trim()) : [],
        allergies ? allergies.split(',').map(a => a.trim()) : [],
        medications ? medications.split(',').map(m => m.trim()) : [],
        follow_up_date || null,
        impact_notes
      ]
    );
    res.redirect('/patients');
  } catch (err) {
    console.error(err);
    res.render('index', { error: "Error adding patient" });
  }
});

// New route: Generate patient summary and recommendations
// Render the AI page
app.get('/ai', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM patients');
    res.render('ai', { patients: rows });
  } catch (err) {
    console.error(err);
    res.send("Error fetching patients");
  }
});

// Generate report for selected patient and date range
app.post('/api/patient/report', async (req, res) => {
  try {
    const { patientId, startDate, endDate } = req.body;

    // Fetch patient records within the date range
    const { rows } = await pool.query(
      `SELECT * FROM patients
       WHERE id = $1
       AND (follow_up_date BETWEEN $2 AND $3 OR follow_up_date IS NULL)`,
      [patientId, startDate, endDate]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No records found for the selected date range" });
    }

    const patientData = rows;

    // Prompt engineering for the LLM
    const prompt = `
      You are a medical assistant. Based on the following patient historical data within the specified date range, provide:
      1. A concise summary of the patient's medical history.
      2. A potential diagnosis (if applicable).
      3. Recommendations for treatment or further action.

      Patient Data:
      ${patientData.map(record => `
        - Record Date: ${record.follow_up_date || 'N/A'}
        - Name: ${record.name}
        - Age: ${record.age}
        - Gender: ${record.gender}
        - Diagnosis: ${record.diagnosis}
        - Symptoms: ${Array.isArray(record.symptoms) ? record.symptoms.join(', ') : record.symptoms}
        - Allergies: ${Array.isArray(record.allergies) ? record.allergies.join(', ') : record.allergies}
        - Medications: ${Array.isArray(record.medications) ? record.medications.join(', ') : record.medications}
        - Impact Notes: ${record.impact_notes}
      `).join('\n')}
    `;

    // Call the LLM
    const chatCompletion = await client.chat.completions.create({
      model: "Qwen/Qwen3-Coder-480B-A35B-Instruct:together",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const response = chatCompletion.choices[0].message.content;
    res.json({ report: response });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
