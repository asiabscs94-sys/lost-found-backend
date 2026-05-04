const mongoose = require('mongoose');
const Feedback = require('./models/Feedback');

const sampleFeedbacks = [
  {
    name: 'Sarah Khan',
    email: 'sarah@example.com',
    type: 'General Feedback',
    message: 'Absolutely love this platform! I found my lost wallet within 24 hours of reporting it. The tracking system is excellent and the interface is so easy to use.',
    rating: 5,
    status: 'resolved',
    isPublic: true,
    isSpam: false,
    adminReply: 'Thank you so much for your kind words, Sarah! We are thrilled that we could help you find your wallet.'
  },
  {
    name: 'Ahmed Ali',
    email: 'ahmed@example.com',
    type: 'Suggestion',
    message: 'Great service! One suggestion: it would be helpful to have push notifications for status updates instead of just email notifications.',
    rating: 4,
    status: 'resolved',
    isPublic: true,
    isSpam: false,
    adminReply: 'Excellent suggestion, Ahmed! Push notifications are on our roadmap and will be coming in a future update.'
  },
  {
    name: 'Fatima Zahra',
    email: 'fatima@example.com',
    type: 'General Feedback',
    message: 'The customer support team was incredibly helpful when I was trying to report my lost phone. They guided me through every step.',
    rating: 5,
    status: 'resolved',
    isPublic: true,
    isSpam: false,
    adminReply: 'We appreciate your feedback, Fatima! Our support team is always here to help.'
  },
  {
    name: 'Omar Hassan',
    email: 'omar@example.com',
    type: 'Bug Report',
    message: 'The photo upload feature was a bit slow on my mobile device, but everything else worked perfectly!',
    rating: 4,
    status: 'resolved',
    isPublic: true,
    isSpam: false,
    adminReply: 'Thank you for reporting this, Omar! We have optimized the upload feature for better mobile performance.'
  },
  {
    name: 'Zainab Qureshi',
    email: 'zainab@example.com',
    type: 'General Feedback',
    message: 'This is such a valuable service for the community. I was skeptical at first, but it really works! Found my laptop.',
    rating: 5,
    status: 'resolved',
    isPublic: true,
    isSpam: false,
    adminReply: 'Thank you, Zainab! We are glad to have been able to help you reunite with your laptop.'
  }
];

const seedFeedbacks = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lost-and-found');
    console.log('Connected to MongoDB');

    await Feedback.deleteMany({});
    console.log('Cleared existing feedbacks');

    const insertedFeedbacks = await Feedback.insertMany(sampleFeedbacks);
    console.log(`Successfully inserted ${insertedFeedbacks.length} sample feedbacks`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding feedbacks:', error);
    process.exit(1);
  }
};

seedFeedbacks();
