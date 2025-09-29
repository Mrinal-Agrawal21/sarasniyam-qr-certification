require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Connect DB
connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/certdb');

// Routes
const certRoutes = require('./routes/certificates');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
app.use('/api/certificate', certRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

// Serve uploaded QR images static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
