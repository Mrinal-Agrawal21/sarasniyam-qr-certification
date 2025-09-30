const Certificate = require('../models/Certificate');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const Counter = require('../models/Counter');
const cloudinary = require('../config/cloudinary');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'qr');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function generateSerial() {
  const year = new Date().getFullYear();
  // try up to 50 increments to find an unused serial
  for (let i = 0; i < 50; i++) {
    const counter = await Counter.findOneAndUpdate(
      { name: 'serial', year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const candidate = `C-${year}-${String(counter.seq).padStart(4, '0')}`;
    const exists = await Certificate.findOne({ serialNumber: candidate }).lean();
    if (!exists) return candidate;
  }
  throw new Error('Unable to allocate unique serial');
}

// Admin: create certificate and generate QR
exports.createCertificate = async (req, res) => {
  try {
    let { serialNumber, studentName, course, position, issueDate } = req.body;
    if (!studentName) return res.status(400).json({ message: 'studentName required' });

    // Auto-generate serial if not provided
    if (!serialNumber) {
      serialNumber = await generateSerial();
    }

    const exists = await Certificate.findOne({ serialNumber });
    if (exists) return res.status(409).json({ message: 'serialNumber already exists' });

    const cert = new Certificate({ serialNumber, studentName, course, position, issueDate });

    // QR: we direct to frontend verify page — student will still input serial.
    const verifyUrl = `${process.env.BASE_URL || 'http://localhost:5173'}/verify`;

    // Generate QR as Data URL (PNG)
    const dataUrl = await QRCode.toDataURL(verifyUrl, { type: 'image/png', margin: 1, scale: 8 });
    // Upload to Cloudinary
    const uploadRes = await cloudinary.uploader.upload(dataUrl, {
      folder: process.env.CLOUDINARY_FOLDER || 'certificates/qr',
      public_id: serialNumber,
      overwrite: true,
      resource_type: 'image'
    });
    cert.qrUrl = uploadRes.secure_url;
    cert.qrPublicId = uploadRes.public_id;
    // Keep legacy path blank in cloud mode
    cert.qrPath = undefined;

    await cert.save();

    res.status(201).json({ message: 'Certificate created', certificate: cert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: delete certificate by serial and remove QR file
exports.deleteCertificate = async (req, res) => {
  try {
    const serial = req.params.serialNumber;
    const cert = await Certificate.findOneAndDelete({ serialNumber: serial });
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });

    // Remove Cloudinary asset if exists
    if (cert.qrPublicId) {
      try {
        await cloudinary.uploader.destroy(cert.qrPublicId);
      } catch (e) {
        console.error('Cloudinary delete failed:', e.message);
      }
    }
    // Remove local QR image if exists (legacy)
    if (cert.qrPath) {
      const filePath = path.join(__dirname, '..', cert.qrPath.replace(/^\/+/, ''));
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('Failed to delete QR file:', err.message);
      });
    }

    res.json({ message: 'Deleted', serialNumber: serial });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: get certificate by serial
exports.getCertificateBySerial = async (req, res) => {
  try {
    const serial = req.params.serialNumber;
    const cert = await Certificate.findOne({ serialNumber: serial });
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    res.json(cert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: list certificates (simple)
exports.listCertificates = async (req, res) => {
  try {
    const certs = await Certificate.find().sort({ createdAt: -1 }).limit(200);
    res.json(certs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: preview next serial without creating
exports.nextSerial = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const doc = await Counter.findOne({ name: 'serial', year }).lean();
    const base = doc?.seq || 0;
    // look ahead up to 50 numbers to find an unused one without consuming counter
    for (let i = 1; i <= 50; i++) {
      const candidate = `C-${year}-${String(base + i).padStart(4, '0')}`;
      const exists = await Certificate.findOne({ serialNumber: candidate }).lean();
      if (!exists) return res.json({ serial: candidate });
    }
    return res.status(409).json({ message: 'No available serial found, try again' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
