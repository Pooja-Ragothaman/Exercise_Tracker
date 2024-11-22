const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log("connection string",process.env.CONNECTION)
        const connect = await mongoose.connect(process.env.CONNECTION);

        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1); // Exit process if the connection fails
    }
};

module.exports = connectDB;
