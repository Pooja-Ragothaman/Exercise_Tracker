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


// Get a user's exercise log
// router.get('/users/:_id/logs', async (req, res) => {
//   const { _id } = req.params;
//   const { from, to, limit } = req.query;

//   try {
//     // Step 1: Find the user by ID
//     const user = await User.findById(_id);
//     if (!user) {
//       return res.status(statusCodes.NOT_FOUND).json({ error: errorMessages.USER_NOT_FOUND });
//     }

//     // Step 2: Prepare date filters
//     const dateFilter = {};
//     if (from) {
//       const fromDate = new Date(from);
//       fromDate.setHours(0, 0, 0, 0);
//       if (isNaN(fromDate.getTime())) {
//         return res.status(statusCodes.BAD_REQUEST).json({ error: errorMessages.INVALID_DATE });
//       }
//       dateFilter.$gte = fromDate;
//     }

//     if (to) {
//       const toDate = new Date(to);
//       toDate.setHours(23, 59, 59, 999); 
//       if (isNaN(toDate.getTime())) {
//         return res.status(statusCodes.BAD_REQUEST).json({ error: errorMessages.INVALID_DATE });
//       }
//       dateFilter.$lte = toDate;
//     }

//     // Step 3: Filter logs based on date range
//     const filteredLogs = user.log.filter((log) => {
//       const logDate = new Date(log.date);
//       const isAfterFrom = dateFilter.$gte ? logDate >= dateFilter.$gte : true;
//       const isBeforeTo = dateFilter.$lte ? logDate <= dateFilter.$lte : true;
//       return isAfterFrom && isBeforeTo;
//     });

//     // Step 4: Calculate the total count of logs after filtering
//     const totalCount = filteredLogs.length;

//     // Step 5: Sort the logs by date
//     filteredLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

//     // Step 6: Apply the limit if provided
//     const limitedLogs = limit ? filteredLogs.slice(0, parseInt(limit, 10)) : filteredLogs;

//     // Step 7: Prepare the response
//     const responseData = {
//       username: user.username,
//       count: totalCount, // Reflect the count of logs in the filtered range
//       _id: user._id,
//       log: limitedLogs, // Include only the logs within the limit
//     };

//     // Step 8: Send the response
//     res.status(statusCodes.OK).json(responseData);
//   } catch (err) {
//     // Handle server errors
//     res.status(statusCodes.SERVER_ERROR).json({ error: errorMessages.SERVER_ERROR });
//   }
// });


router.get('/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;  

  try {
    
    const dateFilter = {};
    if (from) {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0); 
      if (isNaN(fromDate.getTime())) {
        return res.status(statusCodes.BAD_REQUEST).json({ error: errorMessages.INVALID_DATE });
      }
      dateFilter.$gte = fromDate; 
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999); 
      if (isNaN(toDate.getTime())) {
        return res.status(statusCodes.BAD_REQUEST).json({ error: errorMessages.INVALID_DATE });
      }
      dateFilter.$lte = toDate; 
    }

    const user = await User.findOne(
      { _id, "log.date": { $gte: dateFilter.$gte || new Date(0), $lte: dateFilter.$lte || new Date() } },  // Match the user and filter by date range
      { log: 1 } // Only return the "log" field
    );

    if (!user) {
      return res.status(statusCodes.NOT_FOUND).json({ error: errorMessages.USER_NOT_FOUND });
    }
    const filteredLogs = user.log.filter((log) => {
      const logDate = new Date(log.date);
      const isAfterFrom = dateFilter.$gte ? logDate >= dateFilter.$gte : true;
      const isBeforeTo = dateFilter.$lte ? logDate <= dateFilter.$lte : true;
      return isAfterFrom && isBeforeTo;
    });

    filteredLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    const totalCount=filteredLogs.length;
    const limitedLogs = filteredLogs.slice(0, parseInt(limit));
    const responseData = {
      username: user.username,
      _id: user._id,
      count: totalCount,
      log: limitedLogs,
    };
    res.status(statusCodes.OK).json(responseData);
  } catch (err) {
    res.status(statusCodes.SERVER_ERROR).json({ error: errorMessages.SERVER_ERROR });
  }
});





module.exports = router;
