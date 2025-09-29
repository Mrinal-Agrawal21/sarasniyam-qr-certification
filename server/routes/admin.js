const express = require('express');
const router = express.Router();
const controller = require('../controllers/certificateController');
const auth = require('../middleware/auth');

// Admin: create certificate
router.post('/certificate', auth, controller.createCertificate);

// Admin: list certificates
router.get('/certificates', auth, controller.listCertificates);

// Admin: preview next serial
router.get('/next-serial', auth, controller.nextSerial);

// Admin: delete by serial
router.delete('/certificate/:serialNumber', auth, controller.deleteCertificate);

router.get('/health', (req, res) => {
  res.send("Server is Healthy")
})

module.exports = router;
