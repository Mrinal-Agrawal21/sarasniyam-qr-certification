const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  serialNumber: { type: String, required: true, unique: true },
  studentName: { type: String, required: true },
  course: String,
  position: String,
  issueDate: Date,
  createdAt: { type: Date, default: Date.now },
  qrPath: String // path to stored QR code image, optional
});

module.exports = mongoose.model('Certificate', CertificateSchema);
