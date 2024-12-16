const express = require('express');
const router = express.Router();
const User = require('../models/user');
const errorMessages = require('../errors/error-message');
const statusCodes = require('../statuscode/statuscode');
const mongoose = require('mongoose');

// a) Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users from the database
    res.status(statusCodes.OK).json(users);
  } catch (err) {
    return res.status(statusCodes.SERVER_ERROR).json({ error: errorMessages.FAILED_TO_FETCH_USER });
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
  } else if (parsedDuration <= 0) {
    errorObj.duration = errorMessages.DURATION_NEGATIVE;
  }

  if (Object.keys(errorObj).length > 0) {
    return res.status(statusCodes.BAD_REQUEST).json({ error: errorObj });
  }

  // Validate date
if (date) {
  // Ensure date is in YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    errorObj.date = errorMessages.INVALID_DATE; // Custom error message
  } else {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime()) || date !== parsedDate.toISOString().split("T")[0]) {
      errorObj.date = errorMessages.INVALID_DATE; // Custom error message
    }
  }
}

// Check if there are any validation errors and prevent saving the data if invalid
if (Object.keys(errorObj).length > 0) {
  return res.status(400).json({ error: errorObj });
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


router.get("/users/:_id/logs", async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  try {
    // Validate _id
    const userId = mongoose.Types.ObjectId.isValid(_id) ? new mongoose.Types.ObjectId(_id) : _id;

    // Validate Dates
    const isValidDate = (date) => !isNaN(new Date(date).getTime());
    if (from && !isValidDate(from)) {
      return res.status(400).json({ error: errorMessages.INVALID_DATE_FORMAT });
    }
    if (to && !isValidDate(to)) {
      return res.status(400).json({ error: errorMessages.INVALID_DATE_FORMAT });
    }

    // Build the aggregation pipeline
    const pipeline = [
      { $match: { _id: userId } },
      {
        $project: {
          username: 1,
          log: {
            $filter: {
              input: "$log",
              as: "log",
              cond: {
                $and: [
                  from
                    ? {
                        $gte: [
                          { $dateFromString: { dateString: "$$log.date" } }, // Convert string to Date for comparison
                          new Date(from),
                        ],
                      }
                    : {},
                  to
                    ? {
                        $lte: [
                          { $dateFromString: { dateString: "$$log.date" } }, // Convert string to Date for comparison
                          new Date(to),
                        ],
                      }
                    : {},
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          count: { $size: "$log" },
          log: limit ? { $slice: ["$log", parseInt(limit, 10)] } : "$log",
        },
      },
    ];

    // Execute the pipeline
    const result = await User.aggregate(pipeline);

    // If no user found
    if (!result.length) {
      return res.status(404).json({ error: errorMessages.USER_NOT_FOUND });
    }

    // Return the filtered and limited logs
    const user = result[0];
    res.status(200).json({
      username: user.username,
      _id: user._id,
      count: user.count,
      log: user.log,
    });
  } catch (err) {
    res.status(500).json({ error: errorMessages.SERVER_ERROR, details: err.message });
  }
});


module.exports = router;
