const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); 

const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video') {
      cb(null, 'uploads/videos/'); // Store videos in 'uploads/videos/'
    } else if (file.fieldname === 'pilotEvidence') {
      cb(null, 'uploads/pilotEvidence/'); // Store pilot evidence in 'uploads/pilotEvidence/'
    } else {
      cb(new Error('Invalid field name'), null);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Timestamp + file extension
  },
});
const upload = multer({ storage });

// Define a schema and model for the form data
const formDataSchema = new mongoose.Schema({
  companyName: String,
  representativeName: String,
  phoneNumber: String,
  email: String,
  teamMembers: String,
  idea: String,
  isRegistered: String,
  founders: String,
  operationTime: String,
  companyType: String,
  hasTeam: String,
  problemStatement: String,
  uniqueProduct: String,
  legalRequirements: String,
  currentStage: String,
  hasFunding: String,
  fundingDetails: String,
  hasAwards: String,
  awardsDetails: String,
  targetCustomers: String,
  hasPrototype: String,
  hasPilot: String,
  pilotEvidence: String,
  runway: String,
  video: String,
  paymentStatus: { type: Boolean, default: false }, // Added paymentStatus field

});

const FormData = mongoose.model('FormData', formDataSchema);

app.post('/api/startup', upload.fields([
  { name: 'pilotEvidence', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const formData = new FormData({
      ...req.body,
      pilotEvidence: req.files.pilotEvidence ? req.files.pilotEvidence[0].path : '',
      video: req.files.video ? req.files.video[0].path : '',
    });

    await formData.save();
    res.status(201).json({ message: 'Form data saved successfully' });
  } catch (error) {
    console.error('Error saving form data:', error);
    res.status(500).json({ message: 'Error saving form data' });
  }
});

app.get('/api/startups', async (req, res) => {
  try {
    const registrations = await FormData.find();
    res.status(200).json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ message: 'Error fetching registrations' });
  }
});

app.get('/api/registration-status', async (req, res) => {
  try {
    const count = await FormData.countDocuments();
    if (count >= 45) {
      return res.status(200).json({ maxReached: true, count });
    }
    res.status(200).json({ maxReached: false, count });
  } catch (error) {
    console.error('Error fetching registration status:', error);
    res.status(500).json({ message: 'Error fetching registration status', error });
  }
});

app.use('/uploads/videos', express.static(path.join(__dirname, 'uploads/videos')));
app.use('/uploads/pilotEvidence', express.static(path.join(__dirname, 'uploads/pilotEvidence')));




app.get('/', (req, res) => {
  res.send('Hello World');
});



app.post('/api/payment/verify-email', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await FormData.findOne({ email: email }); 
    if (user) {
      return res.status(200).json({ exists: true });
    } else {
      return res.status(404).json({ exists: false, message: 'Email does not exist' });
    }
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/payment/order', async (req, res) => {
  try {
    const { amount, email } = req.body; 

    const existingUser = await FormData.findOne({ email: email });
    
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'Email does not exist' });
    }

    const options = {
      amount: amount * 100, 
      currency: 'INR',
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.log('Error in creating Razorpay order:', error);
    res.status(500).json({ message: 'Failed to create Razorpay order', error });
  }
});


const crypto = require('crypto');

app.post('/api/payment/verify', async (req, res) => {
  const { order_id, payment_id, razorpay_signature, email } = req.body;
  console.log('Received verification request:', req.body);

  const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  shasum.update(order_id + '|' + payment_id);
  const digest = shasum.digest('hex');

  if (digest === razorpay_signature) {
    try {
      const updatedForm = await FormData.findOneAndUpdate(
        { email: email }, 
        { paymentStatus: true },
        { new: true }
      );

      if (!updatedForm) {
        return res.status(404).json({ success: false, message: 'Form not found' });
      }

      res.status(200).json({ success: true, message: 'Payment verified and updated successfully' });
    } catch (error) {
      console.error('Error updating payment status:', error);
      res.status(500).json({ success: false, message: 'Error updating payment status' });
    }
  } else {
    res.status(400).json({ success: false, message: 'Payment verification failed' });
  }
});





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
