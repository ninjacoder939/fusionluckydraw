const express = require('express');
const cors = require('cors'); 
const multer = require('multer');
const path = require('path');
const { put, get } = require('@vercel/blob'); // ✅ Import Vercel Blob SDK

const app = express();

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));

app.use(express.json());

// ✅ FIX 1: Configure Multer to store uploaded files in RAM buffer (No local disk usage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ✅ Helper: Safely fetch the database array from your Vercel Blob bucket
const readDatabaseFromBlob = async () => {
  try {
    // Vercel Blob stores files at fixed token URLs. We fetch the raw content.
    // We append a cache-busting timestamp to avoid getting old static data.
    const url = `${process.env.BLOB_DATABASE_URL}?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error reading database from Blob:', error);
    return []; // Return empty array if file doesn't exist yet
  }
};

// ✅ Helper: Overwrite the database JSON file inside your Vercel Blob bucket
const writeDatabaseToBlob = async (data) => {
  try {
    const jsonBuffer = Buffer.from(JSON.stringify(data, null, 2));
    
    // Uploads and overwrites 'database.json' in your bucket root
    await put('database.json', jsonBuffer, {
      access: 'public',
      addRandomSuffix: false, // Prevents creating duplicate database files like database-xyz.json
    });
  } catch (error) {
    console.error('Error writing database to Blob:', error);
  }
};

// 1. POST API ENDPOINT - Save Ticket Image and Booking Log to Blob Storage
app.post('/api/movies', upload.single('ticketImage'), async (req, res) => {
  try {
    const { phone, email, movieName, movieDateTime } = req.body;

    // Check if the file buffer exists in memory
    if (!phone || !email || !movieName || !movieDateTime || !req.file) {
      return res.status(400).json({ message: 'All form fields and image are required.' });
    }

    // A. Upload the Ticket Image to Vercel Blob
    const uniqueImageName = `uploads/${Date.now()}-${req.file.originalname}`;
    const imageBlob = await put(uniqueImageName, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype
    });

    // B. Fetch existing logs, append new log, and update bucket
    const currentBookings = await readDatabaseFromBlob();

    const newBooking = {
      id: Date.now().toString(),
      phone,
      email,
      movieName,
      movieDateTime,
      ticketImagePath: imageBlob.url, // ✅ This is now a permanent public https:// url!
      createdAt: new Date().toISOString()
    };

    currentBookings.push(newBooking);
    await writeDatabaseToBlob(currentBookings);

    console.log('Successfully recorded to Vercel Blob database.json ✅:', newBooking);

    return res.status(200).json({ 
      message: 'Booking successfully saved to Vercel Blob store!',
      data: newBooking
    });

  } catch (error) {
    console.error('API execution error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 2. GET API ENDPOINT - Retrieve all bookings directly from Blob Storage
app.get('/api/movies', async (req, res) => {
  const data = await readDatabaseFromBlob();
  return res.status(200).json(data);
});

// 3. GET API ENDPOINT - Health
app.get('/api/health', async (req, res) => {
  return res.status(200).json({"health":"all good!"});
});

module.exports = app;
