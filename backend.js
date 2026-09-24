// backend.js
const express = require('express');
const cors = require('cors'); // Handles cross-origin security permissions
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CRITICAL CONFIGURATION CHANGE FOR MOBILE APP ACCESS ---
// This allows any external mobile app, emulator, or client to safely send requests
app.use(cors({
  origin: '*', // Allow access from any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed API actions
  allowedHeaders: ['Content-Type', 'Authorization'] // Allowed metadata headers
}));

app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// Helper function to safely read from our JSON database file
const readDatabase = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const fileData = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(fileData || '[]');
  } catch (error) {
    console.error('Error reading JSON file:', error);
    return [];
  }
};

// Helper function to safely write updates back to our JSON database file
const writeDatabase = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to JSON file:', error);
  }
};

// MULTER FILE STORAGE CONFIGURATION
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); 
  }
});
const upload = multer({ storage: storage });

// Ensure local uploads folder exists
if (!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads');
}

// 1. POST API ENDPOINT - Write to JSON File
app.post('/api/movies', upload.single('ticketImage'), (req, res) => {
  try {
    const { phone, email, movieName, movieDateTime } = req.body;
    const ticketImagePath = req.file ? req.file.path : null;

    if (!phone || !email || !movieName || !movieDateTime || !ticketImagePath) {
      return res.status(400).json({ message: 'All form fields and image are required.' });
    }

    const currentBookings = readDatabase();

    const newBooking = {
      id: Date.now().toString(),
      phone,
      email,
      movieName,
      movieDateTime,
      ticketImagePath,
      createdAt: new Date().toISOString()
    };

    currentBookings.push(newBooking);
    writeDatabase(currentBookings);

    console.log('Successfully recorded to database.json ✅:', newBooking);

    return res.status(200).json({ 
      message: 'Booking successfully saved to local JSON database!',
      data: newBooking
    });

  } catch (error) {
    console.error('API execution error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 2. GET API ENDPOINT - Retrieve all bookings
app.get('/api/movies', (req, res) => {
  const data = readDatabase();
  return res.status(200).json(data);
});

const PORT = 5000;
// Passing 0.0.0.0 tells Node to listen on all network interfaces (Wi-Fi, LAN, localhost)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running locally on port ${PORT} using database.json 🚀`);
  console.log(`Accessible to any mobile device on your network!`);
});
