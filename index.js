// index.js
const express = require('express');
const cors = require('cors'); 
const path = require('path');
const { put } = require('@vercel/blob'); // ✅ Import Vercel Blob SDK

const app = express();

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));

// Express parses standard json
app.use(express.json());

// ✅ FIX 1: Read incoming body as a raw stream buffer instead of letting multer drop it
app.use(express.raw({ type: 'multipart/form-data', limit: '20mb' }));

// ✅ Helper: Safely fetch the database array from your Vercel Blob bucket
const readDatabaseFromBlob = async () => {
  try {
    const url = `${process.env.BLOB_DATABASE_URL}?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error reading database from Blob:', error);
    return []; 
  }
};

// ✅ Helper: Overwrite the database JSON file inside your Vercel Blob bucket
const writeDatabaseToBlob = async (data) => {
  try {
    const jsonBuffer = Buffer.from(JSON.stringify(data, null, 2));
    await put('database.json', jsonBuffer, {
      access: 'public',
      addRandomSuffix: false, 
    });
  } catch (error) {
    console.error('Error writing database to Blob:', error);
  }
};

// 2. POST API ENDPOINT - Serverless Optimized Image and Text Payload Processing
app.post('/api/movies', async (req, res) => {
  try {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ message: 'Invalid Content-Type framework pattern.' });
    }

    // Extract the multi-part payload boundary token string map
    const boundaryMatch = contentType.match(/boundary=(.+)\$/);
    if (!boundaryMatch) {
      return res.status(400).json({ message: 'Missing multipart boundary.' });
    }
    const boundary = boundaryMatch[1];

    // Convert raw body stream blocks to parse data strings cleanly
    const rawBodyText = req.body.toString('binary');
    const parts = rawBodyText.split(`--${boundary}`);

    let fields = {};
    let fileBuffer = null;
    let fileName = 'ticket.jpg';
    let fileMimeType = 'image/jpeg';

    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;

      const [headerSection, bodySectionWithEnding] = part.split('\r\n\r\n');
      if (!bodySectionWithEnding) continue;

      // Strip structural transport line breaks from extracted block string metrics
      let bodySection = bodySectionWithEnding;
      if (bodySection.endsWith('\r\n')) {
        bodySection = bodySection.slice(0, -2);
      }

      const nameMatch = headerSection.match(/name="([^"]+)"/);
      if (!nameMatch) continue;
      const fieldName = nameMatch[1];

      if (fieldName === 'ticketImage') {
        const filenameMatch = headerSection.match(/filename="([^"]+)"/);
        if (filenameMatch) fileName = filenameMatch[1];

        const typeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
        if (typeMatch) fileMimeType = typeMatch[1];

        // Convert the structural text sequence chunk straight back into clean binary data
        fileBuffer = Buffer.from(bodySection, 'binary');
      } else {
        fields[fieldName] = Buffer.from(bodySection, 'binary').toString('utf8');
      }
    }

    const { phone, email, movieName, movieDateTime } = fields;

    // Check if variables or binary records passed validations
    if (!phone || !email || !movieName || !movieDateTime || !fileBuffer) {
      return res.status(400).json({ message: 'All form fields and image are required.' });
    }

    // A. Upload the Ticket Image to Vercel Blob Storage directly from RAM memory blocks
    const uniqueImageName = `uploads/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    const imageBlob = await put(uniqueImageName, fileBuffer, {
      access: 'public',
      contentType: fileMimeType
    });

    // B. Fetch logs array stream data, append tracking entry block, map adjustments back to cloud bucket
    const currentBookings = await readDatabaseFromBlob();

    const newBooking = {
      id: Date.now().toString(),
      phone,
      email,
      movieName,
      movieDateTime,
      ticketImagePath: imageBlob.url, 
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

// 3. GET API ENDPOINT - Retrieve all bookings directly from Blob Storage
app.get('/api/movies', async (req, res) => {
  const data = await readDatabaseFromBlob();
  return res.status(200).json(data);
});

// 4. GET API ENDPOINT - Health
app.get('/api/health', async (req, res) => {
  return res.status(200).json({ "health": "all good!" });
});

module.exports = app;
