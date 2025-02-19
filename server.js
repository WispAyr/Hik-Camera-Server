const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const db = require('./database');

// Initialize express app
const app = express();

// Add logging middleware
app.use(morgan('combined'));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Serve HTML content
app.get('/', async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Get events from database with any filters
    const filters = {
      licensePlate: req.query.licensePlate,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: 100 // Limit the number of events shown
    };

    const [eventsData, stats] = await Promise.all([
      db.getAllEvents(filters),
      db.getEventStats()
    ]);

  // Generate HTML content
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vehicle Detection Events - NOC Dashboard</title>
      <style>
        :root {
          --bg-primary: #1a1a1a;
          --bg-secondary: #2d2d2d;
          --text-primary: #ffffff;
          --text-secondary: #b3b3b3;
          --accent: #007bff;
          --border: #404040;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 20px;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .clock {
          font-size: 1.5em;
          font-weight: bold;
          color: var(--accent);
        }
        .camera-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .camera-section {
          background-color: var(--bg-secondary);
          border-radius: 8px;
          padding: 15px;
        }
        .camera-header {
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
          margin-bottom: 15px;
          color: var(--accent);
        }
        .event {
          background-color: var(--bg-primary);
          border: 1px solid var(--border);
          margin: 10px 0;
          padding: 15px;
          border-radius: 8px;
          transition: transform 0.2s;
        }
        .event:hover {
          transform: translateY(-2px);
        }
        .event img {
          max-width: 300px;
          height: auto;
          margin: 5px;
          border-radius: 4px;
        }
        .event-details {
          margin-top: 10px;
        }
        .event-details p {
          margin: 5px 0;
          color: var(--text-secondary);
        }
        .event-details strong {
          color: var(--text-primary);
        }
        .images-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }
      </style>
      <script>
        function updateClock() {
          const now = new Date();
          const clock = document.getElementById('clock');
          clock.textContent = now.toLocaleString();
        }

        function initializeRealtime() {
          // Update clock every second
          setInterval(updateClock, 1000);

          // Fetch new events every 5 seconds
          setInterval(() => {
            fetch(window.location.href)
              .then(response => response.text())
              .then(html => {
                const parser = new DOMParser();
                const newDoc = parser.parseFromString(html, 'text/html');
                const currentGrid = document.querySelector('.camera-grid');
                const newGrid = newDoc.querySelector('.camera-grid');
                if (newGrid) {
                  currentGrid.innerHTML = newGrid.innerHTML;
                }
              });
          }, 5000);
        }
      </script>
    </head>
    <body onload="initializeRealtime()">
      <div class="header">
        <h1>Vehicle Detection Events</h1>
        <div id="clock" class="clock"></div>
      </div>
      <div class="camera-grid">
      ${eventsData.map(event => `
        <div class="event">
          <div class="images-container">
            ${event.images?.licensePlate ? `<img src="/uploads/${event.images.licensePlate}" alt="License Plate Image">` : ''}
            ${event.images?.vehicle ? `<img src="/uploads/${event.images.vehicle}" alt="Vehicle Image">` : ''}
            ${event.images?.detection ? `<img src="/uploads/${event.images.detection}" alt="Detection Image">` : ''}
          </div>
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
      </div>
    </body>
    </html>
  `;
  
  res.send(html);
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
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
  { name: 'vehiclePicture.jpg', maxCount: 1 },
  { name: 'detectionPicture.jpg', maxCount: 1 }
]), async (req, res) => {
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

    // Get the uploaded files from all possible fields
    const uploadedFiles = {
      licensePlate: req.files?.['licensePlatePicture.jpg']?.[0],
      vehicle: req.files?.['vehiclePicture.jpg']?.[0],
      detection: req.files?.['detectionPicture.jpg']?.[0]
    };

    // Use the first available image file
    const uploadedFile = uploadedFiles.licensePlate || uploadedFiles.vehicle || uploadedFiles.detection;

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
      imageFile: uploadedFile ? uploadedFile.filename : null,
      // Store all image files if available
      images: {
        licensePlate: uploadedFiles.licensePlate?.filename || null,
        vehicle: uploadedFiles.vehicle?.filename || null,
        detection: uploadedFiles.detection?.filename || null
      }
    };

    // Save event to database
    await db.insertEvent(event);

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