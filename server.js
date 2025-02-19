const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Initialize express app
const app = express();

// Add logging middleware
app.use(morgan('combined'));

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use original filename from the camera
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only jpeg images
    if (file.mimetype !== 'image/jpeg') {
      return cb(new Error('Only JPEG images are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Handle vehicle detection events
app.post('/hik', upload.single('licensePlatePicture.jpg'), (req, res) => {
  try {
    // Extract query parameters
    const {
      channelID,
      dateTime,
      eventType,
      country,
      licensePlate,
      lane,
      direction,
      confidenceLevel,
      macAddress
    } = req.query;

    // Validate required parameters
    if (!channelID || !dateTime || !eventType || !licensePlate) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    // Create event object with all data
    const event = {
      channelID,
      dateTime,
      eventType,
      country,
      licensePlate,
      lane,
      direction,
      confidenceLevel,
      macAddress,
      imageFile: req.file ? req.file.filename : null
    };

    // Log the event (you can replace this with your desired processing logic)
    console.log('Received vehicle detection event:', event);

    // Send success response
    res.status(200).json({
      status: 'success',
      message: 'Vehicle detection event processed successfully',
      event
    });
  } catch (error) {
    console.error('Error processing vehicle detection event:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start the server
const PORT = 9001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Waiting for vehicle detection events...`);
});