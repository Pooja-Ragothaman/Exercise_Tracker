const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define Exercise Schema
const exerciseSchema = new Schema({
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: String, required: true }
  }, { _id: false });

// Define User Schema without manual ID assignment
const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  log: [exerciseSchema]
}, { versionKey: false });

module.exports = mongoose.model('User', userSchema);
