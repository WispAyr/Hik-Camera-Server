const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Initialize express app
const app = express();

// Add logging middleware
app.use(morgan('combined'));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Serve HTML content
app.get('/', (req, res) => {
  const eventsData = [];
  const uploadDir = path.join(__dirname, 'uploads');
  
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Read all event files
  const eventFiles = fs.readdirSync(uploadDir).filter(file => file.endsWith('.json'));
  
  for (const file of eventFiles) {
    const eventData = JSON.parse(fs.readFileSync(path.join(uploadDir, file), 'utf8'));
    eventsData.push(eventData);
  }

  // Generate HTML content
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vehicle Detection Events</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .event { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .event img { max-width: 400px; height: auto; margin-top: 10px; }
        .event-details { margin-top: 10px; }
        .event-details p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <h1>Vehicle Detection Events</h1>
      ${eventsData.map(event => `
        <div class="event">
          ${event.imageFile ? `<img src="/uploads/${event.imageFile}" alt="Vehicle Image">` : ''}
          <div class="event-details">
            <p><strong>License Plate:</strong> ${event.licensePlate}</p>
            <p><strong>Date/Time:</strong> ${event.dateTime}</p>
            <p><strong>Channel ID:</strong> ${event.channelID}</p>
            <p><strong>Event Type:</strong> ${event.eventType}</p>
            <p><strong>Country:</strong> ${event.country || 'N/A'}</p>
            <p><strong>Lane:</strong> ${event.lane || 'N/A'}</p>
            <p><strong>Direction:</strong> ${event.direction || 'N/A'}</p>
            <p><strong>Confidence Level:</strong> ${event.confidenceLevel || 'N/A'}</p>
            <p><strong>MAC Address:</strong> ${event.macAddress || 'N/A'}</p>
          </div>
        </div>
      `).join('')}
    </body>
    </html>
  `;
  
  res.send(html);
});

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Get license plate from query params for filename
    const licensePlate = req.query.licensePlate || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = path.extname(file.originalname);
    // Create filename with license plate and timestamp
    const filename = `${licensePlate}_${timestamp}${fileExt}`;
    cb(null, filename);
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

// Handle vehicle detection events for both root and /hik paths
app.post(['/', '/hik'], upload.fields([
  { name: 'licensePlatePicture.jpg', maxCount: 1 },
  { name: 'vehiclePicture.jpg', maxCount: 1 }
]), (req, res) => {
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

    // Get the uploaded file (from either field name)
    const uploadedFile = req.files?.['licensePlatePicture.jpg']?.[0] || req.files?.['vehiclePicture.jpg']?.[0];

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
      imageFile: uploadedFile ? uploadedFile.filename : null
    };

    // Save event data to JSON file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const eventFileName = `${licensePlate}_${timestamp}.json`;
    fs.writeFileSync(
      path.join(__dirname, 'uploads', eventFileName),
      JSON.stringify(event, null, 2)
    );

    // Log the event
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
  console.log(`View the dashboard at http://localhost:${PORT}`);
  console.log(`Waiting for vehicle detection events...`);
});