const express = require('express');
const router = express.Router();
const User = require('../models/user');
const errorMessages = require('../errors/error-message');
const statusCodes = require('../statuscode/statuscode');

// a) Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users from the database
    res.status(statusCodes.OK).json(users);
  } catch (err) {
    return res.status(statusCodes.SERVER_ERROR).json({ error: errorMessages.SERVER_ERROR });
  }
});

// Create a new user
router.post('/users', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(statusCodes.BAD_REQUEST).json({ error: errorMessages.USERNAME_REQUIRED });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(statusCodes.CONFLICT).json({ error: errorMessages.USER_ALREADY_EXISTS });
    }

    // Create new user and save to the database
    const newUser = new User({ username, log: [] });
    await newUser.save();

    res.status(statusCodes.CREATED).json({
      username: newUser.username,
      _id: newUser._id,
      count: newUser.log.length,
      log: newUser.log
    });
  } catch (err) {
    return res.status(statusCodes.SERVER_ERROR).json({ error: errorMessages.SERVER_ERROR });
  }
});

// Add exercise to a specific user
router.post('/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body;
  let errorObj = {};

  // Validate description
  if (!description || typeof description !== 'string' || /^\d+$/.test(description)) {
    errorObj.description = errorMessages.DESCRIPTION_REQUIRED;
  }

  // Validate duration
  const parsedDuration = parseFloat(duration);
  if (!duration || isNaN(parsedDuration)) {
    errorObj.duration = errorMessages.DURATION_REQUIRED;
  }

  if (Object.keys(errorObj).length > 0) {
    return res.status(statusCodes.BAD_REQUEST).json({ error: errorObj });
  }

  try {
    // Find the user by ID
    const user = await User.findById(_id);
    if (!user) {
      return res.status(statusCodes.NOT_FOUND).json({ error: errorMessages.USER_NOT_FOUND });
    }

    // Use provided date or current date
    const exerciseDate = date ? new Date(date).toDateString() : new Date().toDateString();

    // Add the new exercise to the user's log
    user.log.push({
      description,
      duration: parsedDuration,
      date: exerciseDate
    });

    // Save the updated user
    await user.save();

    res.status(statusCodes.CREATED).json({
      username: user.username,
      _id: user._id,
      count: user.log.length,
      log: user.log
    });
  } catch (err) {
    return res.status(statusCodes.SERVER_ERROR).json({ error: errorMessages.SERVER_ERROR });
  }
});

// Get a user's exercise log
router.get('/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  try {
    // Find the user by ID
    const user = await User.findById(_id);
    if (!user) {
      return res.status(statusCodes.NOT_FOUND).json({ error: errorMessages.USER_NOT_FOUND });
    }

    let filteredLogs = user.log;

    // Filter by date range
    if (from) {
      const fromDate = new Date(from);
      filteredLogs = filteredLogs.filter(exercise => new Date(exercise.date) >= fromDate);
    }

    if (to) {
      const toDate = new Date(to);
      filteredLogs = filteredLogs.filter(exercise => new Date(exercise.date) <= toDate);
    }

    // Apply limit
    if (limit) {
      const limitNum = parseInt(limit);
      filteredLogs = filteredLogs.slice(0, limitNum);
    }

    const responseData = {
      username: user.username,
      count: filteredLogs.length,
      _id: user._id,
      log: filteredLogs
    };

    res.status(statusCodes.OK).json(responseData);
  } catch (err) {
    return res.status(statusCodes.SERVER_ERROR).json({ error: errorMessages.SERVER_ERROR });
  }
});

module.exports = router;
